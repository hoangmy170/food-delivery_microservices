import os
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import SessionLocal, engine, Base
import models

# Tạo lại bảng nếu chưa có (Lưu ý: Nếu bảng cũ thiếu cột, nên xóa bảng cũ đi để code tự tạo lại)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# URL các service khác
RESTAURANT_SERVICE_URL = os.getenv("RESTAURANT_SERVICE_URL", "http://restaurant_service:8002")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- INPUT MODELS ---
class OrderItemCreate(BaseModel):
    food_id: int
    quantity: int

class OrderCreate(BaseModel):
    branch_id: int
    items: List[OrderItemCreate]
    coupon_code: Optional[str] = None
    
    # Thông tin khách hàng đầy đủ
    user_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    delivery_address: str
    note: Optional[str] = None

# ==========================================
# API 1: TẠO ĐƠN HÀNG (/checkout)
# ==========================================
@app.post("/checkout")
async def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    total_price = 0
    order_items_data = []

    async with httpx.AsyncClient() as client:
        # 1. Tính tiền (Gọi Restaurant Service lấy giá gốc)
        for item in payload.items:
            try:
                resp = await client.get(f"{RESTAURANT_SERVICE_URL}/foods/{item.food_id}")
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Món ăn ID {item.food_id} lỗi.")
                
                food_data = resp.json()
                # Giá = Giá gốc * (1 - %giảm/100)
                final_item_price = food_data['price'] * (1 - food_data.get('discount', 0)/100)
                total_price += final_item_price * item.quantity

                order_items_data.append({
                    "food_id": item.food_id,
                    "food_name": food_data['name'],
                    "price": final_item_price,
                    "quantity": item.quantity
                })
            except Exception:
                raise HTTPException(status_code=503, detail="Lỗi kết nối Restaurant Service")

        # 2. Xử lý Coupon
        discount_amount = 0
        if payload.coupon_code:
            try:
                coupon_resp = await client.get(
                    f"{RESTAURANT_SERVICE_URL}/coupons/verify", 
                    params={"code": payload.coupon_code, "branch_id": payload.branch_id}
                )
                if coupon_resp.status_code == 200:
                    data = coupon_resp.json()
                    discount_amount = (total_price * data['discount_percent']) / 100
            except: pass

        final_price = max(0, total_price - discount_amount)

    # 3. Lưu Order vào DB
    new_order = models.Order(
        user_id=payload.user_id,          # Lưu ID người mua
        user_name=payload.customer_name,  # Lưu tên người nhận
        branch_id=payload.branch_id,
        customer_phone=payload.customer_phone,
        delivery_address=payload.delivery_address,
        note=payload.note,
        total_price=final_price,
        coupon_code=payload.coupon_code,
        discount_amount=discount_amount,
        status="PENDING_PAYMENT"
    )
    
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Lưu Order Items
    for item in order_items_data:
        new_item = models.OrderItem(
            order_id=new_order.id,
            food_id=item['food_id'],
            food_name=item['food_name'],
            price=item['price'],
            quantity=item['quantity']
        )
        db.add(new_item)
    
    db.commit()

    return {
        "order_id": new_order.id, 
        "total_price": final_price, 
        "status": "PENDING_PAYMENT"
    }

# ==========================================
# CÁC API KHÁC (ĐẢM BẢO KHÔNG BỊ THIẾU)
# ==========================================

# Lấy danh sách tất cả đơn (Dành cho Admin/Seller)
# Sửa lại hàm get_orders trong order_service/main.py

@app.get("/orders")
def get_orders(branch_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Order)
    
    # Nếu có branch_id thì lọc, không thì lấy hết (cho Admin tổng)
    if branch_id:
        query = query.filter(models.Order.branch_id == branch_id)
    
    # Sắp xếp đơn mới nhất lên đầu
    return query.order_by(models.Order.created_at.desc()).all()

# Lấy lịch sử đơn hàng của 1 user (Dành cho Buyer xem "Đơn của tôi")
@app.get("/orders/my-orders")
def get_my_orders(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Order).filter(models.Order.user_id == user_id).order_by(models.Order.created_at.desc()).all()

# Lấy chi tiết 1 đơn hàng
@app.get("/orders/{order_id}")
def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# Cập nhật trạng thái thanh toán (Payment Service gọi)
@app.put("/orders/{order_id}/paid")
def mark_order_paid(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = "PAID"
    db.commit()
    return {"message": "Order paid"}

# Cập nhật trạng thái giao hàng (Seller gọi: Shipping, Delivered...)
@app.put("/orders/{order_id}/status")
def update_status(order_id: int, status: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    db.commit()
    return {"message": f"Updated to {status}"}
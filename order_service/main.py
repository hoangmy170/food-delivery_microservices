import os
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware # <--- THÊM CORS
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from database import SessionLocal, engine, Base
import models

# Tạo bảng
Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CẤU HÌNH CORS (BẮT BUỘC ĐỂ FRONTEND GỌI ĐƯỢC) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cấu hình URL (Mặc định Localhost để chạy máy cá nhân)
RESTAURANT_SERVICE_URL = os.getenv("RESTAURANT_SERVICE_URL", "http://localhost:8002")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8006")

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
    user_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    delivery_address: str
    note: Optional[str] = None

# --- API ---

@app.post("/checkout")
async def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    total_price = 0
    order_items_data = []

    async with httpx.AsyncClient() as client:
        # 1. Tính tiền & Lấy thông tin món
        for item in payload.items:
            try:
                # Gọi sang Restaurant Service để lấy giá và ảnh
                resp = await client.get(f"{RESTAURANT_SERVICE_URL}/foods/{item.food_id}")
                if resp.status_code != 200:
                    print(f"Lỗi lấy món ID {item.food_id}")
                    continue 
                
                food_data = resp.json()
                # Tính giá sau giảm (nếu món đó có giảm giá riêng)
                discount = food_data.get('discount', 0) or 0
                final_item_price = food_data['price'] * (1 - discount/100)
                total_price += final_item_price * item.quantity

                order_items_data.append({
                    "food_id": item.food_id,
                    "food_name": food_data['name'],
                    "price": final_item_price,
                    "quantity": item.quantity,
                    "image_url": food_data.get('image_url', '') # Lưu ảnh để hiện ở lịch sử/dashboard
                })
            except Exception as e:
                print(f"Lỗi kết nối Restaurant Service: {e}")
                # Nếu lỗi kết nối, tạm thời bỏ qua món đó hoặc raise lỗi tùy bạn
                # raise HTTPException(status_code=503, detail="Lỗi kết nối Restaurant Service")

        # 2. Xử lý Coupon (Mã giảm giá đơn hàng)
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
        user_id=payload.user_id,
        user_name=payload.customer_name,
        branch_id=payload.branch_id,
        customer_phone=payload.customer_phone,
        delivery_address=payload.delivery_address,
        note=payload.note,
        total_price=final_price,
        coupon_code=payload.coupon_code,
        discount_amount=discount_amount,
        status="PENDING" # Đổi thành PENDING thay vì PENDING_PAYMENT cho khớp Frontend check
    )
    
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Lưu chi tiết món ăn
    for item in order_items_data:
        new_item = models.OrderItem(
            order_id=new_order.id,
            food_id=item['food_id'],
            food_name=item['food_name'],
            price=item['price'],
            quantity=item['quantity'],
            image_url=item['image_url']
        )
        db.add(new_item)
    
    db.commit()

    # 4. Gửi thông báo (Tùy chọn)
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{NOTIFICATION_SERVICE_URL}/notify", json={
                "branch_id": payload.branch_id,
                "message": "NEW_ORDER" 
            })
    except: pass

    return {"order_id": new_order.id, "total_price": final_price, "status": "PENDING"}

# --- API LẤY ĐƠN HÀNG (SỬA LẠI ĐỂ KHỚP FRONTEND) ---

# 1. API cũ của bạn (giữ nguyên để không ảnh hưởng cái khác)
@app.get("/orders")
def get_orders(branch_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Order).options(joinedload(models.Order.items))
    if branch_id:
        q = q.filter(models.Order.branch_id == branch_id)
    return q.order_by(models.Order.created_at.desc()).all()

# 2. [QUAN TRỌNG] API MỚI CHO FRONTEND REACT GỌI
@app.get("/orders/branch/{branch_id}")
def get_orders_by_branch(branch_id: int, db: Session = Depends(get_db)):
    # Frontend gọi: api.get(`/orders/branch/${branchId}`)
    orders = db.query(models.Order)\
               .options(joinedload(models.Order.items))\
               .filter(models.Order.branch_id == branch_id)\
               .order_by(models.Order.created_at.desc())\
               .all()
    return orders

@app.get("/orders/my-orders")
def get_my_orders(user_id: int, db: Session = Depends(get_db)):
    orders = db.query(models.Order).options(joinedload(models.Order.items))\
                .filter(models.Order.user_id == user_id)\
                .order_by(models.Order.created_at.desc()).all()
    return orders

@app.get("/orders/{order_id}")
def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).options(joinedload(models.Order.items))\
              .filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.put("/orders/{order_id}/paid")
def mark_paid(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order:
        order.status = "PAID"
        db.commit()
    return {"status": "updated"}

@app.put("/orders/{order_id}/status")
def update_status(order_id: int, status: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    db.commit()
    return {"message": f"Updated to {status}"}
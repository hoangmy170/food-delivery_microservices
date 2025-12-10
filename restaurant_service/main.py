import httpx
import shutil
import os
import uuid
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Request, File, UploadFile, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware # <--- THÊM CÁI NÀY
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models
from typing import List, Optional
from pydantic import BaseModel 

Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- 1. CẤU HÌNH CORS (BẮT BUỘC ĐỂ FRONTEND GỌI ĐƯỢC) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CẤU HÌNH THƯ MỤC ẢNH ---
os.makedirs("static", exist_ok=True)
# Mount đường dẫn /static để xem ảnh
app.mount("/static", StaticFiles(directory="static"), name="static")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def verify_user(request: Request):
    token = request.headers.get("Authorization")
    if not token: raise HTTPException(401, "Missing Token")
    try:
        async with httpx.AsyncClient() as client:
            # Lưu ý: Nếu chạy local không qua docker thì sửa thành localhost:8001
            # Nếu chạy Docker thì giữ nguyên user_service:8001
            res = await client.get("http://user_service:8001/verify", headers={"Authorization": token})
            if res.status_code != 200: raise HTTPException(401, "Invalid Token")
            return res.json()
    except Exception as e: 
        print(f"Lỗi verify user: {e}")
        raise HTTPException(401, "Token verification failed")

# --- API MÓN ĂN ---
@app.post("/foods")
async def create_food(
    request: Request,
    name: str = Form(...),
    price: float = Form(...),
    discount: int = Form(0),
    branch_id: int = Form(...), # Nhận thêm branch_id từ form cho chắc
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    user = await verify_user(request)
    if user['role'] != 'seller': raise HTTPException(403, "Only Seller")
    
    # Logic lưu ảnh
    image_url = ""
    if image:
        file_extension = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_extension}"
        file_path = f"static/{file_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        # Lưu đường dẫn tương đối
        image_url = f"/static/{file_name}"

    new_food = models.Food(
        name=name, 
        price=price, 
        branch_id=branch_id, # Dùng branch_id gửi lên hoặc từ user
        discount=discount,
        image_url=image_url,
        is_active=True
    )
    db.add(new_food)
    db.commit()
    db.refresh(new_food)
    return new_food

@app.put("/foods/{food_id}")
async def update_food(
    food_id: int,
    request: Request,
    name: str = Form(...),
    price: float = Form(...),
    discount: int = Form(0),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    user = await verify_user(request)
    
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if not food: raise HTTPException(404, "Food not found")
    
    # Cập nhật thông tin
    food.name = name
    food.price = price
    food.discount = discount

    if image:
        file_extension = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_extension}"
        file_path = f"static/{file_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        food.image_url = f"/static/{file_name}"
    
    db.commit()
    db.refresh(food)
    return food

@app.delete("/foods/{food_id}")
async def delete_food(food_id: int, request: Request, db: Session = Depends(get_db)):
    user = await verify_user(request)
    item = db.query(models.Food).filter(models.Food.id == food_id).first()
    if not item: raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}

# --- API LẤY MÓN ĂN (QUAN TRỌNG: PHẢI CÓ GET BY BRANCH) ---
@app.get("/foods/branch/{branch_id}")
def get_foods_by_branch(branch_id: int, db: Session = Depends(get_db)):
    foods = db.query(models.Food).filter(models.Food.branch_id == branch_id).all()
    return foods

@app.get("/foods/{food_id}")
def get_food_detail(food_id: int, db: Session = Depends(get_db)):
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if not food: raise HTTPException(404, "Not found")
    return food

# --- CÁC API KHÁC GIỮ NGUYÊN (Search, Options, Branch...) ---
# (Bạn giữ lại phần code Search, Options, Coupon bên dưới của file cũ nhé, 
# nhưng nhớ đảm bảo tất cả đều nằm dưới app = FastAPI() đã có CORS)

# ... [Phần code Search, Coupon, Branch cũ của bạn copy vào đây] ...
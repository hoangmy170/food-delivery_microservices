from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    
    # Người mua
    user_id = Column(Integer, index=True, nullable=True) # ID tài khoản (nếu có)
    user_name = Column(String(100)) # Tên người nhận hàng
    
    # Thông tin đơn
    branch_id = Column(Integer, index=True)
    total_price = Column(Float)
    status = Column(String(50), default="PENDING_PAYMENT")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Giao hàng & Ghi chú (Đã bổ sung đầy đủ)
    delivery_address = Column(String(255))
    customer_phone = Column(String(20))
    note = Column(String(500), nullable=True) # <--- Cột mới

    # Khuyến mãi
    coupon_code = Column(String(50), nullable=True)
    discount_amount = Column(Float, default=0.0)

    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    
    food_id = Column(Integer)
    food_name = Column(String(200))
    price = Column(Float)
    quantity = Column(Integer)
    
    order = relationship("Order", back_populates="items")
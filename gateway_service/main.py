import httpx
import os
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# --- CẤU HÌNH CORS (Để Frontend gọi được) ---
origins = [
    "http://localhost:5173", # React Frontend
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- URL CÁC SERVICE CON ---
# Lưu ý: Tên host (user_service, restaurant_service...) phải khớp với tên trong docker-compose.yml
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user_service:8001")
RESTAURANT_SERVICE_URL = os.getenv("RESTAURANT_SERVICE_URL", "http://restaurant_service:8002")
ORDER_SERVICE_URL = os.getenv("ORDER_SERVICE_URL", "http://order_service:8003")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL", "http://payment_service:8004")
CART_SERVICE_URL = os.getenv("CART_SERVICE_URL", "http://cart_service:8005")

# --- HÀM CHUYỂN TIẾP REQUEST (PROXY) ---
async def forward_request(service_url: str, path: str, request: Request):
    client = httpx.AsyncClient()
    
    # Copy headers từ request gốc (trừ host để tránh lỗi)
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None) # Để httpx tự tính lại

    # Copy query params (ví dụ ?q=abc)
    params = dict(request.query_params)

    # Lấy body (nếu có)
    body = await request.body()

    try:
        url = f"{service_url}/{path}"
        response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            params=params,
            content=body
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Service Unavailable")
    except Exception as e:
        print(f"Gateway Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Gateway Error")

# ==========================================
# ĐỊNH TUYẾN (ROUTING)
# ==========================================

@app.get("/")
def read_root():
    return {"message": "Welcome to Food Delivery Gateway!"}

# --- 1. USER SERVICE ---
@app.api_route("/register", methods=["POST", "OPTIONS"])
async def register(req: Request):
    return await forward_request(USER_SERVICE_URL, "register", req)

@app.api_route("/login", methods=["POST", "OPTIONS"])
async def login(req: Request):
    return await forward_request(USER_SERVICE_URL, "login", req)

@app.api_route("/verify", methods=["GET"])
async def verify(req: Request):
    return await forward_request(USER_SERVICE_URL, "verify", req)

@app.api_route("/users/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def users_path(path: str, req: Request):
    return await forward_request(USER_SERVICE_URL, f"users/{path}", req)

# --- 2. RESTAURANT SERVICE ---
@app.api_route("/foods", methods=["GET", "POST"])
async def foods_root(req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, "foods", req)

@app.api_route("/foods/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def foods_path(path: str, req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, f"foods/{path}", req)

@app.api_route("/branches", methods=["GET", "POST"])
async def branches_root(req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, "branches", req)

@app.api_route("/branches/{path:path}", methods=["GET", "PUT", "DELETE"])
async def branches_path(path: str, req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, f"branches/{path}", req)

@app.api_route("/coupons", methods=["POST"])
async def coupons_root(req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, "coupons", req)

@app.api_route("/coupons/{path:path}", methods=["GET", "PUT", "DELETE"])
async def coupons_path(path: str, req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, f"coupons/{path}", req)

# --- !!! QUAN TRỌNG: THÊM ROUTE REVIEW VÀO ĐÂY !!! ---
@app.api_route("/reviews", methods=["POST"]) # Route tạo review
async def reviews_root(req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, "reviews", req)

@app.api_route("/reviews/{path:path}", methods=["GET"]) # Route xem review
async def reviews_path(path: str, req: Request):
    return await forward_request(RESTAURANT_SERVICE_URL, f"reviews/{path}", req)
# -----------------------------------------------------

# --- 3. ORDER SERVICE ---
@app.api_route("/checkout", methods=["POST"])
async def checkout(req: Request):
    return await forward_request(ORDER_SERVICE_URL, "checkout", req)

@app.api_route("/orders", methods=["GET"])
async def orders_root(req: Request):
    return await forward_request(ORDER_SERVICE_URL, "orders", req)

@app.api_route("/orders/{path:path}", methods=["GET", "PUT", "DELETE"])
async def orders_path(path: str, req: Request):
    return await forward_request(ORDER_SERVICE_URL, f"orders/{path}", req)

# --- 4. PAYMENT SERVICE ---
@app.api_route("/pay", methods=["POST"])
async def pay(req: Request):
    return await forward_request(PAYMENT_SERVICE_URL, "pay", req)

# --- 5. CART SERVICE ---
@app.api_route("/cart", methods=["GET", "POST", "PUT", "DELETE"])
async def cart_root(req: Request):
    return await forward_request(CART_SERVICE_URL, "cart", req)
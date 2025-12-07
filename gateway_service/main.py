import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="API Gateway")

# ==================================================================
# 0. CẤU HÌNH CORS (Cho phép React truy cập)
# ==================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================================
# 1. CẤU HÌNH SERVICE URL (Đọc từ .env)
# ==================================================================
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user_service:8001")
RESTAURANT_SERVICE_URL = os.getenv("RESTAURANT_SERVICE_URL", "http://restaurant_service:8002")
ORDER_SERVICE_URL = os.getenv("ORDER_SERVICE_URL", "http://order_service:8003")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL", "http://payment_service:8004")
CART_SERVICE_URL = os.getenv("CART_SERVICE_URL", "http://cart_service:8005")

# ==================================================================
# 2. HÀM CHUYỂN TIẾP (FORWARD REQUEST)
# ==================================================================
async def forward_request(service_url: str, path: str, request: Request):
    client = httpx.AsyncClient()
    body = await request.body()
    # Nếu path rỗng thì không thêm dấu /
    dest_url = f"{service_url}/{path}" if path else service_url

    try:
        response = await client.request(
            method=request.method,
            url=dest_url,
            headers=request.headers,
            content=body,
            params=request.query_params
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except Exception as e:
        return Response(content=f"Gateway Error: {str(e)}", status_code=500)

# ==================================================================
# 3. ĐỊNH TUYẾN (ROUTING)
# ==================================================================

# --- USER SERVICE ---
@app.api_route("/login", methods=["POST"])
async def login(req: Request): return await forward_request(USER_SERVICE_URL, "login", req)

@app.api_route("/register", methods=["POST"])
async def register(req: Request): return await forward_request(USER_SERVICE_URL, "register", req)

@app.api_route("/users/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def users(path: str, req: Request): return await forward_request(USER_SERVICE_URL, f"users/{path}", req)


# --- RESTAURANT SERVICE ---
# Món ăn
@app.api_route("/foods", methods=["GET", "POST"])
async def foods_root(req: Request): return await forward_request(RESTAURANT_SERVICE_URL, "foods", req)

@app.api_route("/foods/{path:path}", methods=["GET", "DELETE", "PUT"])
async def foods_path(path: str, req: Request): return await forward_request(RESTAURANT_SERVICE_URL, f"foods/{path}", req)

# Chi nhánh (QUAN TRỌNG: Để lấy tên quán)
@app.api_route("/branches", methods=["GET", "POST"])
async def branches_root(req: Request): return await forward_request(RESTAURANT_SERVICE_URL, "branches", req)

@app.api_route("/branches/{path:path}", methods=["GET", "POST"])
async def branches_path(path: str, req: Request): return await forward_request(RESTAURANT_SERVICE_URL, f"branches/{path}", req)

# Coupon
@app.api_route("/coupons", methods=["POST", "GET"])
async def coupons_root(req: Request): return await forward_request(RESTAURANT_SERVICE_URL, "coupons", req)

@app.api_route("/coupons/{path:path}", methods=["GET"])
async def coupons_path(path: str, req: Request): return await forward_request(RESTAURANT_SERVICE_URL, f"coupons/{path}", req)


# --- CART SERVICE ---
@app.api_route("/cart", methods=["GET", "POST", "PUT", "DELETE"])
async def cart(req: Request): return await forward_request(CART_SERVICE_URL, "cart", req)


# --- ORDER SERVICE ---
@app.api_route("/checkout", methods=["POST"])
async def checkout(req: Request): return await forward_request(ORDER_SERVICE_URL, "checkout", req)

@app.api_route("/orders", methods=["GET"])
async def orders(req: Request): return await forward_request(ORDER_SERVICE_URL, "orders", req)

@app.api_route("/orders/{path:path}", methods=["GET", "PUT"])
async def orders_path(path: str, req: Request): return await forward_request(ORDER_SERVICE_URL, f"orders/{path}", req)


# --- PAYMENT SERVICE ---
@app.api_route("/pay", methods=["POST"])
async def pay(req: Request): return await forward_request(PAYMENT_SERVICE_URL, "pay", req)
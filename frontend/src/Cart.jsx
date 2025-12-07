import { useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

function Cart() {
    // --- STATE QUẢN LÝ DỮ LIỆU ---
    const [cartItems, setCartItems] = useState([]);
    const [subTotal, setSubTotal] = useState(0);     // Tổng tiền hàng (chưa giảm)
    const [totalPrice, setTotalPrice] = useState(0); // Tổng tiền thanh toán (đã giảm)
    
    // --- STATE CHO COUPON ---
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null); // Lưu thông tin coupon nếu áp dụng thành công
    const [couponMessage, setCouponMessage] = useState('');   // Thông báo lỗi/thành công

    const navigate = useNavigate();

    // 1. Tải giỏ hàng khi vào trang
    useEffect(() => {
        fetchCart();
    }, []);

    // 2. Tự động tính lại Tổng tiền khi (Tiền hàng thay đổi) hoặc (Coupon thay đổi)
    useEffect(() => {
        if (appliedCoupon) {
            const discountAmount = (subTotal * appliedCoupon.discount_percent) / 100;
            setTotalPrice(subTotal - discountAmount);
        } else {
            setTotalPrice(subTotal);
        }
    }, [subTotal, appliedCoupon]);

    // --- CÁC HÀM XỬ LÝ API ---

    const fetchCart = async () => {
        try {
            // Bước 1: Lấy danh sách ID món trong giỏ
            const cartRes = await api.get('/cart');
            const items = cartRes.data;

            if (items.length === 0) {
                setCartItems([]);
                return;
            }

            // Bước 2: Lấy chi tiết tên/giá từng món (Enrich Data)
            const enrichedItems = await Promise.all(items.map(async (item) => {
                try {
                    const foodDetail = await api.get(`/foods/${item.food_id}`);
                    return {
                        ...item, // Giữ lại quantity, branch_id
                        name: foodDetail.data.name,
                        price: foodDetail.data.price,
                    };
                } catch (e) {
                    return { ...item, name: "Món không tồn tại (Đã xóa)", price: 0 };
                }
            }));

            setCartItems(enrichedItems);
            calculateSubTotal(enrichedItems);

        } catch (err) {
            console.error("Lỗi tải giỏ hàng:", err);
        }
    };

    const calculateSubTotal = (items) => {
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setSubTotal(total);
    };

    const updateQuantity = async (foodId, newQty) => {
        try {
            if (newQty < 1) return; // Không cho giảm dưới 1
            
            await api.put('/cart', { food_id: foodId, quantity: newQty });
            
            // Cập nhật state giao diện ngay lập tức
            const updatedItems = cartItems.map(item => 
                item.food_id === foodId ? { ...item, quantity: newQty } : item
            );
            setCartItems(updatedItems);
            calculateSubTotal(updatedItems);
        } catch (err) {
            alert("Lỗi cập nhật số lượng");
        }
    };

    const clearCart = async () => {
        if (!window.confirm("Bạn chắc chắn muốn xóa hết giỏ hàng?")) return;
        try {
            await api.delete('/cart');
            setCartItems([]);
            setSubTotal(0);
            setAppliedCoupon(null); // Reset coupon luôn khi xóa giỏ
            setCouponMessage('');
        } catch (err) {
            alert("Lỗi xóa giỏ");
        }
    };

    // --- HÀM XỬ LÝ COUPON (QUAN TRỌNG) ---
    const handleApplyCoupon = async () => {
        if (!couponCode) return;
        
        // 1. Kiểm tra giỏ hàng có đồ chưa
        if (cartItems.length === 0) {
            setCouponMessage('❌ Vui lòng chọn món ăn trước khi nhập mã.');
            return;
        }

        // 2. Lấy branch_id từ món đầu tiên trong giỏ (Logic: Giỏ hàng chỉ chứa món 1 quán)
        const currentBranchId = cartItems[0].branch_id;

        setCouponMessage(''); // Xóa thông báo cũ

        try {
            // 3. Gọi API verify có sẵn của bạn: /coupons/verify?code=...&branch_id=...
            const res = await api.get('/coupons/verify', {
                params: {
                    code: couponCode,
                    branch_id: currentBranchId
                }
            });

            // Backend trả về: { "valid": true, "discount_percent": 10, "code": "ABC" }
            const couponData = res.data;

            setAppliedCoupon(couponData);
            setCouponMessage(`✅ Áp dụng mã ${couponData.code} thành công! Giảm ${couponData.discount_percent}%`);
        } catch (err) {
            setAppliedCoupon(null);
            // Lấy thông báo lỗi từ backend trả về (nếu có)
            const msg = err.response?.data?.detail || 'Mã giảm giá không hợp lệ hoặc không thuộc quán này.';
            setCouponMessage(`❌ ${msg}`);
        }
    };

    const handleCheckout = () => {
        if (cartItems.length === 0) return alert("Giỏ hàng trống!");
        
        // Chuyển hướng sang trang /checkout và gửi kèm dữ liệu (state)
        navigate('/checkout', {
            state: {
                items: cartItems,
                coupon: appliedCoupon,
                final_price: totalPrice,
                branch_id: cartItems[0].branch_id
            }
        });
    };

    const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    return (
        <div className="cart-container">
            <h2>🛒 Giỏ hàng của bạn</h2>
            
            <button className="back-btn" onClick={() => navigate('/shop')}>← Tiếp tục mua sắm</button>

            {cartItems.length === 0 ? (
                <div className="empty-cart">
                    <p>Giỏ hàng đang trống trơn...</p>
                    <button onClick={() => navigate('/shop')}>Đi mua ngay</button>
                </div>
            ) : (
                <div className="cart-content">
                    <table className="cart-table">
                        <thead>
                            <tr>
                                <th>Món ăn</th>
                                <th>Đơn giá</th>
                                <th>Số lượng</th>
                                <th>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cartItems.map((item) => (
                                <tr key={item.food_id}>
                                    <td><strong>{item.name}</strong></td>
                                    <td>{formatMoney(item.price)}</td>
                                    <td>
                                        <div className="qty-control">
                                            <button onClick={() => updateQuantity(item.food_id, item.quantity - 1)}>-</button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.food_id, item.quantity + 1)}>+</button>
                                        </div>
                                    </td>
                                    <td>{formatMoney(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* --- KHU VỰC TỔNG KẾT & COUPON --- */}
                    <div className="cart-summary-box">
                        {/* Nhập mã giảm giá */}
                        <div className="coupon-section">
                            <input 
                                placeholder="Nhập mã giảm giá" 
                                value={couponCode}
                                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                            />
                            <button onClick={handleApplyCoupon}>Áp dụng</button>
                        </div>
                        {/* Thông báo kết quả áp dụng mã */}
                        {couponMessage && (
                            <p className="coupon-msg" style={{color: couponMessage.startsWith('✅') ? 'green' : 'red'}}>
                                {couponMessage}
                            </p>
                        )}

                        <hr style={{margin: '15px 0', border: '0', borderTop: '1px solid #ddd'}}/>

                        {/* Các dòng tính tiền */}
                        <div className="summary-row">
                            <span>Tạm tính:</span>
                            <span>{formatMoney(subTotal)}</span>
                        </div>

                        {appliedCoupon && (
                            <div className="summary-row discount">
                                <span>Giảm giá ({appliedCoupon.code}):</span>
                                <span>- {formatMoney(subTotal * appliedCoupon.discount_percent / 100)}</span>
                            </div>
                        )}

                        <div className="summary-row total">
                            <span>Tổng cộng:</span>
                            <span>{formatMoney(totalPrice)}</span>
                        </div>

                        {/* Các nút hành động */}
                        <div className="cart-actions">
                            <button className="clear-btn" onClick={clearCart}>Xóa giỏ hàng</button>
                            <button className="checkout-btn" onClick={handleCheckout}>Tiến hành Đặt hàng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Cart;
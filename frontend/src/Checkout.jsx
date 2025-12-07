import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from './api';

function Checkout() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Lấy dữ liệu từ Giỏ hàng
    const { items, coupon, final_price, branch_id } = location.state || {};

    // State form giao hàng
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        address: '',
        note: ''
    });

    const [branchName, setBranchName] = useState('Đang tải...');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (!items || items.length === 0) {
            navigate('/shop');
            return;
        }
        if (branch_id) fetchBranchInfo();
    }, [items, branch_id, navigate]);

    const fetchBranchInfo = async () => {
        try {
            const res = await api.get(`/branches/${branch_id}`);
            setBranchName(res.data.name);
        } catch (err) {
            setBranchName(`Chi nhánh #${branch_id}`);
        }
    };

    const handleChange = (e) => {
        setCustomerInfo({...customerInfo, [e.target.name]: e.target.value});
    };

    const handleConfirmOrder = async () => {
        if (!customerInfo.address || !customerInfo.phone || !customerInfo.name) {
            setError("Vui lòng điền đầy đủ thông tin giao hàng!");
            return;
        }

        setLoading(true);
        setError('');

        // Lấy User ID từ bộ nhớ (nếu đã đăng nhập)
        const userId = localStorage.getItem('user_id');

        try {
            // --- BƯỚC 1: TẠO ĐƠN HÀNG ---
            const orderPayload = {
                user_id: userId ? parseInt(userId) : null, // Gửi ID người mua
                branch_id: branch_id,
                items: items.map(item => ({
                    food_id: item.food_id,
                    quantity: item.quantity
                })),
                coupon_code: coupon ? coupon.code : null,
                
                // Thông tin khách hàng
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                delivery_address: customerInfo.address,
                note: customerInfo.note
            };

            console.log("Payload:", orderPayload);
            const orderRes = await api.post('/checkout', orderPayload);
            const { order_id, total_price } = orderRes.data;

            // --- BƯỚC 2: THANH TOÁN ---
            const paymentPayload = {
                order_id: order_id,
                amount: total_price
            };

            await api.post('/pay', paymentPayload);

            // --- BƯỚC 3: THÀNH CÔNG ---
            setStep(3);
            try { await api.delete('/cart'); } catch(e) {}

        } catch (err) {
            console.error(err);
            let msg = "Lỗi xử lý đơn hàng.";
            if (err.response && err.response.data && err.response.data.detail) {
                const detail = err.response.data.detail;
                if (Array.isArray(detail)) {
                    msg = `Thiếu thông tin: ${detail[0].loc[1]} - ${detail[0].msg}`;
                } else {
                    msg = typeof detail === 'object' ? JSON.stringify(detail) : detail;
                }
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    if (!items) return null;

    return (
        <div className="container" style={{maxWidth: '800px'}}>
            {step === 1 && (
                <div className="checkout-layout" style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
                    <div className="info-section" style={{flex: 1, minWidth: '300px'}}>
                        <h2>📍 Thông tin giao hàng</h2>
                        <div className="auth-form">
                            <label>Họ và tên:</label>
                            <input name="name" value={customerInfo.name} onChange={handleChange} placeholder="VD: Nguyễn Văn A" />
                            <label>Số điện thoại:</label>
                            <input name="phone" value={customerInfo.phone} onChange={handleChange} placeholder="VD: 0987..." />
                            <label>Địa chỉ nhận hàng:</label>
                            <textarea name="address" value={customerInfo.address} onChange={handleChange} placeholder="Số nhà, đường, phường..." style={{width: '100%', padding: '10px', height: '80px'}} />
                            <label>Ghi chú (Tùy chọn):</label>
                            <input name="note" value={customerInfo.note} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="order-summary" style={{flex: 1, minWidth: '300px', background: '#f8f9fa', padding: '20px', borderRadius: '8px', height: 'fit-content'}}>
                        <h3 style={{marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px'}}>🧾 Đơn hàng từ: <span style={{color: '#007bff'}}>{branchName}</span></h3>
                        <ul style={{listStyle: 'none', padding: 0}}>
                            {items.map(item => (
                                <li key={item.food_id} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                                    <span><b>{item.quantity}x</b> {item.name}</span>
                                    <span>{formatMoney(item.price * item.quantity)}</span>
                                </li>
                            ))}
                        </ul>
                        <hr />
                        {coupon && <div style={{display: 'flex', justifyContent: 'space-between', color: 'green'}}><span>Mã giảm ({coupon.code}):</span><span>-{coupon.discount_percent}%</span></div>}
                        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 'bold', marginTop: '15px', color: '#d32f2f'}}><span>Tổng cộng:</span><span>{formatMoney(final_price)}</span></div>
                        {error && <div style={{color: 'red', marginTop: '10px'}}>{error}</div>}
                        <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
                            <button onClick={() => navigate('/cart')} style={{flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px'}}>Quay lại</button>
                            <button onClick={handleConfirmOrder} disabled={loading} style={{flex: 2, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold'}}>{loading ? "Đang xử lý..." : "ĐẶT HÀNG NGAY"}</button>
                        </div>
                    </div>
                </div>
            )}
            {step === 3 && (
                <div className="success-screen" style={{textAlign: 'center', padding: '50px'}}>
                    <div style={{fontSize: '60px'}}>🚀</div>
                    <h2 style={{color: '#28a745'}}>Đặt hàng thành công!</h2>
                    <p>Shipper đang giao món đến cho bạn.</p>
                    <button onClick={() => navigate('/shop')} style={{marginTop: '20px', padding: '12px 30px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px'}}>Tiếp tục mua sắm</button>
                </div>
            )}
        </div>
    );
}
export default Checkout;
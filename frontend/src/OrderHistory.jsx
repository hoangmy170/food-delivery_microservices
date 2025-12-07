import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';

function OrderHistory() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders(); // Tải lần đầu
        const interval = setInterval(() => {
            fetchOrders(true); // Tải ngầm mỗi 5s
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async (isBackground = false) => {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            if (!isBackground) navigate('/');
            return;
        }

        try {
            if (!isBackground) setLoading(true);
            const res = await api.get('/orders/my-orders', { params: { user_id: userId } });
            setOrders(res.data);
        } catch (err) {
            console.error("Lỗi tải lịch sử:", err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const renderStatus = (status) => {
        const styles = {
            'PENDING_PAYMENT': { color: 'orange', label: '⏳ Chờ thanh toán' },
            'PAID': { color: 'green', label: '✅ Đã thanh toán' },
            'SHIPPING': { color: '#007bff', label: '🚚 Đang giao' },
            'COMPLETED': { color: 'purple', label: '🎉 Hoàn tất' },
            'CANCELLED': { color: 'red', label: '❌ Đã hủy' }
        };
        const s = styles[status] || { color: 'black', label: status };
        return <span style={{ color: s.color, fontWeight: 'bold' }}>{s.label}</span>;
    };

    const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString) => new Date(dateString).toLocaleString('vi-VN');

    return (
        <div className="container" style={{maxWidth: '900px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2>📜 Lịch sử đơn hàng</h2>
                <button onClick={() => navigate('/shop')} style={{padding: '8px 15px', cursor: 'pointer'}}>← Quay lại mua sắm</button>
            </div>
            {loading ? <p>Đang tải...</p> : (
                orders.length === 0 ? (
                    <div style={{textAlign: 'center', padding: '40px', background: '#f9f9f9', borderRadius: '8px'}}>
                        <p>Bạn chưa có đơn hàng nào.</p>
                        <button onClick={() => navigate('/shop')}>Đặt món ngay</button>
                    </div>
                ) : (
                    <div className="order-list">
                        {orders.map(order => (
                            <div key={order.id} style={{border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px', padding: '20px', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px'}}>
                                    <div><strong>Đơn #{order.id}</strong> - <span style={{color: '#666'}}>{formatDate(order.created_at)}</span></div>
                                    <div>{renderStatus(order.status)}</div>
                                </div>
                                <div style={{fontSize: '0.9rem', color: '#555', marginBottom: '10px'}}>
                                    <p>📍 <b>Giao đến:</b> {order.user_name} ({order.customer_phone}) - {order.delivery_address}</p>
                                    {order.note && <p>📝 <b>Ghi chú:</b> {order.note}</p>}
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
                                    <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#d32f2f'}}>Tổng: {formatMoney(order.total_price)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

export default OrderHistory;
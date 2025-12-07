import { useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

function SellerDashboard() {
    const navigate = useNavigate();
    
    // Lấy thông tin từ LocalStorage
    const role = localStorage.getItem('role');
    const sellerMode = localStorage.getItem('seller_mode'); 
    const branchId = localStorage.getItem('branch_id');     
    
    // State quản lý Tabs
    const [activeTab, setActiveTab] = useState('orders'); // Mặc định vào xem đơn hàng trước
    
    // State dữ liệu
    const [foods, setFoods] = useState([]);
    const [orders, setOrders] = useState([]);
    const [newFood, setNewFood] = useState({ name: '', price: '', discount: 0 });
    const [newCoupon, setNewCoupon] = useState({ code: '', discount_percent: 0 });

    useEffect(() => {
        if (role !== 'seller') {
            alert("Bạn không có quyền truy cập!");
            navigate('/');
            return;
        }
        if (activeTab === 'menu') fetchFoods();
        if (activeTab === 'orders') fetchOrders();
    }, [activeTab]);

    // --- API ORDERS ---
    const fetchOrders = async () => {
        try {
            // Gọi API lấy đơn hàng, truyền branch_id để lọc
            const res = await api.get('/orders', { params: { branch_id: branchId } });
            setOrders(res.data);
        } catch (err) {
            console.error("Lỗi tải đơn hàng:", err);
        }
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            // Gọi Gateway: PUT /orders/{id}/status?status=...
            await api.put(`/orders/${orderId}/status`, null, {
                params: { status: newStatus }
            });
            fetchOrders(); // Tải lại danh sách sau khi cập nhật
        } catch (err) {
            alert("Lỗi cập nhật trạng thái");
        }
    };

    // --- API FOODS ---
    const fetchFoods = async () => {
        try {
            let url = branchId ? `/foods?branch_id=${branchId}` : '/foods';
            const res = await api.get(url);
            setFoods(res.data);
        } catch (err) { console.error(err); }
    };

    const handleAddFood = async (e) => {
        e.preventDefault();
        try {
            await api.post('/foods', newFood);
            alert("Thêm món thành công!");
            setNewFood({ name: '', price: '', discount: 0 });
            fetchFoods();
        } catch (err) { alert("Lỗi thêm món"); }
    };

    const handleDeleteFood = async (id) => {
        if (!window.confirm("Xóa món này?")) return;
        try { await api.delete(`/foods/${id}`); fetchFoods(); } catch (e) {}
    };

    // --- API COUPONS ---
    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        try {
            await api.post('/coupons', newCoupon);
            alert(`Đã tạo mã ${newCoupon.code}!`);
            setNewCoupon({ code: '', discount_percent: 0 });
        } catch (err) { alert("Lỗi tạo mã"); }
    };

    const formatMoney = (a) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(a);
    const formatDate = (d) => new Date(d).toLocaleString('vi-VN');

    // Helper: Hiển thị trạng thái màu mè
    const renderStatusBadge = (status) => {
        const colors = {
            'PENDING_PAYMENT': '#ffc107', // Vàng
            'PAID': '#28a745',            // Xanh lá (Quan trọng nhất)
            'SHIPPING': '#17a2b8',        // Xanh dương
            'COMPLETED': '#6c757d',       // Xám
            'CANCELLED': '#dc3545'        // Đỏ
        };
        return <span style={{background: colors[status] || '#ccc', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem'}}>{status}</span>
    };

    return (
        <div className="seller-container">
            <header className="seller-header">
                <div>
                    <h2>💼 Kênh Người Bán ({sellerMode === 'owner' ? 'Chủ' : 'NV'})</h2>
                    {branchId && <small>Chi nhánh ID: {branchId}</small>}
                </div>
                <button onClick={() => { localStorage.clear(); navigate('/'); }} className="logout-btn">Đăng xuất</button>
            </header>

            <div className="tabs">
                <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>📦 Đơn hàng</button>
                <button className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>🍽️ Thực đơn</button>
                <button className={activeTab === 'coupons' ? 'active' : ''} onClick={() => setActiveTab('coupons')}>🎟️ Mã giảm giá</button>
            </div>

            {/* TAB QUẢN LÝ ĐƠN HÀNG */}
            {activeTab === 'orders' && (
                <div className="tab-content">
                    <h3>Danh sách đơn hàng cần xử lý</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Mã đơn</th>
                                <th>Khách hàng</th>
                                <th>Tổng tiền</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td>
                                        <strong>#{order.id}</strong><br/>
                                        <small>{formatDate(order.created_at)}</small>
                                    </td>
                                    <td>
                                        <strong>{order.user_name}</strong><br/>
                                        <small>{order.customer_phone}</small><br/>
                                        <small>📍 {order.delivery_address}</small>
                                        {order.note && <div style={{color: 'red', fontSize: '0.8rem'}}>📝 {order.note}</div>}
                                    </td>
                                    <td>
                                        {formatMoney(order.total_price)}
                                        {order.discount_amount > 0 && <div style={{color: 'green', fontSize: '0.8rem'}}>(Đã giảm {formatMoney(order.discount_amount)})</div>}
                                    </td>
                                    <td>{renderStatusBadge(order.status)}</td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                                            {/* Logic nút bấm chuyển trạng thái */}
                                            {order.status === 'PAID' && (
                                                <button onClick={() => handleUpdateStatus(order.id, 'SHIPPING')} style={{background: '#17a2b8', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', borderRadius: '3px'}}>
                                                    🚚 Giao hàng
                                                </button>
                                            )}
                                            
                                            {order.status === 'SHIPPING' && (
                                                <button onClick={() => handleUpdateStatus(order.id, 'COMPLETED')} style={{background: '#6c757d', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', borderRadius: '3px'}}>
                                                    ✅ Hoàn tất
                                                </button>
                                            )}

                                            {(order.status === 'PAID' || order.status === 'PENDING_PAYMENT') && (
                                                <button onClick={() => handleUpdateStatus(order.id, 'CANCELLED')} style={{background: '#dc3545', color: 'white', border: 'none', padding: '5px', cursor: 'pointer', borderRadius: '3px'}}>
                                                    ❌ Hủy đơn
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB THỰC ĐƠN (Giữ nguyên logic cũ) */}
            {activeTab === 'menu' && (
                <div className="tab-content">
                    {sellerMode === 'owner' && (
                        <div className="add-form">
                            <form onSubmit={handleAddFood}>
                                <input placeholder="Tên món" value={newFood.name} onChange={e => setNewFood({...newFood, name: e.target.value})} required />
                                <input type="number" placeholder="Giá" value={newFood.price} onChange={e => setNewFood({...newFood, price: e.target.value})} required />
                                <input type="number" placeholder="Giảm %" value={newFood.discount} onChange={e => setNewFood({...newFood, discount: e.target.value})} />
                                <button type="submit">Thêm món</button>
                            </form>
                        </div>
                    )}
                    <table className="data-table">
                        <thead><tr><th>Tên món</th><th>Giá</th><th>Giảm</th><th>Xóa</th></tr></thead>
                        <tbody>
                            {foods.map(f => (
                                <tr key={f.id}><td>{f.name}</td><td>{formatMoney(f.price)}</td><td>{f.discount}%</td>
                                <td>{sellerMode === 'owner' && <button className="delete-btn" onClick={() => handleDeleteFood(f.id)}>Xóa</button>}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB COUPON */}
            {activeTab === 'coupons' && sellerMode === 'owner' && (
                <div className="tab-content">
                    <div className="add-form">
                        <form onSubmit={handleCreateCoupon}>
                            <input placeholder="Mã Code" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} required />
                            <input type="number" placeholder="Giảm %" value={newCoupon.discount_percent} onChange={e => setNewCoupon({...newCoupon, discount_percent: e.target.value})} required />
                            <button type="submit">Tạo mã</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SellerDashboard;
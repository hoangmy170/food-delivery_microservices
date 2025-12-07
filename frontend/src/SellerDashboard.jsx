import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from './api';

function SellerDashboard() {
    const navigate = useNavigate();
    const role = localStorage.getItem('role');
    const sellerMode = localStorage.getItem('seller_mode'); 
    const branchId = localStorage.getItem('branch_id');     
    
    const [activeTab, setActiveTab] = useState('orders');
    const [foods, setFoods] = useState([]);
    const [orders, setOrders] = useState([]);
    const [newFood, setNewFood] = useState({ name: '', price: '', discount: 0 });
    const [newCoupon, setNewCoupon] = useState({ code: '', discount_percent: 0 });

    useEffect(() => {
        if (role !== 'seller') {
            toast.error("Không có quyền truy cập!");
            navigate('/');
            return;
        }
        if (activeTab === 'menu') fetchFoods();
        if (activeTab === 'orders') fetchOrders();
    }, [activeTab]);

    const fetchOrders = async () => {
        try {
            const res = await api.get('/orders', { params: { branch_id: branchId } });
            setOrders(res.data);
        } catch (err) { console.error(err); }
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            await api.put(`/orders/${orderId}/status`, null, { params: { status: newStatus } });
            toast.success(`Đã cập nhật đơn #${orderId} -> ${newStatus}`);
            fetchOrders();
        } catch (err) { toast.error("Lỗi cập nhật trạng thái"); }
    };

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
            toast.success("Thêm món thành công! 🍖");
            setNewFood({ name: '', price: '', discount: 0 });
            fetchFoods();
        } catch (err) { toast.error("Lỗi thêm món"); }
    };

    const handleDeleteFood = async (id) => {
        if (!window.confirm("Xóa món này?")) return;
        try { await api.delete(`/foods/${id}`); toast.info("Đã xóa món"); fetchFoods(); } catch (e) {}
    };

    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        try {
            await api.post('/coupons', newCoupon);
            toast.success(`Đã tạo mã ${newCoupon.code}! 🎟️`);
            setNewCoupon({ code: '', discount_percent: 0 });
        } catch (err) { toast.error("Lỗi tạo mã"); }
    };

    const formatMoney = (a) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(a);
    const formatDate = (d) => new Date(d).toLocaleString('vi-VN');
    const renderStatusBadge = (status) => {
        const colors = { 'PENDING_PAYMENT': '#ffc107', 'PAID': '#28a745', 'SHIPPING': '#17a2b8', 'COMPLETED': '#6c757d', 'CANCELLED': '#dc3545' };
        return <span style={{background: colors[status] || '#ccc', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem'}}>{status}</span>
    };

    return (
        <div className="seller-container">
            <header className="seller-header">
                <div><h2>💼 Kênh Người Bán ({sellerMode === 'owner' ? 'Chủ' : 'NV'})</h2>{branchId && <small>Chi nhánh ID: {branchId}</small>}</div>
                <button onClick={() => { localStorage.clear(); navigate('/'); }} className="logout-btn">Đăng xuất</button>
            </header>
            <div className="tabs">
                <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>📦 Đơn hàng</button>
                <button className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>🍽️ Thực đơn</button>
                <button className={activeTab === 'coupons' ? 'active' : ''} onClick={() => setActiveTab('coupons')}>🎟️ Mã giảm giá</button>
            </div>
            {activeTab === 'orders' && (
                <div className="tab-content">
                    <table className="data-table">
                        <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td><strong>#{order.id}</strong><br/><small>{formatDate(order.created_at)}</small></td>
                                    <td><strong>{order.user_name}</strong><br/><small>{order.customer_phone}</small><br/><small>📍 {order.delivery_address}</small>{order.note && <div style={{color: 'red', fontSize: '0.8rem'}}>📝 {order.note}</div>}</td>
                                    <td>{formatMoney(order.total_price)}</td>
                                    <td>{renderStatusBadge(order.status)}</td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                                            {order.status === 'PAID' && <button onClick={() => handleUpdateStatus(order.id, 'SHIPPING')} style={{background: '#17a2b8', color: 'white', border: 'none', padding: '5px', borderRadius: '3px'}}>🚚 Giao hàng</button>}
                                            {order.status === 'SHIPPING' && <button onClick={() => handleUpdateStatus(order.id, 'COMPLETED')} style={{background: '#6c757d', color: 'white', border: 'none', padding: '5px', borderRadius: '3px'}}>✅ Hoàn tất</button>}
                                            {(order.status === 'PAID' || order.status === 'PENDING_PAYMENT') && <button onClick={() => handleUpdateStatus(order.id, 'CANCELLED')} style={{background: '#dc3545', color: 'white', border: 'none', padding: '5px', borderRadius: '3px'}}>❌ Hủy đơn</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {activeTab === 'menu' && (
                <div className="tab-content">
                    {sellerMode === 'owner' && <div className="add-form"><form onSubmit={handleAddFood}><input placeholder="Tên món" value={newFood.name} onChange={e => setNewFood({...newFood, name: e.target.value})} required /><input type="number" placeholder="Giá" value={newFood.price} onChange={e => setNewFood({...newFood, price: e.target.value})} required /><input type="number" placeholder="Giảm %" value={newFood.discount} onChange={e => setNewFood({...newFood, discount: e.target.value})} /><button type="submit">Thêm món</button></form></div>}
                    <table className="data-table">
                        <thead><tr><th>Tên món</th><th>Giá</th><th>Giảm</th><th>Xóa</th></tr></thead>
                        <tbody>{foods.map(f => (<tr key={f.id}><td>{f.name}</td><td>{formatMoney(f.price)}</td><td>{f.discount}%</td><td>{sellerMode === 'owner' && <button className="delete-btn" onClick={() => handleDeleteFood(f.id)}>Xóa</button>}</td></tr>))}</tbody>
                    </table>
                </div>
            )}
            {activeTab === 'coupons' && sellerMode === 'owner' && (
                <div className="tab-content"><div className="add-form"><form onSubmit={handleCreateCoupon}><input placeholder="Mã Code" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} required /><input type="number" placeholder="Giảm %" value={newCoupon.discount_percent} onChange={e => setNewCoupon({...newCoupon, discount_percent: e.target.value})} required /><button type="submit">Tạo mã</button></form></div></div>
            )}
        </div>
    );
}
export default SellerDashboard;
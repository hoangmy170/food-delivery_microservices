import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSignOutAlt, FaBoxOpen, FaClipboardList, FaTags, FaPlus, FaTrash, FaUpload } from "react-icons/fa"; 
import api from './api';

// Đường dẫn hiển thị ảnh (Gateway)
const API_BASE_URL = "http://localhost:8000"; 

function SellerDashboard() {
    const [stats, setStats] = useState({ revenue: 0, orders: 0, pending: 0, totalFoods: 0 });
    const [orders, setOrders] = useState([]);
    const [foods, setFoods] = useState([]);
    const [coupons, setCoupons] = useState([]);
    
    const [activeTab, setActiveTab] = useState('orders');
    const [showModal, setShowModal] = useState(null); 
    const [loading, setLoading] = useState(false);

    // Form thêm món
    const [newFood, setNewFood] = useState({ name: '', price: '', description: '' });
    const [foodImageFile, setFoodImageFile] = useState(null); 
    const [previewImage, setPreviewImage] = useState(null);

    // Form thêm mã
    const [newCoupon, setNewCoupon] = useState({ code: '', discount_percent: '', valid_from: '', valid_to: '' });

    const navigate = useNavigate();

    useEffect(() => {
        const branchId = localStorage.getItem('branch_id');
        const role = localStorage.getItem('role');

        if (role !== 'seller') { navigate('/'); return; }
        if (!branchId) { 
            // Nếu không có branch_id, thử lấy từ localStorage hoặc báo lỗi
            toast.error("Vui lòng đăng nhập lại tài khoản Chủ quán!"); 
            return; 
        }

        fetchAllData(branchId);
    }, []);

    const fetchAllData = async (branchId) => {
        try {
            // 1. LẤY MÓN ĂN
            // Logic cũ: GET /foods?branch_id=...
            const resFoods = await api.get('/foods', { params: { branch_id: branchId } });
            setFoods(resFoods.data || []);

            // 2. LẤY ĐƠN HÀNG
            // Logic cũ: GET /orders?branch_id=...
            const resOrders = await api.get('/orders', { params: { branch_id: branchId } });
            const ordersData = resOrders.data || [];
            // Sắp xếp đơn mới nhất lên đầu
            setOrders(ordersData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));

            // 3. LẤY COUPON
            // Logic cũ: GET /coupons?branch_id=... (Giả định bạn có API này hoặc tương tự)
            try {
                // Nếu backend chưa có api get coupon theo branch thì đoạn này sẽ lỗi nhẹ, không sao
                const resCoupons = await api.get('/coupons', { params: { branch_id: branchId } });
                setCoupons(resCoupons.data || []);
            } catch (e) { console.log("Chưa load được coupon"); }

            // 4. TÍNH TOÁN THỐNG KÊ
            const revenue = ordersData
                .filter(o => o.status === 'COMPLETED' || o.status === 'PAID')
                .reduce((sum, o) => sum + (o.total_price || 0), 0);

            setStats({
                revenue: revenue,
                orders: ordersData.length,
                pending: ordersData.filter(o => o.status === 'PENDING').length,
                totalFoods: resFoods.data ? resFoods.data.length : 0
            });

        } catch (err) {
            console.error("Lỗi tải dữ liệu:", err);
            toast.error("Không kết nối được Server. Hãy kiểm tra lại Backend!");
        }
    };

    // --- XỬ LÝ ẢNH ---
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFoodImageFile(file);
            setPreviewImage(URL.createObjectURL(file));
        }
    };

    // --- THÊM MÓN (Logic Cũ + Giao diện Mới) ---
    const handleAddFood = async () => {
        if (!newFood.name || !newFood.price) return toast.warning("Nhập tên và giá!");
        setLoading(true);
        try {
            const branchId = localStorage.getItem('branch_id');
            const formData = new FormData();
            
            // Gửi dữ liệu y hệt code cũ của bạn
            formData.append('name', newFood.name);
            formData.append('price', newFood.price);
            formData.append('description', newFood.description || "");
            formData.append('branch_id', branchId); 
            // Nếu backend cần 'discount', thêm vào: formData.append('discount', 0);
            
            if (foodImageFile) {
                formData.append('image', foodImageFile); 
            }

            await api.post('/foods', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success("Thêm món thành công!");
            setShowModal(null);
            setNewFood({ name: '', price: '', description: '' });
            setFoodImageFile(null);
            setPreviewImage(null);
            fetchAllData(branchId); 
        } catch (err) {
            toast.error("Lỗi thêm món: " + (err.response?.data?.detail || err.message));
        } finally { setLoading(false); }
    };

    const handleDeleteFood = async (id) => {
        if(!window.confirm("Xóa món này?")) return;
        try {
            await api.delete(`/foods/${id}`);
            toast.success("Đã xóa");
            fetchAllData(localStorage.getItem('branch_id'));
        } catch (e) { toast.error("Lỗi xóa món"); }
    };

    // --- TẠO MÃ GIẢM GIÁ ---
    const handleAddCoupon = async () => {
        if (!newCoupon.code || !newCoupon.discount_percent) return toast.warning("Nhập đủ thông tin!");
        setLoading(true);
        try {
            const branchId = localStorage.getItem('branch_id');
            const payload = {
                code: newCoupon.code.toUpperCase(),
                discount_percent: parseInt(newCoupon.discount_percent),
                // Xử lý ngày tháng theo chuẩn ISO để backend dễ đọc
                start_date: newCoupon.valid_from ? new Date(newCoupon.valid_from).toISOString() : new Date().toISOString(),
                end_date: newCoupon.valid_to ? new Date(newCoupon.valid_to).toISOString() : new Date().toISOString(),
                // Lưu ý: Nếu backend cũ của bạn dùng key là 'valid_from'/'valid_to' thì sửa lại key ở đây nhé
                // Dựa trên code cũ bạn gửi, có vẻ là start_date/end_date
            };
            
            // Gửi branch_id qua query params hoặc body tùy backend cũ. 
            // Thường là body:
            // payload.branch_id = branchId; 

            // Ở đây tôi gửi theo query param cho chắc ăn nếu backend tách riêng
            await api.post('/coupons', payload, { params: { branch_id: branchId } });
            
            toast.success("Tạo mã thành công!");
            setShowModal(null);
            fetchAllData(branchId);
        } catch (err) {
            toast.error("Lỗi tạo mã: " + (err.response?.data?.detail || err.message));
        } finally { setLoading(false); }
    };

    const handleDeleteCoupon = async (id) => {
        if(!window.confirm("Xóa mã này?")) return;
        try {
            await api.delete(`/coupons/${id}`);
            toast.success("Đã xóa");
            fetchAllData(localStorage.getItem('branch_id'));
        } catch (e) { toast.error("Lỗi xóa mã"); }
    };

    const handleLogout = () => { localStorage.clear(); navigate('/'); };
    const formatMoney = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    const formatDate = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '---';

    // Style Tab (Giữ giao diện đẹp)
    const tabStyle = (name) => ({
        padding:'10px 20px', border:'none', borderRadius:'30px', cursor:'pointer', fontWeight:'bold', 
        display:'flex', gap:'8px', alignItems:'center', transition:'0.2s',
        background: activeTab === name ? '#ff6347' : '#eee', color: activeTab === name ? 'white' : '#333'
    });

    return (
        <div className="seller-container">
            {/* Header */}
            <div className="seller-header">
                <div><h2 className="seller-brand">FOOD ORDER</h2><span style={{color:'#777'}}>Kênh quản lý</span></div>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={{textAlign:'right'}}><strong>Chủ quán (Branch {localStorage.getItem('branch_id')})</strong></div>
                    <button onClick={handleLogout} className="icon-btn logout" title="Đăng xuất"><FaSignOutAlt/></button>
                </div>
            </div>

            {/* Thống kê */}
            <div className="stat-grid">
                <div className="stat-card" style={{borderLeftColor:'#28a745'}}><h3>Doanh thu</h3><div className="value" style={{color:'#28a745'}}>{formatMoney(stats.revenue)}</div></div>
                <div className="stat-card" style={{borderLeftColor:'#17a2b8'}}><h3>Đơn hàng</h3><div className="value">{stats.orders}</div></div>
                <div className="stat-card" style={{borderLeftColor:'#ffc107'}}><h3>Chờ xử lý</h3><div className="value" style={{color:'#ffc107'}}>{stats.pending}</div></div>
                <div className="stat-card" style={{borderLeftColor:'#6c757d'}}><h3>Tổng món</h3><div className="value" style={{color:'#6c757d'}}>{stats.totalFoods}</div></div>
            </div>

            {/* Menu */}
            <div style={{display:'flex', gap:'10px', marginBottom:'30px', borderBottom:'1px solid #ddd', paddingBottom:'20px'}}>
                <button onClick={()=>setActiveTab('orders')} style={tabStyle('orders')}><FaClipboardList/> Đơn hàng</button>
                <button onClick={()=>setActiveTab('foods')} style={tabStyle('foods')}><FaBoxOpen/> Thực đơn</button>
                <button onClick={()=>setActiveTab('coupons')} style={tabStyle('coupons')}><FaTags/> Mã giảm giá</button>
            </div>

            {/* Tab Đơn hàng */}
            {activeTab === 'orders' && (
                <table className="data-table">
                    <thead><tr><th>Mã</th><th>Khách</th><th>Món đặt</th><th>Tiền</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
                    <tbody>
                        {orders.length === 0 ? <tr><td colSpan="6" style={{textAlign:'center', padding:'20px'}}>Chưa có đơn hàng</td></tr> : 
                        orders.map(o => (
                            <tr key={o.id}>
                                <td>#{o.id}</td><td>{o.user_name || o.customer_name || 'Khách'}</td>
                                <td>
                                    {Array.isArray(o.items) 
                                        ? o.items.map(i=>`${i.quantity}x ${i.food_name}`).join(', ') 
                                        : 'Chi tiết xem sau'}
                                </td>
                                <td style={{fontWeight:'bold'}}>{formatMoney(o.total_price)}</td>
                                <td><span style={{fontWeight:'bold', color: o.status==='PENDING'?'orange':'green'}}>{o.status}</span></td>
                                <td>{formatDate(o.created_at)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Tab Thực đơn */}
            {activeTab === 'foods' && (
                <div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                        <h3>Danh sách món ăn</h3>
                        <button onClick={()=>setShowModal('food')} style={{background:'#28a745', color:'white', padding:'10px 20px', borderRadius:'6px', border:'none', fontWeight:'bold', cursor:'pointer'}}><FaPlus/> Thêm món</button>
                    </div>
                    {foods.length === 0 ? <p style={{textAlign:'center', color:'#999'}}>Chưa có món ăn nào.</p> : (
                        <table className="data-table">
                            <thead><tr><th>Hình</th><th>Tên</th><th>Giá</th><th>Xóa</th></tr></thead>
                            <tbody>
                                {foods.map(f => (
                                    <tr key={f.id}>
                                        <td>
                                            <img src={f.image_url ? `${API_BASE_URL}${f.image_url}` : 'https://via.placeholder.com/50'} 
                                                 style={{width:'50px', height:'50px', objectFit:'cover', borderRadius:'4px'}} alt=""/>
                                        </td>
                                        <td>{f.name}</td>
                                        <td style={{fontWeight:'bold', color:'#d32f2f'}}>{formatMoney(f.price)}</td>
                                        <td><button onClick={()=>handleDeleteFood(f.id)} style={{color:'#dc3545', background:'none', border:'none', cursor:'pointer'}}><FaTrash/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Tab Coupon */}
            {activeTab === 'coupons' && (
                <div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                        <h3>Mã giảm giá</h3>
                        <button onClick={()=>setShowModal('coupon')} style={{background:'#007bff', color:'white', padding:'10px 20px', borderRadius:'6px', border:'none', fontWeight:'bold', cursor:'pointer'}}><FaPlus/> Tạo mã</button>
                    </div>
                    <table className="data-table">
                        <thead><tr><th>Code</th><th>Giảm</th><th>Hạn dùng</th><th>Xóa</th></tr></thead>
                        <tbody>
                            {coupons.map(c => (
                                <tr key={c.id}>
                                    <td><span style={{background:'#e3f2fd', padding:'5px 10px', borderRadius:'4px', color:'#007bff', fontWeight:'bold'}}>{c.code}</span></td>
                                    <td>{c.discount_percent}%</td>
                                    <td>{formatDate(c.end_date || c.valid_to)}</td>
                                    <td><button onClick={()=>handleDeleteCoupon(c.id)} style={{color:'#dc3545', background:'none', border:'none', cursor:'pointer'}}><FaTrash/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL THÊM MÓN */}
            {showModal === 'food' && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header"><h3>Thêm món mới</h3><button className="close-btn" onClick={()=>setShowModal(null)}>×</button></div>
                        <div className="form-group"><label>Tên món:</label><input value={newFood.name} onChange={e=>setNewFood({...newFood, name:e.target.value})} /></div>
                        <div className="form-group"><label>Giá:</label><input type="number" value={newFood.price} onChange={e=>setNewFood({...newFood, price:e.target.value})} /></div>
                        <div className="form-group">
                            <label>Hình ảnh (Từ máy tính):</label>
                            <div style={{border:'1px dashed #ccc', padding:'10px', textAlign:'center', cursor:'pointer', position:'relative'}}>
                                <input type="file" accept="image/*" onChange={handleImageChange} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0}} />
                                {previewImage ? <img src={previewImage} style={{maxHeight:'100px'}} alt=""/> : <span><FaUpload/> Chọn ảnh</span>}
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Hủy</button>
                            <button className="btn-confirm" onClick={handleAddFood} disabled={loading}>{loading?'Đang lưu...':'Lưu món'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TẠO MÃ */}
            {showModal === 'coupon' && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header"><h3>Tạo mã giảm giá</h3><button className="close-btn" onClick={()=>setShowModal(null)}>×</button></div>
                        <div className="form-group"><label>Mã:</label><input value={newCoupon.code} onChange={e=>setNewCoupon({...newCoupon, code:e.target.value.toUpperCase()})}/></div>
                        <div className="form-group"><label>Giảm (%):</label><input type="number" value={newCoupon.discount_percent} onChange={e=>setNewCoupon({...newCoupon, discount_percent:e.target.value})}/></div>
                        <div style={{display:'flex', gap:'10px'}}>
                            <div className="form-group" style={{flex:1}}><label>Từ ngày:</label><input type="datetime-local" onChange={e=>setNewCoupon({...newCoupon, valid_from:e.target.value})}/></div>
                            <div className="form-group" style={{flex:1}}><label>Đến ngày:</label><input type="datetime-local" onChange={e=>setNewCoupon({...newCoupon, valid_to:e.target.value})}/></div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Hủy</button>
                            <button className="btn-confirm" onClick={handleAddCoupon} disabled={loading}>{loading?'Đang tạo...':'Tạo mã'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
export default SellerDashboard;
import { useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

function Shop() {
    const [foods, setFoods] = useState([]);         // Danh sách món ăn (đã gom nhóm)
    const [searchTerm, setSearchTerm] = useState(''); 
    const [selectedFood, setSelectedFood] = useState(null); // Tên món đang chọn xem chi tiết
    const [foodOptions, setFoodOptions] = useState([]);     // Các quán bán món đang chọn
    const navigate = useNavigate();

    // 1. Tải danh sách món ăn khi vào trang
    useEffect(() => {
        fetchFoods();
    }, []);

    const fetchFoods = async (query = '') => {
        try {
            // Gọi API search của restaurant_service để lấy danh sách gom nhóm
            const res = await api.get(`/foods/search?q=${query}`);
            setFoods(res.data);
        } catch (err) {
            console.error("Lỗi tải món ăn:", err);
        }
    };

    // 2. Xử lý tìm kiếm
    const handleSearch = (e) => {
        e.preventDefault();
        fetchFoods(searchTerm);
    };

    // 3. Khi bấm vào một món -> Xem các quán bán món đó
    const handleViewOptions = async (foodName) => {
        try {
            const res = await api.get(`/foods/options?name=${foodName}`);
            setFoodOptions(res.data); // Lưu danh sách các quán
            setSelectedFood(foodName); // Mở Modal
        } catch (err) {
            alert("Không tải được chi tiết món ăn");
        }
    };

    // 4. Hàm Thêm vào giỏ (QUAN TRỌNG: Xử lý khác quán)
    const handleAddToCart = async (option) => {
        // Chuẩn bị dữ liệu gửi đi
        const payload = {
            food_id: option.food_id,
            branch_id: option.branch_id, // Bắt buộc phải có để backend check
            quantity: 1
        };

        try {
            // Thử thêm vào giỏ
            await api.post('/cart', payload);
            alert("Đã thêm vào giỏ thành công!");
            setSelectedFood(null); // Đóng modal
            
        } catch (err) {
            // Xử lý lỗi logic: Khác quán (Lỗi 409 từ backend)
            if (err.response && err.response.status === 409) {
                const confirmSwitch = window.confirm(
                    "⚠️ Giỏ hàng đang chứa món của quán khác!\n\nBạn có muốn XÓA GIỎ HÀNG CŨ để thêm món của quán này không?"
                );

                if (confirmSwitch) {
                    try {
                        // 1. Xóa giỏ cũ
                        await api.delete('/cart');
                        // 2. Thêm lại món mới
                        await api.post('/cart', payload);
                        alert("Đã tạo giỏ hàng mới thành công!");
                        setSelectedFood(null);
                    } catch (retryErr) {
                        alert("Lỗi khi tạo giỏ mới: " + retryErr.message);
                    }
                }
            } else {
                // Các lỗi khác (401, 500...)
                alert("Lỗi: " + (err.response?.data?.detail || "Không thể thêm vào giỏ"));
            }
        }
    };

    // 5. Đăng xuất
    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    // --- Helper: Định dạng tiền tệ VND ---
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="shop-container">
            {/* --- HEADER --- */}
            <header className="shop-header">
                <h2>🍔 Food Delivery</h2>
                <div className="header-actions">
                    {/* Nút Lịch sử */}
                    <button onClick={() => navigate('/history')} style={{marginRight: '10px', background: '#17a2b8'}}>
                        📜 Lịch sử
                    </button>
                    {/* Bấm nút này sẽ chuyển sang trang Giỏ hàng */}
                    <button className="cart-btn" onClick={() => navigate('/cart')}>
                        Xem Giỏ hàng 🛒
                    </button>
                    <button onClick={handleLogout} className="logout-btn">Đăng xuất</button>
                </div>
            </header>

            {/* --- SEARCH BAR --- */}
            <div className="search-bar">
                <form onSubmit={handleSearch}>
                    <input 
                        placeholder="Bạn muốn ăn gì hôm nay?..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit">Tìm kiếm</button>
                </form>
            </div>

            {/* --- DANH SÁCH MÓN ĂN (GRID) --- */}
            <div className="food-grid">
                {foods.map((food, index) => (
                    <div key={index} className="food-card" onClick={() => handleViewOptions(food.name)}>
                        <div className="food-image-placeholder">🍖</div>
                        <h3>{food.name}</h3>
                        <p className="price-range">
                            {formatMoney(food.min_price)} 
                            {food.min_price !== food.max_price && ` - ${formatMoney(food.max_price)}`}
                        </p>
                        <span className="badge">{food.branch_count} quán đang bán</span>
                    </div>
                ))}
            </div>

            {/* --- MODAL CHI TIẾT (Chọn quán) --- */}
            {selectedFood && (
                <div className="modal-overlay" onClick={() => setSelectedFood(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Chọn quán bán: {selectedFood}</h3>
                        <button className="close-btn" onClick={() => setSelectedFood(null)}>×</button>
                        
                        <div className="options-list">
                            {foodOptions.map((opt) => (
                                <div key={opt.food_id} className="option-item">
                                    <div className="option-info">
                                        <strong>{opt.branch_name}</strong>
                                        <div>
                                            {opt.discount > 0 && <span className="old-price">{formatMoney(opt.original_price)}</span>}
                                            <span className="final-price">{formatMoney(opt.final_price)}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleAddToCart(opt)}>+ Thêm</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Shop;
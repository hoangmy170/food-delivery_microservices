import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from './api';

function Shop() {
    const [foods, setFoods] = useState([]);
    const [searchTerm, setSearchTerm] = useState(''); 
    const [selectedFood, setSelectedFood] = useState(null); 
    const [foodOptions, setFoodOptions] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchFoods();
    }, []);

    const fetchFoods = async (query = '') => {
        try {
            const res = await api.get(`/foods/search?q=${query}`);
            setFoods(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchFoods(searchTerm);
    };

    const handleViewOptions = async (foodName) => {
        try {
            const res = await api.get(`/foods/options?name=${foodName}`);
            setFoodOptions(res.data);
            setSelectedFood(foodName);
        } catch (err) {
            toast.error("Không tải được chi tiết món ăn");
        }
    };

    const handleAddToCart = async (option) => {
        const payload = {
            food_id: option.food_id,
            branch_id: option.branch_id,
            quantity: 1
        };

        try {
            await api.post('/cart', payload);
            toast.success(`Đã thêm "${selectedFood}" vào giỏ! 🛒`);
            setSelectedFood(null);
            
        } catch (err) {
            if (err.response && err.response.status === 409) {
                const confirmSwitch = window.confirm("⚠️ Giỏ hàng khác quán! Bạn có muốn XÓA GIỎ CŨ để thêm món mới?");
                if (confirmSwitch) {
                    try {
                        await api.delete('/cart');
                        await api.post('/cart', payload);
                        toast.success("Đã tạo giỏ mới thành công! 🛒");
                        setSelectedFood(null);
                    } catch (retryErr) {
                        toast.error("Lỗi khi tạo giỏ mới");
                    }
                }
            } else {
                toast.error(err.response?.data?.detail || "Lỗi thêm vào giỏ");
            }
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
        toast.info("Đã đăng xuất.");
    };

    const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    return (
        <div className="shop-container">
            <header className="shop-header">
                <h2>🍔 Food Delivery</h2>
                <div className="header-actions">
                    {/* Nút vào Hồ sơ */}
                    <button onClick={() => navigate('/profile')} style={{marginRight: '10px', background: '#6610f2'}}>
                        👤 Hồ sơ
                    </button>
                    <button onClick={() => navigate('/history')} style={{marginRight: '10px', background: '#17a2b8'}}>
                        📜 Lịch sử
                    </button>
                    <button className="cart-btn" onClick={() => navigate('/cart')}>
                        Xem Giỏ hàng 🛒
                    </button>
                    <button onClick={handleLogout} className="logout-btn">Đăng xuất</button>
                </div>
            </header>

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
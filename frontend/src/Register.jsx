import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';

function Register() {
    // 1. Khai báo các biến lưu trữ dữ liệu nhập vào
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: '' // Dùng để kiểm tra khớp mật khẩu
    });
    
    // Biến lưu thông báo lỗi để hiện lên màn hình
    const [error, setError] = useState('');
    
    const navigate = useNavigate();

    // 2. Hàm xử lý khi người dùng gõ phím
    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };

    // 3. Hàm xử lý khi bấm nút Đăng ký
    const handleRegister = async (e) => {
        e.preventDefault();
        setError(''); // Xóa lỗi cũ trước khi gửi

        // --- Kiểm tra mật khẩu nhập lại ---
        if (formData.password !== formData.confirmPassword) {
            setError("Mật khẩu xác nhận không khớp!");
            return;
        }

        try {
            // --- Chuẩn bị gói tin gửi đi ---
            const payload = { 
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                password: formData.password,
                role: 'buyer',      // Mặc định là khách hàng
                address: ""         // Gửi chuỗi rỗng để tránh lỗi 422
            };
            
            // Gọi API đăng ký
            await api.post('/register', payload);
            
            // Nếu thành công:
            alert("Đăng ký thành công! Bạn có thể đăng nhập ngay.");
            navigate('/'); // Chuyển về trang Login

        } catch (err) {
            console.error("Chi tiết lỗi:", err); // Xem lỗi kỹ hơn ở Console (F12)

            // --- XỬ LÝ LỖI KHÔNG BỊ SẬP TRANG ---
            let errorMsg = "Đăng ký thất bại. Vui lòng thử lại.";

            if (err.response && err.response.data) {
                const detail = err.response.data.detail;

                if (Array.isArray(detail)) {
                    // Đây là lỗi 422 (Validation Error)
                    // Ví dụ: Lỗi định dạng email
                    const firstError = detail[0];
                    // Lấy tên trường bị lỗi (ví dụ: email, phone...)
                    const fieldName = firstError.loc[firstError.loc.length - 1]; 
                    errorMsg = `Lỗi ở trường '${fieldName}': ${firstError.msg}`;
                } else if (typeof detail === 'string') {
                    // Lỗi thông thường (400, 401...)
                    errorMsg = detail;
                } else {
                    // Lỗi dạng Object khác
                    errorMsg = JSON.stringify(detail);
                }
            } else if (err.message) {
                errorMsg = err.message;
            }

            setError(errorMsg);
        }
    };

    return (
        <div className="container">
            <h2>Đăng ký Tài khoản</h2>
            
            <form onSubmit={handleRegister} className="auth-form">
                {/* Họ tên */}
                <input 
                    name="name" 
                    placeholder="Họ và tên" 
                    value={formData.name}
                    onChange={handleChange} 
                    required 
                />

                {/* Số điện thoại */}
                <input 
                    name="phone" 
                    placeholder="Số điện thoại" 
                    value={formData.phone}
                    onChange={handleChange} 
                    required 
                />

                {/* Email */}
                <input 
                    name="email" 
                    type="email" 
                    placeholder="Email" 
                    value={formData.email}
                    onChange={handleChange} 
                    required 
                />

                {/* Mật khẩu */}
                <input 
                    name="password" 
                    type="password" 
                    placeholder="Mật khẩu" 
                    value={formData.password}
                    onChange={handleChange} 
                    required 
                />

                {/* Nhập lại mật khẩu */}
                <input 
                    name="confirmPassword" 
                    type="password" 
                    placeholder="Nhập lại mật khẩu" 
                    value={formData.confirmPassword}
                    onChange={handleChange} 
                    required 
                />
                
                {/* Khu vực hiển thị lỗi */}
                {error && (
                    <div style={{
                        color: '#721c24', 
                        backgroundColor: '#f8d7da', 
                        padding: '10px', 
                        borderRadius: '4px',
                        fontSize: '14px',
                        marginTop: '10px'
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <button type="submit" style={{marginTop: '15px'}}>Đăng ký ngay</button>
            </form>

            <p style={{marginTop: '15px'}}>
                Đã có tài khoản? <Link to="/">Đăng nhập</Link>
            </p>
        </div>
    );
}

export default Register;
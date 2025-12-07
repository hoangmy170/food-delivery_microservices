import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await api.post('/login', { email, password });
            
            // Lấy các thông tin từ server trả về
            // QUAN TRỌNG: user_service cần trả về field 'id' (ID của user)
            const { access_token, role, seller_mode, branch_id, id } = res.data;

            // Lưu vào localStorage
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('role', role);
            if (seller_mode) localStorage.setItem('seller_mode', seller_mode);
            if (branch_id) localStorage.setItem('branch_id', branch_id);
            
            // --- LƯU USER ID ĐỂ DÙNG KHI ĐẶT HÀNG ---
            if (id) localStorage.setItem('user_id', id);

            alert("Đăng nhập thành công!");

            if (role === 'seller') {
                navigate('/seller-dashboard');
            } else {
                navigate('/shop');
            }

        } catch (err) {
            console.error(err);
            setError('Sai email hoặc mật khẩu!');
        }
    };

    return (
        <div className="container">
            <h2>Đăng nhập</h2>
            <form onSubmit={handleLogin} className="auth-form">
                <input 
                    type="email" placeholder="Email" required
                    value={email} onChange={e => setEmail(e.target.value)} 
                />
                <input 
                    type="password" placeholder="Mật khẩu" required
                    value={password} onChange={e => setPassword(e.target.value)} 
                />
                <button type="submit">Đăng nhập</button>
            </form>
            {error && <p className="error">{error}</p>}
            <p style={{marginTop: '15px'}}>
                Chưa có tài khoản? <Link to="/register">Đăng ký Buyer ngay</Link>
            </p>
        </div>
    );
}

export default Login;
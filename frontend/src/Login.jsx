import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from './api';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/login', { email, password });
            
            const { access_token, role, seller_mode, branch_id, id } = res.data;

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('role', role);
            if (seller_mode) localStorage.setItem('seller_mode', seller_mode);
            if (branch_id) localStorage.setItem('branch_id', branch_id);
            if (id) localStorage.setItem('user_id', id);

            toast.success("Đăng nhập thành công! 👋");

            if (role === 'seller') {
                navigate('/seller-dashboard');
            } else {
                navigate('/shop');
            }

        } catch (err) {
            console.error(err);
            toast.error("Sai email hoặc mật khẩu! ❌");
        } finally {
            setLoading(false);
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
                <button type="submit" disabled={loading}>
                    {loading ? <><span className="spinner"></span> Đang xử lý...</> : "Đăng nhập"}
                </button>
            </form>
            
            <p style={{marginTop: '15px'}}>
                Chưa có tài khoản? <Link to="/register">Đăng ký Buyer ngay</Link>
            </p>
        </div>
    );
}

export default Login;
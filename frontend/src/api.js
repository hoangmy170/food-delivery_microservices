import axios from 'axios';

// Gọi vào Gateway (Port 8000)
const API_URL = 'http://localhost:8000'; 

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Tự động gắn Token vào Header nếu đã đăng nhập
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Shop from './Shop'; 
import SellerDashboard from './SellerDashboard';
import Cart from './Cart'; // <--- Import trang Giỏ hàng mới
import './App.css';
import Checkout from './Checkout';
import OrderHistory from './OrderHistory';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Mặc định vào trang Login */}
        <Route path="/" element={<Login />} />
        
        {/* 2. Trang Đăng ký */}
        <Route path="/register" element={<Register />} />
        
        {/* 3. Trang Mua hàng (Shop) */}
        <Route path="/shop" element={<Shop />} />

        {/* 4. Trang Giỏ hàng (Cart) */}
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/history" element={<OrderHistory />} />
        
        {/* 5. Trang Quản lý (Seller) */}
        <Route path="/seller-dashboard" element={<SellerDashboard />} />
        
        {/* Chống đi lạc */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
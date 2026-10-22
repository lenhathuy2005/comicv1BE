import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAdminAuth, loginAdmin, saveAdminAuth } from '../../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    identifier: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorText('');
    setLoading(true);

    try {
      const data = await loginAdmin(form);

      if (data?.user?.roleCode !== 'admin') {
        clearAdminAuth();
        throw new Error('Tài khoản này không có quyền admin');
      }

      saveAdminAuth(data);
      navigate('/admin/dashboard');
    } catch (error) {
      setErrorText(error.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Admin Login</h1>
        <p className="login-subtitle">Đăng nhập để vào trang quản trị</p>

        <label className="field">
          <span>Email hoặc username</span>
          <input
            type="text"
            name="identifier"
            value={form.identifier}
            onChange={handleChange}
            placeholder="Nhập email hoặc username"
            required
          />
        </label>

        <label className="field">
          <span>Mật khẩu</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Nhập mật khẩu"
            required
          />
        </label>

        {errorText ? <div className="error-box">{errorText}</div> : null}

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
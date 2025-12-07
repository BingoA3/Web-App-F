import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api.js';
import { useAuth } from '../authContext.jsx';

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      setUser({
        user_id: data.user_id,
        display_name: data.display_name,
        email: data.email,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>信用卡回饋模擬器 - 登入</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '登入中…' : '登入'}
        </button>
      </form>
      <p style={{ marginTop: '12px' }}>
        還沒有帳號？ <Link to="/signup">註冊</Link>
      </p>
    </div>
  );
}

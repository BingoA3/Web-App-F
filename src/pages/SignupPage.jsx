import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '../api.js';
import { useAuth } from '../authContext.jsx';

export default function SignupPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await signup(email, password, displayName);
      setUser({
        user_id: data.user_id,
        display_name: data.display_name,
        email: data.email,
      });
      navigate('/cards');
    } catch (err) {
      setError(err.message || '註冊失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>建立新帳號</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>顯示名稱</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
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
          {loading ? '註冊中…' : '註冊'}
        </button>
      </form>
      <p style={{ marginTop: '12px' }}>
        已有帳號？ <Link to="/login">登入</Link>
      </p>
    </div>
  );
}

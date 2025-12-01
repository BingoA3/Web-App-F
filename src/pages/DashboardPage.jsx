import React, { useEffect, useState } from 'react';
import { getDashboard } from '../api.js';
import { useAuth } from '../authContext.jsx';
import { Link, useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err.message || '載入失敗'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page">主頁載入中...</div>;

  return (
    <div className="page">
      <header>
        <h1>信用卡回饋模擬器</h1>
        <div>
          <span style={{ marginRight: '12px' }}>Hi, {user?.display_name}</span>
          <button
            className="secondary"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            登出
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>本月總覽</h2>
        <div className="stat-cards">
          <div className="stat-card">
            <div className="badge">本月總消費</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: 4 }}>
              NT$ {data.summary.current_month_spending}
            </div>
          </div>
          <div className="stat-card">
            <div className="badge">本月估計總回饋</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: 4 }}>
              NT$ {data.summary.current_month_rewards_value}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>我的信用卡</h2>
          <Link to="/cards">編輯卡片設定</Link>
        </div>
        <div className="stat-cards">
          {data.cards.map((card) => (
            <div key={card.card_id} className="stat-card">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {card.bank_name} - {card.card_name}
              </div>
              <div>本月消費：NT$ {card.month_spending}</div>
              <div>
                累積回饋：{card.reward_mode} {card.month_reward_amount}
              </div>
              {card.hit_monthly_cap && (
                <div style={{ color: '#b91c1c', marginTop: 4 }}>⚠ 已達本月回饋上限</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>近期消費紀錄</h2>
          <Link to="/transactions/new">＋ 新增一筆消費</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>店家</th>
              <th>類別</th>
              <th>金額</th>
              <th>使用卡片</th>
              <th>回饋</th>
            </tr>
          </thead>
          <tbody>
            {data.recent_transactions.map((tx) => (
              <tr key={tx.transaction_id}>
                <td>{tx.date}</td>
                <td>{tx.merchant_name}</td>
                <td>{tx.category_name}</td>
                <td>NT$ {tx.amount}</td>
                <td>{tx.card_name}</td>
                <td>
                  {tx.reward_mode} {tx.reward_amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

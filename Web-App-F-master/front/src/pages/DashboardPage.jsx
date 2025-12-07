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
              
              {/* 【修正點】：顯示累積回饋總數值 */}
              <div style={{ marginTop: 4, fontWeight: 600 }}>
                累積回饋總數值：{card.total_rewards_gained}
              </div>
              
              {/* 【修正點】：顯示回饋細項清單 (Reward Detail) */}
              {card.reward_detail && card.reward_detail.length > 0 && (
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', fontSize: '0.9em', marginTop: '4px' }}>
                  {card.reward_detail.map((detail, index) => (
                    <li key={index}>
                      {detail.total_reward} {detail.reward_mode}
                    </li>
                  ))}
                </ul>
              )}

              {/* ⚠️ 注意：單卡回饋上限 (hit_monthly_cap) 資訊只在 POST /transactions 計算時存在，
                   不在 dashboard 的歷史資料中，故移除。 */}

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
                <th>商家</th>
                <th>類別</th>
                <th>金額</th>
                <th>卡片</th>
                <th>回饋類型</th>
                <th>回饋金額</th>
            </tr>
          </thead>
          <tbody>
            {/* 修正點 2: 確保 data?.recent_transactions 是一個陣列，否則給空陣列 */}
            {(data?.recent_transactions || []).map((tx) => ( 
              <tr key={tx.transaction_id}>
                <td>{tx.date}</td>
                <td>{tx.merchant_name}</td>
                <td>{tx.category_name}</td>
                <td>NT$ {tx.amount}</td>
                <td>{tx.card_name}</td>
                <td>{tx.reward_mode}</td>
                <td>{tx.reward_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
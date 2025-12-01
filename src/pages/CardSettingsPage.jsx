import React, { useEffect, useState } from 'react';
import { getAllCards, getUserCards, updateUserCards } from '../api.js';
import { useNavigate } from 'react-router-dom';

export default function CardSettingsPage() {
  const [allCards, setAllCards] = useState([]);
  const [selectedIds, setSelectedIds] = useState([null, null, null]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [cards, userCards] = await Promise.all([
          getAllCards(),
          getUserCards(),
        ]);
        setAllCards(cards);
        if (userCards && userCards.length > 0) {
          const ids = userCards.map((c) => c.card_id);
          while (ids.length < 3) ids.push(null);
          setSelectedIds(ids.slice(0, 3));
        }
      } catch (err) {
        setError(err.message || '載入卡片資料失敗');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateSlot(index, value) {
    const newIds = [...selectedIds];
    newIds[index] = value ? Number(value) : null;
    setSelectedIds(newIds);
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const cardIds = selectedIds.filter((id) => id !== null);
      await updateUserCards(cardIds);
      navigate('/');
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page">卡片資料載入中...</div>;

  return (
    <div className="page">
      <h1>設定我的信用卡</h1>
      <p>請從下方選擇最多三張你實際持有的卡片，系統會根據這些卡來模擬回饋。</p>

      {[0, 1, 2].map((idx) => (
        <div key={idx}>
          <label>卡片 {idx + 1}</label>
          <select
            value={selectedIds[idx] || ''}
            onChange={(e) => updateSlot(idx, e.target.value || null)}
          >
            <option value="">（未設定）</option>
            {allCards.map((card) => (
              <option key={card.card_id} value={card.card_id}>
                {card.bank_name} - {card.card_name}
              </option>
            ))}
          </select>
        </div>
      ))}

      {error && <p className="error">{error}</p>}

      <button onClick={handleSave} disabled={saving}>
        {saving ? '儲存中…' : '儲存設定'}
      </button>
    </div>
  );
}

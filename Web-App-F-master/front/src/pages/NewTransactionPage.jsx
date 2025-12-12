import React, { useEffect, useState } from 'react';

import {

  getMerchants,

  getCategories,

  simulateRewards,

  createTransaction,

} from '../api.js';

import { useNavigate } from 'react-router-dom';



export default function NewTransactionPage() {

  const [merchants, setMerchants] = useState([]);

  // 儲存所有類別的原始清單

  const [categories, setCategories] = useState([]); 

  // 【新增】儲存篩選後要顯示的類別清單

  const [filteredCategories, setFilteredCategories] = useState([]); 

  

  const [merchantId, setMerchantId] = useState('');

  const [categoryId, setCategoryId] = useState('');

  const [amount, setAmount] = useState('');

  const [simResult, setSimResult] = useState(null);

  const [simLoading, setSimLoading] = useState(false);

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState('');

  const navigate = useNavigate();



  useEffect(() => {

    async function loadData() {

      try {

        // 載入所有店家和所有類別

        const [m, c] = await Promise.all([getMerchants(), getCategories()]); 

        setMerchants(m);

        // 將所有類別儲存起來

        setCategories(c);

      } catch (err) {

        setError(err.message || '載入店家/類別失敗');

      }

    }

    loadData();

  }, []);



  // 監聽 merchantId 或 categories 變動，進行類別篩選

  useEffect(() => {

    // 1. 當店家改變時，清除已選擇的類別

    setCategoryId(''); 



    // 2. 篩選類別

    if (merchantId) {

      // 假設 categories 陣列中的每個物件都包含 merchant_id

      const filtered = categories.filter(c => Number(c.merchant_id) === Number(merchantId));

      setFilteredCategories(filtered);

    } else {

      // 如果沒有選擇店家，則清空類別清單

      setFilteredCategories([]);

    }

  }, [merchantId, categories]); 



  async function handleSimulate(e) {

    e.preventDefault();

    setError('');

    setSimLoading(true);

    setSimResult(null);

    try {

      const result = await simulateRewards({

        merchant_id: Number(merchantId),

        category_id: Number(categoryId),

        amount: Number(amount),

      });

      setSimResult(result);

    } catch (err) {

      setError(err.message || '模擬失敗');

    } finally {

      setSimLoading(false);

    }

  }



  async function handleCreateTransaction(cardId) {

    setError('');

    setCreating(true);

    try {

      await createTransaction({

        merchant_id: Number(merchantId),

        category_id: Number(categoryId),

        amount: Number(amount),

        used_card_id: cardId,

        transaction_date: new Date().toISOString().slice(0, 10),

      });

      navigate('/');

    } catch (err) {

      setError(err.message || '建立消費紀錄失敗');

    } finally {

      setCreating(false);

    }

  }



  // 【新增邏輯】：從模擬結果中找出最佳卡片的名稱

  let bestCardName = 'N/A';

  if (simResult && simResult.best_card_id) {

    const bestCard = simResult.cards.find(card => card.card_id === simResult.best_card_id);

    if (bestCard) {

      bestCardName = `${bestCard.bank_name} - ${bestCard.card_name}`;

    }

  }



  return (

    <div className="page">

      <h1>新增一筆消費</h1>



      <form onSubmit={handleSimulate}>

        <div>

          <label>店家</label>

          <select

            value={merchantId}

            onChange={(e) => setMerchantId(e.target.value)}

            required

          >

            <option value="">請選擇店家</option>

            {merchants.map((m) => (

              <option key={m.merchant_id} value={m.merchant_id}>

                {m.merchant_name}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label>消費類別</label>

          <select

            value={categoryId}

            onChange={(e) => setCategoryId(e.target.value)}

            required

            disabled={!merchantId} 

          >

            <option value="">請選擇類別</option>

            {filteredCategories.map((c) => (

              <option key={c.category_id} value={c.category_id}>

                {c.category_name}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label>預計花費金額（NT$）</label>

          <input

            type="number"

            min="1"

            value={amount}

            onChange={(e) => setAmount(e.target.value)}

            required

          />

        </div>



        {error && <p className="error">{error}</p>}



        <button type="submit" disabled={simLoading || !merchantId || !categoryId || !amount}>

          {simLoading ? '計算中…' : '計算回饋'}

        </button>

      </form>



      {simResult && (

        <section>

          <h2>不同卡片回饋比較</h2>

          {/* 【核心修正】：改為顯示卡片名稱 */}

          <p>系統判定最佳卡片：{bestCardName}</p> 

          <table>

            <thead>

              <tr>

                <th>卡片</th>

                <th>回饋模式</th>

                <th>回饋數量</th>

                <th>等值現金</th>

                <th>備註</th>

                <th>使用這張卡</th>

              </tr>

            </thead>

            <tbody>

              {simResult.cards.map((card) => (

                <tr

                  key={card.card_id}

                  className={

                    // 判斷是否為最佳卡片，讓該列高亮

                    card.card_id === simResult.best_card_id ? 'best-row' : ''

                  }

                >

                  <td>

                    {card.bank_name} - {card.card_name}

                  </td>

                  <td>{card.reward_mode}</td>

                  <td>{card.reward_amount}</td>

                  <td>{card.reward_value_estimated}</td>

                  <td>{card.note}</td>

                  <td>

                    <button

                      onClick={() => handleCreateTransaction(card.card_id)}

                      disabled={creating}

                    >

                      用這張卡建立紀錄

                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </section>

      )}

    </div>

  );

}

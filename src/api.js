// 真實後端版 API：用 fetch 串接後端，而不是用前端 mock 資料

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

// 共用的 request 函式
async function request(path, { method = "GET", body, headers } = {}) {
  const token = localStorage.getItem("token");

  const finalHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // 沒有 body 也沒關係，例如 204 No Content
  }

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `請求失敗（${res.status}）`;
    throw new Error(message);
  }

  return data;
}

// ========== 認證相關 ==========

export async function signup(email, password, display_name) {
  const data = await request("/auth/signup", {
    method: "POST",
    body: { email, password, display_name },
  });

  // 後端請回傳 { user_id, display_name, email, token }
  if (data.token) {
    localStorage.setItem("token", data.token);
  }
  if (data.user_id) {
    localStorage.setItem("user_id", String(data.user_id));
  }

  return data;
}

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  // 同樣預期後端回傳 { user_id, display_name, email, token }
  if (data.token) {
    localStorage.setItem("token", data.token);
  }
  if (data.user_id) {
    localStorage.setItem("user_id", String(data.user_id));
  }

  return data;
}

export async function getCurrentUser() {
  // 預期後端依照 token 回傳目前使用者資訊
  // 例如 { user_id, email, display_name }
  const data = await request("/auth/me");
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_id");
}

// ========== 信用卡設定相關 ==========

export async function getAllCards() {
  // 回傳所有可選的卡片列表
  // 例如 [{ card_id, bank_name, card_name, ... }, ...]
  return request("/cards");
}

export async function getUserCards() {
  // 回傳使用者目前設定的「三張卡」或卡片 ID 陣列
  // 例如 { user_id, card_ids: [1, 2, 3] }
  return request("/user/cards");
}

export async function updateUserCards(cardIds) {
  // 前端呼叫時會丟一個長度最多 3 的陣列
  // 例如 [1, 2, null]
  return request("/user/cards", {
    method: "PUT",
    body: { card_ids: cardIds },
  });
}

// ========== 店家與消費類別 ==========

export async function getMerchants() {
  // 例如回傳 [{ merchant_id, name, ... }, ...]
  return request("/merchants");
}

export async function getCategories() {
  // 例如回傳 [{ category_id, name, ... }, ...]
  return request("/categories");
}

// ========== 消費模擬與建立紀錄 ==========

export async function simulateRewards({ merchant_id, category_id, amount }) {
  // 預期後端接收這三個欄位，回傳每張卡的回饋模擬結果
  // 回傳格式請配合 NewTransactionPage 目前使用的欄位
  return request("/transactions/simulate", {
    method: "POST",
    body: { merchant_id, category_id, amount },
  });
}

export async function createTransaction({
  merchant_id,
  category_id,
  amount,
  used_card_id,
  transaction_date,
}) {
  // 預期後端建立一筆交易，並計算實際回饋
  // 回傳建立好的 transaction 物件即可
  return request("/transactions", {
    method: "POST",
    body: {
      merchant_id,
      category_id,
      amount,
      used_card_id,
      transaction_date,
    },
  });
}

export async function getTransactions({ limit = 10, page = 1, month = "" } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  if (page) qs.set("page", String(page));
  if (month) qs.set("month", month);

  const query = qs.toString();
  return request(`/transactions${query ? `?${query}` : ""}`);
}

// ========== 儀表板（首頁） ==========

export async function getDashboard() {
  // 預期後端直接把「本月總覽」資料算好回傳
  // 建議格式：
  // {
  //   summary: {
  //     current_month_spending,
  //     current_month_rewards_value
  //   },
  //   cards: [...],
  //   recent_transactions: [...]
  // }
  return request("/dashboard");
}

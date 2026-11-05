/**
 * ElectroHub Frontend Application Logic
 * Integrates electronic catalog, secure JWT authentication, cart, and technical utility endpoints.
 */

let productsState = [];
let cartState = JSON.parse(localStorage.getItem("electrohub_cart") || "[]");
let currentUser = JSON.parse(localStorage.getItem("electrohub_user") || "null");
let authToken = localStorage.getItem("electrohub_token") || null;

document.addEventListener("DOMContentLoaded", () => {
  initAuthUI();
  initProducts();
  initCategories();
  initSearch();
  initTools();
  initCartUI();
  updateCartBadge();
});

// Toast notification helper
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// ----------------------------------------------------
// 1. Authentication UI & Logic
// ----------------------------------------------------
function initAuthUI() {
  const authStatus = document.getElementById("authStatus");
  const loginModal = document.getElementById("loginModal");
  const closeModal = document.getElementById("closeModal");
  const loginForm = document.getElementById("loginForm");

  if (currentUser && authToken) {
    authStatus.innerHTML = `
      <div class="user-pill" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; color: var(--primary);">👤 <b>${currentUser.fullName || currentUser.username}</b> (${currentUser.role})</span>
        <button id="logoutBtn" class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;">Đăng Xuất</button>
      </div>
    `;
    document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  } else {
    authStatus.innerHTML = `<button id="loginBtn" class="btn btn-outline">Đăng Nhập</button>`;
    document.getElementById("loginBtn").addEventListener("click", () => {
      loginModal.classList.add("active");
    });
  }

  closeModal.addEventListener("click", () => {
    loginModal.classList.remove("active");
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Đăng nhập thất bại", "error");
        return;
      }

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem("electrohub_token", authToken);
      localStorage.setItem("electrohub_user", JSON.stringify(currentUser));

      loginModal.classList.remove("active");
      initAuthUI();
      showToast(`Chào mừng ${currentUser.fullName || currentUser.username}!`, "success");
    } catch (err) {
      showToast("Lỗi kết nối máy chủ", "error");
    }
  });
}

function handleLogout() {
  localStorage.removeItem("electrohub_token");
  localStorage.removeItem("electrohub_user");
  authToken = null;
  currentUser = null;
  initAuthUI();
  showToast("Đã đăng xuất tài khoản", "info");
}

// ----------------------------------------------------
// 2. Electronic Products Catalog
// ----------------------------------------------------
async function initProducts(category = "All") {
  const grid = document.getElementById("productGrid");
  const metaCount = document.getElementById("productTotalCount");
  grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Đang nạp dữ liệu linh kiện...</p>`;

  try {
    const url = category && category !== "All" ? `/api/products?category=${encodeURIComponent(category)}` : "/api/products";
    const res = await fetch(url);
    const data = await res.json();
    productsState = data.products || [];

    metaCount.textContent = `Tổng: ${productsState.length} linh kiện`;
    renderProductCards(productsState);
  } catch (err) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--danger);">Không thể nạp danh sách sản phẩm.</p>`;
  }
}

function renderProductCards(products) {
  const grid = document.getElementById("productGrid");
  if (!products.length) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Không tìm thấy linh kiện phù hợp tiêu chí.</p>`;
    return;
  }

  grid.innerHTML = products.map(prod => `
    <div class="product-card">
      <div class="card-img-wrap">
        <img src="${prod.image}" alt="${prod.name}" loading="lazy">
        <span class="card-category-badge">${prod.category}</span>
      </div>
      <div class="card-body">
        <h4 class="card-title">${prod.name}</h4>
        <p class="card-desc">${prod.description}</p>
        <div class="card-meta">
          <span class="card-price">${prod.price.toLocaleString("vi-VN")} đ</span>
          <span class="card-stock">Kho: ${prod.stock}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-datasheet" onclick="downloadFile('${prod.datasheet}')">📄 Datasheet</button>
          <button class="btn btn-add-cart" onclick="addToCart(${prod.id})">🛒 Chọn Mua</button>
        </div>
      </div>
    </div>
  `).join("");
}

function initCategories() {
  const pills = document.querySelectorAll(".cat-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const category = pill.getAttribute("data-category");
      initProducts(category);
    });
  });
}

function initSearch() {
  const input = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  const runSearch = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      renderProductCards(productsState);
      return;
    }
    const filtered = productsState.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
    renderProductCards(filtered);
  };

  input.addEventListener("input", runSearch);
  searchBtn.addEventListener("click", runSearch);
}

// ----------------------------------------------------
// 3. Technical Utility Endpoints (Mapped to Security Scenarios)
// ----------------------------------------------------
function initTools() {
  // A. Preview Echo Tool (products.js: GET /preview/echo)
  const previewInput = document.getElementById("previewInput");
  const previewBtn = document.getElementById("previewBtn");
  const previewResult = document.getElementById("previewResult");

  previewBtn.addEventListener("click", async () => {
    const text = previewInput.value.trim();
    if (!text) {
      showToast("Vui lòng nhập tên linh kiện cần xem trước", "warning");
      return;
    }

    previewResult.innerHTML = `<span class="placeholder-text">Đang gửi yêu cầu xem trước...</span>`;

    try {
      const res = await fetch(`/preview/echo?name=${encodeURIComponent(text)}`);
      const data = await res.json();

      // SECURE DISPLAY: Renders escaped text content safely
      previewResult.innerHTML = `
        <div class="preview-rendered">
          <div style="font-weight: bold; margin-bottom: 4px;">🏷️ Kết quả Echo Preview (JSON Sanitized):</div>
          <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
            <span>Tên đã xử lý an toàn: <b>${escapeHtmlClient(data.name)}</b></span><br>
            <span style="font-size: 11px; color: var(--text-muted);">Timestamp: ${data.timestamp}</span>
          </div>
        </div>
      `;
    } catch (err) {
      previewResult.innerHTML = `<span style="color: var(--danger);">Lỗi gọi endpoint preview</span>`;
    }
  });

  // B. Order Tracker (orders.js: GET /api/orders/:id)
  const orderIdInput = document.getElementById("orderIdInput");
  const orderLookupBtn = document.getElementById("orderLookupBtn");
  const orderResult = document.getElementById("orderResult");

  orderLookupBtn.addEventListener("click", async () => {
    const id = orderIdInput.value.trim();
    if (!id) {
      showToast("Vui lòng nhập ID đơn hàng", "warning");
      return;
    }

    if (!authToken) {
      showToast("Vui lòng đăng nhập trước khi tra cứu đơn hàng cá nhân", "warning");
      document.getElementById("loginModal").classList.add("active");
      return;
    }

    orderResult.innerHTML = `<span class="placeholder-text">Đang xác thực và truy vấn đơn hàng #${id}...</span>`;

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        orderResult.innerHTML = `
          <div style="color: var(--danger); text-align: left; width: 100%;">
            <b>⛔ Từ chối truy cập (HTTP ${res.status}):</b> ${data.error || "Không có quyền"}
            <br><small style="color: var(--text-muted);">Hệ thống đã xác thực quyền sở hữu giữa tài khoản của bạn và đơn hàng #${id}.</small>
          </div>
        `;
        return;
      }

      orderResult.innerHTML = `
        <div style="width: 100%; text-align: left;">
          <div style="color: var(--secondary); font-weight: bold; margin-bottom: 4px;">✅ Đơn Hàng #${data.id} - ${data.status}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Khách hàng: <b>${data.customerName}</b> | Địa chỉ: ${data.shippingAddress}</div>
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            Tổng tiền: <b style="color: var(--secondary);">${data.totalAmount.toLocaleString("vi-VN")} đ</b> (${data.paymentMethod})
          </div>
        </div>
      `;
    } catch (err) {
      orderResult.innerHTML = `<span style="color: var(--danger);">Lỗi kết nối khi tra cứu đơn hàng</span>`;
    }
  });

  // C. Datasheet Downloader (files.js: GET /api/files/download)
  const datasheetSelect = document.getElementById("datasheetSelect");
  const downloadDatasheetBtn = document.getElementById("downloadDatasheetBtn");

  downloadDatasheetBtn.addEventListener("click", () => {
    const filename = datasheetSelect.value;
    downloadFile(filename);
  });
}

function downloadFile(filename) {
  if (!filename) return;
  showToast(`Đang tải tài liệu: ${filename}`, "info");
  window.location.href = `/api/files/download?file=${encodeURIComponent(filename)}`;
}

function escapeHtmlClient(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ----------------------------------------------------
// 4. Shopping Cart State
// ----------------------------------------------------
function initCartUI() {
  const cartBtn = document.getElementById("cartBtn");
  const cartDrawer = document.getElementById("cartDrawer");
  const closeCart = document.getElementById("closeCart");
  const checkoutBtn = document.getElementById("checkoutBtn");

  cartBtn.addEventListener("click", () => {
    renderCartItems();
    cartDrawer.classList.add("active");
  });

  closeCart.addEventListener("click", () => {
    cartDrawer.classList.remove("active");
  });

  checkoutBtn.addEventListener("click", handleCheckout);
}

function addToCart(productId) {
  const prod = productsState.find(p => p.id === productId);
  if (!prod) return;

  const existing = cartState.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cartState.push({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      quantity: 1
    });
  }

  saveCart();
  updateCartBadge();
  showToast(`Đã thêm "${prod.name}" vào giỏ`, "success");
}

function removeFromCart(productId) {
  cartState = cartState.filter(item => item.id !== productId);
  saveCart();
  updateCartBadge();
  renderCartItems();
}

function saveCart() {
  localStorage.setItem("electrohub_cart", JSON.stringify(cartState));
}

function updateCartBadge() {
  const badge = document.getElementById("cartCount");
  const count = cartState.reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = count;
}

function renderCartItems() {
  const list = document.getElementById("cartItemsList");
  const totalSum = document.getElementById("cartTotalSum");

  if (!cartState.length) {
    list.innerHTML = `<p class="empty-cart-msg">Giỏ hàng đang trống.</p>`;
    totalSum.textContent = "0 đ";
    return;
  }

  const total = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  totalSum.textContent = `${total.toLocaleString("vi-VN")} đ`;

  list.innerHTML = cartState.map(item => `
    <div class="cart-item-row">
      <div class="item-info">
        <h5>${item.name}</h5>
        <span>${item.quantity} x ${item.price.toLocaleString("vi-VN")} đ</span>
      </div>
      <button class="item-remove" onclick="removeFromCart(${item.id})">✕</button>
    </div>
  `).join("");
}

async function handleCheckout() {
  if (!cartState.length) {
    showToast("Giỏ hàng của bạn đang trống!", "warning");
    return;
  }

  if (!authToken) {
    showToast("Vui lòng đăng nhập để hoàn tất đơn hàng", "warning");
    document.getElementById("loginModal").classList.add("active");
    return;
  }

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        items: cartState,
        shippingAddress: "Số 268 Lý Thường Kiệt, Quận 10, TP.HCM",
        paymentMethod: "COD"
      })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Đặt hàng thành công! Mã đơn: #${data.order.id}`, "success");
      cartState = [];
      saveCart();
      updateCartBadge();
      renderCartItems();
      document.getElementById("cartDrawer").classList.remove("active");
    } else {
      showToast(data.error || "Lỗi tạo đơn hàng", "error");
    }
  } catch (err) {
    showToast("Không thể gửi đơn hàng", "error");
  }
}

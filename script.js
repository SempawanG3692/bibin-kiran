let allProducts = [];
let cart = [];
let cartData = {};
let productMap = {};
let chart;
let activeCategory = "All";

const CATEGORIES = ["All", "Phones", "Laptops", "TVs", "Cameras", "Smartwatches", "Earphones", "Other"];

/* ================== LOAD PRODUCTS ================== */
async function loadProducts() {
    try {
        const res = await fetch("/products");
        if (!res.ok) throw new Error("Server error");
        allProducts = await res.json();
        productMap = {};
        allProducts.forEach(p => productMap[p._id] = p);
        renderCategoryButtons();
        applyFilters();
    } catch (err) {
        document.getElementById("products").innerHTML =
            `<p class="error-msg">⚠️ Could not load products. Is the server running?</p>`;
    }
}

/* ================== STAR RATING HELPERS ================== */
function renderStars(rating, productId, interactive = false) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    let html = `<div class="stars ${interactive ? "stars-interactive" : ""}" ${interactive ? `data-id="${productId}"` : ""}>`;
    for (let i = 1; i <= 5; i++) {
        let cls = "star-empty";
        if (i <= fullStars) cls = "star-full";
        else if (i === fullStars + 1 && halfStar) cls = "star-half";
        if (interactive) {
            html += `<span class="star ${cls}" onclick="rateProduct('${productId}', ${i})" onmouseover="hoverStars(this, ${i})" onmouseout="resetStars('${productId}', ${rating})">★</span>`;
        } else {
            html += `<span class="star ${cls}">★</span>`;
        }
    }
    html += `</div>`;
    return html;
}

function hoverStars(el, index) {
    const container = el.parentElement;
    const stars = container.querySelectorAll(".star");
    stars.forEach((s, i) => { s.className = "star " + (i < index ? "star-hover" : "star-empty"); });
}

function resetStars(productId, rating) {
    const container = document.querySelector(`.stars-interactive[data-id="${productId}"]`);
    if (!container) return;
    container.innerHTML = "";
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    for (let i = 1; i <= 5; i++) {
        let cls = i <= fullStars ? "star-full" : (i === fullStars + 1 && halfStar ? "star-half" : "star-empty");
        container.innerHTML += `<span class="star ${cls}" onclick="rateProduct('${productId}', ${i})" onmouseover="hoverStars(this, ${i})" onmouseout="resetStars('${productId}', ${rating})">★</span>`;
    }
}

async function rateProduct(id, stars) {
    try {
        const res = await fetch(`/rate/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stars })
        });
        const data = await res.json();
        if (res.ok) {
            if (productMap[id]) { productMap[id].rating = data.rating; productMap[id].ratingCount = data.ratingCount; }
            showToast(`⭐ Rated ${stars} star${stars > 1 ? "s" : ""}! Avg: ${data.rating} (${data.ratingCount} ratings)`);
            const card = document.querySelector(`[data-product-id="${id}"]`);
            if (card) {
                const ratingDiv = card.querySelector(".rating-wrap");
                if (ratingDiv) ratingDiv.innerHTML = renderStars(data.rating, id, true) + `<span class="rating-count">${data.rating} (${data.ratingCount})</span>`;
            }
        } else { showToast("❌ Could not save rating"); }
    } catch (err) { showToast("❌ Server error"); }
}

/* ================== CATEGORY BUTTONS ================== */
function renderCategoryButtons() {
    const container = document.getElementById("categoryBar");
    container.innerHTML = "";
    CATEGORIES.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "btn-cat" + (cat === activeCategory ? " active" : "");
        btn.textContent = cat;
        btn.onclick = () => setCategory(cat);
        container.appendChild(btn);
    });
}

function setCategory(cat) { activeCategory = cat; renderCategoryButtons(); applyFilters(); }

/* ================== APPLY FILTERS ================== */
function applyFilters() {
    const searchVal = document.getElementById("search").value.toLowerCase();
    const sortVal = document.getElementById("sortSelect").value;
    let filtered = [...allProducts];
    if (activeCategory !== "All") filtered = filtered.filter(p => (p.category || "Other") === activeCategory);
    if (searchVal) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
    if (sortVal === "low-high") filtered.sort((a, b) => a.price - b.price);
    else if (sortVal === "high-low") filtered.sort((a, b) => b.price - a.price);
    else if (sortVal === "name-az") filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortVal === "name-za") filtered.sort((a, b) => b.name.localeCompare(a.name));
    displayProducts(filtered);
}

/* ================== DISPLAY PRODUCTS ================== */
function displayProducts(products) {
    const container = document.getElementById("products");
    container.innerHTML = "";
    if (products.length === 0) { container.innerHTML = `<p class="error-msg">No products found.</p>`; return; }
    products.forEach(p => {
        const outOfStock = p.stock <= 0;
        const rating = p.rating || 0;
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("data-product-id", p._id);
        card.innerHTML = `
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="product-img" />
            <h3>${escapeHtml(p.name)}</h3>
            <p class="category-tag">${escapeHtml(p.category || "Other")}</p>
            <div class="rating-wrap">
                ${renderStars(rating, p._id, true)}
                <span class="rating-count">${rating > 0 ? `${rating} (${p.ratingCount || 0})` : "No ratings yet"}</span>
            </div>
            <p class="price">₹${p.price.toLocaleString("en-IN")}</p>
            <p class="stock-label ${outOfStock ? "out" : "in"}">
                ${outOfStock ? "❌ Out of Stock" : `✅ In Stock (${p.stock})`}
            </p>
            <div class="card-actions">
                <button class="btn-addcart ${outOfStock ? "disabled" : ""}" onclick="addToCart('${p._id}')" ${outOfStock ? "disabled" : ""}>Add to Cart 🛒</button>
                <button class="btn-view" onclick="openPopup('${p._id}')">View 🔍</button>
            </div>
        `;
        container.appendChild(card);
    });
}

/* ================== ESCAPE HTML ================== */
function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

/* ================== CART ================== */
function addToCart(id) {
    const p = productMap[id];
    if (!p) return;
    if (p.stock <= 0) { showToast("❌ This item is out of stock!"); return; }
    cart.push({ _id: p._id, name: p.name, price: p.price, image: p.image, orderId: null });
    cartData[p.name] = (cartData[p.name] || 0) + 1;
    document.getElementById("cartCount").innerText = cart.length;
    showToast(`✅ ${p.name} added to cart!`);
}

function displayCart() {
    const container = document.getElementById("cartItems");
    container.innerHTML = "";
    let total = 0;
    if (cart.length === 0) {
        container.innerHTML = `<p class="error-msg">Your cart is empty.</p>`;
        document.getElementById("totalPrice").innerText = "0";
        return;
    }
    cart.forEach((item, index) => {
        total += Number(item.price);
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="product-img" />
            <h3>${escapeHtml(item.name)}</h3>
            <p class="price">₹${Number(item.price).toLocaleString("en-IN")}</p>
            <button class="btn-remove" onclick="removeItem(${index})">Remove ❌</button>
        `;
        container.appendChild(card);
    });
    document.getElementById("totalPrice").innerText = total.toLocaleString("en-IN");
}

async function removeItem(index) {
    const item = cart[index];
    if (!item) return;
    if (item.orderId) {
        try {
            const res = await fetch(`/cancel-order/${item.orderId}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                showToast(`🗑️ Order for ${item.name} cancelled!`);
                if (productMap[item._id]) { productMap[item._id].stock++; applyFilters(); }
            }
        } catch (err) { showToast("❌ Server error while cancelling"); }
    }
    cartData[item.name]--;
    if (cartData[item.name] <= 0) delete cartData[item.name];
    cart.splice(index, 1);
    document.getElementById("cartCount").innerText = cart.length;
    displayCart();
}

/* ================== CHECKOUT FORM ================== */
function showCheckoutForm() {
    if (cart.length === 0) { showToast("❌ Cart is empty!"); return; }

    // Show cart summary in form
    let total = cart.reduce((sum, item) => sum + Number(item.price), 0);
    document.getElementById("checkoutSummaryMini").innerHTML = `
        <div class="mini-summary">
            <span>🛒 ${cart.length} item${cart.length > 1 ? "s" : ""}</span>
            <span class="mini-total">₹${total.toLocaleString("en-IN")}</span>
        </div>
    `;

    // Reset to step 1
    document.getElementById("checkoutStep1").style.display = "block";
    document.getElementById("checkoutStep2").style.display = "none";

    // Show overlay
    document.getElementById("checkoutOverlay").classList.add("show");
    document.body.style.overflow = "hidden";
}

function closeCheckout() {
    document.getElementById("checkoutOverlay").classList.remove("show");
    document.body.style.overflow = "";
}

function closeCheckoutOutside(e) {
    if (e.target.id === "checkoutOverlay") closeCheckout();
}

async function submitCheckout(e) {
    e.preventDefault();

    const customerName    = document.getElementById("cf-name").value.trim();
    const customerEmail   = document.getElementById("cf-email").value.trim();
    const customerPhone   = document.getElementById("cf-phone").value.trim();
    const street          = document.getElementById("cf-street").value.trim();
    const city            = document.getElementById("cf-city").value.trim();
    const pin             = document.getElementById("cf-pin").value.trim();
    const customerAddress = `${street}, ${city} - ${pin}`;
    const paymentMethod   = document.querySelector('input[name="payment"]:checked').value;

    const confirmBtn = document.getElementById("confirmBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Placing Order...";

    let successCount = 0;
    let failedItems = [];

    for (let i = 0; i < cart.length; i++) {
        try {
            const res = await fetch(`/buy/${cart[i]._id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerName, customerEmail, customerPhone, customerAddress, paymentMethod })
            });
            const data = await res.json();
            if (res.ok) { cart[i].orderId = data.order._id; successCount++; }
            else { failedItems.push(`${cart[i].name}: ${data.error}`); }
        } catch (err) { failedItems.push(`${cart[i].name}: Network error`); }
    }

    confirmBtn.disabled = false;
    confirmBtn.textContent = "Place Order 🎉";

    if (successCount > 0) {
        // Show success screen
        document.getElementById("checkoutStep1").style.display = "none";
        document.getElementById("checkoutStep2").style.display = "block";

        const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
        document.getElementById("successDetails").innerHTML = `
            <div class="success-row"><span>👤 Name</span><strong>${escapeHtml(customerName)}</strong></div>
            <div class="success-row"><span>📧 Email</span><strong>${escapeHtml(customerEmail)}</strong></div>
            <div class="success-row"><span>📱 Phone</span><strong>${escapeHtml(customerPhone)}</strong></div>
            <div class="success-row"><span>🏠 Address</span><strong>${escapeHtml(customerAddress)}</strong></div>
            <div class="success-row"><span>💳 Payment</span><strong>${escapeHtml(paymentMethod)}</strong></div>
            <div class="success-row highlight"><span>🛒 Items</span><strong>${successCount} item${successCount > 1 ? "s" : ""}</strong></div>
            <div class="success-row highlight"><span>💰 Total</span><strong>₹${total.toLocaleString("en-IN")}</strong></div>
        `;

        // Clear cart
        cart = [];
        cartData = {};
        document.getElementById("cartCount").innerText = 0;
        loadProducts();
    }

    if (failedItems.length > 0) showToast(`⚠️ Failed: ${failedItems.join(", ")}`, 4000);
}

/* ================== POPUP ================== */
function openPopup(id) {
    const p = productMap[id];
    if (!p) return;
    const outOfStock = p.stock <= 0;
    const rating = p.rating || 0;
    document.getElementById("popup-content").innerHTML = `
        <span class="close" onclick="closePopup()">×</span>
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
        <h2>${escapeHtml(p.name)}</h2>
        <p class="category-tag">${escapeHtml(p.category || "Other")}</p>
        <div class="rating-wrap" style="justify-content:center; margin:8px 0;">
            ${renderStars(rating, p._id, true)}
            <span class="rating-count">${rating > 0 ? `${rating} (${p.ratingCount || 0} ratings)` : "No ratings yet"}</span>
        </div>
        <p class="price">₹${p.price.toLocaleString("en-IN")}</p>
        <p>${escapeHtml(p.description || "")}</p>
        <p class="stock-label ${outOfStock ? "out" : "in"}">${outOfStock ? "❌ Out of Stock" : `✅ In Stock (${p.stock})`}</p>
        <button class="btn-addcart ${outOfStock ? "disabled" : ""}" onclick="addToCart('${p._id}'); closePopup();" ${outOfStock ? "disabled" : ""}>Add to Cart 🛒</button>
    `;
    document.getElementById("popup").classList.add("show");
    document.body.style.overflow = "hidden";
}

function closePopup() { document.getElementById("popup").classList.remove("show"); document.body.style.overflow = ""; }
function closePopupOutside(e) { if (e.target.id === "popup") closePopup(); }

/* ================== PAGE CONTROL ================== */
function hideAll() {
    ["mainPage","cartPage","ordersPage","graphPage"].forEach(id => document.getElementById(id).style.display = "none");
}

function showCart() { hideAll(); document.getElementById("cartPage").style.display = "block"; displayCart(); }
function showGraph() { hideAll(); document.getElementById("graphPage").style.display = "block"; updateChart(); }
function showOrders() { hideAll(); document.getElementById("ordersPage").style.display = "block"; loadOrderHistory(); }
function goBack() { hideAll(); document.getElementById("mainPage").style.display = "block"; }

/* ================== ORDER HISTORY ================== */
async function loadOrderHistory() {
    const orderList = document.getElementById("orderList");
    const orderSummary = document.getElementById("orderSummary");
    orderList.innerHTML = `<p class="error-msg">Loading orders...</p>`;
    orderSummary.innerHTML = "";
    try {
        const orders = await (await fetch("/orders")).json();
        if (!orders.length) { orderList.innerHTML = `<p class="error-msg">No orders yet. Buy something first! 🛒</p>`; return; }
        const totalRevenue = orders.reduce((sum, o) => sum + o.price, 0);
        orderSummary.innerHTML = `
            <div class="summary-box">
                <div class="summary-item"><span class="summary-num">${orders.length}</span><span class="summary-label">Total Orders</span></div>
                <div class="summary-item"><span class="summary-num">₹${totalRevenue.toLocaleString("en-IN")}</span><span class="summary-label">Total Spent</span></div>
                <div class="summary-item"><span class="summary-num">₹${Math.round(totalRevenue/orders.length).toLocaleString("en-IN")}</span><span class="summary-label">Avg. Order</span></div>
            </div>`;
        orderList.innerHTML = "";
        orders.forEach((order, index) => {
            const date = new Date(order.date);
            const card = document.createElement("div");
            card.className = "order-card";
            card.innerHTML = `
                <div class="order-img-wrap"><img src="${escapeHtml(order.image)}" alt="${escapeHtml(order.name)}" /></div>
                <div class="order-details">
                    <h3>${escapeHtml(order.name)}</h3>
                    <p class="price">₹${order.price.toLocaleString("en-IN")}</p>
                    <p class="order-date">📅 ${date.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} at ${date.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                    ${order.customerName ? `<p class="order-date">👤 ${escapeHtml(order.customerName)} &nbsp;|&nbsp; 📱 ${escapeHtml(order.customerPhone || "")}</p>` : ""}
                    ${order.customerAddress ? `<p class="order-date">🏠 ${escapeHtml(order.customerAddress)}</p>` : ""}
                    ${order.paymentMethod ? `<span class="order-badge">💳 ${escapeHtml(order.paymentMethod)}</span>` : `<span class="order-badge">✅ Order Placed</span>`}
                </div>
                <div class="order-num">#${orders.length - index}</div>
            `;
            orderList.appendChild(card);
        });
    } catch (err) { orderList.innerHTML = `<p class="error-msg">⚠️ Could not load orders.</p>`; }
}

/* ================== GRAPH ================== */
async function updateChart() {
    const container = document.querySelector(".chart-container");
    try {
        const orders = await (await fetch("/orders")).json();
        if (!orders.length) { if (chart) chart.destroy(); container.innerHTML = `<p class="error-msg">No orders yet!</p>`; return; }
        const orderCounts = {}, orderRevenue = {};
        orders.forEach(o => { orderCounts[o.name] = (orderCounts[o.name]||0)+1; orderRevenue[o.name] = (orderRevenue[o.name]||0)+o.price; });
        if (!document.getElementById("cartChart")) container.innerHTML = `<canvas id="cartChart"></canvas>`;
        if (chart) chart.destroy();
        chart = new Chart(document.getElementById("cartChart"), {
            type: "bar",
            data: {
                labels: Object.keys(orderCounts),
                datasets: [
                    { label:"Times Ordered", data:Object.values(orderCounts), backgroundColor:"rgba(108,99,255,0.7)", borderColor:"#6c63ff", borderWidth:2, borderRadius:8, yAxisID:"y" },
                    { label:"Total Revenue (₹)", data:Object.values(orderRevenue), backgroundColor:"rgba(67,233,123,0.7)", borderColor:"#43e97b", borderWidth:2, borderRadius:8, yAxisID:"y1" }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend:{labels:{color:"#aaa"}}, title:{display:true, text:`📦 Total Orders: ${orders.length}`, color:"#f0f0ff", font:{size:16}} },
                scales: {
                    x:{ticks:{color:"#888"}},
                    y:{ticks:{color:"#6c63ff",stepSize:1}, title:{display:true,text:"Times Ordered",color:"#6c63ff"}},
                    y1:{position:"right", ticks:{color:"#43e97b"}, title:{display:true,text:"Revenue (₹)",color:"#43e97b"}, grid:{drawOnChartArea:false}}
                }
            }
        });
    } catch (err) { container.innerHTML = `<p class="error-msg">⚠️ Could not load order data.</p>`; }
}

/* ================== TOAST ================== */
function showToast(msg, duration = 2500) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), duration);
}

loadProducts();
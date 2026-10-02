const SUPABASE_URL = "https://tvaczmcdvqaiworrjsjw.supabase.co";
const SUPABASE_KEY = "sb_publishable_G0Ev8UdENIu5r_leRDoXuQ_eVEJmTeD";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =====================================================
// GLOBAL STATE
// =====================================================

let currentUser = null;
let currentProfile = null;

let menuItems = [];
let cart = [];

let currentCustomItem = null;
let currentCustomIndex = null;

let currentEditingMenuId = null;

let realtimeChannel = null;


// Fixed menu order
const menuOrder = [
    "Aaloo Pyaz",
    "Paneer Paratha",
    "Anda Paratha",
    "Gobhi Paratha",
    "Mix Paratha",
    "Pyazz Paratha",
    "Chai Small",
    "Chai Big",
    "Maggie Veg"
];


// =====================================================
// START APP
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
});


// =====================================================
// AUTH
// =====================================================

async function checkLogin() {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (session) {
        currentUser = session.user;
        await showApp();
    } else {
        showLogin();
    }
}


function showLogin() {
    const loginScreen = document.getElementById("loginScreen");
    const appContent = document.getElementById("appContent");

    if (loginScreen) loginScreen.style.display = "flex";
    if (appContent) appContent.style.display = "none";
}


async function loginUser() {
    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;

    const errorBox = document.getElementById("loginError");

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.style.display = "none";
    }

    if (!email || !password) {
        showLoginError("Please enter your email and password.");
        return;
    }

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        showLoginError(getFriendlyLoginError(error));
        return;
    }

    currentUser = data.user;

    await showApp();
}


function getFriendlyLoginError(error) {
    if (!error) return "Login failed.";

    if (
        error.message?.toLowerCase().includes("invalid login credentials")
    ) {
        return "Incorrect email or password.";
    }

    if (
        error.message?.toLowerCase().includes("email not confirmed")
    ) {
        return "Please confirm your email before logging in.";
    }

    return error.message;
}


function showLoginError(message) {
    const errorBox = document.getElementById("loginError");

    if (!errorBox) {
        alert(message);
        return;
    }

    errorBox.textContent = message;
    errorBox.style.display = "block";
}


async function logoutUser() {
    await supabaseClient.auth.signOut();

    currentUser = null;
    currentProfile = null;
    cart = [];

    if (realtimeChannel) {
        await supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    showLogin();
}


// =====================================================
// SHOW APP
// =====================================================

async function showApp() {
    const loginScreen = document.getElementById("loginScreen");
    const appContent = document.getElementById("appContent");

    if (loginScreen) loginScreen.style.display = "none";
    if (appContent) appContent.style.display = "block";

    await initializeApp();
}


async function initializeApp() {
    await loadUserProfile();
    applyPermissions();

    await loadMenu();
    await renderActiveOrders();
    await renderTodayOrders();

    updateTodaySummary();

    setupRealtime();

    showPage("newOrderPage");
}


// =====================================================
// PROFILE / PERMISSIONS
// =====================================================

async function loadUserProfile() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {
        console.error("Profile error:", error);
        currentProfile = {
            id: currentUser.id,
            name: currentUser.email,
            role: "staff"
        };
        return;
    }

    currentProfile = data;

    const roleElement = document.getElementById("userRole");

    if (roleElement) {
        roleElement.textContent =
            currentProfile.role === "admin"
                ? "Admin"
                : "Staff";
    }
}


function isAdmin() {
    return currentProfile?.role === "admin";
}


function applyPermissions() {
    const menuSettingsButton =
        document.getElementById("menuSettingsButton");

    if (menuSettingsButton) {
        menuSettingsButton.style.display =
            isAdmin() ? "block" : "none";
    }
}


// =====================================================
// MENU
// =====================================================

async function loadMenu() {
    const { data, error } = await supabaseClient
        .from("menu_items")
        .select("*")
        .eq("active", true);

    if (error) {
        console.error("Menu loading error:", error);
        return;
    }

    menuItems = data || [];

    menuItems.sort((a, b) => {
        const indexA = menuOrder.indexOf(a.name);
        const indexB = menuOrder.indexOf(b.name);

        const safeA = indexA === -1 ? 999 : indexA;
        const safeB = indexB === -1 ? 999 : indexB;

        return safeA - safeB;
    });

    renderMenu();
}


function renderMenu() {
    const container = document.getElementById("menuContainer");

    if (!container) return;

    container.innerHTML = "";

    if (!menuItems.length) {
        container.innerHTML = `
            <div class="empty-state">
                No menu items available.
            </div>
        `;
        return;
    }

    menuItems.forEach(item => {
        const card = document.createElement("div");

        card.className = "menu-card";

        card.innerHTML = `
            <div class="menu-card-header">
                <div>
                    <div class="menu-category">
                        ${escapeHtml(item.category || "")}
                    </div>

                    <h3>${escapeHtml(item.name)}</h3>
                </div>

                <div class="menu-price">
                    ₹${Number(item.price).toFixed(0)}
                </div>
            </div>

            <button
                class="menu-add-button"
                onclick="openCustomization('${item.id}')"
            >
                Add
            </button>
        `;

        container.appendChild(card);
    });
}


// =====================================================
// CUSTOMIZATION
// =====================================================

function openCustomization(itemId, cartIndex = null) {
    const item = menuItems.find(x => x.id === itemId);

    if (!item) return;

    currentCustomItem = item;
    currentCustomIndex = cartIndex;

    const modal = document.getElementById("customizationModal");

    const title = document.getElementById("customizationTitle");
    const price = document.getElementById("customizationPrice");
    const quantity = document.getElementById("customQuantity");
    const note = document.getElementById("customNote");

    if (title) {
        title.textContent = item.name;
    }

    if (price) {
        price.textContent = `₹${Number(item.price).toFixed(0)}`;
    }

    if (cartIndex !== null && cart[cartIndex]) {
        quantity.value = cart[cartIndex].quantity || 1;
        note.value = cart[cartIndex].note || "";
    } else {
        quantity.value = 1;
        note.value = "";
    }

    renderCustomizationOptions(item);

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeCustomization() {
    const modal =
        document.getElementById("customizationModal");

    if (modal) {
        modal.style.display = "none";
    }

    currentCustomItem = null;
    currentCustomIndex = null;
}


function renderCustomizationOptions(item) {
    const container =
        document.getElementById("customizationOptions");

    if (!container) return;

    container.innerHTML = "";

    const addons = Array.isArray(item.addons)
        ? item.addons
        : [];

    if (!addons.length) {
        container.innerHTML = `
            <p class="no-options">
                No add-ons available for this item.
            </p>
        `;
        return;
    }

    addons.forEach((addon, index) => {
        const addonName = escapeHtml(addon.name);
        const addonPrice = Number(addon.price || 0);

        let existingQty = 0;

        if (
            currentCustomIndex !== null &&
            cart[currentCustomIndex]?.addons
        ) {
            const existing = cart[currentCustomIndex].addons.find(
                x => x.name === addon.name
            );

            if (existing) {
                existingQty = Number(existing.quantity || 0);
            }
        }

        const option = document.createElement("div");

        option.className = "custom-option";

        option.innerHTML = `
            <div class="custom-option-info">
                <span>${addonName}</span>
                <small>+₹${addonPrice}</small>
            </div>

            <div class="addon-quantity">
                <button
                    type="button"
                    class="addon-minus"
                    data-index="${index}"
                >
                    −
                </button>

                <span
                    class="addon-qty"
                    id="addonQty${index}"
                >
                    ${existingQty}
                </span>

                <button
                    type="button"
                    class="addon-plus"
                    data-index="${index}"
                >
                    +
                </button>
            </div>
        `;

        container.appendChild(option);
    });

    container
        .querySelectorAll(".addon-minus")
        .forEach(button => {
            button.addEventListener("click", () => {
                const index =
                    Number(button.dataset.index);

                const qtyElement =
                    document.getElementById(
                        `addonQty${index}`
                    );

                let qty =
                    Number(qtyElement.textContent);

                qty = Math.max(0, qty - 1);

                qtyElement.textContent = qty;
            });
        });

    container
        .querySelectorAll(".addon-plus")
        .forEach(button => {
            button.addEventListener("click", () => {
                const index =
                    Number(button.dataset.index);

                const qtyElement =
                    document.getElementById(
                        `addonQty${index}`
                    );

                let qty =
                    Number(qtyElement.textContent);

                qty += 1;

                qtyElement.textContent = qty;
            });
        });
}


// =====================================================
// CUSTOM QUANTITY
// =====================================================

function changeCustomQuantity(amount) {
    const quantity =
        document.getElementById("customQuantity");

    if (!quantity) return;

    let value = Number(quantity.value || 1);

    value += amount;

    value = Math.max(1, value);

    quantity.value = value;
}


// =====================================================
// ADD CUSTOMIZED ITEM TO CART
// =====================================================

function addCustomizedItem() {
    if (!currentCustomItem) return;

    const quantityElement =
        document.getElementById("customQuantity");

    const noteElement =
        document.getElementById("customNote");

    const quantity =
        Math.max(1, Number(quantityElement?.value || 1));

    const note =
        noteElement?.value?.trim() || "";

    const addons = [];

    const itemAddons = Array.isArray(
        currentCustomItem.addons
    )
        ? currentCustomItem.addons
        : [];

    itemAddons.forEach((addon, index) => {
        const qtyElement =
            document.getElementById(`addonQty${index}`);

        const qty =
            Number(qtyElement?.textContent || 0);

        if (qty > 0) {
            addons.push({
                name: addon.name,
                price: Number(addon.price || 0),
                quantity: qty
            });
        }
    });

    const cartItem = {
        menu_item_id: currentCustomItem.id,
        name: currentCustomItem.name,
        base_price: Number(currentCustomItem.price),
        quantity,
        addons,
        note
    };

    // Edit existing cart item
    if (
        currentCustomIndex !== null &&
        cart[currentCustomIndex]
    ) {
        cart[currentCustomIndex] = cartItem;
    } else {
        cart.push(cartItem);
    }

    renderCart();
    closeCustomization();
}


// =====================================================
// CART
// =====================================================

function calculateCartItemTotal(item) {
    const base =
        Number(item.base_price || 0) *
        Number(item.quantity || 1);

    let addonTotal = 0;

    if (Array.isArray(item.addons)) {
        item.addons.forEach(addon => {
            addonTotal +=
                Number(addon.price || 0) *
                Number(addon.quantity || 0);
        });
    }

    return base + addonTotal;
}


function calculateCartTotal() {
    return cart.reduce(
        (sum, item) =>
            sum + calculateCartItemTotal(item),
        0
    );
}


function renderCart() {
    const container =
        document.getElementById("cartItems");

    const countElement =
        document.getElementById("cartCount");

    const totalElement =
        document.getElementById("cartTotal");

    if (!container) return;

    container.innerHTML = "";

    let totalQuantity = 0;

    cart.forEach((item, index) => {
        totalQuantity += Number(item.quantity || 0);

        const card = document.createElement("div");

        card.className = "cart-item";

        const addonsText =
            Array.isArray(item.addons) &&
            item.addons.length
                ? item.addons
                    .map(
                        addon =>
                            `${escapeHtml(addon.name)} × ${addon.quantity}`
                    )
                    .join(", ")
                : "";

        card.innerHTML = `
            <div>
                <strong>
                    ${escapeHtml(item.name)}
                </strong>

                <div class="cart-item-meta">
                    ${item.quantity} × ₹${Number(
                        item.base_price
                    ).toFixed(0)}
                </div>

                ${
                    addonsText
                        ? `<div class="cart-item-addons">
                            ${addonsText}
                           </div>`
                        : ""
                }

                ${
                    item.note
                        ? `<div class="cart-item-note">
                            ${escapeHtml(item.note)}
                           </div>`
                        : ""
                }
            </div>

            <div class="cart-item-right">
                <strong>
                    ₹${calculateCartItemTotal(item).toFixed(0)}
                </strong>

                <div class="cart-item-buttons">
                    <button
                        type="button"
                        onclick="openCustomization(
                            '${item.menu_item_id}',
                            ${index}
                        )"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        onclick="removeCartItem(${index})"
                    >
                        Remove
                    </button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    if (!cart.length) {
        container.innerHTML = `
            <div class="empty-state">
                Your cart is empty.
            </div>
        `;
    }

    if (countElement) {
        countElement.textContent = totalQuantity;
    }

    if (totalElement) {
        totalElement.textContent =
            `₹${calculateCartTotal().toFixed(0)}`;
    }
}


function removeCartItem(index) {
    cart.splice(index, 1);
    renderCart();
}


function openCart() {
    const modal =
        document.getElementById("cartModal");

    if (modal) {
        modal.style.display = "flex";
    }

    renderCart();
}


function closeCart() {
    const modal =
        document.getElementById("cartModal");

    if (modal) {
        modal.style.display = "none";
    }
}


// =====================================================
// PLACE ORDER
// =====================================================

async function placeOrder() {
    if (!currentUser) {
        alert("Please login first.");
        return;
    }

    if (!cart.length) {
        alert("Please add at least one item.");
        return;
    }

    const customerName =
        document.getElementById("customerName")
            ?.value.trim();

    const orderType =
        document.getElementById("orderType")
            ?.value || "Dine";

    const paymentMethod =
        document.getElementById("paymentMethod")
            ?.value || "Cash";

    const note =
        document.getElementById("orderNote")
            ?.value.trim() || "";

    if (!customerName) {
        alert("Please enter customer name.");
        return;
    }

    // Get next daily token safely from Supabase
    const { data: token, error: tokenError } =
        await supabaseClient.rpc(
            "get_next_order_token"
        );

    if (tokenError) {
        console.error(tokenError);
        alert("Could not generate order token.");
        return;
    }

    const total = calculateCartTotal();

    const orderData = {
        token,
        customer_name: customerName,
        items: cart,
        note,
        payment_method: paymentMethod,
        total,
        status: "New",
        created_by: currentUser.id,
        order_type: orderType
    };

    const { error } =
        await supabaseClient
            .from("orders")
            .insert(orderData);

    if (error) {
        console.error("Order error:", error);
        alert("Could not place order.");
        return;
    }

    alert(`Order #${token} placed successfully.`);

    cart = [];

    renderCart();

    const customerInput =
        document.getElementById("customerName");

    const noteInput =
        document.getElementById("orderNote");

    if (customerInput) customerInput.value = "";
    if (noteInput) noteInput.value = "";

    closeCart();

    await renderActiveOrders();
    await renderTodayOrders();
    updateTodaySummary();
}


// =====================================================
// ORDERS
// =====================================================

async function getOrders() {
    const { data, error } =
        await supabaseClient
            .from("orders")
            .select("*")
            .order("created_at", {
                ascending: false
            });

    if (error) {
        console.error("Orders error:", error);
        return [];
    }

    return data || [];
}


async function renderActiveOrders() {
    const container =
        document.getElementById(
            "activeOrdersContainer"
        );

    if (!container) return;

    const orders = await getOrders();

    const activeOrders =
        orders.filter(order =>
            order.status === "New" ||
            order.status === "Preparing"
        );

    container.innerHTML = "";

    if (!activeOrders.length) {
        container.innerHTML = `
            <div class="empty-state">
                No active orders.
            </div>
        `;
        return;
    }

    activeOrders.forEach(order => {
        container.appendChild(
            createOrderCard(order, true)
        );
    });
}


async function renderTodayOrders() {
    const container =
        document.getElementById(
            "todayOrdersContainer"
        );

    if (!container) return;

    const orders = await getOrders();

    const today = new Date()
        .toISOString()
        .split("T")[0];

    const todayOrders =
        orders.filter(order =>
            order.order_date === today
        );

    container.innerHTML = "";

    if (!todayOrders.length) {
        container.innerHTML = `
            <div class="empty-state">
                No orders today.
            </div>
        `;
        return;
    }

    todayOrders.forEach(order => {
        container.appendChild(
            createOrderCard(order, false)
        );
    });
}


// =====================================================
// ORDER CARD
// =====================================================

function createOrderCard(order, activeView) {
    const card =
        document.createElement("div");

    card.className = "order-card";

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    const itemsSummary =
        items.map(item => {
            const addons =
                Array.isArray(item.addons) &&
                item.addons.length
                    ? ` (${item.addons
                        .map(
                            addon =>
                                `${addon.name} × ${addon.quantity}`
                        )
                        .join(", ")})`
                    : "";

            return `
                <div>
                    ${item.quantity} ×
                    ${escapeHtml(item.name)}
                    ${addons}
                </div>
            `;
        }).join("");

    const statusClass =
        String(order.status || "")
            .toLowerCase();

    let actions = "";

    if (activeView) {
        if (order.status === "New") {
            actions += `
                <button
                    class="order-action preparing"
                    onclick="setPreparing('${order.id}')"
                >
                    Preparing
                </button>
            `;
        }

        if (isAdmin()) {
            actions += `
                <button
                    class="order-action complete"
                    onclick="completeOrder('${order.id}')"
                >
                    Complete
                </button>

                <button
                    class="order-action cancel"
                    onclick="cancelOrder('${order.id}')"
                >
                    Cancel
                </button>
            `;
        }
    }

    card.innerHTML = `
        <div class="order-card-header">

            <div class="order-token">
                #${order.token}
            </div>

            <div class="order-status ${statusClass}">
                ${escapeHtml(order.status)}
            </div>

        </div>

        <div class="order-customer">
            ${escapeHtml(order.customer_name)}
        </div>

        <div class="order-meta">
            ${escapeHtml(order.order_type || "Dine")}
            •
            ${escapeHtml(order.payment_method || "Cash")}
        </div>

        <div class="order-items-summary">
            ${itemsSummary}
        </div>

        ${
            order.note
                ? `
                <div class="order-note">
                    <strong>Note:</strong>
                    ${escapeHtml(order.note)}
                </div>
                `
                : ""
        }

        <div class="order-total">
            Total: ₹${Number(order.total || 0).toFixed(0)}
        </div>

        ${
            actions
                ? `
                <div class="order-actions">
                    ${actions}
                </div>
                `
                : ""
        }
    `;

    return card;
}


// =====================================================
// ORDER STATUS
// =====================================================

async function setPreparing(orderId) {
    const { error } =
        await supabaseClient
            .from("orders")
            .update({
                status: "Preparing"
            })
            .eq("id", orderId);

    if (error) {
        console.error(error);
        alert("Could not update order.");
        return;
    }

    await renderActiveOrders();
    await renderTodayOrders();
    updateTodaySummary();
}


async function completeOrder(orderId) {
    if (!isAdmin()) {
        alert("Only admin can complete orders.");
        return;
    }

    const { error } =
        await supabaseClient
            .from("orders")
            .update({
                status: "Completed",
                completed_by: currentUser.id,
                completed_at: new Date().toISOString()
            })
            .eq("id", orderId);

    if (error) {
        console.error(error);
        alert("Could not complete order.");
        return;
    }

    await renderActiveOrders();
    await renderTodayOrders();
    updateTodaySummary();
}


async function cancelOrder(orderId) {
    if (!isAdmin()) {
        alert("Only admin can cancel orders.");
        return;
    }

    const confirmed =
        confirm(
            "Are you sure you want to cancel this order?"
        );

    if (!confirmed) return;

    const { error } =
        await supabaseClient
            .from("orders")
            .update({
                status: "Cancelled",
                completed_by: currentUser.id,
                completed_at: new Date().toISOString()
            })
            .eq("id", orderId);

    if (error) {
        console.error(error);
        alert("Could not cancel order.");
        return;
    }

    await renderActiveOrders();
    await renderTodayOrders();
    updateTodaySummary();
}


// =====================================================
// ORDER DETAILS
// =====================================================

async function openOrderDetails(orderId) {
    const orders = await getOrders();

    const order =
        orders.find(x => x.id === orderId);

    if (!order) return;

    const container =
        document.getElementById(
            "orderDetailsContent"
        );

    if (!container) return;

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    container.innerHTML = `
        <h2>Order #${order.token}</h2>

        <p>
            <strong>Customer:</strong>
            ${escapeHtml(order.customer_name)}
        </p>

        <p>
            <strong>Type:</strong>
            ${escapeHtml(order.order_type || "Dine")}
        </p>

        <hr>

        ${items.map(item => `
            <div class="detail-item">
                <strong>
                    ${item.quantity} ×
                    ${escapeHtml(item.name)}
                </strong>

                ${
                    item.addons?.length
                        ? `
                        <div>
                            ${item.addons.map(addon => `
                                ${escapeHtml(addon.name)}
                                × ${addon.quantity}
                            `).join("<br>")}
                        </div>
                        `
                        : ""
                }

                ${
                    item.note
                        ? `
                        <div>
                            Note:
                            ${escapeHtml(item.note)}
                        </div>
                        `
                        : ""
                }
            </div>
        `).join("")}

        <hr>

        <strong>
            Total: ₹${Number(order.total).toFixed(0)}
        </strong>
    `;

    const modal =
        document.getElementById(
            "orderDetailsModal"
        );

    if (modal) modal.style.display = "flex";
}


function closeOrderDetails() {
    const modal =
        document.getElementById(
            "orderDetailsModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


// =====================================================
// PAGES
// =====================================================

function showPage(pageId) {
    document
        .querySelectorAll(".page")
        .forEach(page => {
            page.style.display = "none";
        });

    const page =
        document.getElementById(pageId);

    if (page) {
        page.style.display = "block";
    }

    document
        .querySelectorAll(".nav-button")
        .forEach(button => {
            button.classList.remove("active-page");
        });

    if (pageId === "newOrderPage") {
        document
            .getElementById("newOrderNav")
            ?.classList.add("active-page");
    }

    if (pageId === "activePage") {
        document
            .getElementById("activeNav")
            ?.classList.add("active-page");
    }

    if (pageId === "todayPage") {
        document
            .getElementById("todayNav")
            ?.classList.add("active-page");
    }

    if (pageId === "menuSettingsPage") {
        document
            .getElementById("menuSettingsButton")
            ?.classList.add("active-page");

        loadMenuSettings();
    }
}


// =====================================================
// TODAY SUMMARY
// =====================================================

async function updateTodaySummary() {
    const orders = await getOrders();

    const today =
        new Date()
            .toISOString()
            .split("T")[0];

    const todayOrders =
        orders.filter(
            order => order.order_date === today
        );

    const newCount =
        todayOrders.filter(
            x => x.status === "New"
        ).length;

    const preparingCount =
        todayOrders.filter(
            x => x.status === "Preparing"
        ).length;

    const completedCount =
        todayOrders.filter(
            x => x.status === "Completed"
        ).length;

    const cancelledCount =
        todayOrders.filter(
            x => x.status === "Cancelled"
        ).length;

    const sales =
        todayOrders
            .filter(
                x => x.status !== "Cancelled"
            )
            .reduce(
                (sum, x) =>
                    sum + Number(x.total || 0),
                0
            );

    setText("summaryOrders", todayOrders.length);
    setText("summaryNew", newCount);
    setText("summaryPreparing", preparingCount);
    setText("summaryCompleted", completedCount);
    setText("summaryCancelled", cancelledCount);
    setText(
        "summarySales",
        `₹${sales.toFixed(0)}`
    );

    const dateElement =
        document.getElementById("summaryDate");

    if (dateElement) {
        dateElement.textContent =
            new Date().toLocaleDateString(
                "en-IN",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
    }
}


// =====================================================
// ADMIN MENU MANAGEMENT
// =====================================================

async function loadMenuSettings() {
    if (!isAdmin()) return;

    const container =
        document.getElementById(
            "menuSettingsContainer"
        );

    if (!container) return;

    const { data, error } =
        await supabaseClient
            .from("menu_items")
            .select("*")
            .order("created_at", {
                ascending: true
            });

    if (error) {
        console.error(error);
        return;
    }

    const items = data || [];

    items.sort((a, b) => {
        const indexA =
            menuOrder.indexOf(a.name);

        const indexB =
            menuOrder.indexOf(b.name);

        return (
            (indexA === -1 ? 999 : indexA) -
            (indexB === -1 ? 999 : indexB)
        );
    });

    container.innerHTML = "";

    items.forEach(item => {
        const card =
            document.createElement("div");

        card.className =
            "menu-setting-card";

        const addons =
            Array.isArray(item.addons)
                ? item.addons
                : [];

        card.innerHTML = `
            <div class="menu-setting-header">
                <div>
                    <strong>
                        ${escapeHtml(item.name)}
                    </strong>

                    <small>
                        ${escapeHtml(item.category)}
                    </small>
                </div>

                <div class="menu-setting-price">
                    ₹${Number(item.price).toFixed(0)}
                </div>
            </div>

            ${
                addons.length
                    ? `
                    <div class="menu-setting-addons">
                        ${addons.map(addon => `
                            <div>
                                ${escapeHtml(addon.name)}
                                — ₹${Number(
                                    addon.price || 0
                                ).toFixed(0)}
                            </div>
                        `).join("")}
                    </div>
                    `
                    : `
                    <div class="menu-setting-addons">
                        No add-ons
                    </div>
                    `
            }

            <div class="menu-setting-actions">
                <button
                    onclick="editMenuItem('${item.id}')"
                >
                    Edit
                </button>

                <button
                    onclick="deleteMenuItem('${item.id}')"
                >
                    Delete
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}


function openMenuEditor(itemId = null) {
    if (!isAdmin()) return;

    currentEditingMenuId = itemId;

    const modal =
        document.getElementById(
            "menuEditorModal"
        );

    const title =
        document.getElementById(
            "menuEditorTitle"
        );

    const nameInput =
        document.getElementById(
            "menuItemName"
        );

    const categoryInput =
        document.getElementById(
            "menuItemCategory"
        );

    const priceInput =
        document.getElementById(
            "menuItemPrice"
        );

    const activeInput =
        document.getElementById(
            "menuItemActive"
        );

    if (itemId) {
        const item =
            menuItems.find(
                x => x.id === itemId
            );

        if (!item) return;

        if (title)
            title.textContent =
                "Edit Menu Item";

        if (nameInput)
            nameInput.value =
                item.name;

        if (categoryInput)
            categoryInput.value =
                item.category;

        if (priceInput)
            priceInput.value =
                item.price;

        if (activeInput)
            activeInput.checked =
                item.active !== false;

        renderAddonEditor(
            Array.isArray(item.addons)
                ? item.addons
                : []
        );
    } else {
        if (title)
            title.textContent =
                "Add Menu Item";

        if (nameInput)
            nameInput.value = "";

        if (categoryInput)
            categoryInput.value = "";

        if (priceInput)
            priceInput.value = "";

        if (activeInput)
            activeInput.checked = true;

        renderAddonEditor([]);
    }

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeMenuEditor() {
    const modal =
        document.getElementById(
            "menuEditorModal"
        );

    if (modal) {
        modal.style.display = "none";
    }

    currentEditingMenuId = null;
}


function renderAddonEditor(addons) {
    const container =
        document.getElementById(
            "addonFields"
        );

    if (!container) return;

    container.innerHTML = "";

    addons.forEach(addon => {
        addAddonField(
            addon.name,
            addon.price
        );
    });

    if (!addons.length) {
        addAddonField("", "");
    }
}


function addAddonField(
    name = "",
    price = ""
) {
    const container =
        document.getElementById(
            "addonFields"
        );

    if (!container) return;

    const row =
        document.createElement("div");

    row.className =
        "editor-field";

    row.innerHTML = `
        <input
            type="text"
            class="addon-name"
            placeholder="Add-on name"
            value="${escapeAttribute(name)}"
        >

        <input
            type="number"
            class="addon-price"
            placeholder="Price"
            min="0"
            value="${price}"
        >

        <button
            type="button"
            onclick="this.parentElement.remove()"
        >
            Remove
        </button>
    `;

    container.appendChild(row);
}


async function saveMenuItem() {
    if (!isAdmin()) return;

    const name =
        document.getElementById(
            "menuItemName"
        )?.value.trim();

    const category =
        document.getElementById(
            "menuItemCategory"
        )?.value.trim();

    const price =
        Number(
            document.getElementById(
                "menuItemPrice"
            )?.value || 0
        );

    const active =
        document.getElementById(
            "menuItemActive"
        )?.checked ?? true;

    if (!name || !category) {
        alert(
            "Please enter item name and category."
        );
        return;
    }

    const addons = [];

    document
        .querySelectorAll(
            "#addonFields .editor-field"
        )
        .forEach(row => {
            const addonName =
                row.querySelector(
                    ".addon-name"
                )?.value.trim();

            const addonPrice =
                Number(
                    row.querySelector(
                        ".addon-price"
                    )?.value || 0
                );

            if (addonName) {
                addons.push({
                    name: addonName,
                    price: addonPrice
                });
            }
        });

    const payload = {
        name,
        category,
        price,
        addons,
        active
    };

    let error;

    if (currentEditingMenuId) {
        ({ error } =
            await supabaseClient
                .from("menu_items")
                .update(payload)
                .eq(
                    "id",
                    currentEditingMenuId
                ));
    } else {
        ({ error } =
            await supabaseClient
                .from("menu_items")
                .insert(payload));
    }

    if (error) {
        console.error(error);
        alert(
            "Could not save menu item."
        );
        return;
    }

    closeMenuEditor();

    await loadMenu();
    await loadMenuSettings();
}


async function editMenuItem(itemId) {
    if (!isAdmin()) return;

    const { data, error } =
        await supabaseClient
            .from("menu_items")
            .select("*")
            .eq("id", itemId)
            .single();

    if (error) {
        console.error(error);
        return;
    }

    menuItems = menuItems.filter(
        x => x.id !== itemId
    );

    menuItems.push(data);

    openMenuEditor(itemId);
}


async function deleteMenuItem(itemId) {
    if (!isAdmin()) return;

    const confirmed =
        confirm(
            "Are you sure you want to delete this menu item?"
        );

    if (!confirmed) return;

    const { error } =
        await supabaseClient
            .from("menu_items")
            .delete()
            .eq("id", itemId);

    if (error) {
        console.error(error);
        alert(
            "Could not delete menu item."
        );
        return;
    }

    await loadMenu();
    await loadMenuSettings();
}


// =====================================================
// ORDER SEARCH
// =====================================================

function filterOrders() {
    const search =
        document.getElementById(
            "orderSearch"
        )?.value
            .trim()
            .toLowerCase();

    document
        .querySelectorAll(".order-card")
        .forEach(card => {
            const text =
                card.textContent
                    .toLowerCase();

            card.style.display =
                !search ||
                text.includes(search)
                    ? ""
                    : "none";
        });
}


// =====================================================
// REALTIME
// =====================================================

function setupRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(
            realtimeChannel
        );
    }

    realtimeChannel =
        supabaseClient
            .channel("chai-mohalla-realtime")

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders"
                },
                async () => {
                    await renderActiveOrders();
                    await renderTodayOrders();
                    updateTodaySummary();
                }
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "menu_items"
                },
                async () => {
                    await loadMenu();

                    if (isAdmin()) {
                        await loadMenuSettings();
                    }
                }
            )

            .subscribe();
}


// =====================================================
// HELPERS
// =====================================================

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// =====================================================
// AUTH STATE LISTENER
// =====================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {
        if (event === "SIGNED_IN" && session) {
            currentUser = session.user;
        }

        if (event === "SIGNED_OUT") {
            currentUser = null;
            currentProfile = null;
            cart = [];

            showLogin();
        }
    }
);

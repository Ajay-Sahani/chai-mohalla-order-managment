/* =========================================================
   CHAI MOHALLA ORDER MANAGEMENT
   Supabase + Vanilla JavaScript
========================================================= */


/* =========================================================
   SUPABASE CONFIG
========================================================= */

// Put your existing Supabase project values here.

const SUPABASE_URL = "https://tvaczmcdvqaiworrjsjw.supabase.co";

const SUPABASE_KEY = "sb_publishable_G0Ev8UdENIu5r_leRDoXuQ_eVEJmTeD";


/* =========================================================
   SUPABASE INITIALIZATION
========================================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentProfile = null;

let menuItems = [];
let allOrders = [];

let cart = [];

let currentCustomItem = null;
let customQuantity = 1;

let realtimeChannel = null;

let editingMenuItemId = null;


/* =========================================================
   FIXED MENU ORDER
========================================================= */

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


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
});


/* =========================================================
   AUTH
========================================================= */

async function checkLogin() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Session error:", error);
            showLogin();
            return;
        }

        const session = data?.session;

        if (session) {

            currentUser = session.user;

            await showApp();

        } else {

            showLogin();

        }

    } catch (error) {

        console.error("Login check error:", error);

        showLogin();
    }
}


/* =========================================================
   LOGIN
========================================================= */

async function loginUser() {

    const email =
        document.getElementById("loginEmail")?.value.trim();

    const password =
        document.getElementById("loginPassword")?.value;

    const errorElement =
        document.getElementById("loginError");

    if (errorElement) {
        errorElement.textContent = "";
    }

    if (!email || !password) {

        if (errorElement) {
            errorElement.textContent =
                "Please enter email and password.";
        }

        return;
    }

    const button =
        document.querySelector(".login-button");

    if (button) {
        button.disabled = true;
        button.textContent = "Logging in...";
    }

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        currentUser = data.user;

        await showApp();

    } catch (error) {

        console.error("Login error:", error);

        if (errorElement) {
            errorElement.textContent =
                error.message || "Login failed.";
        }

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "Login";
        }
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

    try {

        if (realtimeChannel) {
            await supabaseClient
                .removeChannel(realtimeChannel);

            realtimeChannel = null;
        }

        await supabaseClient.auth.signOut();

        currentUser = null;
        currentProfile = null;

        cart = [];
        menuItems = [];
        allOrders = [];

        showLogin();

    } catch (error) {

        console.error("Logout error:", error);
    }
}


/* =========================================================
   LOGIN / APP DISPLAY
========================================================= */

function showLogin() {

    const loginScreen =
        document.getElementById("loginScreen");

    const appContent =
        document.getElementById("appContent");

    if (loginScreen) {
        loginScreen.classList.remove("hidden");
        loginScreen.style.display = "flex";
    }

    if (appContent) {
        appContent.classList.add("hidden");
        appContent.style.display = "none";
    }
}


async function showApp() {

    const loginScreen =
        document.getElementById("loginScreen");

    const appContent =
        document.getElementById("appContent");

    if (loginScreen) {
        loginScreen.classList.add("hidden");
        loginScreen.style.display = "none";
    }

    if (appContent) {
        appContent.classList.remove("hidden");
        appContent.style.display = "block";
    }

    await initializeApp();
}


/* =========================================================
   INITIALIZE APPLICATION
========================================================= */

async function initializeApp() {

    try {

        await loadUserProfile();

        applyPermissions();

        await loadMenu();

        await loadOrders();

        renderActiveOrders();

        renderTodayOrders();

        updateTodaySummary();

        setupRealtime();

        showPage("newOrderPage");

    } catch (error) {

        console.error(
            "Application initialization error:",
            error
        );
    }
}


/* =========================================================
   PROFILE
========================================================= */

async function loadUserProfile() {

    if (!currentUser) {
        return;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            console.error(
                "Profile loading error:",
                error
            );
        }

        if (data) {

            currentProfile = data;

        } else {

            currentProfile = {
                id: currentUser.id,
                name:
                    currentUser.email ||
                    "Staff",
                role: "staff"
            };
        }

    } catch (error) {

        console.error(
            "Profile error:",
            error
        );

        currentProfile = {
            id: currentUser.id,
            name:
                currentUser.email ||
                "Staff",
            role: "staff"
        };
    }


    const roleElement =
        document.getElementById("userRole");

    if (roleElement) {

        const role =
            currentProfile?.role === "admin"
                ? "Admin"
                : "Staff";

        roleElement.textContent =
            `${currentProfile?.name || "User"} • ${role}`;
    }
}


/* =========================================================
   PERMISSIONS
========================================================= */

function isAdmin() {

    return currentProfile?.role === "admin";
}


function applyPermissions() {

    const adminElements =
        document.querySelectorAll(".admin-only");

    adminElements.forEach(element => {

        element.style.display =
            isAdmin()
                ? ""
                : "none";
    });
}


/* =========================================================
   MENU LOADING
========================================================= */

async function loadMenu() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("menu_items")
            .select("*")
            .eq("active", true);

        if (error) {
            throw error;
        }

        menuItems = data || [];

        sortMenu();

        renderMenu();

        renderMenuSettings();

    } catch (error) {

        console.error(
            "Menu loading error:",
            error
        );

        menuItems = [];

        renderMenu();

        renderMenuSettings();
    }
}


function sortMenu() {

    menuItems.sort((a, b) => {

        const indexA =
            menuOrder.indexOf(a.name);

        const indexB =
            menuOrder.indexOf(b.name);

        const safeA =
            indexA === -1
                ? 999
                : indexA;

        const safeB =
            indexB === -1
                ? 999
                : indexB;

        return safeA - safeB;
    });
}


/* =========================================================
   RENDER MENU
========================================================= */

function renderMenu() {

    const container =
        document.getElementById("menuContainer");

    if (!container) {
        return;
    }

    if (!menuItems.length) {

        container.innerHTML = `
            <div class="empty-state">
                No menu items available.
            </div>
        `;

        return;
    }

    container.innerHTML =
        menuItems.map(item => {

            return `
                <div
                    class="menu-card"
                    data-menu-name="${escapeHtml(item.name)}"
                >

                    <div class="menu-card-top">

                        <div>

                            <h3>
                                ${escapeHtml(item.name)}
                            </h3>

                            <div class="menu-category">
                                ${escapeHtml(item.category || "")}
                            </div>

                        </div>

                        <div class="menu-price">
                            ₹${formatMoney(item.price)}
                        </div>

                    </div>

                    <div class="menu-card-bottom">

                        <button
                            class="add-item-button"
                            onclick="openCustomization('${item.id}')"
                        >
                            Customize & Add
                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   MENU SEARCH
========================================================= */

function searchMenu() {

    const searchInput =
        document.getElementById("menuSearch");

    const search =
        searchInput?.value
            .trim()
            .toLowerCase() || "";

    const cards =
        document.querySelectorAll(".menu-card");

    cards.forEach(card => {

        const name =
            card
                .getAttribute("data-menu-name")
                ?.toLowerCase() || "";

        card.style.display =
            name.includes(search)
                ? ""
                : "none";
    });
}


/* =========================================================
   CUSTOMIZATION
========================================================= */

function openCustomization(itemId) {

    const item =
        menuItems.find(
            menuItem =>
                String(menuItem.id) ===
                String(itemId)
        );

    if (!item) {
        return;
    }

    currentCustomItem = item;
    customQuantity = 1;

    const modal =
        document.getElementById(
            "customizationModal"
        );

    const title =
        document.getElementById(
            "customizationTitle"
        );

    const price =
        document.getElementById(
            "customizationPrice"
        );

    const quantity =
        document.getElementById(
            "customQuantity"
        );

    const note =
        document.getElementById(
            "customNote"
        );

    if (title) {
        title.textContent = item.name;
    }

    if (price) {
        price.textContent =
            `₹${formatMoney(item.price)}`;
    }

    if (quantity) {
        quantity.textContent = "1";
    }

    if (note) {
        note.value = "";
    }

    renderCustomizationOptions(item);

    modal?.classList.remove("hidden");
}


function closeCustomization() {

    document
        .getElementById("customizationModal")
        ?.classList.add("hidden");

    currentCustomItem = null;
    customQuantity = 1;
}


function changeCustomQuantity(change) {

    customQuantity += Number(change);

    if (customQuantity < 1) {
        customQuantity = 1;
    }

    if (customQuantity > 99) {
        customQuantity = 99;
    }

    const element =
        document.getElementById(
            "customQuantity"
        );

    if (element) {
        element.textContent =
            String(customQuantity);
    }
}


/* =========================================================
   CUSTOMIZATION ADDONS
========================================================= */

function renderCustomizationOptions(item) {

    const container =
        document.getElementById(
            "customizationOptions"
        );

    if (!container) {
        return;
    }

    const addons =
        Array.isArray(item.addons)
            ? item.addons
            : [];

    if (!addons.length) {

        container.innerHTML = `
            <h3>Customization</h3>
            <p class="menu-category">
                No paid add-ons available.
            </p>
        `;

        return;
    }

    container.innerHTML = `
        <h3>Add-ons</h3>

        ${addons.map((addon, index) => {

            const name =
                addon?.name || "Add-on";

            const price =
                Number(addon?.price || 0);

            return `
                <div class="custom-option">

                    <div>

                        <div class="custom-option-name">
                            ${escapeHtml(name)}
                        </div>

                        <div class="custom-option-price">
                            +₹${formatMoney(price)}
                        </div>

                    </div>

                    <div class="addon-control">

                        <button
                            type="button"
                            onclick="changeAddonQuantity(${index}, -1)"
                        >
                            −
                        </button>

                        <span
                            class="addon-qty"
                            id="addonQty${index}"
                        >
                            0
                        </span>

                        <button
                            type="button"
                            onclick="changeAddonQuantity(${index}, 1)"
                        >
                            +
                        </button>

                    </div>

                </div>
            `;

        }).join("")}
    `;
}


function changeAddonQuantity(
    index,
    change
) {

    const element =
        document.getElementById(
            `addonQty${index}`
        );

    if (!element) {
        return;
    }

    let quantity =
        Number(element.textContent || 0);

    quantity += Number(change);

    if (quantity < 0) {
        quantity = 0;
    }

    if (quantity > 99) {
        quantity = 99;
    }

    element.textContent =
        String(quantity);
}


/* =========================================================
   ADD CUSTOMIZED ITEM TO CART
========================================================= */

function addCustomizedItem() {

    if (!currentCustomItem) {
        return;
    }

    const item =
        currentCustomItem;

    const addons =
        Array.isArray(item.addons)
            ? item.addons
            : [];

    const selectedAddons = [];

    addons.forEach((addon, index) => {

        const quantityElement =
            document.getElementById(
                `addonQty${index}`
            );

        const quantity =
            Number(
                quantityElement?.textContent || 0
            );

        if (quantity > 0) {

            selectedAddons.push({

                name:
                    addon.name,

                price:
                    Number(addon.price || 0),

                quantity
            });
        }
    });


    const note =
        document
            .getElementById("customNote")
            ?.value
            .trim() || "";


    const cartItem = {

        cart_id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 9)}`,

        menu_item_id:
            item.id,

        name:
            item.name,

        base_price:
            Number(item.price || 0),

        quantity:
            customQuantity,

        addons:
            selectedAddons,

        note
    };


    cart.push(cartItem);

    updateCartCount();

    closeCustomization();

    showToast(
        `${item.name} added to cart.`
    );
}


/* =========================================================
   CART
========================================================= */

function openCart() {

    renderCart();

    document
        .getElementById("cartModal")
        ?.classList.remove("hidden");
}


function closeCart() {

    document
        .getElementById("cartModal")
        ?.classList.add("hidden");
}


function renderCart() {

    const container =
        document.getElementById("cartItems");

    const totalElement =
        document.getElementById("cartTotal");

    if (!container) {
        return;
    }


    if (!cart.length) {

        container.innerHTML = `
            <div class="empty-state">
                Your cart is empty.
            </div>
        `;

        if (totalElement) {
            totalElement.textContent = "₹0";
        }

        return;
    }


    container.innerHTML =
        cart.map(item => {

            const itemTotal =
                calculateCartItemTotal(item);

            const addonsHtml =
                Array.isArray(item.addons)
                    ? item.addons
                        .map(addon => {

                            return `
                                <div class="cart-addon">
                                    ${escapeHtml(addon.name)}
                                    × ${addon.quantity}
                                    (+₹${formatMoney(
                                        Number(addon.price || 0) *
                                        Number(addon.quantity || 0)
                                    )})
                                </div>
                            `;

                        })
                        .join("")
                    : "";


            return `
                <div class="cart-item">

                    <div class="cart-item-header">

                        <div class="cart-item-name">
                            ${escapeHtml(item.name)}
                        </div>

                        <div class="cart-item-price">
                            ₹${formatMoney(itemTotal)}
                        </div>

                    </div>


                    <div class="cart-item-meta">

                        Base:
                        ₹${formatMoney(item.base_price)}
                        × ${item.quantity}

                        ${addonsHtml}

                        ${
                            item.note
                                ? `<div>
                                    Note: ${escapeHtml(item.note)}
                                   </div>`
                                : ""
                        }

                    </div>


                    <div class="cart-item-actions">

                        <div class="quantity-control">

                            <button
                                onclick="changeCartQuantity('${item.cart_id}', -1)"
                            >
                                −
                            </button>

                            <strong>
                                ${item.quantity}
                            </strong>

                            <button
                                onclick="changeCartQuantity('${item.cart_id}', 1)"
                            >
                                +
                            </button>

                        </div>


                        <button
                            class="remove-cart-button"
                            onclick="removeCartItem('${item.cart_id}')"
                        >
                            Remove
                        </button>

                    </div>

                </div>
            `;

        }).join("");


    const total =
        calculateCartTotal();

    if (totalElement) {
        totalElement.textContent =
            `₹${formatMoney(total)}`;
    }
}


function changeCartQuantity(
    cartId,
    change
) {

    const item =
        cart.find(
            cartItem =>
                cartItem.cart_id === cartId
        );

    if (!item) {
        return;
    }

    item.quantity += Number(change);

    if (item.quantity <= 0) {

        removeCartItem(cartId);

        return;
    }

    if (item.quantity > 99) {
        item.quantity = 99;
    }

    renderCart();
    updateCartCount();
}


function removeCartItem(cartId) {

    cart =
        cart.filter(
            item =>
                item.cart_id !== cartId
        );

    renderCart();

    updateCartCount();
}


function updateCartCount() {

    const count =
        cart.reduce(
            (total, item) =>
                total + Number(item.quantity || 0),
            0
        );

    const element =
        document.getElementById("cartCount");

    if (element) {
        element.textContent =
            String(count);
    }
}


/* =========================================================
   CART CALCULATIONS
========================================================= */

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
        (total, item) =>
            total +
            calculateCartItemTotal(item),
        0
    );
}


/* =========================================================
   PLACE ORDER
========================================================= */

async function placeOrder() {

    if (!currentUser) {

        alert("Please login first.");

        return;
    }


    if (!cart.length) {

        alert("Your cart is empty.");

        return;
    }


    const customerName =
        document
            .getElementById("customerName")
            ?.value
            .trim();


    const orderType =
        document
            .getElementById("orderType")
            ?.value || "Dine";


    const paymentMethod =
        document
            .getElementById("paymentMethod")
            ?.value || "Cash";


    const note =
        document
            .getElementById("orderNote")
            ?.value
            .trim() || "";


    if (!customerName) {

        alert(
            "Please enter customer name."
        );

        return;
    }


    const button =
        document.querySelector(
            "#cartModal .primary-button"
        );


    if (button) {

        button.disabled = true;
        button.textContent =
            "Placing Order...";
    }


    try {

        /* ---------------------------------------------
           GET DAILY TOKEN
        --------------------------------------------- */

        const {
            data: token,
            error: tokenError
        } = await supabaseClient
            .rpc("get_next_order_token");


        if (tokenError) {
            throw tokenError;
        }


        /* ---------------------------------------------
           INSERT ORDER
        --------------------------------------------- */

        const {
            error: orderError
        } = await supabaseClient
            .from("orders")
            .insert({

                token:
                    Number(token),

                customer_name:
                    customerName,

                items:
                    cart,

                note:
                    note,

                payment_method:
                    paymentMethod,

                total:
                    calculateCartTotal(),

                status:
                    "New",

                created_by:
                    currentUser.id,

                order_type:
                    orderType,

                order_date:
                    getLocalDate()
            });


        if (orderError) {
            throw orderError;
        }


        /* ---------------------------------------------
           RESET
        --------------------------------------------- */

        cart = [];

        updateCartCount();

        document
            .getElementById("customerName")
            .value = "";

        document
            .getElementById("orderNote")
            .value = "";

        document
            .getElementById("orderType")
            .value = "Dine";

        document
            .getElementById("paymentMethod")
            .value = "Cash";


        closeCart();


        await loadOrders();

        renderActiveOrders();

        renderTodayOrders();

        updateTodaySummary();


        showToast(
            `Order #${token} placed successfully.`
        );


    } catch (error) {

        console.error(
            "Place order error:",
            error
        );

        alert(
            error.message ||
            "Unable to place order."
        );


    } finally {

        if (button) {

            button.disabled = false;
            button.textContent =
                "Place Order";
        }
    }
}


/* =========================================================
   LOAD ORDERS
========================================================= */

async function loadOrders() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("orders")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        allOrders = data || [];


    } catch (error) {

        console.error(
            "Orders loading error:",
            error
        );

        allOrders = [];
    }
}


/* =========================================================
   ACTIVE ORDERS
========================================================= */

function renderActiveOrders() {

    const container =
        document.getElementById(
            "activeOrdersContainer"
        );

    if (!container) {
        return;
    }


    const activeOrders =
        allOrders.filter(
            order =>
                order.status === "New" ||
                order.status === "Preparing"
        );


    if (!activeOrders.length) {

        container.innerHTML = `
            <div class="empty-state">
                No active orders.
            </div>
        `;

        return;
    }


    container.innerHTML =
        activeOrders
            .map(order =>
                renderOrderCard(
                    order,
                    true
                )
            )
            .join("");
}


/* =========================================================
   TODAY'S ORDERS
========================================================= */

function renderTodayOrders() {

    const container =
        document.getElementById(
            "todayOrdersContainer"
        );

    if (!container) {
        return;
    }


    const today =
        getLocalDate();


    const todayOrders =
        allOrders.filter(
            order =>
                order.order_date === today
        );


    if (!todayOrders.length) {

        container.innerHTML = `
            <div class="empty-state">
                No orders today.
            </div>
        `;

        return;
    }


    container.innerHTML =
        todayOrders
            .map(order =>
                renderOrderCard(
                    order,
                    false
                )
            )
            .join("");
}


/* =========================================================
   ORDER CARD
========================================================= */

function renderOrderCard(
    order,
    showActions
) {

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];


    const itemsHtml =
        items.map(item => {

            const itemTotal =
                calculateCartItemTotal(item);


            const addonsHtml =
                Array.isArray(item.addons)
                    ? item.addons
                        .filter(
                            addon =>
                                Number(
                                    addon.quantity || 0
                                ) > 0
                        )
                        .map(
                            addon =>
                                `${escapeHtml(
                                    addon.name
                                )} × ${addon.quantity}`
                        )
                        .join(", ")
                    : "";


            return `
                <div class="order-line">

                    <div class="order-line-main">

                        <span class="order-line-name">
                            ${Number(item.quantity || 1)}
                            ×
                            ${escapeHtml(item.name)}
                        </span>

                        <span class="order-line-price">
                            ₹${formatMoney(itemTotal)}
                        </span>

                    </div>


                    ${
                        addonsHtml
                            ? `
                                <div class="order-line-details">
                                    Add-ons:
                                    ${addonsHtml}
                                </div>
                              `
                            : ""
                    }


                    ${
                        item.note
                            ? `
                                <div class="order-line-details">
                                    Note:
                                    ${escapeHtml(item.note)}
                                </div>
                              `
                            : ""
                    }

                </div>
            `;

        }).join("");


    const statusClass =
        getStatusClass(order.status);


    const orderTime =
        formatDateTime(order.created_at);


    let actions = "";


    if (showActions) {

        if (
            order.status === "New"
        ) {

            actions += `
                <button
                    class="order-action-button prepare-button"
                    onclick="changeOrderStatus('${order.id}', 'Preparing')"
                >
                    Start Preparing
                </button>
            `;
        }


        if (
            order.status === "Preparing" &&
            isAdmin()
        ) {

            actions += `
                <button
                    class="order-action-button complete-button"
                    onclick="changeOrderStatus('${order.id}', 'Completed')"
                >
                    Complete
                </button>
            `;
        }


        if (
            isAdmin() &&
            order.status !== "Cancelled"
        ) {

            actions += `
                <button
                    class="order-action-button cancel-button"
                    onclick="cancelOrder('${order.id}')"
                >
                    Cancel
                </button>
            `;
        }
    }


    return `
        <article class="order-card">

            <div class="order-card-header">

                <div>

                    <div class="order-token">
                        #${order.token}
                    </div>

                    <div class="order-customer">
                        ${escapeHtml(
                            order.customer_name
                        )}
                    </div>

                    <div class="order-time">
                        ${orderTime}
                        •
                        ${escapeHtml(
                            order.order_type || "Dine"
                        )}
                        •
                        ${escapeHtml(
                            order.payment_method || ""
                        )}
                    </div>

                </div>


                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHtml(
                        order.status
                    )}
                </span>

            </div>


            <div class="order-items">
                ${itemsHtml}
            </div>


            ${
                order.note
                    ? `
                        <div class="order-note">
                            <strong>Order Note:</strong>
                            ${escapeHtml(order.note)}
                        </div>
                      `
                    : ""
            }


            <div class="order-footer">

                <div class="order-total">
                    ₹${formatMoney(order.total)}
                </div>


                <div class="order-actions">

                    <button
                        class="order-action-button details-button"
                        onclick="openOrderDetails('${order.id}')"
                    >
                        Details
                    </button>

                    ${actions}

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   CHANGE ORDER STATUS
========================================================= */

async function changeOrderStatus(
    orderId,
    newStatus
) {

    const order =
        allOrders.find(
            item =>
                String(item.id) ===
                String(orderId)
        );


    if (!order) {
        return;
    }


    if (
        newStatus === "Completed" &&
        !isAdmin()
    ) {

        alert(
            "Only admin can complete orders."
        );

        return;
    }


    try {

        const updateData = {
            status: newStatus
        };


        if (
            newStatus === "Completed"
        ) {

            updateData.completed_by =
                currentUser.id;

            updateData.completed_at =
                new Date().toISOString();
        }


        const {
            error
        } = await supabaseClient
            .from("orders")
            .update(updateData)
            .eq("id", orderId);


        if (error) {
            throw error;
        }


        await loadOrders();

        renderActiveOrders();

        renderTodayOrders();

        updateTodaySummary();


    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert(
            error.message ||
            "Unable to update order."
        );
    }
}


/* =========================================================
   CANCEL ORDER
========================================================= */

async function cancelOrder(orderId) {

    if (!isAdmin()) {

        alert(
            "Only admin can cancel orders."
        );

        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to cancel this order?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("orders")
            .update({
                status: "Cancelled"
            })
            .eq("id", orderId);


        if (error) {
            throw error;
        }


        await loadOrders();

        renderActiveOrders();

        renderTodayOrders();

        updateTodaySummary();


    } catch (error) {

        console.error(
            "Cancel order error:",
            error
        );

        alert(
            error.message ||
            "Unable to cancel order."
        );
    }
}


/* =========================================================
   ORDER DETAILS
========================================================= */

function openOrderDetails(orderId) {

    const order =
        allOrders.find(
            item =>
                String(item.id) ===
                String(orderId)
        );


    if (!order) {
        return;
    }


    const container =
        document.getElementById(
            "orderDetailsContent"
        );


    if (!container) {
        return;
    }


    const items =
        Array.isArray(order.items)
            ? order.items
            : [];


    const itemsHtml =
        items.map(item => {

            const itemTotal =
                calculateCartItemTotal(item);


            const addons =
                Array.isArray(item.addons)
                    ? item.addons
                        .map(
                            addon =>
                                `${escapeHtml(
                                    addon.name
                                )} × ${addon.quantity}`
                        )
                        .join(", ")
                    : "";


            return `
                <div class="order-line">

                    <div class="order-line-main">

                        <span>
                            ${item.quantity} ×
                            ${escapeHtml(item.name)}
                        </span>

                        <strong>
                            ₹${formatMoney(itemTotal)}
                        </strong>

                    </div>


                    ${
                        addons
                            ? `
                                <div class="order-line-details">
                                    ${addons}
                                </div>
                              `
                            : ""
                    }

                </div>
            `;

        }).join("");


    container.innerHTML = `

        <div class="order-card-header">

            <div>

                <div class="order-token">
                    #${order.token}
                </div>

                <div class="order-customer">
                    ${escapeHtml(
                        order.customer_name
                    )}
                </div>

            </div>

            <span
                class="status-badge ${getStatusClass(
                    order.status
                )}"
            >
                ${escapeHtml(order.status)}
            </span>

        </div>


        <div class="order-line-details">
            ${formatDateTime(order.created_at)}
        </div>


        <div style="margin-top:15px;">
            ${itemsHtml}
        </div>


        <div class="order-note">

            <strong>Order Type:</strong>
            ${escapeHtml(
                order.order_type || "Dine"
            )}

            <br>

            <strong>Payment:</strong>
            ${escapeHtml(
                order.payment_method || ""
            )}

            ${
                order.note
                    ? `
                        <br>
                        <strong>Note:</strong>
                        ${escapeHtml(order.note)}
                      `
                    : ""
            }

        </div>


        <div
            class="cart-total-row"
            style="margin-top:15px;"
        >

            <span>Total</span>

            <strong>
                ₹${formatMoney(order.total)}
            </strong>

        </div>
    `;


    document
        .getElementById("orderDetailsModal")
        ?.classList.remove("hidden");
}


function closeOrderDetails() {

    document
        .getElementById(
            "orderDetailsModal"
        )
        ?.classList.add("hidden");
}


/* =========================================================
   PAGES
========================================================= */

function showPage(pageId) {

    const pages =
        document.querySelectorAll(".page");

    pages.forEach(page => {

        page.classList.remove(
            "active-page"
        );
    });


    const target =
        document.getElementById(pageId);


    if (target) {

        target.classList.add(
            "active-page"
        );
    }


    const navMap = {

        newOrderPage:
            "newOrderNav",

        activePage:
            "activeNav",

        todayPage:
            "todayNav",

        menuSettingsPage:
            "menuSettingsButton"
    };


    document
        .querySelectorAll(".nav-button")
        .forEach(button => {

            button.classList.remove(
                "active"
            );
        });


    const navButton =
        document.getElementById(
            navMap[pageId]
        );


    if (navButton) {
        navButton.classList.add(
            "active"
        );
    }


    if (
        pageId ===
        "menuSettingsPage"
    ) {

        renderMenuSettings();
    }


    if (
        pageId ===
        "activePage"
    ) {

        renderActiveOrders();
    }


    if (
        pageId ===
        "todayPage"
    ) {

        renderTodayOrders();

        updateTodaySummary();
    }
}


/* =========================================================
   TODAY SUMMARY
========================================================= */

function updateTodaySummary() {

    const today =
        getLocalDate();


    const todayOrders =
        allOrders.filter(
            order =>
                order.order_date === today
        );


    const totalOrders =
        todayOrders.length;


    const newOrders =
        todayOrders.filter(
            order =>
                order.status === "New"
        ).length;


    const preparingOrders =
        todayOrders.filter(
            order =>
                order.status === "Preparing"
        ).length;


    const completedOrders =
        todayOrders.filter(
            order =>
                order.status === "Completed"
        ).length;


    const cancelledOrders =
        todayOrders.filter(
            order =>
                order.status === "Cancelled"
        ).length;


    const sales =
        todayOrders
            .filter(
                order =>
                    order.status !== "Cancelled"
            )
            .reduce(
                (sum, order) =>
                    sum +
                    Number(order.total || 0),
                0
            );


    setText(
        "summaryDate",
        formatReadableDate(today)
    );

    setText(
        "summaryOrders",
        totalOrders
    );

    setText(
        "summaryNew",
        newOrders
    );

    setText(
        "summaryPreparing",
        preparingOrders
    );

    setText(
        "summaryCompleted",
        completedOrders
    );

    setText(
        "summaryCancelled",
        cancelledOrders
    );

    setText(
        "summarySales",
        `₹${formatMoney(sales)}`
    );
}


/* =========================================================
   MENU SETTINGS
========================================================= */

async function renderMenuSettings() {

    const container =
        document.getElementById(
            "menuSettingsContainer"
        );


    if (!container) {
        return;
    }


    if (!isAdmin()) {

        container.innerHTML = `
            <div class="empty-state">
                Admin access required.
            </div>
        `;

        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("menu_items")
            .select("*")
            .order("created_at", {
                ascending: true
            });


        if (error) {
            throw error;
        }


        const items =
            data || [];


        if (!items.length) {

            container.innerHTML = `
                <div class="empty-state">
                    No menu items found.
                </div>
            `;

            return;
        }


        container.innerHTML =
            items.map(item => {

                const addons =
                    Array.isArray(item.addons)
                        ? item.addons
                        : [];


                const addonText =
                    addons.length
                        ? addons
                            .map(
                                addon =>
                                    `${escapeHtml(
                                        addon.name
                                    )} ₹${formatMoney(
                                        addon.price
                                    )}`
                            )
                            .join(" • ")
                        : "No add-ons";


                return `

                    <div class="menu-setting-card">

                        <div class="menu-setting-header">

                            <div>

                                <div class="menu-setting-name">
                                    ${escapeHtml(item.name)}
                                </div>

                                <div class="menu-setting-category">
                                    ${escapeHtml(
                                        item.category || ""
                                    )}
                                    •
                                    ${
                                        item.active
                                            ? "Active"
                                            : "Inactive"
                                    }
                                </div>

                            </div>


                            <div class="menu-setting-price">
                                ₹${formatMoney(item.price)}
                            </div>

                        </div>


                        <div class="menu-setting-addons">

                            <strong>
                                Add-ons:
                            </strong>

                            ${addonText}

                        </div>


                        <div class="menu-setting-actions">

                            <button
                                class="secondary-button"
                                onclick="openEditMenuItem('${item.id}')"
                            >
                                Edit
                            </button>


                            <button
                                class="danger-button"
                                onclick="deleteMenuItem('${item.id}')"
                            >
                                Delete
                            </button>

                        </div>

                    </div>

                `;

            }).join("");


    } catch (error) {

        console.error(
            "Menu settings error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                Unable to load menu settings.
            </div>
        `;
    }
}


/* =========================================================
   ADD MENU ITEM
========================================================= */

function openAddMenuItem() {

    if (!isAdmin()) {
        return;
    }

    editingMenuItemId = null;

    setText(
        "menuEditorTitle",
        "Add Menu Item"
    );

    document
        .getElementById("editingMenuItemId")
        .value = "";


    document
        .getElementById("menuItemName")
        .value = "";


    document
        .getElementById("menuItemCategory")
        .value = "";


    document
        .getElementById("menuItemPrice")
        .value = "";


    document
        .getElementById("menuItemActive")
        .checked = true;


    document
        .getElementById("addonFields")
        .innerHTML = "";


    document
        .getElementById("menuEditorModal")
        ?.classList.remove("hidden");
}


/* =========================================================
   EDIT MENU ITEM
========================================================= */

async function openEditMenuItem(itemId) {

    if (!isAdmin()) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("menu_items")
            .select("*")
            .eq("id", itemId)
            .single();


        if (error) {
            throw error;
        }


        editingMenuItemId =
            itemId;


        setText(
            "menuEditorTitle",
            "Edit Menu Item"
        );


        document
            .getElementById("editingMenuItemId")
            .value = item.id;


        document
            .getElementById("menuItemName")
            .value = item.name || "";


        document
            .getElementById("menuItemCategory")
            .value =
                item.category || "";


        document
            .getElementById("menuItemPrice")
            .value =
                item.price || 0;


        document
            .getElementById("menuItemActive")
            .checked =
                Boolean(item.active);


        renderAddonEditor(
            Array.isArray(item.addons)
                ? item.addons
                : []
        );


        document
            .getElementById("menuEditorModal")
            ?.classList.remove("hidden");


    } catch (error) {

        console.error(
            "Edit menu error:",
            error
        );

        alert(
            error.message ||
            "Unable to load menu item."
        );
    }
}


/* =========================================================
   ADDON EDITOR
========================================================= */

function renderAddonEditor(addons) {

    const container =
        document.getElementById(
            "addonFields"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    addons.forEach(addon => {

        addAddonField(
            addon.name,
            addon.price
        );
    });
}


function addAddonField(
    name = "",
    price = ""
) {

    const container =
        document.getElementById(
            "addonFields"
        );


    if (!container) {
        return;
    }


    const row =
        document.createElement("div");


    row.className =
        "addon-editor-row";


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
            min="0"
            step="1"
            placeholder="Price"
            value="${escapeAttribute(price)}"
        >


        <button
            type="button"
            class="remove-addon-button"
            onclick="this.parentElement.remove()"
        >
            ×
        </button>

    `;


    container.appendChild(row);
}


/* =========================================================
   SAVE MENU ITEM
========================================================= */

async function saveMenuItem() {

    if (!isAdmin()) {
        return;
    }


    const name =
        document
            .getElementById("menuItemName")
            ?.value
            .trim();


    const category =
        document
            .getElementById("menuItemCategory")
            ?.value
            .trim();


    const price =
        Number(
            document
                .getElementById("menuItemPrice")
                ?.value || 0
        );


    const active =
        document
            .getElementById("menuItemActive")
            ?.checked ?? true;


    if (!name) {

        alert(
            "Please enter item name."
        );

        return;
    }


    if (!category) {

        alert(
            "Please enter category."
        );

        return;
    }


    if (price < 0) {

        alert(
            "Price cannot be negative."
        );

        return;
    }


    const addonRows =
        document.querySelectorAll(
            "#addonFields .addon-editor-row"
        );


    const addons = [];


    addonRows.forEach(row => {

        const addonName =
            row
                .querySelector(".addon-name")
                ?.value
                .trim();


        const addonPrice =
            Number(
                row
                    .querySelector(".addon-price")
                    ?.value || 0
            );


        if (
            addonName &&
            addonPrice >= 0
        ) {

            addons.push({

                name:
                    addonName,

                price:
                    addonPrice
            });
        }
    });


    const saveButton =
        document.querySelector(
            "#menuEditorModal .primary-button"
        );


    if (saveButton) {

        saveButton.disabled = true;
        saveButton.textContent =
            "Saving...";
    }


    try {

        const menuData = {

            name,

            category,

            price,

            addons,

            active
        };


        if (editingMenuItemId) {

            const {
                error
            } = await supabaseClient
                .from("menu_items")
                .update(menuData)
                .eq(
                    "id",
                    editingMenuItemId
                );


            if (error) {
                throw error;
            }

        } else {

            const {
                error
            } = await supabaseClient
                .from("menu_items")
                .insert(menuData);


            if (error) {
                throw error;
            }
        }


        closeMenuEditor();

        await loadMenu();

        await renderMenuSettings();

        showToast(
            "Menu item saved."
        );


    } catch (error) {

        console.error(
            "Save menu error:",
            error
        );

        alert(
            error.message ||
            "Unable to save menu item."
        );


    } finally {

        if (saveButton) {

            saveButton.disabled = false;
            saveButton.textContent =
                "Save Menu Item";
        }
    }
}


/* =========================================================
   DELETE MENU ITEM
========================================================= */

async function deleteMenuItem(itemId) {

    if (!isAdmin()) {
        return;
    }


    const confirmed =
        confirm(
            "Delete this menu item?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("menu_items")
            .delete()
            .eq("id", itemId);


        if (error) {
            throw error;
        }


        await loadMenu();

        await renderMenuSettings();


        showToast(
            "Menu item deleted."
        );


    } catch (error) {

        console.error(
            "Delete menu error:",
            error
        );

        alert(
            error.message ||
            "Unable to delete menu item."
        );
    }
}


/* =========================================================
   CLOSE MENU EDITOR
========================================================= */

function closeMenuEditor() {

    document
        .getElementById(
            "menuEditorModal"
        )
        ?.classList.add("hidden");


    editingMenuItemId = null;
}


/* =========================================================
   REALTIME
========================================================= */

function setupRealtime() {

    if (realtimeChannel) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );

        realtimeChannel = null;
    }


    realtimeChannel =
        supabaseClient
            .channel(
                "chai-mohalla-live"
            )


            /* Orders */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders"
                },
                async () => {

                    await loadOrders();

                    renderActiveOrders();

                    renderTodayOrders();

                    updateTodaySummary();
                }
            )


            /* Menu */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "menu_items"
                },
                async () => {

                    await loadMenu();

                    if (
                        document
                            .getElementById(
                                "menuSettingsPage"
                            )
                            ?.classList
                            .contains(
                                "active-page"
                            )
                    ) {

                        await renderMenuSettings();
                    }
                }
            )


            .subscribe(
                status => {

                    console.log(
                        "Realtime status:",
                        status
                    );
                }
            );
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (
            event === "SIGNED_OUT"
        ) {

            currentUser = null;

            showLogin();

            return;
        }


        if (
            event === "SIGNED_IN" &&
            session
        ) {

            currentUser =
                session.user;

            await showApp();
        }
    }
);


/* =========================================================
   HELPERS
========================================================= */

function getLocalDate() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            now.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;
}


function formatReadableDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}


function formatDateTime(
    dateString
) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(dateString);


    return date.toLocaleString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


function formatMoney(value) {

    const number =
        Number(value || 0);


    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 2
        }
    );
}


function getStatusClass(
    status
) {

    switch (status) {

        case "New":
            return "status-new";

        case "Preparing":
            return "status-preparing";

        case "Completed":
            return "status-completed";

        case "Cancelled":
            return "status-cancelled";

        default:
            return "";
    }
}


function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {
        element.textContent =
            String(value);
    }
}


/* =========================================================
   SECURITY / HTML HELPERS
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeAttribute(value) {

    return escapeHtml(value);
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    let toast =
        document.getElementById(
            "appToast"
        );


    if (!toast) {

        toast =
            document.createElement("div");

        toast.id =
            "appToast";


        toast.style.position =
            "fixed";

        toast.style.left =
            "50%";

        toast.style.bottom =
            "85px";

        toast.style.transform =
            "translateX(-50%)";

        toast.style.background =
            "#3c2115";

        toast.style.color =
            "white";

        toast.style.padding =
            "11px 16px";

        toast.style.borderRadius =
            "10px";

        toast.style.zIndex =
            "1000";

        toast.style.fontSize =
            "14px";

        toast.style.boxShadow =
            "0 4px 15px rgba(0,0,0,.2)";


        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;


    toast.style.display =
        "block";


    clearTimeout(
        toast._timeout
    );


    toast._timeout =
        setTimeout(
            () => {

                toast.style.display =
                    "none";

            },
            2500
        );
}

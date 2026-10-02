/* =====================================================
   CHAI MOHALLA
   ORDER MANAGEMENT SYSTEM
   ===================================================== */


/* =====================================================
   SUPABASE
   ===================================================== */

const SUPABASE_URL = "https://tvaczmcdvqaiworrjsjw.supabase.co";
const SUPABASE_KEY = "sb_publishable_G0Ev8UdENIu5r_leRDoXuQ_eVEJmTeD";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =====================================================
   GLOBAL STATE
   ===================================================== */

let currentUser = null;
let currentRole = "staff";
let currentProfile = null;

let menuItems = [];
let cart = [];

let currentCustomizationItem = null;
let customQuantity = 1;

let editingMenuItemId = null;


/* =====================================================
   MENU ORDER
   ===================================================== */

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


/* =====================================================
   START APP
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
});


/* =====================================================
   AUTHENTICATION
   ===================================================== */

async function checkLogin() {

    try {

        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Session error:", error);
            showLogin();
            return;
        }

        if (session && session.user) {

            currentUser = session.user;

            await initializeApp();

        } else {

            showLogin();

        }

    } catch (error) {

        console.error("Login check failed:", error);

        showLogin();
    }
}


/* =====================================================
   LOGIN
   ===================================================== */

async function loginUser() {

    const emailInput =
        document.getElementById("loginEmail");

    const passwordInput =
        document.getElementById("loginPassword");

    const errorElement =
        document.getElementById("loginError");

    if (!emailInput || !passwordInput) {
        console.error("Login fields not found.");
        return;
    }

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    if (!email || !password) {

        if (errorElement) {
            errorElement.textContent =
                "Please enter email and password.";
        }

        return;
    }

    if (errorElement) {
        errorElement.textContent = "Logging in...";
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

            console.error("Login error:", error);

            if (errorElement) {
                errorElement.textContent =
                    error.message;
            }

            return;
        }

        currentUser = data.user;

        if (errorElement) {
            errorElement.textContent = "";
        }

        await initializeApp();

    } catch (error) {

        console.error(error);

        if (errorElement) {
            errorElement.textContent =
                "Login failed. Please try again.";
        }
    }
}


/* =====================================================
   LOGOUT
   ===================================================== */

async function logoutUser() {

    try {

        await supabaseClient.auth.signOut();

        currentUser = null;
        currentProfile = null;
        currentRole = "staff";

        cart = [];

        showLogin();

    } catch (error) {

        console.error("Logout error:", error);

    }
}


/* =====================================================
   SHOW / HIDE LOGIN
   ===================================================== */

function showLogin() {

    const loginScreen =
        document.getElementById("loginScreen");

    const appContent =
        document.getElementById("appContent");

    if (loginScreen) {
        loginScreen.classList.remove("hidden");
    }

    if (appContent) {
        appContent.classList.add("hidden");
    }
}


function showApp() {

    const loginScreen =
        document.getElementById("loginScreen");

    const appContent =
        document.getElementById("appContent");

    if (loginScreen) {
        loginScreen.classList.add("hidden");
    }

    if (appContent) {
        appContent.classList.remove("hidden");
    }
}


/* =====================================================
   INITIALIZE APP
   ===================================================== */

async function initializeApp() {

    showApp();

    await loadUserProfile();

    await loadMenu();

    updateCartCount();

    await renderActiveOrders();

    await renderTodayOrders();

    renderMenuSettings();

    setupRealtime();

    showPage("newOrderPage");

}


/* =====================================================
   LOAD USER PROFILE
   ===================================================== */

async function loadUserProfile() {

    if (!currentUser) {
        return;
    }

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

        currentRole = "staff";

        applyPermissions();

        return;
    }

    currentProfile = data;

    currentRole =
        data?.role || "staff";

    const roleElement =
        document.getElementById("userRole");

    if (roleElement) {

        roleElement.textContent =
            currentRole === "admin"
                ? "Admin"
                : "Staff";
    }

    applyPermissions();
}


/* =====================================================
   ADMIN / STAFF PERMISSIONS
   ===================================================== */

function applyPermissions() {

    const menuButton =
        document.getElementById(
            "menuSettingsButton"
        );

    if (menuButton) {

        if (currentRole === "admin") {

            menuButton.classList.remove("hidden");

        } else {

            menuButton.classList.add("hidden");

        }
    }
}


/* =====================================================
   LOAD MENU
   ===================================================== */

async function loadMenu() {

    const {
        data,
        error
    } = await supabaseClient
        .from("menu_items")
        .select("*")
        .eq("active", true);

    if (error) {

        console.error(
            "Menu loading error:",
            error
        );

        return;
    }

    menuItems = data || [];

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

    renderMenu();
}


/* =====================================================
   RENDER MENU
   ===================================================== */

function renderMenu() {

    const container =
        document.getElementById(
            "menuContainer"
        );

    if (!container) {
        return;
    }

    if (menuItems.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No menu items available.
            </div>
        `;

        return;
    }

    container.innerHTML =
        menuItems.map(item => {

            const unavailable =
                item.available === false;

            return `
                <div class="menu-card ${unavailable ? "sold-out" : ""}">

                    <div class="menu-card-header">

                        <div>
                            <h3>
                                ${escapeHtml(item.name)}
                            </h3>

                            <div class="menu-category">
                                ${escapeHtml(item.category)}
                            </div>
                        </div>

                        <div class="menu-price">
                            ₹${Number(item.price).toFixed(0)}
                        </div>

                    </div>

                    ${
                        unavailable
                            ? `
                                <button
                                    type="button"
                                    disabled
                                    style="opacity:0.6;cursor:not-allowed;"
                                >
                                    Sold Out
                                </button>
                            `
                            : `
                                <button
                                    type="button"
                                    onclick="openCustomization('${item.id}')"
                                >
                                    Customize & Add
                                </button>
                            `
                    }

                </div>
            `;

        }).join("");
}


/* =====================================================
   CUSTOMIZATION
   ===================================================== */

function openCustomization(itemId) {

    const item =
        menuItems.find(
            x => x.id === itemId
        );

    if (!item) {
        return;
    }

    currentCustomizationItem = item;
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
            `₹${Number(item.price).toFixed(0)}`;
    }

    if (quantity) {
        quantity.textContent = "1";
    }

    if (note) {
        note.value = "";
    }

    renderCustomizationOptions(item);

    if (modal) {
        modal.classList.remove("hidden");
    }
}


function closeCustomization() {

    const modal =
        document.getElementById(
            "customizationModal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }

    currentCustomizationItem = null;
    customQuantity = 1;
}


/* =====================================================
   CUSTOMIZATION OPTIONS
   ===================================================== */

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

    const styles =
        Array.isArray(item.styles)
            ? item.styles
            : [];

    let html = "";

    if (addons.length > 0) {

        html += `
            <div class="customization-section">

                <label>
                    Add-ons
                </label>

                <div class="customization-options">
        `;

        addons.forEach(addon => {

            html += `
                <label class="custom-option">

                    <input
                        type="checkbox"
                        class="custom-addon"
                        data-name="${escapeAttribute(addon.name)}"
                        data-price="${Number(addon.price || 0)}"
                    >

                    <span>
                        ${escapeHtml(addon.name)}

                        ${
                            Number(addon.price || 0) > 0
                                ? ` + ₹${Number(addon.price).toFixed(0)}`
                                : ""
                        }
                    </span>

                </label>
            `;

        });

        html += `
                </div>

            </div>
        `;
    }


    if (styles.length > 0) {

        html += `
            <div class="customization-section">

                <label>
                    Style
                </label>

                <div class="customization-options">
        `;

        styles.forEach((style, index) => {

            html += `
                <label class="custom-option">

                    <input
                        type="radio"
                        name="customStyle"
                        class="custom-style"
                        data-name="${escapeAttribute(style.name)}"
                        ${index === 0 ? "checked" : ""}
                    >

                    <span>
                        ${escapeHtml(style.name)}
                    </span>

                </label>
            `;

        });

        html += `
                </div>

            </div>
        `;
    }

    container.innerHTML = html;
}


/* =====================================================
   CUSTOM QUANTITY
   ===================================================== */

function changeCustomQuantity(change) {

    customQuantity += change;

    if (customQuantity < 1) {
        customQuantity = 1;
    }

    if (customQuantity > 20) {
        customQuantity = 20;
    }

    const element =
        document.getElementById(
            "customQuantity"
        );

    if (element) {
        element.textContent =
            customQuantity;
    }
}


/* =====================================================
   ADD CUSTOMIZED ITEM
   ===================================================== */

function addCustomizedItem() {

    if (!currentCustomizationItem) {
        return;
    }

    const item =
        currentCustomizationItem;

    const selectedAddons =
        Array.from(
            document.querySelectorAll(
                ".custom-addon:checked"
            )
        );

    const selectedStyles =
        Array.from(
            document.querySelectorAll(
                ".custom-style:checked"
            )
        );

    const noteElement =
        document.getElementById(
            "customNote"
        );

    const note =
        noteElement
            ? noteElement.value.trim()
            : "";

    let addonTotal = 0;

    const addons = selectedAddons.map(
        checkbox => {

            const name =
                checkbox.dataset.name;

            const price =
                Number(
                    checkbox.dataset.price || 0
                );

            addonTotal += price;

            return {
                name,
                price
            };
        }
    );

    const styles =
        selectedStyles.map(
            radio => radio.dataset.name
        );

    const unitPrice =
        Number(item.price) + addonTotal;

    const totalPrice =
        unitPrice * customQuantity;

    cart.push({

        cartId:
            Date.now().toString() +
            Math.random()
                .toString(36)
                .substring(2),

        menuItemId: item.id,

        name: item.name,

        quantity: customQuantity,

        basePrice: Number(item.price),

        addons,

        styles,

        note,

        unitPrice,

        totalPrice
    });

    updateCartCount();

    closeCustomization();

    openCart();
}


/* =====================================================
   CART
   ===================================================== */

function updateCartCount() {

    const count =
        cart.reduce(
            (sum, item) =>
                sum + Number(item.quantity),
            0
        );

    const element =
        document.getElementById(
            "cartCount"
        );

    if (element) {
        element.textContent = count;
    }
}


function openCart() {

    renderCart();

    const modal =
        document.getElementById(
            "cartModal"
        );

    if (modal) {
        modal.classList.remove("hidden");
    }
}


function closeCart() {

    const modal =
        document.getElementById(
            "cartModal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }
}


function renderCart() {

    const container =
        document.getElementById(
            "cartItems"
        );

    const totalElement =
        document.getElementById(
            "cartTotal"
        );

    if (!container) {
        return;
    }

    if (cart.length === 0) {

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

    let total = 0;

    container.innerHTML =
        cart.map(item => {

            total +=
                Number(item.totalPrice);

            const addonsText =
                item.addons
                    ?.map(
                        addon =>
                            `${escapeHtml(addon.name)}`
                    )
                    .join(", ");

            const stylesText =
                item.styles
                    ?.map(
                        style =>
                            escapeHtml(style)
                    )
                    .join(", ");

            return `
                <div class="cart-item">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                        font-weight:900;
                    ">

                        <span>
                            ${escapeHtml(item.name)}
                            × ${item.quantity}
                        </span>

                        <span>
                            ₹${Number(item.totalPrice).toFixed(0)}
                        </span>

                    </div>

                    ${
                        addonsText
                            ? `
                                <div style="
                                    margin-top:6px;
                                    font-size:12px;
                                    color:#755c4e;
                                ">
                                    Add-ons: ${addonsText}
                                </div>
                            `
                            : ""
                    }

                    ${
                        stylesText
                            ? `
                                <div style="
                                    margin-top:4px;
                                    font-size:12px;
                                    color:#755c4e;
                                ">
                                    Style: ${stylesText}
                                </div>
                            `
                            : ""
                    }

                    ${
                        item.note
                            ? `
                                <div style="
                                    margin-top:5px;
                                    font-size:12px;
                                    font-weight:700;
                                    color:#4a2c20;
                                ">
                                    Note: ${escapeHtml(item.note)}
                                </div>
                            `
                            : ""
                    }

                    <button
                        type="button"
                        onclick="removeCartItem('${item.cartId}')"
                        style="
                            margin-top:8px;
                            background:#fff0ef;
                            border:1px solid #e8aaa5;
                            color:#b42318;
                            border-radius:7px;
                            padding:6px 9px;
                            font-size:11px;
                            font-weight:800;
                        "
                    >
                        Remove
                    </button>

                </div>
            `;

        }).join("");

    if (totalElement) {
        totalElement.textContent =
            `₹${total.toFixed(0)}`;
    }
}


function removeCartItem(cartId) {

    cart =
        cart.filter(
            item =>
                item.cartId !== cartId
        );

    updateCartCount();

    renderCart();
}


/* =====================================================
   PLACE ORDER
   ===================================================== */

async function placeOrder() {

    if (!currentUser) {

        alert(
            "Please login again."
        );

        return;
    }

    if (cart.length === 0) {

        alert(
            "Please add at least one item."
        );

        return;
    }

    const customerNameElement =
        document.getElementById(
            "customerName"
        );

    const orderTypeElement =
        document.getElementById(
            "orderType"
        );

    const paymentElement =
        document.getElementById(
            "paymentMethod"
        );

    const customerName =
        customerNameElement
            ? customerNameElement.value.trim()
            : "";

    const orderType =
        orderTypeElement
            ? orderTypeElement.value
            : "Dine";

    const paymentMethod =
        paymentElement
            ? paymentElement.value
            : "Cash";

    if (!customerName) {

        alert(
            "Please enter customer name."
        );

        return;
    }

    const total =
        cart.reduce(
            (sum, item) =>
                sum + Number(item.totalPrice),
            0
        );

    try {

        /* Get daily token */

        const {
            data: token,
            error: tokenError
        } = await supabaseClient
            .rpc("get_next_order_token");

        if (tokenError) {

            console.error(
                "Token error:",
                tokenError
            );

            alert(
                "Could not generate order token."
            );

            return;
        }


        /* Prepare order items */

        const orderItems =
            cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                basePrice: item.basePrice,
                addons: item.addons || [],
                styles: item.styles || [],
                note: item.note || "",
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice
            }));


        /* Insert order */

        const {
            data,
            error
        } = await supabaseClient
            .from("orders")
            .insert({

                token,

                customer_name:
                    customerName,

                items:
                    orderItems,

                note: "",

                payment_method:
                    paymentMethod,

                total,

                status: "New",

                order_type:
                    orderType,

                order_date:
                    new Date()
                        .toISOString()
                        .split("T")[0],

                created_by:
                    currentUser.id

            })
            .select()
            .single();


        if (error) {

            console.error(
                "Order creation error:",
                error
            );

            alert(
                "Could not place order:\n" +
                error.message
            );

            return;
        }


        /* Clear cart */

        cart = [];

        updateCartCount();

        if (customerNameElement) {
            customerNameElement.value = "";
        }

        if (orderTypeElement) {
            orderTypeElement.value = "Dine";
        }

        if (paymentElement) {
            paymentElement.value = "Cash";
        }

        closeCart();


        /* Refresh */

        await renderActiveOrders();

        await renderTodayOrders();


        alert(
            `Order #${data.token} placed successfully.`
        );


    } catch (error) {

        console.error(
            "Place order error:",
            error
        );

        alert(
            "Something went wrong while placing the order."
        );
    }
}


/* =====================================================
   GET ORDERS
   ===================================================== */

async function getOrders() {

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

        console.error(
            "Orders loading error:",
            error
        );

        return [];
    }

    return data || [];
}


/* =====================================================
   ACTIVE ORDERS
   ===================================================== */

async function renderActiveOrders() {

    const container =
        document.getElementById(
            "activeOrdersContainer"
        );

    if (!container) {
        return;
    }

    const orders =
        await getOrders();

    const activeOrders =
        orders.filter(order =>
            order.status !== "Completed" &&
            order.status !== "Cancelled"
        );

    if (activeOrders.length === 0) {

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
                createOrderCard(order)
            )
            .join("");
}


/* =====================================================
   TODAY ORDERS
   ===================================================== */

async function renderTodayOrders() {

    const container =
        document.getElementById(
            "todayOrdersContainer"
        );

    if (!container) {
        return;
    }

    const orders =
        await getOrders();

    const today =
        new Date()
            .toISOString()
            .split("T")[0];

    const todayOrders =
        orders.filter(order =>
            order.order_date === today
        );

    /* UPDATE SUMMARY */

    updateTodaySummary(todayOrders);


    if (todayOrders.length === 0) {

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
                createOrderCard(order)
            )
            .join("");
}


/* =====================================================
   TODAY'S SUMMARY
   ===================================================== */

function updateTodaySummary(orders) {

    const totalOrders =
        orders.length;

    const newOrders =
        orders.filter(
            order =>
                order.status === "New"
        ).length;

    const preparingOrders =
        orders.filter(
            order =>
                order.status === "Preparing"
        ).length;

    const completedOrders =
        orders.filter(
            order =>
                order.status === "Completed"
        ).length;

    const cancelledOrders =
        orders.filter(
            order =>
                order.status === "Cancelled"
        ).length;

    const sales =
        orders
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


    const ordersElement =
        document.getElementById(
            "summaryOrders"
        );

    const newElement =
        document.getElementById(
            "summaryNew"
        );

    const preparingElement =
        document.getElementById(
            "summaryPreparing"
        );

    const completedElement =
        document.getElementById(
            "summaryCompleted"
        );

    const cancelledElement =
        document.getElementById(
            "summaryCancelled"
        );

    const salesElement =
        document.getElementById(
            "summarySales"
        );

    const dateElement =
        document.getElementById(
            "summaryDate"
        );


    if (ordersElement) {
        ordersElement.textContent =
            totalOrders;
    }

    if (newElement) {
        newElement.textContent =
            newOrders;
    }

    if (preparingElement) {
        preparingElement.textContent =
            preparingOrders;
    }

    if (completedElement) {
        completedElement.textContent =
            completedOrders;
    }

    if (cancelledElement) {
        cancelledElement.textContent =
            cancelledOrders;
    }

    if (salesElement) {
        salesElement.textContent =
            `₹${sales.toFixed(0)}`;
    }

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


/* =====================================================
   CREATE ORDER CARD
   ===================================================== */

function createOrderCard(order) {

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    const itemSummary =
        items
            .map(item => {

                let text =
                    `${item.name} × ${item.quantity}`;

                if (
                    item.addons &&
                    item.addons.length > 0
                ) {

                    const addons =
                        item.addons
                            .map(
                                addon =>
                                    addon.name
                            )
                            .join(", ");

                    text +=
                        ` (${addons})`;
                }

                return text;

            })
            .join("<br>");


    const statusClass =
        getStatusClass(
            order.status
        );


    const adminButtons =
        currentRole === "admin"
            ? `
                ${
                    order.status === "New"
                        ? `
                            <button
                                type="button"
                                class="complete-button"
                                onclick="setPreparing('${order.id}')"
                            >
                                Preparing
                            </button>
                        `
                        : ""
                }

                ${
                    order.status === "Preparing"
                        ? `
                            <button
                                type="button"
                                class="complete-button"
                                onclick="completeOrder('${order.id}')"
                            >
                                Complete
                            </button>
                        `
                        : ""
                }

                ${
                    order.status !== "Completed" &&
                    order.status !== "Cancelled"
                        ? `
                            <button
                                type="button"
                                class="cancel-button"
                                onclick="cancelOrder('${order.id}')"
                            >
                                Cancel
                            </button>
                        `
                        : ""
                }
            `
            : "";


    return `
        <div
            class="order-card"
            data-order-id="${escapeAttribute(order.id)}"
        >

            <div class="order-card-header">

                <div class="order-token">
                    #${order.token}
                </div>

                <div
                    class="order-status ${statusClass}"
                >
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

                ${itemSummary || "No items"}

            </div>


            ${
                order.note
                    ? `
                        <div class="order-meta">
                            <strong>Note:</strong>
                            ${escapeHtml(order.note)}
                        </div>
                    `
                    : ""
            }


            <div class="order-total">

                Total:
                ₹${Number(order.total || 0).toFixed(0)}

            </div>


            <div class="order-actions">

                <button
                    type="button"
                    class="view-order-button"
                    onclick="openOrderDetails('${order.id}')"
                >
                    View
                </button>

                ${adminButtons}

            </div>

        </div>
    `;
}


/* =====================================================
   STATUS CLASS
   ===================================================== */

function getStatusClass(status) {

    switch (status) {

        case "Completed":
            return "status-completed";

        case "Cancelled":
            return "status-cancelled";

        case "Preparing":
            return "status-preparing";

        default:
            return "status-new";
    }
}


/* =====================================================
   SET PREPARING
   ===================================================== */

async function setPreparing(orderId) {

    if (currentRole !== "admin") {

        alert(
            "Only Admin can change order status."
        );

        return;
    }

    const {
        error
    } = await supabaseClient
        .from("orders")
        .update({
            status: "Preparing"
        })
        .eq("id", orderId);

    if (error) {

        console.error(error);

        alert(
            "Could not update order."
        );

        return;
    }

    await renderActiveOrders();

    await renderTodayOrders();
}


/* =====================================================
   COMPLETE ORDER
   ===================================================== */

async function completeOrder(orderId) {

    if (currentRole !== "admin") {

        alert(
            "Only Admin can complete orders."
        );

        return;
    }

    const confirmed =
        confirm(
            "Mark this order as completed?"
        );

    if (!confirmed) {
        return;
    }

    const {
        error
    } = await supabaseClient
        .from("orders")
        .update({

            status: "Completed",

            completed_by:
                currentUser.id,

            completed_at:
                new Date().toISOString()

        })
        .eq("id", orderId);

    if (error) {

        console.error(error);

        alert(
            "Could not complete order."
        );

        return;
    }

    await renderActiveOrders();

    await renderTodayOrders();
}


/* =====================================================
   CANCEL ORDER
   ===================================================== */

async function cancelOrder(orderId) {

    if (currentRole !== "admin") {

        alert(
            "Only Admin can cancel orders."
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

    const {
        error
    } = await supabaseClient
        .from("orders")
        .update({
            status: "Cancelled"
        })
        .eq("id", orderId);

    if (error) {

        console.error(error);

        alert(
            "Could not cancel order."
        );

        return;
    }

    await renderActiveOrders();

    await renderTodayOrders();
}


/* =====================================================
   ORDER DETAILS
   ===================================================== */

async function openOrderDetails(orderId) {

    const {
        data: order,
        error
    } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

    if (error || !order) {

        alert(
            "Could not load order details."
        );

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

    container.innerHTML = `

        <div class="order-detail-section">

            <h3>Order</h3>

            <p>
                <strong>Token:</strong>
                #${order.token}
            </p>

            <p>
                <strong>Customer:</strong>
                ${escapeHtml(order.customer_name)}
            </p>

            <p>
                <strong>Status:</strong>
                ${escapeHtml(order.status)}
            </p>

            <p>
                <strong>Type:</strong>
                ${escapeHtml(order.order_type || "Dine")}
            </p>

            <p>
                <strong>Payment:</strong>
                ${escapeHtml(order.payment_method || "Cash")}
            </p>

        </div>


        <div class="order-detail-section">

            <h3>Items</h3>

            ${
                items.map(item => `

                    <div
                        style="
                            padding:10px 0;
                            border-bottom:1px solid #ead7b5;
                        "
                    >

                        <strong>
                            ${escapeHtml(item.name)}
                            × ${item.quantity}
                        </strong>

                        ${
                            item.addons &&
                            item.addons.length
                                ? `
                                    <p>
                                        <strong>
                                            Add-ons:
                                        </strong>

                                        ${
                                            item.addons
                                                .map(
                                                    addon =>
                                                        escapeHtml(
                                                            addon.name
                                                        )
                                                )
                                                .join(", ")
                                        }
                                    </p>
                                `
                                : ""
                        }

                        ${
                            item.styles &&
                            item.styles.length
                                ? `
                                    <p>
                                        <strong>
                                            Style:
                                        </strong>

                                        ${
                                            item.styles
                                                .map(
                                                    style =>
                                                        escapeHtml(
                                                            style
                                                        )
                                                )
                                                .join(", ")
                                        }
                                    </p>
                                `
                                : ""
                        }

                        ${
                            item.note
                                ? `
                                    <p>
                                        <strong>
                                            Note:
                                        </strong>

                                        ${escapeHtml(item.note)}
                                    </p>
                                `
                                : ""
                        }

                        <p>
                            ₹${Number(
                                item.totalPrice || 0
                            ).toFixed(0)}
                        </p>

                    </div>

                `).join("")
            }

        </div>


        ${
            order.note
                ? `
                    <div class="order-detail-section">

                        <h3>Order Note</h3>

                        <p>
                            ${escapeHtml(order.note)}
                        </p>

                    </div>
                `
                : ""
        }


        <div class="order-detail-section">

            <h3>Total</h3>

            <p style="
                font-size:20px;
                font-weight:900;
            ">
                ₹${Number(order.total || 0).toFixed(0)}
            </p>

        </div>
    `;


    const modal =
        document.getElementById(
            "orderDetailsModal"
        );

    if (modal) {
        modal.classList.remove("hidden");
    }
}


function closeOrderDetails() {

    const modal =
        document.getElementById(
            "orderDetailsModal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }
}


/* =====================================================
   PAGE NAVIGATION
   ===================================================== */

function showPage(pageId, button = null) {

    if (
        pageId === "menuSettingsPage" &&
        currentRole !== "admin"
    ) {

        alert(
            "Admin access required."
        );

        return;
    }


    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove(
                "active-page"
            );

        });


    const page =
        document.getElementById(pageId);

    if (page) {

        page.classList.add(
            "active-page"
        );
    }


    document
        .querySelectorAll(".nav-button")
        .forEach(navButton => {

            navButton.classList.remove(
                "active"
            );

        });


    if (button) {

        button.classList.add(
            "active"
        );

    } else {

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

        const nav =
            document.getElementById(
                navMap[pageId]
            );

        if (nav) {
            nav.classList.add("active");
        }
    }


    if (pageId === "activePage") {
        renderActiveOrders();
    }

    if (pageId === "todayPage") {
        renderTodayOrders();
    }

    if (pageId === "menuSettingsPage") {
        renderMenuSettings();
    }
}


/* =====================================================
   MENU SETTINGS
   ===================================================== */

function renderMenuSettings() {

    const container =
        document.getElementById(
            "menuSettingsContainer"
        );

    if (!container) {
        return;
    }

    if (currentRole !== "admin") {

        container.innerHTML = "";

        return;
    }

    if (menuItems.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No menu items.
            </div>
        `;

        return;
    }

    container.innerHTML =
        menuItems.map(item => {

            return `

                <div class="menu-setting-card">

                    <div class="menu-setting-header">

                        <div>

                            <h3>
                                ${escapeHtml(item.name)}
                            </h3>

                            <div class="menu-category">
                                ${escapeHtml(item.category)}
                            </div>

                        </div>

                        <div class="menu-setting-price">
                            ₹${Number(item.price).toFixed(0)}
                        </div>

                    </div>


                    <div
                        style="
                            margin-top:8px;
                            font-size:12px;
                            color:#755c4e;
                            font-weight:700;
                        "
                    >

                        ${
                            item.available === false
                                ? "🔴 Sold Out"
                                : "🟢 Available"
                        }

                    </div>


                    <div class="menu-setting-actions">

                        <button
                            type="button"
                            class="edit-menu-button"
                            onclick="editMenuItem('${item.id}')"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-menu-button"
                            onclick="deleteMenuItem('${item.id}')"
                        >
                            Delete
                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


/* =====================================================
   ADD MENU ITEM
   ===================================================== */

function openAddMenuItem() {

    if (currentRole !== "admin") {
        return;
    }

    editingMenuItemId = null;

    const title =
        document.getElementById(
            "menuEditorTitle"
        );

    if (title) {
        title.textContent =
            "Add Menu Item";
    }


    document.getElementById(
        "menuItemName"
    ).value = "";

    document.getElementById(
        "menuItemCategory"
    ).value = "";

    document.getElementById(
        "menuItemPrice"
    ).value = "";

    document.getElementById(
        "menuItemActive"
    ).checked = true;


    document.getElementById(
        "addonFields"
    ).innerHTML = "";

    document.getElementById(
        "styleFields"
    ).innerHTML = "";


    const modal =
        document.getElementById(
            "menuEditorModal"
        );

    if (modal) {
        modal.classList.remove("hidden");
    }
}


/* =====================================================
   EDIT MENU ITEM
   ===================================================== */

function editMenuItem(itemId) {

    if (currentRole !== "admin") {
        return;
    }

    const item =
        menuItems.find(
            x => x.id === itemId
        );

    if (!item) {
        return;
    }

    editingMenuItemId = itemId;


    document.getElementById(
        "menuEditorTitle"
    ).textContent =
        "Edit Menu Item";


    document.getElementById(
        "menuItemName"
    ).value =
        item.name || "";


    document.getElementById(
        "menuItemCategory"
    ).value =
        item.category || "";


    document.getElementById(
        "menuItemPrice"
    ).value =
        item.price || 0;


    document.getElementById(
        "menuItemActive"
    ).checked =
        item.active !== false;


    const addonFields =
        document.getElementById(
            "addonFields"
        );

    addonFields.innerHTML = "";


    if (Array.isArray(item.addons)) {

        item.addons.forEach(addon => {

            addAddonField(
                addon.name,
                addon.price
            );

        });

    }


    const styleFields =
        document.getElementById(
            "styleFields"
        );

    styleFields.innerHTML = "";


    if (Array.isArray(item.styles)) {

        item.styles.forEach(style => {

            addStyleField(style);

        });

    }


    const modal =
        document.getElementById(
            "menuEditorModal"
        );

    if (modal) {
        modal.classList.remove("hidden");
    }
}


/* =====================================================
   CLOSE MENU EDITOR
   ===================================================== */

function closeMenuEditor() {

    const modal =
        document.getElementById(
            "menuEditorModal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }

    editingMenuItemId = null;
}


/* =====================================================
   ADD ADDON FIELD
   ===================================================== */

function addAddonField(
    name = "",
    price = 0
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
            step="1"
            value="${Number(price || 0)}"
        >

        <button
            type="button"
            onclick="this.parentElement.remove()"
        >
            ×
        </button>

    `;

    container.appendChild(row);
}


/* =====================================================
   ADD STYLE FIELD
   ===================================================== */

function addStyleField(name = "") {

    const container =
        document.getElementById(
            "styleFields"
        );

    if (!container) {
        return;
    }

    const row =
        document.createElement("div");

    row.className =
        "editor-field";

    row.innerHTML = `

        <input
            type="text"
            class="style-name"
            placeholder="Style name"
            value="${escapeAttribute(name)}"
        >

        <button
            type="button"
            onclick="this.parentElement.remove()"
        >
            ×
        </button>

    `;

    container.appendChild(row);
}


/* =====================================================
   SAVE MENU ITEM
   ===================================================== */

async function saveMenuItem() {

    if (currentRole !== "admin") {

        alert(
            "Admin access required."
        );

        return;
    }


    const name =
        document.getElementById(
            "menuItemName"
        ).value.trim();


    const category =
        document.getElementById(
            "menuItemCategory"
        ).value.trim();


    const price =
        Number(
            document.getElementById(
                "menuItemPrice"
            ).value
        );


    const active =
        document.getElementById(
            "menuItemActive"
        ).checked;


    if (!name) {

        alert(
            "Enter item name."
        );

        return;
    }


    if (!category) {

        alert(
            "Enter category."
        );

        return;
    }


    if (isNaN(price) || price < 0) {

        alert(
            "Enter a valid price."
        );

        return;
    }


    const addonRows =
        Array.from(
            document.querySelectorAll(
                "#addonFields .editor-field"
            )
        );


    const addons =
        addonRows
            .map(row => {

                const nameInput =
                    row.querySelector(
                        ".addon-name"
                    );

                const priceInput =
                    row.querySelector(
                        ".addon-price"
                    );

                return {

                    name:
                        nameInput
                            ? nameInput.value.trim()
                            : "",

                    price:
                        Number(
                            priceInput?.value || 0
                        )

                };

            })
            .filter(
                addon =>
                    addon.name
            );


    const styleRows =
        Array.from(
            document.querySelectorAll(
                "#styleFields .editor-field"
            )
        );


    const styles =
        styleRows
            .map(row => {

                const input =
                    row.querySelector(
                        ".style-name"
                    );

                return input
                    ? input.value.trim()
                    : "";

            })
            .filter(Boolean);


    try {

        if (editingMenuItemId) {

            const {
                error
            } = await supabaseClient
                .from("menu_items")
                .update({

                    name,
                    category,
                    price,
                    addons,
                    styles,
                    active

                })
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
                .insert({

                    name,
                    category,
                    price,
                    addons,
                    styles,
                    active

                });


            if (error) {
                throw error;
            }
        }


        closeMenuEditor();

        await loadMenu();

        renderMenuSettings();


    } catch (error) {

        console.error(
            "Menu save error:",
            error
        );

        alert(
            "Could not save menu item:\n" +
            error.message
        );
    }
}


/* =====================================================
   DELETE MENU ITEM
   ===================================================== */

async function deleteMenuItem(itemId) {

    if (currentRole !== "admin") {

        alert(
            "Admin access required."
        );

        return;
    }


    const item =
        menuItems.find(
            x => x.id === itemId
        );


    const confirmed =
        confirm(
            `Delete "${item?.name || "this item"}"?`
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("menu_items")
        .delete()
        .eq("id", itemId);


    if (error) {

        console.error(
            "Menu delete error:",
            error
        );

        alert(
            "Could not delete menu item:\n" +
            error.message
        );

        return;
    }


    await loadMenu();

    renderMenuSettings();
}


/* =====================================================
   SEARCH ORDERS
   ===================================================== */

function filterOrders() {

    const input =
        document.getElementById(
            "orderSearch"
        );

    if (!input) {
        return;
    }

    const search =
        input.value
            .trim()
            .toLowerCase();


    const cards =
        document.querySelectorAll(
            ".order-card"
        );


    cards.forEach(card => {

        const text =
            card.innerText
                .toLowerCase();

        card.style.display =
            text.includes(search)
                ? ""
                : "none";
    });
}


/* =====================================================
   REALTIME
   ===================================================== */

function setupRealtime() {

    /* Prevent duplicate channels */

    supabaseClient
        .removeAllChannels();


    /* Orders */

    supabaseClient
        .channel("orders-realtime")
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

            }
        )
        .subscribe();


    /* Menu */

    supabaseClient
        .channel("menu-realtime")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "menu_items"
            },
            async () => {

                await loadMenu();

                renderMenuSettings();

            }
        )
        .subscribe();
}


/* =====================================================
   HTML SAFETY
   ===================================================== */

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {

        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    return escapeHtml(value);
}


/* =====================================================
   SUPABASE AUTH STATE LISTENER
   ===================================================== */

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (
            event === "SIGNED_IN" &&
            session?.user
        ) {

            currentUser =
                session.user;

        }

        if (event === "SIGNED_OUT") {

            currentUser = null;

            currentProfile = null;

            currentRole = "staff";

            showLogin();

        }
    }
);
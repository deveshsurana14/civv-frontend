const API = "https://civv-backend.onrender.com/api";

const colors = ["White", "Black", "Beige", "Green", "Lavender"];
const allSizes = ["S", "M", "L", "XL"];

const imageMap = {
  White: "assets/images/white.jpg",
  Black: "assets/images/black.jpg",
  Beige: "assets/images/beige.jpg",
  Green: "assets/images/green.jpg",
  Lavender: "assets/images/lavender.jpg"
};

let stockData = [];

const state = {
  selectedColor: "White",
  selections: [],
  cart: []
};

/* ---------- LOAD STOCK ---------- */
async function loadStock() {
  try {
    const res = await fetch(`${API}/stock`);
    stockData = await res.json();
  } catch (err) {
    console.error("Stock error:", err);
  }
}

/* ---------- GET STOCK ---------- */
function getStock(color, size) {
  const item = stockData.find(
    s => s.color === color && s.size === size
  );
  return item ? item.stock : 0;
}

/* ---------- TOAST ---------- */
function showToast(message) {
  const toast = document.createElement("div");

  toast.className =
    "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-3 rounded-lg shadow-lg z-50";

  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

/* ---------- SUCCESS POPUP ---------- */
function showSuccessPopup() {
  const old = document.getElementById("success-popup");
  if (old) old.remove();

  const popup = document.createElement("div");
  popup.id = "success-popup";

  popup.className =
    "fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50";

  popup.innerHTML = `
    <div class="bg-white p-6 rounded-xl max-w-sm text-center">
      <h2 class="text-xl font-bold mb-3">Order Confirmed 🎉</h2>
      <p class="text-sm text-gray-300 mb-4">
        Your order has been successfully confirmed. You will receive a confirmation email shortly with your order details.
      </p>
      <button id="close-popup" class="bg-black text-white px-4 py-2 rounded">
        Continue Shopping
      </button>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("close-popup").onclick = () => {
    popup.remove();
  };
}

/* ---------- PAYMENT ---------- */
async function startPayment(items, description) {
  const totalAmount = calculateTotal(items);

  const customer = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    address: document.getElementById("address").value.trim()
  };

  if (!customer.name || !customer.phone || !customer.address) {
    alert("Please fill all delivery details");
    return;
  }

  try {
    const res = await fetch(`${API}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: totalAmount })
    });

    if (!res.ok) {
      throw new Error("Order creation failed");
    }

    const order = await res.json();

    const options = {
      key: "rzp_live_SZozO6o2xOQkNw", 
      amount: order.amount,
      currency: "INR",
      name: "Civv",
      description,
      order_id: order.id,

      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone
      },

      handler: async function (response) {
        try {
          const verifyRes = await fetch(`${API}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              items,
              amount: totalAmount,
              customer
            })
          });

          const data = await verifyRes.json();

          if (!verifyRes.ok || !data.success) {
            throw new Error(data.error || "Verification failed");
          }

          setTimeout(showSuccessPopup, 300);

          state.cart = [];
          state.selections = [];

          document.getElementById("selected-summary").innerHTML = "";
          document.getElementById("live-total").textContent = "₹0";

          document.getElementById("name").value = "";
          document.getElementById("phone").value = "";
          document.getElementById("email").value = "";
          document.getElementById("address").value = "";

          await loadStock();

          renderSizes();
          renderSummary();
          updateCartUI();

        } catch (err) {
          console.error("Verification error:", err);
          alert("Payment verification failed");
        }
      },

      theme: { color: "#000000" }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error("Payment error:", err);
    alert("Something went wrong. Try again.");
  }
}

/* ---------- COLORS ---------- */
function renderColors() {
  const container = document.getElementById("color-options");
  container.innerHTML = "";

  colors.forEach(color => {
    const btn = document.createElement("button");
    btn.textContent = color;
    btn.className = "px-4 py-2 border rounded-lg text-sm";

    if (color === state.selectedColor) {
      btn.classList.add("bg-black", "text-white");
    }

    btn.onclick = () => {
      state.selectedColor = color;
      document.getElementById("main-image").src = imageMap[color];

      renderColors();
      renderSizes();
    };

    container.appendChild(btn);
  });
}

/* ---------- SIZES ---------- */
function renderSizes() {
  const container = document.getElementById("size-options");
  container.innerHTML = "";

  allSizes.forEach(size => {
    const stock = getStock(state.selectedColor, size);
    const isAvailable = stock > 0;

    const existing = state.selections.find(
      s => s.color === state.selectedColor && s.size === size
    );

    const qty = existing ? existing.quantity : 0;

    const btn = document.createElement("button");
    btn.textContent = isAvailable ? size : `${size} (Out)`;

    btn.className = "relative px-4 py-2 border rounded-lg text-sm";

    if (!isAvailable) {
      btn.classList.add("opacity-30", "cursor-not-allowed");
      btn.disabled = true;
    }

    if (qty > 0) {
      btn.classList.add("bg-black", "text-white");

      const badge = document.createElement("span");
      badge.className =
        "absolute -top-2 -right-2 bg-black text-white text-xs px-2 rounded-full";
      badge.textContent = qty;
      btn.appendChild(badge);
    }

    btn.onclick = () => {
      if (!isAvailable) return;

      if (qty >= stock) {
        alert("Only limited stock available");
        return;
      }

      addSelection(state.selectedColor, size);
    };

    container.appendChild(btn);
  });
}

/* ---------- ADD ---------- */
function addSelection(color, size) {
  const existing = state.selections.find(
    s => s.color === color && s.size === size
  );

  if (existing) existing.quantity++;
  else state.selections.push({ color, size, quantity: 1 });

  renderSizes();
  renderSummary();
}

/* ---------- SUMMARY ---------- */
function renderSummary() {
  const container = document.getElementById("selected-summary");
  container.innerHTML = "";

  state.selections.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "flex justify-between border px-3 py-2 rounded";

    row.innerHTML = `
      <div>${item.color} - ${item.size} x ${item.quantity}</div>
      <button data-index="${index}" class="text-red-500">Remove</button>
    `;

    container.appendChild(row);
  });

  // 🔥 THIS WAS MISSING
  document.querySelectorAll("#selected-summary button").forEach(btn => {
    btn.onclick = function () {
      const index = this.getAttribute("data-index");
      state.selections.splice(index, 1);

      renderSummary();   // refresh UI
      renderSizes();     // update size badges
    };
  });

  document.getElementById("live-total").textContent =
    "₹" + calculateTotal(state.selections);
}

/* ---------- PRICE ---------- */
const PRODUCT_PRICE = 299;

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.quantity, 0) * PRODUCT_PRICE;
}

/* ---------- CART ---------- */
function updateCartUI() {
  const count = state.cart.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  document.getElementById("cart-count").textContent = count;

  const cartItems = document.getElementById("cart-items");
  cartItems.innerHTML = "";

  state.cart.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "flex justify-between items-center border p-2 rounded";

    div.innerHTML = `
      <div>${item.color} - ${item.size} x ${item.quantity}</div>
      <button class="text-red-500" data-index="${index}">Remove</button>
    `;

    cartItems.appendChild(div);
  });

  document.querySelectorAll("#cart-items button").forEach(btn => {
    btn.onclick = function () {
      const index = this.getAttribute("data-index");
      state.cart.splice(index, 1);
      updateCartUI();
    };
  });

  document.getElementById("cart-total").textContent =
    "₹" + calculateTotal(state.cart);
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {

  await loadStock();

  renderColors();
  renderSizes();

  document.getElementById("add-to-cart").onclick = () => {
    if (state.selections.length === 0) {
      alert("Select at least one item.");
      return;
    }

    state.selections.forEach(sel => {
      const existing = state.cart.find(
        item => item.color === sel.color && item.size === sel.size
      );

      if (existing) existing.quantity += sel.quantity;
      else state.cart.push({ ...sel });
    });

    state.selections = [];

    renderSizes();
    renderSummary();
    updateCartUI();

    document.getElementById("go-to-cart").classList.remove("hidden");
    showToast("Added to cart 🛒");
  };

  document.getElementById("go-to-cart").onclick = () => {
    document.getElementById("cart-modal").classList.remove("translate-x-full");
  };

  document.getElementById("buy-now").onclick = () => {
    const items = state.selections.length > 0 ? state.selections : state.cart;

    if (items.length === 0) {
      alert("Select or add items first.");
      return;
    }

    startPayment(items, "Direct Purchase");
  };

  document.getElementById("checkout-btn").onclick = () => {
    if (state.cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    startPayment(state.cart, "Cart Checkout");
  };

  document.getElementById("cart-icon").onclick = () => {
    document.getElementById("cart-modal").classList.remove("translate-x-full");
  };

  document.getElementById("close-cart").onclick = () => {
    document.getElementById("cart-modal").classList.add("translate-x-full");
  };

  document.getElementById("size-chart-btn").onclick = () => {
    const modal = document.getElementById("size-chart-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  };

  document.getElementById("close-size-chart").onclick = () => {
    const modal = document.getElementById("size-chart-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  };
});
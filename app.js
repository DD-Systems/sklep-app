const MAX_PRODUCTS = 30;
const STOCK_PER_PRODUCT = 30;
const PRODUCTS_URL = "products.json";
const CART_STORAGE_KEY = "simple-shop-cart-v1";

const fallbackProducts = [
  {
    id: "kawa-ziarnista",
    name: "Kawa ziarnista",
    price: "39,99",
    description: "Aromatyczna kawa 1 kg do ekspresu.",
    image: ""
  },
  {
    id: "herbata-malinowa",
    name: "Herbata malinowa",
    price: "14,50",
    description: "Owocowa herbata w opakowaniu 100 g.",
    image: ""
  },
  {
    id: "miod-lipowy",
    name: "Miód lipowy",
    price: "28,00",
    description: "Słoik 400 g z lokalnej pasieki.",
    image: ""
  }
];

const grid = document.querySelector("#productGrid");
const emptyState = document.querySelector("#emptyState");
const counter = document.querySelector("#productCounter");
const installButton = document.querySelector("#installButton");
const cartToggle = document.querySelector("#cartToggle");
const cartPanel = document.querySelector("#cartPanel");
const cartItems = document.querySelector("#cartItems");
const cartSummary = document.querySelector("#cartSummary");
const cartTotal = document.querySelector("#cartTotal");
const clearCartButton = document.querySelector("#clearCartButton");
const sendOrderButton = document.querySelector("#sendOrderButton");
const imageDialog = document.querySelector("#imageDialog");
const largeImage = document.querySelector("#largeImage");
const largeImageCaption = document.querySelector("#largeImageCaption");
const closeImageButton = document.querySelector("#closeImageButton");

let products = [];
let cart = loadCart();
let deferredInstallPrompt = null;

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function normalizeProducts(items) {
  if (!Array.isArray(items)) {
    return fallbackProducts;
  }

  return items
    .filter((product) => product && product.name && product.price)
    .slice(0, MAX_PRODUCTS)
    .map((product, index) => ({
      id: String(product.id || `product-${index + 1}`),
      name: String(product.name),
      price: String(product.price),
      description: String(product.description || ""),
      image: String(product.image || "")
    }));
}

async function loadProducts() {
  try {
    const response = await fetch(`${PRODUCTS_URL}?v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Products request failed: ${response.status}`);
    }

    products = normalizeProducts(await response.json());
  } catch {
    products = fallbackProducts;
  }

  renderProducts();
  renderCart();
}

function formatPrice(value) {
  const amount = parsePrice(value);
  if (Number.isNaN(amount)) {
    return `${value} zł`;
  }

  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN"
  }).format(amount);
}

function parsePrice(value) {
  const normalized = String(value).replace(",", ".").replace(/[^0-9.]/g, "");
  return Number.parseFloat(normalized);
}

function productInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function renderProducts() {
  const visibleProducts = products;

  grid.innerHTML = "";
  counter.textContent = `${products.length}/${MAX_PRODUCTS} produktów`;
  emptyState.hidden = visibleProducts.length > 0;

  visibleProducts.forEach((product) => {
    const quantityInCart = cart[product.id] || 0;
    const card = document.createElement("article");
    card.className = product.image ? "product-card is-clickable" : "product-card";
    if (product.image) {
      card.dataset.viewId = product.id;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Powiększ zdjęcie: ${product.name}`);
    }

    const photo = product.image
      ? `<img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">`
      : `<div class="product-photo"><span class="photo-fallback">${escapeHtml(productInitials(product.name))}</span></div>`;

    card.innerHTML = `
      ${photo}
      <div class="product-body">
        <h2 class="product-name">${escapeHtml(product.name)}</h2>
        <p class="product-description">${escapeHtml(product.description)}</p>
        ${product.description.length > 82 ? '<button class="description-toggle" type="button">Pokaż opis</button>' : ""}
        <p class="stock-note">${STOCK_PER_PRODUCT} szt. dostępne</p>
        <div class="product-bottom">
          <span class="price">${escapeHtml(formatPrice(product.price))}</span>
          <button class="add-cart-button" type="button" data-cart-id="${escapeHtml(product.id)}" ${quantityInCart >= STOCK_PER_PRODUCT ? "disabled" : ""}>${quantityInCart > 0 ? `W koszyku: ${quantityInCart}` : "Dodaj"}</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function getCartEntries() {
  return Object.entries(cart)
    .map(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);
}

function cartTotals() {
  return getCartEntries().reduce(
    (totals, entry) => {
      const price = parsePrice(entry.product.price);
      totals.quantity += entry.quantity;
      totals.total += Number.isNaN(price) ? 0 : price * entry.quantity;
      return totals;
    },
    { quantity: 0, total: 0 }
  );
}

function setCartQuantity(productId, quantity) {
  const safeQuantity = Math.max(0, Math.min(STOCK_PER_PRODUCT, quantity));
  if (safeQuantity === 0) {
    delete cart[productId];
  } else {
    cart[productId] = safeQuantity;
  }

  saveCart();
  renderCart();
  renderProducts();
}

function addToCart(productId) {
  const currentQuantity = cart[productId] || 0;
  if (currentQuantity >= STOCK_PER_PRODUCT) {
    alert("W koszyku jest już maksymalna ilość tego produktu.");
    return;
  }

  setCartQuantity(productId, currentQuantity + 1);
  cartPanel.hidden = false;
}

function renderCart() {
  const entries = getCartEntries();
  const totals = cartTotals();

  cartToggle.textContent = `Koszyk: ${totals.quantity} szt. / ${formatPrice(totals.total)}`;
  cartSummary.textContent = `${entries.length} produktów, ${totals.quantity} szt.`;
  cartTotal.textContent = formatPrice(totals.total);
  clearCartButton.hidden = entries.length === 0;
  sendOrderButton.hidden = entries.length === 0;

  cartItems.innerHTML = "";

  if (entries.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Koszyk jest pusty.</p>';
    return;
  }

  entries.forEach(({ product, quantity }) => {
    const price = parsePrice(product.price);
    const lineTotal = Number.isNaN(price) ? 0 : price * quantity;
    const item = document.createElement("article");
    item.className = "cart-item";
    item.innerHTML = `
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(formatPrice(product.price))} / szt. · max ${STOCK_PER_PRODUCT} szt.</p>
      </div>
      <div class="quantity-controls">
        <button type="button" data-cart-change="-1" data-cart-id="${escapeHtml(product.id)}">−</button>
        <span>${quantity}</span>
        <button type="button" data-cart-change="1" data-cart-id="${escapeHtml(product.id)}" ${quantity >= STOCK_PER_PRODUCT ? "disabled" : ""}>+</button>
      </div>
      <button class="remove-cart-button" type="button" data-cart-remove="${escapeHtml(product.id)}">Usuń</button>
      <strong>${escapeHtml(formatPrice(lineTotal))}</strong>
    `;
    cartItems.appendChild(item);
  });
}

function orderEmailAddress() {
  return ["sklepapp2026", "gmail.com"].join("@");
}

function sendOrderByEmail() {
  const entries = getCartEntries();
  if (entries.length === 0) {
    alert("Koszyk jest pusty.");
    return;
  }

  const totals = cartTotals();
  const lines = entries.map(({ product, quantity }, index) => {
    const price = parsePrice(product.price);
    const lineTotal = Number.isNaN(price) ? 0 : price * quantity;
    return [
      `${index + 1}. ${product.name}`,
      `   Ilość: ${quantity} szt.`,
      `   Cena: ${formatPrice(product.price)} / szt.`,
      `   Razem: ${formatPrice(lineTotal)}`
    ].join("\n");
  });

  const body = [
    "Dzień dobry,",
    "",
    "Chcę złożyć zamówienie:",
    "",
    "----------------------------------------",
    ...lines,
    "----------------------------------------",
    "",
    `Suma sztuk: ${totals.quantity}`,
    `Suma zamówienia: ${formatPrice(totals.total)}`
  ].join("\n");

  const subject = encodeURIComponent("Zamówienie ze sklepu");
  const encodedBody = encodeURIComponent(body);
  window.location.href = `mailto:${orderEmailAddress()}?subject=${subject}&body=${encodedBody}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openLargeImage(image, name) {
  largeImage.src = image;
  largeImage.alt = name;
  largeImageCaption.textContent = name;
  imageDialog.showModal();
}

function closeLargeImage() {
  imageDialog.close();
  largeImage.removeAttribute("src");
}

function openProductImageFromCard(card) {
  const product = products.find((item) => item.id === card.dataset.viewId);
  if (!product || !product.image) {
    return;
  }

  openLargeImage(product.image, product.name);
}

grid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-cart-id]");
  if (addButton) {
    event.stopPropagation();
    addToCart(addButton.dataset.cartId);
    return;
  }

  const toggle = event.target.closest(".description-toggle");
  if (toggle) {
    event.stopPropagation();
    const card = toggle.closest(".product-card");
    const isOpen = card.classList.toggle("description-open");
    toggle.textContent = isOpen ? "Zwiń opis" : "Pokaż opis";
    return;
  }

  const card = event.target.closest("[data-view-id]");
  if (card) {
    openProductImageFromCard(card);
  }
});

cartItems.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-cart-remove]");
  if (removeButton) {
    setCartQuantity(removeButton.dataset.cartRemove, 0);
    return;
  }

  const button = event.target.closest("[data-cart-change]");
  if (!button) {
    return;
  }

  const productId = button.dataset.cartId;
  const change = Number.parseInt(button.dataset.cartChange, 10);
  setCartQuantity(productId, (cart[productId] || 0) + change);
});

cartToggle.addEventListener("click", () => {
  cartPanel.hidden = !cartPanel.hidden;
});

clearCartButton.addEventListener("click", () => {
  cart = {};
  saveCart();
  renderCart();
  renderProducts();
});

sendOrderButton.addEventListener("click", sendOrderByEmail);

grid.addEventListener("keydown", (event) => {
  if (event.target.closest("button")) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const card = event.target.closest("[data-view-id]");
  if (card) {
    event.preventDefault();
    openProductImageFromCard(card);
  }
});

imageDialog.addEventListener("click", (event) => {
  if (event.target === imageDialog) {
    closeLargeImage();
  }
});

closeImageButton.addEventListener("click", closeLargeImage);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

loadProducts();

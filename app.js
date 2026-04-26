const MAX_PRODUCTS = 30;
const PRODUCTS_URL = "products.json";

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
    name: "Miod lipowy",
    price: "28,00",
    description: "Sloik 400 g z lokalnej pasieki.",
    image: ""
  }
];

const grid = document.querySelector("#productGrid");
const emptyState = document.querySelector("#emptyState");
const counter = document.querySelector("#productCounter");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const installButton = document.querySelector("#installButton");
const imageDialog = document.querySelector("#imageDialog");
const largeImage = document.querySelector("#largeImage");
const largeImageCaption = document.querySelector("#largeImageCaption");
const closeImageButton = document.querySelector("#closeImageButton");

let products = [];
let deferredInstallPrompt = null;

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
}

function formatPrice(value) {
  const normalized = String(value).replace(",", ".").replace(/[^0-9.]/g, "");
  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) {
    return `${value} zl`;
  }

  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN"
  }).format(amount);
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
  const query = searchInput.value.trim().toLowerCase();
  const visibleProducts = products.filter((product) =>
    product.name.toLowerCase().includes(query)
  );

  grid.innerHTML = "";
  counter.textContent = `${products.length}/${MAX_PRODUCTS} produktow`;
  emptyState.hidden = visibleProducts.length > 0;

  visibleProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = product.image ? "product-card is-clickable" : "product-card";
    if (product.image) {
      card.dataset.viewId = product.id;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Powieksz zdjecie: ${product.name}`);
    }

    const photo = product.image
      ? `<img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">`
      : `<div class="product-photo"><span class="photo-fallback">${escapeHtml(productInitials(product.name))}</span></div>`;

    card.innerHTML = `
      ${photo}
      <div class="product-body">
        <h2 class="product-name">${escapeHtml(product.name)}</h2>
        <p class="product-description">${escapeHtml(product.description)}</p>
        ${product.description.length > 82 ? '<button class="description-toggle" type="button">Pokaz opis</button>' : ""}
        <div class="product-bottom">
          <span class="price">${escapeHtml(formatPrice(product.price))}</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
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
  const toggle = event.target.closest(".description-toggle");
  if (toggle) {
    event.stopPropagation();
    const card = toggle.closest(".product-card");
    const isOpen = card.classList.toggle("description-open");
    toggle.textContent = isOpen ? "Zwin opis" : "Pokaz opis";
    return;
  }

  const card = event.target.closest("[data-view-id]");
  if (card) {
    openProductImageFromCard(card);
  }
});

grid.addEventListener("keydown", (event) => {
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

searchInput.addEventListener("input", renderProducts);
refreshButton.addEventListener("click", loadProducts);

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

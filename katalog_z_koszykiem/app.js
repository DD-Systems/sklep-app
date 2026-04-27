const PRODUCTS_URL = "products.json";
const grid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const cartCountDisplay = document.querySelector("#cartCount");
const cartTotalDisplay = document.querySelector("#cartTotal");
const imageDialog = document.querySelector("#imageDialog");
const largeImage = document.querySelector("#largeImage");
const largeImageCaption = document.querySelector("#largeImageCaption");
const closeImageButton = document.querySelector("#closeImageButton");

let products = [];
let cart = [];

function parsePrice(value) {
  const normalized = String(value).replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatPrice(value) {
  return `${value.toFixed(2).replace(".", ",")} zł`;
}

async function loadProducts() {
  try {
    const response = await fetch(`${PRODUCTS_URL}?t=${Date.now()}`);
    const data = await response.json();
    // Każdy produkt startuje z ilością 50 sztuk.
    products = data.map((p) => ({
      ...p,
      stock: 50,
      unitPrice: parsePrice(p.price)
    }));
    cart = [];
    renderProducts();
  } catch (error) {
    console.error("Błąd ładowania:", error);
  }
}

function renderProducts() {
  grid.innerHTML = "";
  const query = searchInput.value.toLowerCase();
  
  products.filter(p => p.name.toLowerCase().includes(query)).forEach(product => {
    const cartItem = cart.find(item => item.id === product.id);
    const boughtQty = cartItem ? cartItem.quantity : 0;
    const remaining = product.stock - boughtQty;

    const card = document.createElement("div");
    card.className = "product-card";
    card.onclick = () => openImage(product);

    card.innerHTML = `
      <div class="product-image-container">
         <img src="${product.image || ''}" alt="${product.name}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="price">${formatPrice(product.unitPrice)}</p>
        <p class="stock-info">
           Kupiono <strong>${boughtQty}</strong> z ${product.stock} <br>
           (Zostało: ${remaining})
        </p>
        <button 
          class="primary-button" 
          style="width: 100%; margin-top: 10px; background: ${remaining <= 0 ? '#ccc' : '#145c63'}"
          onclick="event.stopPropagation(); addToCart('${product.id}')"
          ${remaining <= 0 ? 'disabled' : ''}
        >
          ${remaining <= 0 ? 'Brak towaru' : 'Dodaj do koszyka'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
  updateCartUI();
}

window.addToCart = function(id) {
  const product = products.find((p) => p.id === id);
  if (!product) {
    return;
  }

  const cartItem = cart.find((item) => item.id === id);
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  if (currentQuantity >= product.stock) {
    return;
  }

  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    cart.push({
      id,
      name: product.name,
      unitPrice: product.unitPrice,
      quantity: 1
    });
  }

  renderProducts();
};

function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  cartCountDisplay.textContent = totalQty;
  cartTotalDisplay.textContent = formatPrice(totalPrice);
}

function openImage(product) {
  largeImage.src = product.image;
  largeImageCaption.textContent = product.name;
  imageDialog.showModal();
}

closeImageButton.onclick = () => imageDialog.close();
imageDialog.onclick = (e) => { if(e.target === imageDialog) imageDialog.close(); };

searchInput.addEventListener("input", renderProducts);
refreshButton.addEventListener("click", loadProducts);

loadProducts();

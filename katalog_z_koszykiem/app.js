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

async function loadProducts() {
  try {
    const response = await fetch(`${PRODUCTS_URL}?t=${Date.now()}`);
    const data = await response.json();
    // Inicjalizacja: jeśli brak stock, ustaw 50
    products = data.map(p => ({
      ...p,
      stock: p.stock || 50
    }));
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
        <p class="price">${product.price} zł</p>
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
  const product = products.find(p => p.id === id);
  const cartItem = cart.find(item => item.id === id);

  if (cartItem) {
    if (cartItem.quantity < product.stock) {
      cartItem.quantity++;
    }
  } else {
    cart.push({ id: id, price: product.price, quantity: 1 });
  }
  renderProducts();
};

function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const p = parseFloat(item.price.toString().replace(',', '.'));
    return sum + (p * item.quantity);
  }, 0);

  cartCountDisplay.textContent = totalQty;
  cartTotalDisplay.textContent = totalPrice.toFixed(2).replace('.', ',') + " zł";
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

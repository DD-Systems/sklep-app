const MAX_PRODUCTS = 30;
const PRODUCTS_URL = new URL("../products.json", window.location.href).href;

const form = document.querySelector("#adminForm");
const formTitle = document.querySelector("#formTitle");
const productId = document.querySelector("#productId");
const nameInput = document.querySelector("#nameInput");
const priceInput = document.querySelector("#priceInput");
const descriptionInput = document.querySelector("#descriptionInput");
const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");
const deleteButton = document.querySelector("#deleteButton");
const clearButton = document.querySelector("#clearButton");
const downloadButton = document.querySelector("#downloadButton");
const reloadButton = document.querySelector("#reloadButton");
const importInput = document.querySelector("#importInput");
const adminList = document.querySelector("#adminList");
const productCounter = document.querySelector("#productCounter");
const loadStatus = document.querySelector("#loadStatus");

let products = [];
let selectedImage = "";
let lastLoadError = "";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `produkt-${Date.now()}`;
}

function normalizeProducts(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((product) => product && product.name && product.price)
    .slice(0, MAX_PRODUCTS)
    .map((product, index) => ({
      id: String(product.id || slugify(`${product.name}-${index + 1}`)),
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
    lastLoadError = "";
  } catch (error) {
    products = [];
    lastLoadError = error instanceof Error ? error.message : "Nie udało się wczytać products.json.";
  }

  clearForm();
  renderList();
}

function renderList() {
  adminList.innerHTML = "";
  productCounter.textContent = `${products.length}/${MAX_PRODUCTS} produktów`;
  loadStatus.textContent = lastLoadError || `Źródło danych: ${PRODUCTS_URL}`;
  loadStatus.classList.toggle("error-text", Boolean(lastLoadError));

  if (products.length === 0) {
    adminList.innerHTML = `<p class="admin-empty">${lastLoadError ? "Nie udało się wczytać produktów." : "Brak produktów."}</p>`;
    return;
  }

  products.forEach((product, index) => {
    const item = document.createElement("article");
    item.className = "admin-item";
    item.innerHTML = `
      ${product.image ? `<img src="${escapeHtml(product.image)}" alt="">` : `<div class="admin-thumb">${escapeHtml(product.name[0] || "?")}</div>`}
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.price)} zł</p>
      </div>
      <div class="admin-row-actions">
        <button class="sort-button" type="button" data-move="up" data-id="${escapeHtml(product.id)}" ${index === 0 ? "disabled" : ""} title="Przesuń wyżej">↑</button>
        <button class="sort-button" type="button" data-move="down" data-id="${escapeHtml(product.id)}" ${index === products.length - 1 ? "disabled" : ""} title="Przesuń niżej">↓</button>
        <button class="edit-button" type="button" data-edit-id="${escapeHtml(product.id)}">Edytuj</button>
      </div>
    `;
    adminList.appendChild(item);
  });
}

function clearForm() {
  productId.value = "";
  nameInput.value = "";
  priceInput.value = "";
  descriptionInput.value = "";
  imageInput.value = "";
  selectedImage = "";
  formTitle.textContent = "Dodaj produkt";
  deleteButton.hidden = true;
  renderPreview();
}

function editProduct(product) {
  productId.value = product.id;
  nameInput.value = product.name;
  priceInput.value = product.price;
  descriptionInput.value = product.description;
  selectedImage = product.image;
  imageInput.value = "";
  formTitle.textContent = "Edytuj produkt";
  deleteButton.hidden = false;
  renderPreview();
  nameInput.focus();
}

function renderPreview() {
  imagePreview.innerHTML = selectedImage
    ? `<img src="${selectedImage}" alt="">`
    : "<span>Brak zdjęcia</span>";
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function downloadProducts() {
  const blob = new Blob([JSON.stringify(products, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "products.json";
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

adminList.addEventListener("click", (event) => {
  const moveButton = event.target.closest("[data-move]");
  if (moveButton) {
    const index = products.findIndex((item) => item.id === moveButton.dataset.id);
    const direction = moveButton.dataset.move === "up" ? -1 : 1;
    const nextIndex = index + direction;

    if (index >= 0 && nextIndex >= 0 && nextIndex < products.length) {
      [products[index], products[nextIndex]] = [products[nextIndex], products[index]];
      renderList();
    }

    return;
  }

  const editButton = event.target.closest("[data-edit-id]");
  if (!editButton) {
    return;
  }

  const product = products.find((item) => item.id === editButton.dataset.editId);
  if (product) {
    editProduct(product);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const currentId = productId.value || slugify(nameInput.value);
  const existingIndex = products.findIndex((product) => product.id === currentId);

  if (existingIndex === -1 && products.length >= MAX_PRODUCTS) {
    alert("Limit to 30 produktów.");
    return;
  }

  const product = {
    id: currentId,
    name: nameInput.value.trim(),
    price: priceInput.value.trim(),
    description: descriptionInput.value.trim(),
    image: selectedImage
  };

  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    products.unshift(product);
  }

  clearForm();
  renderList();
});

imageInput.addEventListener("change", async () => {
  const [file] = imageInput.files;
  if (!file) {
    return;
  }

  selectedImage = await resizeImage(file);
  renderPreview();
});

deleteButton.addEventListener("click", () => {
  products = products.filter((product) => product.id !== productId.value);
  clearForm();
  renderList();
});

clearButton.addEventListener("click", clearForm);
downloadButton.addEventListener("click", downloadProducts);
reloadButton.addEventListener("click", loadProducts);

importInput.addEventListener("change", async () => {
  const [file] = importInput.files;
  if (!file) {
    return;
  }

  try {
    products = normalizeProducts(JSON.parse(await file.text()));
    clearForm();
    renderList();
  } catch {
    alert("Nie udało się wczytać pliku JSON.");
  }

  importInput.value = "";
});

loadProducts();

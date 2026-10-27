const MAX_PRODUCTS = 30;
const PRODUCTS_URL = new URL("../products.json", window.location.href).href;
const SHOP_CONFIG = window.SHOP_CONFIG || {};
const ORDER_API_URL = String(SHOP_CONFIG.orderApiUrl || "").trim();
const ADMIN_PASSWORD_STORAGE_KEY = "simple-shop-admin-password";
const GITHUB_TOKEN_STORAGE_KEY = "simple-shop-github-token";
const catalogPublisher = ShopCatalogPublisher.create();

const form = document.querySelector("#adminForm");
const formTitle = document.querySelector("#formTitle");
const productId = document.querySelector("#productId");
const nameInput = document.querySelector("#nameInput");
const priceInput = document.querySelector("#priceInput");
const descriptionInput = document.querySelector("#descriptionInput");
const stockInput = document.querySelector("#stockInput");
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
const adminPasswordInput = document.querySelector("#adminPassword");
const savePasswordButton = document.querySelector("#savePasswordButton");
const adminApiTestButton = document.querySelector("#adminApiTestButton");
const syncInventoryButton = document.querySelector("#syncInventoryButton");
const adminApiStatus = document.querySelector("#adminApiStatus");
const inventorySummary = document.querySelector("#inventorySummary");
const inventoryTableWrap = document.querySelector("#inventoryTableWrap");
const downloadInventoryButton = document.querySelector("#downloadInventoryButton");
const publishButton = document.querySelector("#publishButton");
const publishStatus = document.querySelector("#publishStatus");
const githubSettings = document.querySelector("#githubSettings");
const githubConnectionForm = document.querySelector("#githubConnectionForm");
const githubTokenInput = document.querySelector("#githubTokenInput");
const disconnectGithubButton = document.querySelector("#disconnectGithubButton");
const githubConnectionStatus = document.querySelector("#githubConnectionStatus");

let products = [];
let selectedImage = "";
let lastLoadError = "";
let inventoryMap = new Map();
let catalogSha = "";
let hasUnpublishedChanges = false;
let isBusy = false;
let githubToken = "";
let draftQueue = Promise.resolve();
try { githubToken = sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) || ""; } catch {}

function setPublishStatus(message, isError = false) {
  publishStatus.textContent = message;
  publishStatus.classList.toggle("error-text", isError);
}

function updatePublishControls() {
  publishButton.disabled = isBusy || !hasUnpublishedChanges || !catalogSha;
  publishButton.textContent = isBusy ? "Proszę czekać..." : "Opublikuj zmiany";
  githubConnectionStatus.textContent = githubToken ? "GitHub połączony" : "Połącz GitHub";
  disconnectGithubButton.hidden = !githubToken;
  form.inert = isBusy;
  adminList.inert = isBusy;
  githubConnectionForm.inert = isBusy;
  disconnectGithubButton.disabled = isBusy;
  reloadButton.disabled = isBusy;
  importInput.disabled = isBusy;
}

function setBusy(value) {
  isBusy = value;
  updatePublishControls();
}

function draftRequest(mode, value) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("simple-shop-admin", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("drafts");
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error("Magazyn wersji roboczych jest zajęty."));
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction("drafts", mode);
      const store = transaction.objectStore("drafts");
      const request = value === undefined ? store.get("catalog") : value === null
        ? store.delete("catalog") : store.put(value, "catalog");
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}

function catalogChanged() {
  hasUnpublishedChanges = true;
  setPublishStatus("Masz nieopublikowane zmiany.");
  updatePublishControls();
  const snapshot = { products: structuredClone(products), sha: catalogSha };
  draftQueue = draftQueue.catch(() => {}).then(() => draftRequest("readwrite", snapshot)).catch(() => {
    setPublishStatus("Zmiany są w tej karcie. Przeglądarka nie pozwoliła zapisać kopii roboczej.", true);
  });
}

async function publishCatalog() {
  if (isBusy || !hasUnpublishedChanges) return;
  if (!githubToken) {
    githubSettings.open = true;
    githubTokenInput.focus();
    setPublishStatus("Połącz GitHub, aby opublikować przygotowane zmiany.");
    return;
  }
  if (!products.length && !confirm("Opublikować pusty katalog i usunąć wszystkie produkty ze sklepu?")) return;
  setBusy(true);
  setPublishStatus("Wysyłanie produktów i zdjęć...");
  try {
    const result = await catalogPublisher.publish(products, catalogSha, githubToken);
    catalogSha = result.sha;
    hasUnpublishedChanges = false;
    await draftQueue;
    try { await draftRequest("readwrite", null); } catch {}
    setPublishStatus(result.unchanged ? "Katalog na GitHubie jest już aktualny."
      : "Zapisano na GitHubie. Aktualizacja sklepu trwa zwykle 1–2 minuty.");
  } catch (error) {
    setPublishStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

function isApiEnabled() {
  return /^https?:\/\//i.test(ORDER_API_URL);
}

function getAdminPassword() {
  return sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) || "";
}

function setAdminPassword(value) {
  sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, value);
}

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
      image: String(product.image || ""),
      stock: normalizeStock(product.stock)
    }));
}

function normalizeStock(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN"
  }).format(Number(value || 0));
}

function inventoryRecord(productId) {
  return inventoryMap.get(productId) || null;
}

function currentStockFor(product) {
  return inventoryRecord(product.id)?.currentStock ?? normalizeStock(product.stock);
}

async function apiRequest(payload, requireAuth = false) {
  const finalPayload = { ...payload };
  if (requireAuth) {
    const adminPassword = adminPasswordInput.value.trim() || getAdminPassword();
    if (!adminPassword) {
      throw new Error("Podaj hasło administratora do magazynu.");
    }
    finalPayload.adminPassword = adminPassword;
  }

  const response = await fetch(ORDER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(finalPayload)
  });

  if (!response.ok) {
    throw new Error(`Błąd API: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Nie udało się wykonać operacji.");
  }

  return data;
}

function renderInventorySummary() {
  if (!isApiEnabled()) {
    inventorySummary.innerHTML = '<p class="admin-empty">Brak podpiętego API magazynu.</p>';
    return;
  }

  const cards = products.map((product) => {
    const inventory = inventoryRecord(product.id);
    const currentStock = inventory ? inventory.currentStock : normalizeStock(product.stock);
    const confirmedSold = inventory ? inventory.confirmedSold : 0;
    return `
      <article class="summary-card">
        <strong>${escapeHtml(product.name)}</strong>
        <span>Zostało: ${currentStock} szt.</span>
        <span>Sprzedano: ${confirmedSold} szt.</span>
      </article>
    `;
  });

  inventorySummary.innerHTML = cards.join("") || '<p class="admin-empty">Brak produktów do podsumowania.</p>';
}

function inventoryRows() {
  return products.map((product) => {
    const inventory = inventoryRecord(product.id);
    const baseStock = normalizeStock(product.stock);
    const confirmedSold = inventory ? inventory.confirmedSold : 0;
    const currentStock = inventory ? inventory.currentStock : baseStock;
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      baseStock,
      confirmedSold,
      currentStock
    };
  });
}

function renderInventoryTable() {
  const rows = inventoryRows();

  if (!rows.length) {
    inventoryTableWrap.innerHTML = '<p class="admin-empty">Brak produktów na liście magazynowej.</p>';
    return;
  }

  inventoryTableWrap.innerHTML = `
    <table class="inventory-table">
      <thead>
        <tr>
          <th>Produkt</th>
          <th>Cena</th>
          <th>Stan bazowy</th>
          <th>Sprzedano</th>
          <th>Zostało</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.price)} zł</td>
                <td>${row.baseStock}</td>
                <td>${row.confirmedSold}</td>
                <td><strong>${row.currentStock}</strong></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function downloadInventoryCsv() {
  const rows = inventoryRows();
  if (!rows.length) {
    alert("Brak danych do eksportu.");
    return;
  }

  const csv = [
    ["Produkt", "Cena", "Stan bazowy", "Sprzedano", "Zostało"].join(";"),
    ...rows.map((row) =>
      [
        `"${String(row.name).replaceAll('"', '""')}"`,
        `"${String(row.price).replaceAll('"', '""')}"`,
        row.baseStock,
        row.confirmedSold,
        row.currentStock
      ].join(";")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lista-magazynowa.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function renderList() {
  adminList.innerHTML = "";
  productCounter.textContent = `${products.length}/${MAX_PRODUCTS} produktów`;
  loadStatus.textContent = lastLoadError;
  loadStatus.hidden = !lastLoadError;
  loadStatus.classList.toggle("error-text", Boolean(lastLoadError));

  if (products.length === 0) {
    adminList.innerHTML = `<p class="admin-empty">${lastLoadError ? "Nie udało się wczytać produktów." : "Brak produktów."}</p>`;
    renderInventorySummary();
    renderInventoryTable();
    return;
  }

  products.forEach((product, index) => {
    const inventory = inventoryRecord(product.id);
    const item = document.createElement("article");
    item.className = "admin-item";
    item.innerHTML = `
      ${product.image ? `<img src="${escapeHtml(product.image)}" alt="">` : `<div class="admin-thumb">${escapeHtml(product.name[0] || "?")}</div>`}
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.price)} zł · bazowy stan: ${escapeHtml(String(product.stock ?? 30))} szt.</p>
        <p class="admin-stock-line">Zostało: ${currentStockFor(product)} szt. · Sprzedano: ${inventory ? inventory.confirmedSold : 0} szt.</p>
      </div>
      <div class="admin-row-actions">
        <button class="sort-button" type="button" data-move="up" data-id="${escapeHtml(product.id)}" ${index === 0 ? "disabled" : ""} title="Przesuń wyżej">↑</button>
        <button class="sort-button" type="button" data-move="down" data-id="${escapeHtml(product.id)}" ${index === products.length - 1 ? "disabled" : ""} title="Przesuń niżej">↓</button>
        <button class="edit-button" type="button" data-edit-id="${escapeHtml(product.id)}">Edytuj</button>
      </div>
    `;
    adminList.appendChild(item);
  });

  renderInventorySummary();
  renderInventoryTable();
}

function clearForm() {
  productId.value = "";
  nameInput.value = "";
  priceInput.value = "";
  descriptionInput.value = "";
  stockInput.value = "30";
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
  stockInput.value = String(product.stock ?? 30);
  selectedImage = product.image;
  imageInput.value = "";
  formTitle.textContent = "Edytuj produkt";
  deleteButton.hidden = false;
  renderPreview();
  nameInput.focus();
}

function renderPreview() {
  imagePreview.innerHTML = selectedImage
    ? `<img src="${escapeHtml(selectedImage)}" alt="">`
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

async function loadAdminData() {
  if (!isApiEnabled()) {
    adminApiStatus.textContent = "Brak API magazynu.";
    inventoryMap = new Map();
    renderInventorySummary();
    return;
  }

  try {
    const adminPassword = adminPasswordInput.value.trim() || getAdminPassword();
    if (!adminPassword) {
      adminApiStatus.textContent = SHOP_CONFIG.adminPasswordHint || "Podaj hasło administratora, aby wczytać magazyn.";
      inventoryMap = new Map();
      renderInventorySummary();
      return;
    }

    setAdminPassword(adminPassword);
    const data = await apiRequest({ action: "getAdminData" }, true);
    inventoryMap = new Map(
      (data.inventory || []).map((row) => [
        row.productId,
        {
          currentStock: normalizeStock(row.currentStock),
          confirmedSold: normalizeStock(row.confirmedSold),
          updatedAt: String(row.updatedAt || "")
        }
      ])
    );
    adminApiStatus.textContent = "API magazynu połączone.";
  } catch (error) {
    adminApiStatus.textContent = error.message;
    inventoryMap = new Map();
  }

  renderList();
}

async function loadProducts({ restoreDraft = false } = {}) {
  if (isBusy) return;
  if (hasUnpublishedChanges && !confirm("Odrzucić nieopublikowane zmiany i wczytać aktualny katalog?")) return;
  setBusy(true);
  try {
    let catalog;
    try {
      catalog = await catalogPublisher.readCatalog(githubToken);
    } catch {
      const response = await fetch(`${PRODUCTS_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Nie udało się wczytać katalogu.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const items = JSON.parse(new TextDecoder().decode(bytes));
      ShopCatalogPublisher.validate(items);
      catalog = { products: items, sha: await ShopCatalogPublisher.blobSha(bytes) };
    }
    products = normalizeProducts(catalog.products);
    catalogSha = catalog.sha;
    hasUnpublishedChanges = false;
    lastLoadError = "";
    if (restoreDraft) {
      const draft = await draftRequest("readonly").catch(() => null);
      if (draft && Array.isArray(draft.products) && draft.sha) {
        products = normalizeProducts(draft.products);
        catalogSha = draft.sha;
        hasUnpublishedChanges = true;
      }
    } else {
      await draftQueue;
      await draftRequest("readwrite", null).catch(() => {});
    }
    setPublishStatus(hasUnpublishedChanges ? "Przywrócono nieopublikowaną wersję roboczą."
      : "Katalog jest aktualny.");
  } catch (error) {
    lastLoadError = "Nie udało się wczytać katalogu. Sprawdź połączenie i spróbuj ponownie.";
    if (restoreDraft) {
      const draft = await draftRequest("readonly").catch(() => null);
      if (draft && Array.isArray(draft.products) && draft.sha) {
        products = normalizeProducts(draft.products);
        catalogSha = draft.sha;
        hasUnpublishedChanges = true;
        lastLoadError = "Brak połączenia. Przywrócono nieopublikowaną wersję roboczą.";
      }
    }
    setPublishStatus(lastLoadError, true);
  } finally {
    setBusy(false);
  }

  clearForm();
  renderList();
  await loadAdminData();
}

adminList.addEventListener("click", (event) => {
  const moveButton = event.target.closest("[data-move]");
  if (moveButton) {
    const index = products.findIndex((item) => item.id === moveButton.dataset.id);
    const direction = moveButton.dataset.move === "up" ? -1 : 1;
    const nextIndex = index + direction;

    if (index >= 0 && nextIndex >= 0 && nextIndex < products.length) {
      [products[index], products[nextIndex]] = [products[nextIndex], products[index]];
      catalogChanged();
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
  if (isBusy) return;

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
    stock: normalizeStock(stockInput.value),
    image: selectedImage
  };
  try {
    ShopCatalogPublisher.validate([product]);
  } catch (error) {
    setPublishStatus(error.message, true);
    return;
  }

  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    products.unshift(product);
  }

  catalogChanged();
  clearForm();
  renderList();
});

imageInput.addEventListener("change", async () => {
  const [file] = imageInput.files;
  if (!file) {
    return;
  }

  setBusy(true);
  try {
    selectedImage = await resizeImage(file);
    renderPreview();
  } catch {
    setPublishStatus("Nie udało się odczytać zdjęcia. Wybierz inny plik.", true);
  } finally {
    setBusy(false);
  }
});

deleteButton.addEventListener("click", () => {
  products = products.filter((product) => product.id !== productId.value);
  catalogChanged();
  clearForm();
  renderList();
});

clearButton.addEventListener("click", clearForm);
downloadButton.addEventListener("click", downloadProducts);
reloadButton.addEventListener("click", () => loadProducts());
publishButton.addEventListener("click", publishCatalog);
githubConnectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy) return;
  const token = githubTokenInput.value.trim();
  setBusy(true);
  setPublishStatus("Sprawdzanie połączenia z GitHubem...");
  try {
    const catalog = await catalogPublisher.connect(token);
    githubToken = token;
    try { sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, token); } catch {}
    githubTokenInput.value = "";
    githubSettings.open = false;
    if (!hasUnpublishedChanges) {
      products = normalizeProducts(catalog.products);
      catalogSha = catalog.sha;
      renderList();
    }
    setPublishStatus(hasUnpublishedChanges ? "Połączono. Możesz opublikować przygotowane zmiany."
      : "GitHub połączony. Katalog jest aktualny.");
  } catch (error) {
    setPublishStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});
disconnectGithubButton.addEventListener("click", () => {
  githubToken = "";
  githubTokenInput.value = "";
  try { sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY); } catch {}
  updatePublishControls();
  setPublishStatus("Odłączono GitHub. Wersja robocza została zachowana.");
});
window.addEventListener("beforeunload", (event) => {
  if (hasUnpublishedChanges) {
    event.preventDefault();
    event.returnValue = "";
  }
});
savePasswordButton.addEventListener("click", async () => {
  setAdminPassword(adminPasswordInput.value.trim());
  await loadAdminData();
});
adminApiTestButton.addEventListener("click", async () => {
  adminApiTestButton.disabled = true;
  await loadAdminData();
  adminApiTestButton.disabled = false;
});
syncInventoryButton.addEventListener("click", async () => {
  try {
    await apiRequest({ action: "syncCatalog", products }, true);
    await loadAdminData();
  } catch (error) {
    alert(error.message);
  }
});
downloadInventoryButton.addEventListener("click", downloadInventoryCsv);

importInput.addEventListener("change", async () => {
  const [file] = importInput.files;
  if (!file) {
    return;
  }

  try {
    const importedProducts = JSON.parse(await file.text());
    ShopCatalogPublisher.validate(importedProducts);
    products = normalizeProducts(importedProducts);
    catalogChanged();
    clearForm();
    renderList();
    await loadAdminData();
  } catch {
    alert("Nie udało się wczytać pliku JSON.");
  }

  importInput.value = "";
});

adminPasswordInput.value = getAdminPassword();
loadProducts({ restoreDraft: true });
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("../service-worker.js", window.location.href)).catch(() => {});
}

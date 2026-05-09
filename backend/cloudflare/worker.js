export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      const payload = await readJson(request);
      const action = String(payload.action || "");

      if (action === "getInventory") {
        return jsonResponse(await getInventory(env));
      }

      if (action === "createOrder") {
        return jsonResponse(await createOrder(env, payload));
      }

      requireAdmin(payload, env);

      if (action === "syncCatalog") {
        return jsonResponse(await syncCatalog(env, payload.products || []));
      }

      if (action === "getAdminData") {
        return jsonResponse(await getAdminData(env));
      }

      if (action === "confirmOrder") {
        return jsonResponse(await confirmOrder(env, String(payload.orderId || "")));
      }

      if (action === "cancelOrder") {
        return jsonResponse(await cancelOrder(env, String(payload.orderId || "")));
      }

      return jsonResponse({ ok: false, error: "Nieznana akcja." }, 400);
    } catch (error) {
      return jsonResponse({ ok: false, error: error.message || "Błąd serwera." }, 500);
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

async function readJson(request) {
  if (request.method !== "POST") {
    throw new Error("Dozwolone jest tylko POST.");
  }

  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function requireAdmin(payload, env) {
  if (!env.ADMIN_PASSWORD || payload.adminPassword !== env.ADMIN_PASSWORD) {
    const error = new Error("Brak dostępu do panelu admina.");
    error.status = 403;
    throw error;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStock(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeMoney(value) {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function randomOrderId() {
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getInventory(env) {
  const { results } = await env.DB.prepare(
    "SELECT product_id, current_stock, confirmed_sold, updated_at FROM inventory"
  ).all();

  const inventory = Object.fromEntries(
    (results || []).map((row) => [
      row.product_id,
      {
        currentStock: normalizeStock(row.current_stock),
        confirmedSold: normalizeStock(row.confirmed_sold),
        updatedAt: row.updated_at
      }
    ])
  );

  return { ok: true, inventory };
}

async function syncCatalog(env, products) {
  for (const product of Array.isArray(products) ? products : []) {
    if (!product?.id || !product?.name) {
      continue;
    }

    const baseStock = normalizeStock(product.stock);
    const existing = await env.DB.prepare(
      "SELECT base_stock, current_stock FROM inventory WHERE product_id = ?"
    ).bind(String(product.id)).first();

    if (!existing) {
      await env.DB.prepare(
        "INSERT INTO inventory (product_id, product_name, base_stock, current_stock, confirmed_sold, updated_at) VALUES (?, ?, ?, ?, 0, ?)"
      ).bind(String(product.id), String(product.name), baseStock, baseStock, nowIso()).run();
      continue;
    }

    const oldBase = normalizeStock(existing.base_stock);
    const oldCurrent = normalizeStock(existing.current_stock);
    const delta = baseStock - oldBase;
    const nextCurrent = Math.max(0, oldCurrent + delta);

    await env.DB.prepare(
      "UPDATE inventory SET product_name = ?, base_stock = ?, current_stock = ?, updated_at = ? WHERE product_id = ?"
    ).bind(String(product.name), baseStock, nextCurrent, nowIso(), String(product.id)).run();
  }

  return { ok: true };
}

async function createOrder(env, payload) {
  const customerName = String(payload.customerName || "").trim();
  const customerContact = String(payload.customerContact || "").trim();
  const customerNote = String(payload.customerNote || "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!customerName || !customerContact) {
    return { ok: false, error: "Podaj nazwę i kontakt." };
  }

  if (!items.length) {
    return { ok: false, error: "Koszyk jest pusty." };
  }

  const sanitizedItems = items
    .map((item) => ({
      productId: String(item.productId || "").trim(),
      productName: String(item.productName || "").trim(),
      quantity: normalizeStock(item.quantity),
      unitPrice: normalizeMoney(item.unitPrice),
      stockSnapshot: normalizeStock(item.stockSnapshot)
    }))
    .filter((item) => item.productId && item.productName && item.quantity > 0);

  if (!sanitizedItems.length) {
    return { ok: false, error: "Brak poprawnych pozycji zamówienia." };
  }

  const orderId = randomOrderId();
  const totalQuantity = sanitizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = sanitizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  await env.DB.prepare(
    "INSERT INTO orders (id, status, customer_name, customer_contact, customer_note, total_quantity, total_amount, created_at) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?)"
  ).bind(orderId, customerName, customerContact, customerNote, totalQuantity, totalAmount, nowIso()).run();

  for (const item of sanitizedItems) {
    await env.DB.prepare(
      "INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, stock_snapshot) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.stockSnapshot).run();

    const existing = await env.DB.prepare(
      "SELECT product_id FROM inventory WHERE product_id = ?"
    ).bind(item.productId).first();

    if (!existing) {
      await env.DB.prepare(
        "INSERT INTO inventory (product_id, product_name, base_stock, current_stock, confirmed_sold, updated_at) VALUES (?, ?, ?, ?, 0, ?)"
      ).bind(item.productId, item.productName, item.stockSnapshot, item.stockSnapshot, nowIso()).run();
    }
  }

  return { ok: true, orderId };
}

async function getAdminData(env) {
  const { results: inventoryRows } = await env.DB.prepare(
    "SELECT product_id, product_name, base_stock, current_stock, confirmed_sold, updated_at FROM inventory ORDER BY product_name COLLATE NOCASE"
  ).all();
  const { results: orderRows } = await env.DB.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC"
  ).all();
  const { results: itemRows } = await env.DB.prepare(
    "SELECT * FROM order_items ORDER BY id ASC"
  ).all();

  const itemsByOrder = {};
  for (const row of itemRows || []) {
    (itemsByOrder[row.order_id] ||= []).push({
      productId: row.product_id,
      productName: row.product_name,
      quantity: normalizeStock(row.quantity),
      unitPrice: Number(row.unit_price || 0),
      stockSnapshot: normalizeStock(row.stock_snapshot)
    });
  }

  return {
    ok: true,
    inventory: (inventoryRows || []).map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      baseStock: normalizeStock(row.base_stock),
      currentStock: normalizeStock(row.current_stock),
      confirmedSold: normalizeStock(row.confirmed_sold),
      updatedAt: row.updated_at
    })),
    orders: (orderRows || []).map((row) => ({
      id: row.id,
      status: row.status,
      customerName: row.customer_name,
      customerContact: row.customer_contact,
      customerNote: row.customer_note,
      totalQuantity: normalizeStock(row.total_quantity),
      totalAmount: Number(row.total_amount || 0),
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      cancelledAt: row.cancelled_at,
      items: itemsByOrder[row.id] || []
    }))
  };
}

async function confirmOrder(env, orderId) {
  const order = await env.DB.prepare(
    "SELECT id, status FROM orders WHERE id = ?"
  ).bind(orderId).first();

  if (!order) {
    return { ok: false, error: "Nie znaleziono zamówienia." };
  }
  if (order.status !== "pending") {
    return { ok: false, error: "To zamówienie nie oczekuje już na potwierdzenie." };
  }

  const { results: items } = await env.DB.prepare(
    "SELECT product_id, product_name, quantity, stock_snapshot FROM order_items WHERE order_id = ?"
  ).bind(orderId).all();

  for (const item of items || []) {
    let inventoryRow = await env.DB.prepare(
      "SELECT current_stock, confirmed_sold FROM inventory WHERE product_id = ?"
    ).bind(item.product_id).first();

    if (!inventoryRow) {
      await env.DB.prepare(
        "INSERT INTO inventory (product_id, product_name, base_stock, current_stock, confirmed_sold, updated_at) VALUES (?, ?, ?, ?, 0, ?)"
      ).bind(item.product_id, item.product_name, normalizeStock(item.stock_snapshot), normalizeStock(item.stock_snapshot), nowIso()).run();
      inventoryRow = { current_stock: normalizeStock(item.stock_snapshot), confirmed_sold: 0 };
    }

    const currentStock = normalizeStock(inventoryRow.current_stock);
    const quantity = normalizeStock(item.quantity);
    if (currentStock < quantity) {
      return {
        ok: false,
        error: `Brakuje stanu dla produktu: ${item.product_name}. Dostępne: ${currentStock}, potrzebne: ${quantity}.`
      };
    }
  }

  for (const item of items || []) {
    await env.DB.prepare(
      "UPDATE inventory SET current_stock = current_stock - ?, confirmed_sold = confirmed_sold + ?, updated_at = ? WHERE product_id = ?"
    ).bind(normalizeStock(item.quantity), normalizeStock(item.quantity), nowIso(), item.product_id).run();
  }

  await env.DB.prepare(
    "UPDATE orders SET status = 'confirmed', confirmed_at = ? WHERE id = ?"
  ).bind(nowIso(), orderId).run();

  return { ok: true };
}

async function cancelOrder(env, orderId) {
  const order = await env.DB.prepare(
    "SELECT id, status FROM orders WHERE id = ?"
  ).bind(orderId).first();

  if (!order) {
    return { ok: false, error: "Nie znaleziono zamówienia." };
  }
  if (order.status !== "pending") {
    return { ok: false, error: "To zamówienie nie oczekuje już na anulowanie." };
  }

  await env.DB.prepare(
    "UPDATE orders SET status = 'cancelled', cancelled_at = ? WHERE id = ?"
  ).bind(nowIso(), orderId).run();

  return { ok: true };
}

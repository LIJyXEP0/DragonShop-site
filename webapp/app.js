let PRODUCTS = [];

const tg = window.Telegram?.WebApp;
// Public HTTPS API on the DragonShop VM; the bot validates Telegram initData server-side.
const API_BASE_URL = "https://129.151.199.231";
const money = (cents) => new Intl.NumberFormat("ru-LV", { style: "currency", currency: "EUR" }).format(cents / 100);
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const productImage = (image) => image.startsWith("/media/") ? `${API_BASE_URL}${image}` : image;
const CART_STORAGE_KEY = `dragon-shop:cart:v1:${tg?.initDataUnsafe?.user?.id || "browser"}`;
let MAX_PRICE_EUROS = 1;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return new Map();
    return new Map(saved.filter((row) => Array.isArray(row) && row.length === 2).filter(([id, quantity]) =>
      typeof id === "string"
      && Number.isInteger(quantity)
      && quantity > 0
      && quantity <= 20
    ));
  } catch {
    return new Map();
  }
}

const cart = loadCart();

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.entries()]));
  } catch {
    showToast("Не удалось сохранить корзину на этом устройстве");
  }
}

function renderProducts() {
  const minRaw = byId("price-min").value;
  const maxRaw = byId("price-max").value;
  const minCents = minRaw === "" ? 0 : Math.max(0, Math.round(Number(minRaw) * 100));
  const maxCents = maxRaw === "" ? MAX_PRICE_EUROS * 100 : Math.max(0, Math.round(Number(maxRaw) * 100));
  const invalidRange = minCents > maxCents;
  let visibleProducts = invalidRange ? [] : PRODUCTS.filter((product) =>
    product.priceCents >= minCents && product.priceCents <= maxCents
  );

  const sortMode = byId("sort-price").value;
  if (sortMode === "price-asc") visibleProducts.sort((a, b) => a.priceCents - b.priceCents);
  if (sortMode === "price-desc") visibleProducts.sort((a, b) => b.priceCents - a.priceCents);

  byId("product-total").textContent = `${visibleProducts.length} / ${PRODUCTS.length} ПОЗИЦИЙ`;
  byId("filter-results").textContent = visibleProducts.length === PRODUCTS.length
    ? "Показаны все товары"
    : `Найдено ${visibleProducts.length} из ${PRODUCTS.length}`;
  byId("filter-empty").hidden = visibleProducts.length > 0;
  byId("filter-empty").querySelector("p").textContent = invalidRange
    ? "Минимальная цена выше максимальной."
    : "В этом диапазоне товаров нет.";

  byId("product-grid").innerHTML = visibleProducts.map((product) => {
    const image = escapeHtml(productImage(product.image));
    const name = escapeHtml(product.name);
    const description = product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : "";
    return `
    <article class="product-card">
      <div class="product-visual">
        <img class="product-image" src="${image}" alt="${name}" loading="lazy" />
      </div>
      <div class="product-info">
        <div><p class="product-name">${name}</p>${description}</div>
        <span class="product-price">${money(product.priceCents)}</span>
      </div>
      <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Добавить: ${name}">В корзину <span>+</span></button>
    </article>`;
  }).join("");
}

function cartTotal() {
  return [...cart.entries()].reduce((sum, [id, quantity]) => {
    const product = PRODUCTS.find((item) => item.id === id);
    return sum + (product ? product.priceCents * quantity : 0);
  }, 0);
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  byId("cart-count").textContent = count;
  byId("cart-empty").hidden = count > 0;
  byId("cart-summary").hidden = count === 0;
  byId("cart-items").innerHTML = [...cart.entries()].map(([id, quantity]) => {
    const product = PRODUCTS.find((item) => item.id === id);
    if (!product) return "";
    return `<div class="cart-row">
      <div class="cart-thumb"><img src="${escapeHtml(productImage(product.image))}" alt="" /></div>
      <div><p class="cart-product-name">${escapeHtml(product.name)}</p><span class="cart-product-price">${money(product.priceCents * quantity)}</span>
        <div class="quantity-control"><button type="button" data-change="${escapeHtml(id)}" data-delta="-1" aria-label="Уменьшить количество">−</button><span>${quantity}</span><button type="button" data-change="${escapeHtml(id)}" data-delta="1" aria-label="Увеличить количество">+</button></div>
      </div><button class="remove-item" type="button" data-remove="${escapeHtml(id)}" aria-label="Удалить ${escapeHtml(product.name)}">×</button>
    </div>`;
  }).join("");
  byId("cart-total").textContent = money(cartTotal());
}

function setCartOpen(open) {
  byId("cart-drawer").classList.toggle("is-open", open);
  byId("cart-drawer").setAttribute("aria-hidden", String(!open));
  byId("overlay").hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
  if (open) byId("close-cart").focus();
}

let toastTimer;
function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1900);
}

async function apiRequest(path, { method = "GET", body, formData } = {}) {
  if (!tg?.initData) throw new Error("Откройте магазин через Telegram.");
  const headers = { "X-Telegram-Init-Data": tg.initData };
  const options = { method, headers };
  if (formData) options.body = formData;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error("Сервер каталога временно недоступен.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || "Операция не выполнена.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function loadCatalog() {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/catalog`);
  } catch {
    throw new Error("Не удалось загрузить каталог. Проверьте соединение и попробуйте снова.");
  }
  const result = await response.json();
  if (!response.ok || !result.ok || !Array.isArray(result.products)) {
    throw new Error(result.error || "Не удалось загрузить каталог.");
  }
  PRODUCTS = result.products;
  MAX_PRICE_EUROS = Math.max(1, Math.ceil(Math.max(0, ...PRODUCTS.map((product) => product.priceCents)) / 100));
  byId("price-min").max = MAX_PRICE_EUROS;
  byId("price-max").max = MAX_PRICE_EUROS;
  byId("price-max").value = MAX_PRICE_EUROS;
  for (const id of cart.keys()) {
    if (!PRODUCTS.some((product) => product.id === id)) cart.delete(id);
  }
  saveCart();
  renderProducts();
  renderCart();
}

let adminProducts = [];
async function enableAdminForOwner() {
  if (!tg?.initData) return;
  try {
    const result = await apiRequest("/api/admin/catalog");
    adminProducts = result.products;
    byId("admin-trigger").hidden = false;
    renderAdminList();
  } catch (error) {
    if (error.status !== 403) console.warn("Admin panel is unavailable:", error.message);
  }
}

const adminDialog = byId("admin-dialog");
const adminForm = byId("admin-product-form");

function renderAdminList() {
  const filter = byId("admin-search").value.trim().toLocaleLowerCase("ru");
  const shown = adminProducts.filter((product) => product.name.toLocaleLowerCase("ru").includes(filter));
  byId("admin-products").innerHTML = shown.map((product) => `
    <button class="admin-product-row" type="button" data-admin-edit="${escapeHtml(product.id)}">
      <img src="${escapeHtml(productImage(product.image))}" alt="" />
      <span class="admin-product-main"><strong>${escapeHtml(product.name)}</strong><small>${money(product.priceCents)} · ${escapeHtml(product.id)}</small></span>
      <span class="admin-product-state ${product.active ? "is-active" : "is-hidden"}">${product.active ? "В каталоге" : "Скрыт"}</span>
      <span class="admin-product-arrow" aria-hidden="true">›</span>
    </button>`).join("");
  byId("admin-empty").hidden = shown.length > 0;
}

function showAdminEditor(product = null) {
  adminForm.reset();
  const randomId = globalThis.crypto?.randomUUID?.().replaceAll("-", "")
    || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  byId("admin-product-id").value = product?.id || `item-${randomId}`;
  byId("admin-name").value = product?.name || "";
  byId("admin-price").value = product ? (product.priceCents / 100).toFixed(2) : "";
  byId("admin-description").value = product?.description || "";
  byId("admin-active").checked = product ? product.active : true;
  byId("admin-image-url").value = product?.image || "";
  byId("admin-image-file").value = "";
  byId("admin-editor-title").textContent = product ? "Изменить товар" : "Новый товар";
  byId("admin-product-id-label").textContent = product ? product.id : "ID будет создан автоматически";
  const preview = byId("admin-image-preview");
  preview.hidden = !product?.image;
  if (product?.image) preview.src = productImage(product.image);
  byId("admin-products-view").hidden = true;
  byId("admin-editor-view").hidden = false;
}

function showAdminProducts() {
  byId("admin-editor-view").hidden = true;
  byId("admin-products-view").hidden = false;
  renderAdminList();
}

byId("admin-trigger").addEventListener("click", () => {
  adminDialog.showModal();
  showAdminProducts();
});
byId("admin-search").addEventListener("input", renderAdminList);
byId("admin-products").addEventListener("click", (event) => {
  const row = event.target.closest("[data-admin-edit]");
  if (!row) return;
  const product = adminProducts.find((item) => item.id === row.dataset.adminEdit);
  if (product) showAdminEditor(product);
});
byId("admin-add-product").addEventListener("click", () => showAdminEditor());
byId("admin-cancel-edit").addEventListener("click", showAdminProducts);
byId("admin-image-file").addEventListener("change", () => {
  const file = byId("admin-image-file").files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    byId("admin-image-file").value = "";
    showToast("Фото должно быть меньше 5 МБ.");
    return;
  }
  const preview = byId("admin-image-preview");
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = byId("admin-save-product");
  saveButton.disabled = true;
  saveButton.textContent = "Сохраняю…";
  try {
    let image = byId("admin-image-url").value;
    const file = byId("admin-image-file").files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await apiRequest("/api/admin/upload", { method: "POST", formData });
      image = uploaded.image;
    }
    const price = Number(byId("admin-price").value);
    const saved = await apiRequest("/api/admin/catalog", {
      method: "POST",
      body: {
        id: byId("admin-product-id").value,
        name: byId("admin-name").value,
        priceCents: Math.round(price * 100),
        description: byId("admin-description").value,
        image,
        active: byId("admin-active").checked,
      },
    });
    const index = adminProducts.findIndex((product) => product.id === saved.product.id);
    if (index < 0) adminProducts.push(saved.product);
    else adminProducts[index] = saved.product;
    await loadCatalog();
    showToast("Каталог сохранён");
    showAdminProducts();
  } catch (error) {
    showToast(error.message || "Не удалось сохранить товар.");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Сохранить товар";
  }
});

async function submitOrder(paymentMethod) {
  const items = [...cart.entries()].map(([id, quantity]) => ({ id, quantity }));
  if (!items.length) return;
  if (!byId("age-confirmed").checked) {
    showToast("Подтвердите, что вам исполнилось 18 лет.");
    return;
  }
  if (!tg?.initData) {
    showToast("Для отправки заказа откройте магазин в Telegram.");
    return;
  }

  const buttons = [byId("pay-card"), byId("pay-cash")];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await sendToBot({ type: "order", payment_method: paymentMethod, age_confirmed: true, items });
    tg.HapticFeedback?.impactOccurred("light");
    showToast("Заявка передана менеджеру");
  } catch (error) {
    showToast(error.message || "Не удалось отправить заявку. Попробуйте ещё раз.");
    return;
  } finally {
    buttons.forEach((button) => { button.disabled = !byId("age-confirmed").checked; });
  }

  cart.clear();
  saveCart();
  renderCart();
  byId("checkout-dialog").close();
  setCartOpen(false);
}

async function sendToBot(payload) {
  if (!tg?.initData) throw new Error("Откройте магазин через кнопку в Telegram.");
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": tg.initData,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Сервер временно недоступен. Проверьте интернет и попробуйте ещё раз.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ. Попробуйте позже.");
  }
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Не удалось передать данные. Попробуйте ещё раз.");
  }
  return result;
}

function resetCatalogFilters() {
  byId("price-min").value = 0;
  byId("price-max").value = MAX_PRICE_EUROS;
  byId("sort-price").value = "featured";
  renderProducts();
}

byId("price-min").addEventListener("input", renderProducts);
byId("price-max").addEventListener("input", renderProducts);
byId("sort-price").addEventListener("change", renderProducts);
byId("reset-filters").addEventListener("click", resetCatalogFilters);
byId("empty-reset").addEventListener("click", resetCatalogFilters);

byId("product-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const id = button.dataset.add;
  const quantity = cart.get(id) || 0;
  if (quantity >= 20) {
    showToast("Максимум 20 единиц одного товара");
    return;
  }
  cart.set(id, quantity + 1);
  saveCart();
  renderCart();
  showToast("Добавлено в корзину");
  tg?.HapticFeedback?.selectionChanged();
});

byId("cart-items").addEventListener("click", (event) => {
  const change = event.target.closest("[data-change]");
  const remove = event.target.closest("[data-remove]");
  if (change) {
    const id = change.dataset.change;
    const quantity = (cart.get(id) || 0) + Number(change.dataset.delta);
    if (quantity <= 0) cart.delete(id); else cart.set(id, quantity);
  }
  if (remove) cart.delete(remove.dataset.remove);
  saveCart();
  renderCart();
});

let selectedRating = 0;
const reviewDialog = byId("review-dialog");

function setRating(value) {
  selectedRating = value;
  document.querySelectorAll("[data-rating]").forEach((button) => {
    const active = Number(button.dataset.rating) <= value;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(Number(button.dataset.rating) === value));
  });
}

byId("open-review").addEventListener("click", () => {
  if (!tg) {
    showToast("Чтобы отправить отзыв, откройте магазин в Telegram");
    return;
  }
  reviewDialog.showModal();
});

document.querySelectorAll("[data-rating]").forEach((button) => {
  button.addEventListener("click", () => setRating(Number(button.dataset.rating)));
});

byId("review-text").addEventListener("input", (event) => {
  byId("review-length").textContent = event.target.value.length;
});

byId("send-review").addEventListener("click", async () => {
  const text = byId("review-text").value.trim();
  if (selectedRating < 1 || selectedRating > 5) {
    showToast("Поставьте оценку от 1 до 5");
    return;
  }
  if (text.length < 5) {
    showToast("Напишите отзыв хотя бы из 5 символов");
    return;
  }
  const button = byId("send-review");
  button.disabled = true;
  try {
    await sendToBot({ type: "review", rating: selectedRating, text });
  } catch (error) {
    showToast(error.message || "Не удалось отправить отзыв. Попробуйте ещё раз.");
    return;
  } finally {
    button.disabled = false;
  }
  showToast("Спасибо! Отзыв отправлен");
  reviewDialog.close();
  byId("review-text").value = "";
  byId("review-length").textContent = "0";
  setRating(0);
});

byId("review-dialog").addEventListener("click", (event) => {
  if (event.target === reviewDialog) reviewDialog.close();
});

byId("open-cart").addEventListener("click", () => setCartOpen(true));
byId("close-cart").addEventListener("click", () => setCartOpen(false));
byId("overlay").addEventListener("click", () => setCartOpen(false));
byId("checkout-button").addEventListener("click", () => byId("checkout-dialog").showModal());
byId("pay-card").addEventListener("click", () => submitOrder("card"));
byId("pay-cash").addEventListener("click", () => submitOrder("cash"));
byId("age-confirmed").addEventListener("change", (event) => {
  byId("pay-card").disabled = !event.target.checked;
  byId("pay-cash").disabled = !event.target.checked;
});
byId("checkout-dialog").addEventListener("close", () => {
  byId("age-confirmed").checked = false;
  byId("pay-card").disabled = true;
  byId("pay-cash").disabled = true;
});
byId("checkout-dialog").addEventListener("click", (event) => {
  if (event.target === byId("checkout-dialog")) byId("checkout-dialog").close();
});

async function startApp() {
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#0c090b");
    tg.setBackgroundColor?.("#0c090b");
  }

  try {
    await loadCatalog();
    await enableAdminForOwner();
  } catch (error) {
    console.error("Could not load DragonShop catalog:", error);
    byId("product-grid").innerHTML = "";
    byId("filter-empty").hidden = false;
    byId("filter-empty").querySelector("p").textContent = error.message;
    renderCart();
  }
}

startApp();

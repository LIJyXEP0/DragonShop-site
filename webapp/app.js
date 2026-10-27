const PRODUCTS = [
  { id: "dumbum-2g-p5du13", name: "Dumbum", priceCents: 1200, image: "images/dumbum-2g-p5du13.webp" },
  { id: "rc3-pxp203", name: "RC3", priceCents: 700, image: "images/rc3-pxp203.webp" },
  { id: "dumbum-micro-p2d", name: "Dumbum Micro", priceCents: 500, image: "images/dumbum-micro-p2d.webp" },
  { id: "dumbum-middle-red-p6a13", name: "Dumbum Middle(R)", priceCents: 1800, image: "images/dumbum-middle-red-p6a13.webp" },
  { id: "fp3-small-jc05", name: "FP3 Small", priceCents: 1200, image: "images/fp3-small-jc05.webp" },
  { id: "tp2l", name: "TP2L", priceCents: 1300, image: "images/tp2l.webp" },
  { id: "viper-black-p5d13", name: "Viper Black", priceCents: 1500, image: "images/viper-black-p5d13.webp" },
  { id: "zombum-original-zb101", name: "Zom Bum", priceCents: 1200, image: "images/zombum-original-zb101.webp" },
  { id: "zb600-zombie-attack", name: "ZOMBIE ATTACK 5G", priceCents: 2500, image: "images/zb600-zombie-attack.webp" },
  { id: "rc1-pxp201", name: "RC1", priceCents: 400, image: "images/rc1-pxp201.webp" },
  { id: "dumbum-middle-green-p6a13", name: "Dumbum Middle(G)", priceCents: 1800, image: "images/dumbum-middle-green-p6a13.webp" },
];

const tg = window.Telegram?.WebApp;
const money = (cents) => new Intl.NumberFormat("ru-LV", { style: "currency", currency: "EUR" }).format(cents / 100);
const byId = (id) => document.getElementById(id);
const CART_STORAGE_KEY = `dragon-shop:cart:v1:${tg?.initDataUnsafe?.user?.id || "browser"}`;
const MAX_PRICE_EUROS = Math.ceil(Math.max(...PRODUCTS.map((product) => product.priceCents)) / 100);
byId("price-min").max = MAX_PRICE_EUROS;
byId("price-max").max = MAX_PRICE_EUROS;
byId("price-max").value = MAX_PRICE_EUROS;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return new Map();
    return new Map(saved.filter(([id, quantity]) =>
      PRODUCTS.some((product) => product.id === id)
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
    return `
    <article class="product-card">
      <div class="product-visual">
        <img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy" />
      </div>
      <div class="product-info">
        <div><p class="product-name">${product.name}</p></div>
        <span class="product-price">${money(product.priceCents)}</span>
      </div>
      <button class="add-button" type="button" data-add="${product.id}" aria-label="Добавить: ${product.name}">В корзину <span>+</span></button>
    </article>`;
  }).join("");
}

function cartTotal() {
  return [...cart.entries()].reduce((sum, [id, quantity]) => {
    const product = PRODUCTS.find((item) => item.id === id);
    return sum + product.priceCents * quantity;
  }, 0);
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  byId("cart-count").textContent = count;
  byId("cart-empty").hidden = count > 0;
  byId("cart-summary").hidden = count === 0;
  byId("cart-items").innerHTML = [...cart.entries()].map(([id, quantity]) => {
    const product = PRODUCTS.find((item) => item.id === id);
    return `<div class="cart-row">
      <div class="cart-thumb"><img src="${product.image}" alt="" /></div>
      <div><p class="cart-product-name">${product.name}</p><span class="cart-product-price">${money(product.priceCents * quantity)}</span>
        <div class="quantity-control"><button type="button" data-change="${id}" data-delta="-1" aria-label="Уменьшить количество">−</button><span>${quantity}</span><button type="button" data-change="${id}" data-delta="1" aria-label="Увеличить количество">+</button></div>
      </div><button class="remove-item" type="button" data-remove="${id}" aria-label="Удалить ${product.name}">×</button>
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

function submitOrder(paymentMethod) {
  const items = [...cart.entries()].map(([id, quantity]) => ({ id, quantity }));
  if (!items.length) return;
  if (!byId("age-confirmed").checked) {
    showToast("Подтвердите, что вам исполнилось 18 лет.");
    return;
  }
  const payload = JSON.stringify({ type: "order", payment_method: paymentMethod, age_confirmed: true, items });

  if (!tg) {
    showToast("Для отправки заказа откройте магазин в Telegram.");
    return;
  }

  tg.HapticFeedback?.impactOccurred("light");
  tg.sendData(payload);
  cart.clear();
  saveCart();
  renderCart();
  byId("checkout-dialog").close();
  setCartOpen(false);
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

byId("send-review").addEventListener("click", () => {
  const text = byId("review-text").value.trim();
  if (selectedRating < 1 || selectedRating > 5) {
    showToast("Поставьте оценку от 1 до 5");
    return;
  }
  if (text.length < 5) {
    showToast("Напишите отзыв хотя бы из 5 символов");
    return;
  }
  tg.sendData(JSON.stringify({ type: "review", rating: selectedRating, text }));
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

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.("#0c090b");
  tg.setBackgroundColor?.("#0c090b");
}

renderProducts();
renderCart();

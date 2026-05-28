const state = {
  products: [],
  cart: { items: [], total: 0, count: 0 },
  favorites: [],
  account: null,
  session: { city: "", user: null },
  orders: [],
  reviews: [],
  supportTickets: [],
  activeDrawer: null,
  adminTab: "reviews",
  adminEditingProductId: null,
  accountMode: "guest",
  maxPrice: 10000,
  categories: new Set(),
  textures: new Set(),
  search: "",
  reviewRating: 5,
  consultantStep: 0,
  consultantAnswers: {},
  consultantMessages: [],
  consultantQuestionQueue: null,
  consultantQuickMode: false
};

const productsContainer = document.querySelector(".products");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
const cartCount = document.querySelector("#cart-count");
const favoritesCount = document.querySelector("#favorites-count");
const accountContent = document.querySelector("#account-content");
const cartContent = document.querySelector("#cart-content");
const favoritesContent = document.querySelector("#favorites-content");
const productContent = document.querySelector("#product-content");
const adminContent = document.querySelector("#admin-content");
const supportForm = document.querySelector("#support-form");
const consultantForm = document.querySelector("#consultant-form");
const requestForm = document.querySelector("#request-form");
const checkoutForm = document.querySelector("#checkout-form");
const loyaltyForm = document.querySelector("#loyalty-form");
const supportStatus = document.querySelector("#support-status");
const consultantStatus = document.querySelector("#consultant-status");
const consultantResults = document.querySelector("#consultant-results");
const consultantMessages = document.querySelector("#consultant-messages");
const consultantOptions = document.querySelector("#consultant-options");
const consultantAnswer = document.querySelector("#consultant-answer");
const requestStatus = document.querySelector("#request-status");
const checkoutStatus = document.querySelector("#checkout-status");
const loyaltyStatus = document.querySelector("#loyalty-status");
const cityStatus = document.querySelector("#city-status");
const cityLabel = document.querySelector("#city-label");
const citySearch = document.querySelector("#city-search");
const checkoutLoyaltyField = document.querySelector("#checkout-loyalty-field");
const checkoutBarcodeInput = document.querySelector("#checkout-barcode");
const checkoutPhoneInput = document.querySelector("#checkout-phone");
const checkoutAddressInput = document.querySelector("#checkout-address");
const checkoutEmailInput = document.querySelector("#checkout-email");
const checkoutNameInput = document.querySelector("#checkout-name");
const supportNameInput = document.querySelector("#drawer-support-name");
const supportEmailInput = document.querySelector("#drawer-support-email");
const loyaltyNameInput = document.querySelector("#loyalty-name");
const loyaltyPhoneInput = document.querySelector("#loyalty-phone");
const loyaltyEmailInput = document.querySelector("#loyalty-email");
const priceRange = document.querySelector("#price-range");
const priceValue = document.querySelector("#price-value");
const searchInput = document.querySelector("#search");
const categoryFilters = document.querySelectorAll("[data-filter-category]");
const textureFilters = document.querySelectorAll("[data-filter-texture]");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.error || "Ошибка запроса");
  }

  return payload;
}

async function loadProductsSafe() {
  try {
    return await api("/api/products");
  } catch (error) {
    const data = await api("/data.json");
    return data.products.map(product => {
      const category = data.categories.find(item => item.category_id === product.category_id);
      return { ...product, category: category ? category.name : "Без категории" };
    });
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function formatDateTime(value) {
  if (!value) {
    return "Дата не указана";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function makeStars(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function makeBarcode(value) {
  const digits = String(value || "").replace(/\D/g, "") || "462000000000";
  const bars = digits.split("").map((digit, index) => {
    const height = 44 + (Number(digit) % 4) * 8;
    const width = 2 + ((Number(digit) + index) % 3);
    return `<span style="--bar-h:${height}px;--bar-w:${width}px"></span>`;
  }).join("");

  return `
    <div class="barcode" aria-label="Штрихкод карты ${escapeHtml(digits)}">
      <div class="barcode-lines" aria-hidden="true">${bars}${bars}</div>
      <strong>${escapeHtml(digits.replace(/(\d{3})(?=\d)/g, "$1 "))}</strong>
    </div>
  `;
}

function loyaltyCardTemplate(card) {
  if (!card) {
    return "";
  }

  return `
    <section class="loyalty-card-wrap" aria-label="Карта лояльности">
      <button class="loyalty-card-preview" type="button" data-toggle-loyalty-card aria-pressed="false" aria-label="Перевернуть карту лояльности и показать штрихкод">
        <span class="loyalty-card-inner">
          <span class="loyalty-card-face loyalty-card-front">
            <span class="loyalty-photo" aria-hidden="true"></span>
            <span class="loyalty-card-copy">
              <span class="loyalty-kicker">карта лояльности</span>
              <strong>A.Klimasy</strong>
              <span>${escapeHtml(card.name)}</span>
              <em>${Number(card.discount || 15)}% скидка карты лояльности</em>
            </span>
          </span>
          <span class="loyalty-card-face loyalty-card-back">
            <span class="loyalty-back-title">A.Klimasy Cosmetic</span>
            <span class="loyalty-back-text">Введите номер штрихкода для получения скидки на заказ</span>
            ${makeBarcode(card.barcode)}
          </span>
        </span>
      </button>
    </section>
  `;
}

function passwordField(id, name, options = {}) {
  const valueAttr = options.value ? ` value="${escapeHtml(options.value)}"` : "";
  const placeholderAttr = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : "";
  const autocomplete = options.autocomplete || "current-password";

  return `
    <div class="password-field">
      <input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="password"${valueAttr}${placeholderAttr} minlength="5" autocomplete="${escapeHtml(autocomplete)}" required>
      <button class="password-peek" type="button" data-password-peek="${escapeHtml(id)}" aria-label="Показать пароль при наведении" title="Наведи, чтобы увидеть пароль">
        <span aria-hidden="true"></span>
      </button>
    </div>
  `;
}

function productImage(product) {
  const src = product.image_url || productFallbackImage(product);
  const fallback = "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&crop=center&w=900&h=900&q=88";

  return `<img class="product-photo" src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}" loading="lazy" data-fallback-src="${escapeHtml(fallback)}" onerror="this.onerror=null; this.src=this.dataset.fallbackSrc; this.parentElement.classList.add('has-image')">`;
}

function productFallbackImage(product) {
  const palette = {
    peach: ["#f5cfb7", "#fff3e7", "#8d6049"],
    sage: ["#d6dfcb", "#fbfff8", "#53644c"],
    rose: ["#ecc2d2", "#fff5fa", "#944d68"],
    cream: ["#f2e4cf", "#fffaf1", "#7a5c44"],
    sand: ["#e5d1bc", "#fff8ed", "#72513d"],
    milk: ["#f4efe7", "#ffffff", "#6d6259"],
    lavender: ["#d9d7ea", "#ffffff", "#555075"]
  };
  const [bg, light, ink] = palette[product.color] || palette.peach;
  const label = String(product.brand || "A.K").replace(/[^\p{L}\p{N}.& -]/gu, "").slice(0, 16);
  const title = String(product.name || "Product").replace(/[^\p{L}\p{N}.& -]/gu, "").slice(0, 24);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900">
      <defs>
        <radialGradient id="g" cx="34%" cy="26%" r="78%">
          <stop offset="0" stop-color="#fff7dd"/>
          <stop offset="0.52" stop-color="${bg}"/>
          <stop offset="1" stop-color="${light}"/>
        </radialGradient>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="28" stdDeviation="26" flood-color="#5f4b42" flood-opacity=".22"/>
        </filter>
      </defs>
      <rect width="900" height="900" rx="36" fill="url(#g)"/>
      <circle cx="210" cy="170" r="18" fill="#fffaf0" opacity=".72"/>
      <circle cx="725" cy="245" r="28" fill="#fffaf0" opacity=".58"/>
      <circle cx="690" cy="675" r="16" fill="#fffaf0" opacity=".68"/>
      <path d="M0 710 C170 640 315 755 510 675 C690 600 780 646 900 590 V900 H0 Z" fill="#fff" opacity=".22"/>
      <g filter="url(#s)">
        <rect x="382" y="190" width="178" height="485" rx="78" fill="${light}"/>
        <rect x="407" y="135" width="128" height="82" rx="24" fill="${ink}"/>
        <rect x="408" y="360" width="126" height="145" rx="38" fill="#fff" opacity=".68"/>
        <text x="471" y="432" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${ink}" opacity=".86">${escapeHtml(label)}</text>
      </g>
      <text x="450" y="795" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${ink}" opacity=".82">${escapeHtml(title)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function isFavorite(productId) {
  return state.favorites.some(item => item.product_id === productId);
}

function productReviews(productId) {
  return state.reviews
    .filter(review => review.product_id === Number(productId))
    .sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0));
}

function averageRating(product) {
  const reviews = productReviews(product.product_id).filter(review => review.status !== "deleted");
  if (!reviews.length) {
    return product.rating || 5;
  }

  return Math.round(reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length);
}

function reviewRepliesTemplate(review) {
  const replies = review.replies || [];

  return `
    ${replies.length ? `
      <div class="review-replies">
        ${replies.map(reply => `
          <article>
            <strong>${escapeHtml(reply.role === "admin" ? "Администратор" : reply.user_name || "Пользователь")}</strong>
            <p>${escapeHtml(reply.text)}</p>
            <small>${escapeHtml(formatDateTime(reply.created_at))}</small>
          </article>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function reviewReplyFormTemplate(review) {
  const canReply = state.account && state.account.role !== "guest" && review.status !== "deleted";
  if (!canReply) {
    return "";
  }

  return `
    <form class="reply-form" data-review-reply-form="${review.review_id}">
      <label class="visually-hidden" for="reply-${review.review_id}">Ответ на отзыв</label>
      <input id="reply-${review.review_id}" name="text" type="text" placeholder="Ответить на отзыв" minlength="3" required>
      <button class="mini-button" type="submit">Ответить</button>
      <p class="form-status" role="status"></p>
    </form>
  `;
}

function reviewItemTemplate(review) {
  const deleted = review.status === "deleted";

  return `
    <article class="review-item ${deleted ? "is-deleted" : ""}">
      <strong>${deleted ? "Отзыв удален" : makeStars(review.rating)}</strong>
      <p>${deleted ? "Этот отзыв был удален администратором." : escapeHtml(review.text)}</p>
      <small>
        ${escapeHtml(review.user_name || "Пользователь")} · ${escapeHtml(formatDateTime(review.created_at))}
        ${deleted ? ` · удалено ${escapeHtml(review.deleted_by_name || "администратором")} ${escapeHtml(formatDateTime(review.deleted_at))}` : ""}
      </small>
      ${reviewRepliesTemplate(review)}
      ${reviewReplyFormTemplate(review)}
    </article>
  `;
}

function productDetailsTemplate(product) {
  const details = [
    ["Описание", product.description],
    ["Состав", product.ingredients || product.composition],
    ["Способ применения", product.application || product.usage],
    ["Результат", product.effect],
    ["Тип кожи", product.skin_type]
  ].filter(([, value]) => value);

  return `
    <div class="product-info-grid">
      ${details.map(([label, value]) => `
        <article>
          <h4>${escapeHtml(label)}</h4>
          <p>${escapeHtml(value)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function openProductCard(productId) {
  const product = state.products.find(item => item.product_id === Number(productId));
  if (!product) {
    return;
  }

  state.reviewRating = averageRating(product || { rating: 5 });
  renderProduct(productId);
}

function validateForm(form) {
  validateFormFields(form);

  if (!form.reportValidity()) {
    return false;
  }

  form.querySelectorAll("input, textarea").forEach(field => {
    if (typeof field.value === "string") {
      field.value = field.value.trim();
    }
  });

  return true;
}

function normalizeRussianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  let local = digits;

  if (local.startsWith("8")) {
    local = `7${local.slice(1)}`;
  }

  if (!local.startsWith("7")) {
    local = `7${local}`;
  }

  local = local.slice(0, 11);
  const rest = local.slice(1);
  const groups = [
    rest.slice(0, 3),
    rest.slice(3, 6),
    rest.slice(6, 8),
    rest.slice(8, 10)
  ].filter(Boolean);

  if (!groups.length) {
    return "+7 ";
  }

  return `+7 ${groups.join("-")}`;
}

function isValidRussianPhone(value) {
  return /^(\+7|8)\s?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/.test(String(value || "").trim());
}

function setFieldValidity(field) {
  if (!field || field.disabled || field.type === "hidden") {
    return;
  }

  field.setCustomValidity("");
  const value = String(field.value || "").trim();
  const label = field.labels?.[0]?.textContent?.trim() || field.placeholder || "Поле";

  if (field.required && !value) {
    field.setCustomValidity(`Заполните поле «${label}».`);
    return;
  }

  if (!value) {
    return;
  }

  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    field.setCustomValidity("Введите корректную почту, например name@example.ru.");
    return;
  }

  if (field.type === "tel" && !isValidRussianPhone(value)) {
    field.setCustomValidity("Введите телефон в формате +7 900 000-00-00.");
    return;
  }

  if (field.name === "name" && value.length < 2) {
    field.setCustomValidity("Имя должно быть не короче 2 символов.");
    return;
  }

  if (field.name === "pickup_address" && value.length < 8) {
    field.setCustomValidity("Укажите город и адрес пункта выдачи.");
    return;
  }

  if (field.name === "loyalty_barcode" && !/^\d{8,16}$/.test(value)) {
    field.setCustomValidity("Штрихкод должен содержать от 8 до 16 цифр.");
    return;
  }

  if (field.minLength > 0 && value.length < field.minLength) {
    field.setCustomValidity(`Минимум ${field.minLength} символов.`);
  }
}

function validateFormFields(form) {
  form.querySelectorAll("input, textarea").forEach(setFieldValidity);
}

function visibleProducts() {
  return state.products.filter(product => {
    const search = state.search.trim().toLowerCase();
    const priceOk = product.price <= state.maxPrice;
    const categoryOk = state.categories.size === 0 || state.categories.has(product.category);
    const textureOk = state.textures.size === 0 || state.textures.has(product.texture);
    const searchOk = !search || [product.name, product.brand, product.shop, product.description, product.category, product.texture]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(search));

    return priceOk && categoryOk && textureOk && searchOk;
  });
}

function isConsultantQuestionRelevant(question) {
  if (!question) {
    return false;
  }

  if (question.key === "skin_type") {
    return !["Волосы", "Тело"].includes(state.consultantAnswers.zone);
  }

  if (question.key === "hair_goal") {
    return state.consultantAnswers.zone === "Волосы";
  }

  return true;
}

const consultantQuestions = [
  {
    key: "zone",
    text: "Привет! Я цифровой консультант A.Klimasy. Сначала выберем зону ухода, а потом я уточню только нужные детали. Для какой зоны подбираем средство?",
    required: true,
    options: ["Все лицо", "T-зона", "Кожа вокруг глаз", "Тело", "Волосы", "Руки", "Ноги"]
  },
  {
    key: "skin_type",
    text: "Какой у вас тип кожи? Если не уверены, можно выбрать «Не знаю».",
    required: true,
    options: ["Сухая", "Чувствительная", "Комбинированная", "Жирная", "Нормальная", "Не знаю"]
  },
  {
    key: "hair_goal",
    text: "Если подбираем уход за волосами, что важнее всего? Можно выбрать вариант или написать свой запрос.",
    required: false,
    options: ["Восстановление длины", "Питание и блеск", "Уход за кожей головы", "Гладкость без пушения", "Защита от сухости", "Очищение без утяжеления"]
  },
  {
    key: "goal",
    text: "Что хочется улучшить? Например: сухость, тусклость, очищение, раздражение, питание, восстановление.",
    required: true,
    options: ["Увлажнение", "Сияние", "Очищение", "Питание", "Восстановление", "Чувствительность"]
  },
  {
    key: "contraindications",
    text: "Есть ли аллергии, раздражение, дерматит, активные воспаления, ранки или другие противопоказания? Если нет, так и напишите.",
    required: true,
    options: ["Нет", "Есть аллергия", "Есть раздражение", "Активные воспаления", "Очень чувствительная кожа"]
  },
  {
    key: "texture",
    text: "Какая текстура комфортнее? Этот вопрос можно пропустить.",
    required: false,
    options: ["Крем", "Гель", "Сыворотка", "Масло", "Молочко", "Шампунь", "Маска", "Бальзам", "Спрей", "Не важно"]
  },
  {
    key: "time",
    text: "Когда планируете использовать средство? Можно пропустить.",
    required: false,
    options: ["Утром", "Вечером", "Утром и вечером", "После душа", "Не важно"]
  },
  {
    key: "budget",
    text: "Есть ли желаемый бюджет? Можно написать сумму или пропустить.",
    required: false,
    options: ["До 1000 ₽", "До 2000 ₽", "До 3500 ₽", "Не важно"]
  }
];

const consultantZones = ["Все лицо", "T-зона", "Кожа вокруг глаз", "Тело", "Волосы", "Руки", "Ноги"];
const consultantSkinTypes = ["Сухая", "Чувствительная", "Комбинированная", "Жирная", "Нормальная", "Не знаю"];
const consultantGoals = ["Увлажнение", "Сияние", "Очищение", "Питание", "Восстановление", "Чувствительность"];
const consultantTextures = ["Крем", "Гель", "Сыворотка", "Масло", "Молочко", "Шампунь", "Маска", "Бальзам", "Спрей", "Не важно"];

function textHasAny(text, words) {
  return words.some(word => text.includes(word));
}

function inferConsultantAnswers(text) {
  const source = String(text || "").toLowerCase();
  const answers = { initial_query: String(text || "").trim() };

  if (textHasAny(source, ["волос", "кожи головы", "скальп", "шампун", "маск", "кончик", "пушени", "кератин"])) {
    answers.zone = "Волосы";
  } else if (textHasAny(source, ["тело", "body", "локт", "бедр", "живот", "после душа"])) {
    answers.zone = "Тело";
  } else if (textHasAny(source, ["рук", "кист", "кутикул"])) {
    answers.zone = "Руки";
  } else if (textHasAny(source, ["ног", "стоп", "пятк"])) {
    answers.zone = "Ноги";
  } else if (textHasAny(source, ["вокруг глаз", "под глазами", "веки", "отек", "темные круг"])) {
    answers.zone = "Кожа вокруг глаз";
  } else if (textHasAny(source, ["t-зон", "т-зон", "нос", "лоб", "поры", "черные точки", "жирный блеск"])) {
    answers.zone = "T-зона";
  } else if (textHasAny(source, ["лиц", "кожа", "щеки", "тон", "сыворотк", "тоник", "крем"])) {
    answers.zone = "Все лицо";
  }

  if (textHasAny(source, ["сух", "шелуш", "стян"])) {
    answers.skin_type = "Сухая";
    answers.goal = "Увлажнение";
  } else if (textHasAny(source, ["чувств", "раздраж", "покрасн"])) {
    answers.skin_type = "Чувствительная";
    answers.goal = "Чувствительность";
  } else if (textHasAny(source, ["жирн", "себум", "блеск", "поры"])) {
    answers.skin_type = "Жирная";
    answers.goal = "Очищение";
  } else if (textHasAny(source, ["комбинир", "смешан"])) {
    answers.skin_type = "Комбинированная";
  } else if (textHasAny(source, ["нормальн"])) {
    answers.skin_type = "Нормальная";
  }

  if (textHasAny(source, ["увлаж", "обезвож", "гиалур"])) answers.goal = "Увлажнение";
  if (textHasAny(source, ["сия", "glow", "туск", "витамин", "пигмент", "пятн"])) answers.goal = "Сияние";
  if (textHasAny(source, ["очищ", "умыван", "комедон", "черные точки"])) answers.goal = "Очищение";
  if (textHasAny(source, ["пит", "мягк", "бархат"])) answers.goal = "Питание";
  if (textHasAny(source, ["восстанов", "барьер", "repair", "кератин", "ломк"])) answers.goal = "Восстановление";

  if (textHasAny(source, ["крем"])) answers.texture = "Крем";
  if (textHasAny(source, ["гель"])) answers.texture = "Гель";
  if (textHasAny(source, ["сыворот", "serum"])) answers.texture = "Сыворотка";
  if (textHasAny(source, ["масло", "oil"])) answers.texture = "Масло";
  if (textHasAny(source, ["молочк", "milk"])) answers.texture = "Молочко";
  if (textHasAny(source, ["шампун"])) answers.texture = "Шампунь";
  if (textHasAny(source, ["маск"])) answers.texture = "Маска";
  if (textHasAny(source, ["бальзам"])) answers.texture = "Бальзам";
  if (textHasAny(source, ["спрей"])) answers.texture = "Спрей";

  if (textHasAny(source, ["аллерг", "дерматит", "акне", "воспал", "ран", "ожог", "беремен", "противопоказ"])) {
    answers.contraindications = text;
  } else if (textHasAny(source, ["нет противопоказ", "нет аллерг", "ничего нет", "без аллерг"])) {
    answers.contraindications = "Нет";
  }

  const budgetMatch = source.match(/(?:до|бюджет|цена|не дороже)\s*(\d[\d\s]*)/);
  if (budgetMatch) {
    answers.budget = `До ${budgetMatch[1].replace(/\s/g, "")} ₽`;
  }

  if (answers.zone === "Волосы") {
    if (textHasAny(source, ["восстанов", "ломк", "кератин", "repair"])) answers.hair_goal = "Восстановление длины";
    if (textHasAny(source, ["блеск", "сия", "масло"])) answers.hair_goal = "Питание и блеск";
    if (textHasAny(source, ["кожи головы", "перхот", "себум", "скальп"])) answers.hair_goal = "Уход за кожей головы";
    if (textHasAny(source, ["гладк", "пушени", "спрей"])) answers.hair_goal = "Гладкость без пушения";
  }

  return answers;
}

function quickConsultantQuestions(answers) {
  const questions = [];

  if (!answers.zone) {
    questions.push({
      key: "zone",
      text: "Поняла запрос. Уточню пару вещей и сразу покажу подбор. Для какой зоны выбираем уход?",
      required: true,
      options: consultantZones
    });
  }

  if (!answers.skin_type) {
    questions.push({
      key: "skin_type",
      text: "Какой у вас тип кожи? Если речь про волосы или тело, этот вопрос можно пропустить.",
      required: false,
      options: consultantSkinTypes
    });
  }

  if (answers.zone === "Волосы" && !answers.hair_goal) {
    questions.push({
      key: "hair_goal",
      text: "Что для волос важнее всего сейчас?",
      required: false,
      options: ["Восстановление длины", "Питание и блеск", "Уход за кожей головы", "Гладкость без пушения", "Очищение без утяжеления"]
    });
  }

  if (!answers.goal) {
    questions.push({
      key: "goal",
      text: "Какая основная цель ухода?",
      required: true,
      options: consultantGoals
    });
  }

  if (!answers.contraindications) {
    questions.push({
      key: "contraindications",
      text: "Есть аллергии, раздражение, активные воспаления или другие противопоказания?",
      required: false,
      options: ["Нет", "Есть аллергия", "Есть раздражение", "Активные воспаления", "Очень чувствительная кожа"]
    });
  }

  if (!answers.texture) {
    questions.push({
      key: "texture",
      text: "Есть любимая текстура? Можно пропустить.",
      required: false,
      options: consultantTextures
    });
  }

  return questions.filter(isConsultantQuestionRelevant).slice(0, 2);
}

function resetConsultant() {
  state.consultantStep = 0;
  state.consultantAnswers = {};
  state.consultantQuestionQueue = consultantQuestions;
  state.consultantQuickMode = false;
  state.consultantMessages = [
    {
      role: "ai",
      text: consultantQuestions[0].text
    }
  ];
  if (consultantResults) {
    renderConsultantDefaultProducts();
  }
  if (consultantStatus) {
    consultantStatus.textContent = "";
  }
  renderConsultantChat();
}

function currentConsultantQuestion() {
  const queue = state.consultantQuestionQueue || consultantQuestions;

  while (state.consultantStep < queue.length && !isConsultantQuestionRelevant(queue[state.consultantStep])) {
    state.consultantStep += 1;
  }

  return queue[state.consultantStep] || null;
}

function renderConsultantChat() {
  if (!consultantMessages || !consultantOptions) {
    return;
  }

  consultantMessages.innerHTML = state.consultantMessages.map(message => `
    <article class="chat-message ${message.role === "user" ? "is-user" : "is-ai"}">
      <strong>${message.role === "user" ? "Вы" : "AI"}</strong>
      <p>${escapeHtml(message.text)}</p>
    </article>
  `).join("");

  const question = currentConsultantQuestion();
  consultantOptions.innerHTML = question ? question.options.map(option => `
    <button type="button" data-consultant-option="${escapeHtml(option)}">${escapeHtml(option)}</button>
  `).join("") : "";

  const skipButton = document.querySelector("[data-consultant-skip]");
  if (skipButton) {
    skipButton.hidden = !question || question.required;
  }

  if (consultantAnswer) {
    consultantAnswer.value = "";
    consultantAnswer.disabled = !question;
    consultantAnswer.placeholder = question ? "Напишите ответ или выберите вариант" : "Подбор готов";
  }

  consultantMessages.scrollTop = consultantMessages.scrollHeight;
}

function resetConsultantState() {
  state.consultantStep = 0;
  state.consultantAnswers = {};
  state.consultantMessages = [];
  state.consultantQuestionQueue = null;
  state.consultantQuickMode = false;
  if (consultantMessages) {
    consultantMessages.innerHTML = "";
  }
  if (consultantOptions) {
    consultantOptions.innerHTML = "";
  }
  if (consultantResults) {
    consultantResults.innerHTML = "";
  }
  if (consultantStatus) {
    consultantStatus.textContent = "";
  }
}

function finishConsultantSelection() {
  const result = consultantRecommendations(state.consultantAnswers);
  state.consultantMessages.push({
    role: "ai",
    text: result.warning
      ? "Я вижу возможные противопоказания. Покажу мягкие варианты, но при активных проблемах кожи лучше уточнить уход у врача."
      : "Готово. Ниже несколько вариантов из каталога с пояснениями, почему они могут подойти."
  });
  consultantStatus.textContent = "Подбор завершен.";
  renderConsultantChat();
  renderConsultantResults(result);
}

function startConsultantFromFreeQuery(query) {
  const text = String(query || "").trim();

  if (!text) {
    answerConsultantQuestion(text);
    return;
  }

  state.consultantQuickMode = true;
  state.consultantAnswers = inferConsultantAnswers(text);
  state.consultantMessages.push({ role: "user", text });
  state.consultantQuestionQueue = quickConsultantQuestions(state.consultantAnswers);
  state.consultantStep = 0;
  consultantStatus.textContent = "";

  const nextQuestion = currentConsultantQuestion();
  if (nextQuestion) {
    state.consultantMessages.push({ role: "ai", text: nextQuestion.text });
    renderConsultantChat();
    return;
  }

  finishConsultantSelection();
}

function answerConsultantQuestion(answer, skipped = false) {
  const question = currentConsultantQuestion();
  if (!question) {
    return;
  }

  const text = String(answer || "").trim();
  if (!text && question.required && !skipped) {
    consultantStatus.textContent = "Этот вопрос нужен для подбора. Ответьте текстом или выберите вариант.";
    return;
  }

  const userText = skipped ? "Пропустить" : text;
  state.consultantAnswers[question.key] = skipped ? "" : text;
  state.consultantMessages.push({ role: "user", text: userText });
  state.consultantStep += 1;
  consultantStatus.textContent = "";

  const nextQuestion = currentConsultantQuestion();
  if (nextQuestion) {
    state.consultantMessages.push({ role: "ai", text: nextQuestion.text });
    renderConsultantChat();
    return;
  }

  finishConsultantSelection();
}

function consultantRecommendations(formData) {
  const skinType = String(formData.skin_type || "").toLowerCase();
  const zone = String(formData.zone || "");
  const goal = String(formData.goal || "").toLowerCase();
  const hairGoal = String(formData.hair_goal || "").toLowerCase();
  const contraindications = String(formData.contraindications || "").toLowerCase();
  const texture = String(formData.texture || "");
  const budgetText = String(formData.budget || "").toLowerCase();
  const warningWords = ["дерматит", "экзема", "аллерг", "рана", "ожог", "псориаз", "воспал", "акне", "беремен"];
  const hasWarning = warningWords.some(word => contraindications.includes(word));
  const budgetMatch = budgetText.match(/(\d[\d\s]*)/);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/\s/g, "")) : 0;

  const scored = state.products.map(product => {
    const haystack = [
      product.name,
      product.brand,
      product.shop,
      product.description,
      product.category,
      product.texture,
      product.ingredients,
      product.application,
      product.effect,
      product.skin_type
    ].filter(Boolean).join(" ").toLowerCase();

    let score = 0;
    if (zone && product.category === zone) score += 8;
    score += Number(product.rating || 0);
    if (texture && texture !== "Не важно" && product.texture === texture) score += 5;
    if (skinType && haystack.includes(skinType)) score += 4;
    if (budget && product.price <= budget) score += 3;

    `${goal} ${hairGoal}`.split(/[\s,.;!?]+/).filter(word => word.length > 3).forEach(word => {
      if (haystack.includes(word)) score += 2;
    });

    if (goal.includes("сух") && /увлаж|пит|мягк|масл|крем/.test(haystack)) score += 4;
    if (goal.includes("чувств") && /calm|спокой|чувств|мягк|сыворотка/.test(haystack)) score += 4;
    if (goal.includes("туск") && /сиян|glow|витамин|эффект/.test(haystack)) score += 4;
    if (goal.includes("очищ") && /очищ|гель|clean/.test(haystack)) score += 4;
    if (hairGoal.includes("восстанов") && /восстанов|маск|keratin|кератин|repair/.test(haystack)) score += 5;
    if (hairGoal.includes("блеск") && /блеск|сиян|масло|oil|argan/.test(haystack)) score += 5;
    if (hairGoal.includes("кожей головы") && /кожи головы|scalp|баланс|тоник|очищ/.test(haystack)) score += 5;
    if (hairGoal.includes("гладк") && /гладк|пушени|молочко|спрей|бальзам/.test(haystack)) score += 5;
    if (hasWarning && /мягк|calm|чувств|без стянутости|восстанов/.test(haystack)) score += 2;

    return { product, score };
  }).sort((first, second) => second.score - first.score);

  const limit = 5;
  const recommendations = scored.filter(item => item.score > 0).slice(0, limit).map(item => item.product);
  const fallback = visibleProducts().slice(0, limit);

  return {
    warning: hasWarning,
    products: recommendations.length ? recommendations : fallback,
    answers: formData
  };
}

function recommendationReason(product, answers) {
  const parts = [];
  if (answers.zone && product.category === answers.zone) {
    parts.push(`подходит для зоны "${answers.zone}"`);
  }
  if (answers.texture && answers.texture !== "Не важно" && product.texture === answers.texture) {
    parts.push(`совпадает по текстуре: ${answers.texture.toLowerCase()}`);
  }
  if (String(answers.goal || "").toLowerCase().includes("сух")) {
    parts.push("ориентирован на комфорт и увлажнение");
  }
  if (String(answers.goal || "").toLowerCase().includes("сия")) {
    parts.push("может поддержать более свежий вид кожи");
  }
  if (String(answers.goal || "").toLowerCase().includes("чувств")) {
    parts.push("выбран как более мягкий вариант ухода");
  }
  if (String(answers.hair_goal || "").trim()) {
    parts.push(`учитывает запрос по волосам: ${String(answers.hair_goal).toLowerCase()}`);
  }

  return parts.length
    ? parts.join(", ")
    : "подходит как базовый вариант по вашим ответам";
}

function productUsageHint(product) {
  const texture = String(product.texture || "").toLowerCase();
  const category = String(product.category || "").toLowerCase();
  const usage = product.application || product.usage || "";

  if (usage) {
    return usage;
  }

  if (category.includes("волос")) {
    if (texture.includes("шамп")) return "Нанесите на влажную кожу головы, вспеньте и тщательно смойте. При необходимости повторите.";
    if (texture.includes("маск")) return "Нанесите по длине волос после мытья на 5-10 минут, затем смойте.";
    if (texture.includes("масл")) return "Распределите 1-2 капли по длине и кончикам, избегая корней.";
    if (texture.includes("спрей")) return "Распылите на влажные или сухие волосы с расстояния 15-20 см.";
    return "Используйте после мытья по длине волос или на коже головы согласно текстуре средства.";
  }

  if (category.includes("тело")) {
    return "Наносите после душа на слегка влажную кожу, уделяя внимание сухим зонам.";
  }

  if (category.includes("рук")) {
    return "Наносите на чистую кожу рук после мытья и повторяйте в течение дня при ощущении сухости.";
  }

  if (category.includes("ног")) {
    return "Наносите вечером на чистую кожу стоп, уделяя внимание пяткам и сухим участкам.";
  }

  if (texture.includes("тоник") || texture.includes("пэд")) {
    return "Используйте после очищения: нанесите ладонями или пэдом, затем переходите к сыворотке или крему.";
  }

  if (texture.includes("сыворот")) {
    return "Нанесите 2-3 капли после тонера и закройте кремом.";
  }

  if (texture.includes("крем")) {
    return "Нанесите финальным этапом ухода утром и/или вечером.";
  }

  return "Наносите на очищенную кожу и вводите средство постепенно, наблюдая за реакцией.";
}

function consultantRoutineIntro(answers) {
  const zone = String(answers.zone || "").toLowerCase();

  if (zone.includes("волос")) {
    return [
      "Начните с очищения кожи головы и длины.",
      "Затем добавьте уход по задаче: маску для восстановления, масло/молочко для блеска или спрей для легкости.",
      "Не вводите все средства сразу: протестируйте 1-2 продукта в течение недели."
    ];
  }

  if (zone.includes("тело")) {
    return [
      "Лучшее время для ухода за телом — сразу после душа.",
      "Наносите средство на слегка влажную кожу, чтобы удержать ощущение мягкости.",
      "Если кожа сухая, используйте уход ежедневно, особенно вечером."
    ];
  }

  if (zone.includes("рук")) {
    return [
      "Держите крем или бальзам рядом и наносите после мытья рук.",
      "На ночь можно нанести более плотный слой.",
      "Для кутикулы добавьте масло точечно и мягко вмассируйте."
    ];
  }

  if (zone.includes("ног")) {
    return [
      "Используйте уход вечером на чистую кожу стоп.",
      "Для пяток наносите средство плотнее и дайте ему впитаться.",
      "При раздражении или трещинах лучше выбирать самые мягкие текстуры."
    ];
  }

  return [
    "Базовый порядок: очищение, тонер, сыворотка, крем.",
    "Утром завершайте уход SPF, если выходите на улицу.",
    "Новое средство вводите постепенно: сначала 2-3 раза в неделю или через день."
  ];
}

function consultantUsagePlanTemplate(result) {
  const answers = result.answers || {};
  const products = result.products || [];

  if (!products.length) {
    return "";
  }

  return `
    <div class="consultant-routine">
      <h3>Как использовать подбор</h3>
      <ul>
        ${consultantRoutineIntro(answers).map(item => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <div class="consultant-routine-products">
        ${products.map((product, index) => `
          <article>
            <strong>${index + 1}. ${escapeHtml(product.name)}</strong>
            <p>${escapeHtml(productUsageHint(product))}</p>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function productCardTemplate(product, options = {}) {
  const favorite = isFavorite(product.product_id);
  const rating = averageRating(product);
  const extraClass = options.compact ? " is-recommendation" : "";
  const reason = options.reason ? `<p class="consultant-reason"><strong>Почему:</strong> ${escapeHtml(options.reason)}.</p>` : "";

  return `
    <article class="product-card${extraClass}" data-open-product="${product.product_id}">
      <button class="favorite ${favorite ? "is-favorite" : ""}" type="button" data-toggle-favorite="${product.product_id}" aria-label="${favorite ? "Убрать" : "Добавить"} ${escapeHtml(product.name)} в избранное">${favorite ? "♥" : "♡"}</button>
      <div class="product-art ${escapeHtml(product.color || "peach")} ${product.image_url ? "has-image" : ""}">
        ${productImage(product)}
      </div>
      <h3>${escapeHtml(product.name)}</h3>
      <div class="chips-row">
        ${product.brand ? `<span class="brand-chip">${escapeHtml(product.brand)}</span>` : ""}
        ${product.shop ? `<span class="shop-chip">${escapeHtml(product.shop)}</span>` : ""}
      </div>
      <p>${escapeHtml(product.description)}</p>
      ${reason}
      <div class="product-meta">
        <span>${escapeHtml(product.category)}</span>
        <span>${escapeHtml(product.texture)}</span>
      </div>
      <div class="product-bottom">
        <button class="stars-button" type="button" data-open-product="${product.product_id}" aria-label="Открыть отзывы ${escapeHtml(product.name)}">${makeStars(rating)}</button>
        <strong>${formatPrice(product.price)}</strong>
      </div>
      <button class="button button-dark card-action" type="button" data-add-cart="${product.product_id}">В корзину</button>
    </article>
  `;
}

function renderConsultantDefaultProducts() {
  if (!consultantResults) {
    return;
  }

  const products = state.products
    .filter(product => product.category === "Волосы")
    .slice(0, 4);

  if (!products.length) {
    consultantResults.innerHTML = "";
    return;
  }

  consultantResults.innerHTML = `
    <div class="consultant-note">
      <strong>Можно посмотреть сразу</strong>
      <p>Несколько популярных средств для волос уже доступны ниже. После ответов я уточню подбор точнее.</p>
    </div>
    <div class="consultant-products">
      ${products.map(product => productCardTemplate(product, {
        compact: true,
        reason: product.effect || "подходит для базового ухода"
      })).join("")}
    </div>
  `;
}

function renderConsultantResults(result) {
  if (!consultantResults) {
    return;
  }

  consultantResults.innerHTML = `
    ${result.warning ? `
      <div class="consultant-warning">
        <strong>Важно</strong>
        <p>При активных заболеваниях кожи, аллергиях или сильном раздражении лучше согласовать уход с врачом. Ниже — мягкие варианты из каталога, но они не заменяют медицинскую консультацию.</p>
      </div>
    ` : `
      <div class="consultant-note">
        <strong>Подбор готов</strong>
        <p>Я подобрала варианты по вашим ответам. Начинайте с одного средства и следите за реакцией кожи.</p>
      </div>
    `}
    ${consultantUsagePlanTemplate(result)}
    <div class="consultant-products">
      ${result.products.map(product => productCardTemplate(product, {
        compact: true,
        reason: recommendationReason(product, result.answers || {})
      })).join("")}
    </div>
  `;
}

function renderProducts() {
  const products = visibleProducts();

  if (!products.length) {
    productsContainer.innerHTML = '<p class="loading-message">По выбранным фильтрам товары не найдены.</p>';
    return;
  }

  productsContainer.innerHTML = products.map(product => productCardTemplate(product)).join("");
}

function renderAccount() {
  if (!state.account || state.account.role === "guest") {
    if (state.accountMode === "register") {
      accountContent.innerHTML = `
        <form class="drawer-form auth-form" id="register-form">
          <h3>Регистрация</h3>
          <label for="register-name">Name</label>
          <input id="register-name" name="name" type="text" placeholder="Имя" minlength="2" autocomplete="name" required>
          <label for="register-email">Email</label>
          <input id="register-email" name="email" type="email" placeholder="name@example.ru" autocomplete="email" required>
          <label for="register-password">Password</label>
          ${passwordField("register-password", "password", { placeholder: "Пароль", autocomplete: "new-password" })}
          <button class="button button-dark" type="submit">Зарегистрироваться</button>
          <button class="button button-light" type="button" data-account-role="guest">Назад ко входу</button>
          <p class="form-status" id="register-status" role="status"></p>
        </form>
      `;
      return;
    }

    accountContent.innerHTML = `
      <div class="account-card">
        <div class="profile-icon small" aria-hidden="true">◎</div>
        <h3>Гость</h3>
        <p>Можно смотреть каталог без входа. Чтобы добавлять товары в корзину, избранное и оставлять отзывы, зарегистрируйтесь.</p>
        <button class="button button-dark" type="button" data-account-role="register">Перейти к регистрации</button>
      </div>
      <form class="drawer-form auth-form" id="login-form">
        <h3>Вход</h3>
        <p class="muted-text">Если у вас есть права администратора, войдите через выданные email и пароль.</p>
        <label for="login-email">Email</label>
        <input id="login-email" name="email" type="email" placeholder="name@example.ru" autocomplete="email" required>
        <label for="login-password">Password</label>
        ${passwordField("login-password", "password", { placeholder: "Пароль", autocomplete: "current-password" })}
        <button class="button button-dark" type="submit">Войти</button>
        <p class="form-status" id="login-status" role="status"></p>
      </form>
    `;
    return;
  }

  const notifications = Array.isArray(state.account.notifications) && state.account.notifications.length
    ? state.account.notifications.map(notification => `
      <li>
        <div>
          <strong>${escapeHtml(notification.title || "Уведомление")}</strong>
          <span>${escapeHtml(notification.message || "")}</span>
          <small>${escapeHtml(formatDateTime(notification.created_at))}</small>
        </div>
        ${notification.payment_url ? `<a class="mini-button payment-link" href="${escapeHtml(notification.payment_url)}">Оплатить</a>` : ""}
      </li>
    `).join("")
    : "";

  const orders = state.account.orders.length
    ? state.account.orders.map(order => `
      <li>
        <div>
          <strong>Заказ #${order.order_id}</strong>
          <span>${escapeHtml(order.status)} · ${escapeHtml(formatDateTime(order.created_at))}</span>
          ${order.payment_url && order.status !== "paid" ? `<small><a href="${escapeHtml(order.payment_url)}">Ссылка на оплату</a></small>` : ""}
        </div>
        <strong>${formatPrice(order.total_amount)}</strong>
      </li>
    `).join("")
    : "<li>Заказов пока нет</li>";

  accountContent.innerHTML = `
    <div class="account-summary">
      <div class="profile-icon small" aria-hidden="true">◎</div>
      <div>
        <p class="eyebrow">личный кабинет</p>
        <h3>${escapeHtml(state.account.name)}</h3>
        <p>${escapeHtml(state.account.email)}</p>
        <span class="role-chip">${escapeHtml(state.account.role === "admin" ? "Администратор" : "Пользователь")}</span>
      </div>
    </div>
    <div class="account-card">
      <h3>Информация</h3>
      <p>Город: ${escapeHtml(state.session.city || "не выбран")}</p>
      <p>Заказов: ${state.account.orders.length}</p>
      <p>${state.account.loyalty_card ? "Карта лояльности оформлена" : "Карта лояльности пока не оформлена"}</p>
      ${state.account.role === "admin" ? `<button class="button button-dark logout-button" type="button" data-open-admin>Открыть админ-панель</button>` : ""}
      <button class="button button-light logout-button" type="button" data-logout>Выйти</button>
    </div>
    ${loyaltyCardTemplate(state.account.loyalty_card)}
    ${notifications ? `
      <div class="account-notice" role="status" aria-live="polite">
        <h3>Оповещения</h3>
        <ul class="drawer-list">${notifications}</ul>
      </div>
    ` : ""}
    <h3>Последние заказы</h3>
    <ul class="drawer-list">${orders}</ul>
  `;
}

function renderCart() {
  if (!state.cart.items.length) {
    cartContent.innerHTML = '<p class="empty-state">Корзина пока пустая.</p>';
    return;
  }

  const items = state.cart.items.map(item => `
    <li>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.quantity} шт. · ${formatPrice(item.price)}</span>
      </div>
      <button class="mini-button" type="button" data-remove-cart="${item.product_id}" aria-label="Удалить ${escapeHtml(item.name)} из корзины">Удалить</button>
    </li>
  `).join("");

  cartContent.innerHTML = `
    <ul class="drawer-list">${items}</ul>
    <div class="drawer-total">
      <span>Итого</span>
      <strong>${formatPrice(state.cart.total)}</strong>
    </div>
    <button class="button button-dark checkout-button" type="button" data-open-drawer="checkout">Оформить заказ</button>
  `;
}

function renderFavorites() {
  if (!state.favorites.length) {
    favoritesContent.innerHTML = '<p class="empty-state">В избранном пока нет товаров.</p>';
    return;
  }

  favoritesContent.innerHTML = `
    <ul class="drawer-list">
      ${state.favorites.map(item => `
        <li>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.description)}</span>
          </div>
          <button class="mini-button" type="button" data-remove-favorite="${item.product_id}" aria-label="Удалить ${escapeHtml(item.name)} из избранного">Удалить</button>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderProduct(productId) {
  const product = state.products.find(item => item.product_id === Number(productId));
  if (!product) {
    return;
  }

  const favorite = isFavorite(product.product_id);
  const reviews = productReviews(product.product_id);
  const canReview = state.account && state.account.role !== "guest";

  productContent.innerHTML = `
    <div class="account-card product-detail-card">
      <button class="favorite ${favorite ? "is-favorite" : ""}" type="button" data-toggle-favorite="${product.product_id}" aria-label="${favorite ? "Убрать" : "Добавить"} ${escapeHtml(product.name)} в избранное">${favorite ? "♥" : "♡"}</button>
      <div class="product-art ${escapeHtml(product.color || "peach")} ${product.image_url ? "has-image" : ""}" role="img" aria-label="${escapeHtml(product.name)}">
        ${productImage(product)}
      </div>
      <h3>${escapeHtml(product.name)}</h3>
      <div class="chips-row">
        ${product.brand ? `<span class="brand-chip">${escapeHtml(product.brand)}</span>` : ""}
        ${product.shop ? `<span class="shop-chip">${escapeHtml(product.shop)}</span>` : ""}
      </div>
      <button class="stars-button" type="button" aria-label="Рейтинг ${averageRating(product)} из 5">${makeStars(averageRating(product))}</button>
      ${productDetailsTemplate(product)}
      <strong>${formatPrice(product.price)}</strong>
      <button class="button button-dark card-action" type="button" data-add-cart="${product.product_id}">В корзину</button>
    </div>
    <div class="review-panel">
      <h3>Отзывы</h3>
      ${reviews.length ? reviews.map(reviewItemTemplate).join("") : `<p class="empty-state">Отзывов пока нет. Можно быть первой.</p>`}
      ${canReview ? `
        <form id="review-form" class="drawer-form review-form" data-product-id="${product.product_id}">
          <label>Ваша оценка</label>
          <div class="rating-picker" aria-label="Поставить оценку">
            ${[1, 2, 3, 4, 5].map(value => `<button type="button" class="${value <= state.reviewRating ? "is-active" : ""}" data-review-star="${value}" aria-label="${value} из 5">★</button>`).join("")}
          </div>
          <label for="review-text">Отзыв</label>
          <textarea id="review-text" name="text" rows="4" placeholder="Что понравилось в товаре" minlength="5" required></textarea>
          <button class="button button-dark" type="submit">Оставить отзыв</button>
          <p class="form-status" id="review-status" role="status"></p>
        </form>
      ` : `<p class="empty-state">Войдите как пользователь, чтобы поставить звезды и оставить отзыв.</p>`}
    </div>
  `;
  openDrawer("product");
}

function renderAdmin() {
  if (!adminContent) {
    return;
  }

  const orders = state.orders.length
    ? state.orders.map(order => `
      <li>
        <div>
          <strong>#${order.order_id} · ${escapeHtml(order.status)}</strong>
          <span>${escapeHtml(order.name || order.user_name || "Клиент")} · ${formatPrice(order.total_amount || 0)}</span>
          <small>${escapeHtml(order.pickup_address || "")}</small>
        </div>
        ${order.status === "new" ? `<button class="mini-button" type="button" data-accept-order="${order.order_id}">Accept</button>` : ""}
      </li>
    `).join("")
    : "<li>Заказов нет</li>";

  const reviews = state.reviews.length
    ? [...state.reviews].sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0)).map(review => {
      const deleted = review.status === "deleted";
      return `
      <li class="${deleted ? "is-deleted" : ""}">
        <div>
          <strong>${escapeHtml(review.product_name || "Товар")} · ${deleted ? "удален администратором" : makeStars(review.rating)}</strong>
          <span>${deleted ? "Текст отзыва скрыт после удаления." : escapeHtml(review.text)}</span>
          <small>
            ${escapeHtml(review.user_name || "Пользователь")} · ${escapeHtml(formatDateTime(review.created_at))}
            ${deleted ? ` · удалено ${escapeHtml(review.deleted_by_name || "администратором")} ${escapeHtml(formatDateTime(review.deleted_at))}` : ""}
          </small>
          ${reviewRepliesTemplate(review)}
          ${reviewReplyFormTemplate(review)}
        </div>
        ${deleted ? `<span class="status-pill">Удален</span>` : `<button class="mini-button danger-button" type="button" data-delete-review="${review.review_id}" aria-label="Удалить отзыв о ${escapeHtml(review.product_name || "товаре")}">Удалить</button>`}
      </li>
    `;
    }).join("")
    : "<li>Отзывов пока нет</li>";

  const supportTickets = state.supportTickets.length
    ? state.supportTickets.map(ticket => `
      <li>
        <div>
          <strong>${escapeHtml(ticket.subject || "Обращение")}</strong>
          <span>${escapeHtml(ticket.name || "Клиент")} · ${escapeHtml(ticket.email || "")}</span>
          <small>${escapeHtml(ticket.message || "")}</small>
        </div>
        <span class="status-pill">${escapeHtml(ticket.status || "new")}</span>
      </li>
    `).join("")
    : "<li>Обращений пока нет</li>";

  const editingProduct = state.products.find(product => product.product_id === state.adminEditingProductId);
  const productFormTitle = editingProduct ? "Редактирование карточки товара" : "Создание новой карточки товара";
  const productFormButton = editingProduct ? "Сохранить изменения" : "Добавить карточку";
  const products = state.products.map(product => `
    <li class="admin-product-item">
      <img src="${escapeHtml(product.image_url || "")}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.hidden=true">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.brand || "")} · ${escapeHtml(product.shop || "")}</span>
        <small>${escapeHtml(product.category || "Без категории")} · ${escapeHtml(product.texture || "")} · ${formatPrice(product.price)}</small>
      </div>
      <div class="admin-product-actions">
        <button class="mini-button" type="button" data-edit-product="${product.product_id}">Редактировать</button>
        <button class="mini-button danger-button" type="button" data-delete-product="${product.product_id}">Удалить</button>
      </div>
    </li>
  `).join("");
  const pendingOrdersCount = state.orders.filter(order => order.status === "new").length;
  const tabs = [
    { id: "reviews", label: "Отзывы", count: state.reviews.length },
    { id: "product", label: "Новая карточка" },
    { id: "support", label: "Тех поддержка", count: state.supportTickets.length },
    { id: "orders", label: "Заказы", count: pendingOrdersCount }
  ];

  const activeSection = {
    reviews: `
      <section class="admin-panel admin-area">
        <p class="area-label">Панель управления</p>
        <h3>Отзывы</h3>
        <ul class="drawer-list">${reviews}</ul>
      </section>
    `,
    product: `
      <section class="admin-panel admin-area">
        <p class="area-label">Панель управления</p>
        <h3>${productFormTitle}</h3>
        <form id="admin-product-form" class="drawer-form" data-product-id="${editingProduct ? editingProduct.product_id : ""}">
          <input name="name" type="text" placeholder="Название" minlength="2" value="${escapeHtml(editingProduct?.name || "")}" required>
          <input name="brand" type="text" placeholder="Бренд" minlength="2" value="${escapeHtml(editingProduct?.brand || "")}" required>
          <input name="shop" type="text" placeholder="Магазин" minlength="2" value="${escapeHtml(editingProduct?.shop || "")}" required>
          <input name="price" type="number" min="1" max="100000" step="1" placeholder="Цена" value="${escapeHtml(editingProduct?.price || "")}" required>
          <input name="category_id" type="number" min="1" max="7" step="1" placeholder="ID категории 1-7" value="${escapeHtml(editingProduct?.category_id || "")}" required>
          <input name="texture" type="text" placeholder="Текстура" minlength="2" value="${escapeHtml(editingProduct?.texture || "")}" required>
          <input name="image_url" type="text" placeholder="Ссылка на фото или /assets/products/product-001.svg" value="${escapeHtml(editingProduct?.image_url || "")}">
          <textarea name="description" rows="3" placeholder="Описание" minlength="10" required>${escapeHtml(editingProduct?.description || "")}</textarea>
          <textarea name="ingredients" rows="3" placeholder="Состав">${escapeHtml(editingProduct?.ingredients || "")}</textarea>
          <textarea name="application" rows="3" placeholder="Способ применения">${escapeHtml(editingProduct?.application || "")}</textarea>
          <textarea name="effect" rows="3" placeholder="Результат/эффект">${escapeHtml(editingProduct?.effect || "")}</textarea>
          <input name="skin_type" type="text" placeholder="Тип кожи или зона ухода" value="${escapeHtml(editingProduct?.skin_type || "")}">
          <button class="button button-dark" type="submit">${productFormButton}</button>
          ${editingProduct ? `<button class="button button-light" type="button" data-cancel-product-edit>Отменить редактирование</button>` : ""}
          <p class="form-status" id="admin-product-status" role="status"></p>
        </form>
        <h3 class="admin-products-title">Товары в каталоге</h3>
        <ul class="drawer-list compact-list admin-products-list">${products}</ul>
      </section>
    `,
    support: `
      <section class="admin-panel admin-area">
        <p class="area-label">Панель управления</p>
        <h3>Техническая поддержка</h3>
        <ul class="drawer-list">${supportTickets}</ul>
      </section>
    `,
    orders: `
      <section class="admin-panel admin-area">
        <p class="area-label">Панель управления</p>
        <h3>Заказы</h3>
        <ul class="drawer-list">${orders}</ul>
      </section>
    `
  }[state.adminTab] || "";

  adminContent.innerHTML = `
    <div class="admin-tabs" aria-label="Панель управления администратора">
      ${tabs.map(tab => `
        <button class="${state.adminTab === tab.id ? "is-active" : ""}" type="button" data-admin-tab="${tab.id}">
          <span>${escapeHtml(tab.label)}</span>
          ${typeof tab.count === "number" ? `<strong>${tab.count}</strong>` : ""}
        </button>
      `).join("")}
    </div>
    <div class="admin-areas">
      ${activeSection}
    </div>
  `;
}

function renderCounters() {
  cartCount.textContent = state.cart.count;
  favoritesCount.textContent = state.favorites.length;
}

function renderCheckoutLoyaltyField() {
  if (!checkoutLoyaltyField || !checkoutBarcodeInput) {
    return;
  }

  const hasLoyaltyCard = Boolean(state.account && state.account.role !== "guest" && state.account.loyalty_card);
  const loyaltyBarcode = hasLoyaltyCard ? String(state.account.loyalty_card.barcode || "") : "";
  checkoutLoyaltyField.hidden = !hasLoyaltyCard;
  checkoutBarcodeInput.required = hasLoyaltyCard;
  checkoutBarcodeInput.disabled = !hasLoyaltyCard;
  checkoutBarcodeInput.readOnly = hasLoyaltyCard;
  checkoutBarcodeInput.value = loyaltyBarcode;
  checkoutBarcodeInput.title = hasLoyaltyCard
    ? "Штрихкод карты лояльности заполнен автоматически"
    : "";
}

function lastKnownOrder() {
  if (state.account?.last_checkout) {
    return state.account.last_checkout;
  }

  const orders = Array.isArray(state.account?.orders) ? [...state.account.orders] : [];
  return orders.sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0))[0] || null;
}

function fillUserField(input, value, { force = false } = {}) {
  if (!input || value === undefined || value === null) {
    return;
  }

  const current = String(input.value || "").trim();
  if (force || !current || current === "+7") {
    input.value = input.type === "tel" ? normalizeRussianPhone(value) : String(value);
  }
}

function fillKnownUserData(scope = "checkout") {
  const user = state.account && state.account.role !== "guest" ? state.account : null;
  const lastOrder = user ? lastKnownOrder() : null;
  const loyalty = user?.loyalty_card || null;

  if (scope === "checkout") {
    fillUserField(checkoutEmailInput, lastOrder?.email || user?.email);
    fillUserField(checkoutNameInput, lastOrder?.name || user?.name);
    fillUserField(checkoutPhoneInput, lastOrder?.phone || loyalty?.phone || "+7 ");
    fillUserField(checkoutAddressInput, lastOrder?.pickup_address);
    ensureRussianPhonePrefix();
    fillCheckoutCity();
    renderCheckoutLoyaltyField();
  }

  if (scope === "support") {
    fillUserField(supportNameInput, user?.name);
    fillUserField(supportEmailInput, user?.email);
  }

  if (scope === "loyalty") {
    fillUserField(loyaltyNameInput, loyalty?.name || user?.name);
    fillUserField(loyaltyPhoneInput, loyalty?.phone || lastOrder?.phone || "+7 ");
    fillUserField(loyaltyEmailInput, loyalty?.email || user?.email);
  }
}

function fillCheckoutCity() {
  if (!checkoutAddressInput) {
    return;
  }

  const city = String(state.session?.city || "").trim();
  const currentValue = checkoutAddressInput.value.trim();
  if (city && (!currentValue || currentValue === "Город, улица, дом, пункт выдачи")) {
    checkoutAddressInput.value = `${city}, `;
  }
}

function renderPriceRange() {
  if (priceRange && priceValue) {
    priceValue.textContent = `до ${formatPrice(state.maxPrice)}`;
  }
}

function syncFilterState() {
  state.categories = new Set(Array.from(categoryFilters).filter(input => input.checked).map(input => input.value));
  state.textures = new Set(Array.from(textureFilters).filter(input => input.checked).map(input => input.value));
}

function renderCity() {
  cityLabel.textContent = state.session.city || "Выберите город";
}

function renderAll() {
  renderPriceRange();
  renderCity();
  renderProducts();
  renderAccount();
  renderCart();
  renderFavorites();
  renderCounters();
  renderCheckoutLoyaltyField();
}

async function refreshProducts() {
  state.products = await loadProductsSafe();
  renderProducts();
}

async function refreshSession() {
  state.session = await api("/api/session");
  state.account = await api("/api/account");
  renderCity();
  renderAccount();
  renderCheckoutLoyaltyField();
}

async function refreshCart() {
  state.cart = await api("/api/cart");
  renderCart();
  renderCounters();
}

async function refreshFavorites() {
  state.favorites = await api("/api/favorites");
  renderFavorites();
  renderProducts();
  renderCounters();
}

async function refreshReviews() {
  state.reviews = await api("/api/reviews");
}

async function refreshAdmin() {
  try {
    const [orders, reviews, supportTickets] = await Promise.all([api("/api/orders"), api("/api/reviews"), api("/api/support")]);
    state.orders = orders;
    state.reviews = reviews;
    state.supportTickets = supportTickets;
    renderAdmin();
  } catch (error) {
    if (adminContent) {
      adminContent.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
  }
}

function openDrawer(name) {
  const drawer = document.querySelector(`#drawer-${name}`);
  if (!drawer) {
    return;
  }

  const wasConsultant = state.activeDrawer && state.activeDrawer.id === "drawer-consultant";
  closeDrawer({ resetConsultant: name !== "product" });
  if (wasConsultant && name === "product") {
    resetConsultantState();
  }
  state.activeDrawer = drawer;
  drawerBackdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  drawer.removeAttribute("inert");
  document.body.classList.add("drawer-lock");
  requestAnimationFrame(() => {
    drawerBackdrop.classList.add("is-open");
    drawer.classList.add("is-open");
  });
}

function openModal(name) {
  const modal = document.querySelector(`#modal-${name}`);
  if (!modal) {
    return;
  }

  closeDrawer();
  if (name === "loyalty") {
    fillKnownUserData("loyalty");
  }
  state.activeDrawer = modal;
  drawerBackdrop.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  modal.removeAttribute("inert");
  document.body.classList.add("drawer-lock");
  requestAnimationFrame(() => {
    drawerBackdrop.classList.add("is-open");
    modal.classList.add("is-open");
  });
}

function closeDrawer(options = {}) {
  const shouldResetConsultant = options.resetConsultant !== false
    && state.activeDrawer
    && state.activeDrawer.id === "drawer-consultant";

  if (state.activeDrawer) {
    state.activeDrawer.classList.remove("is-open");
    state.activeDrawer.setAttribute("aria-hidden", "true");
    state.activeDrawer.setAttribute("inert", "");
  }

  if (shouldResetConsultant) {
    resetConsultantState();
  }

  state.activeDrawer = null;
  drawerBackdrop.classList.remove("is-open");
  document.body.classList.remove("drawer-lock");
  setTimeout(() => {
    if (!state.activeDrawer) {
      drawerBackdrop.hidden = true;
    }
  }, 260);
}

async function loadInitialData() {
  const [products, session, account, cart, favorites, reviews] = await Promise.all([
    loadProductsSafe(),
    api("/api/session"),
    api("/api/account"),
    api("/api/cart"),
    api("/api/favorites"),
    api("/api/reviews")
  ]);

  state.products = products;
  state.session = session;
  state.account = account;
  state.cart = cart;
  state.favorites = favorites;
  state.reviews = reviews;
  renderAll();
}

if (productsContainer) {
  productsContainer.addEventListener("click", event => {
    if (event.target.closest("[data-add-cart], [data-toggle-favorite], [data-add-favorite], input, textarea, select")) {
      return;
    }

    const productCard = event.target.closest(".product-card[data-open-product]");
    if (!productCard) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openProductCard(productCard.dataset.openProduct);
  });
}

document.addEventListener("click", async event => {
  const drawerButton = event.target.closest("[data-open-drawer]");
  const modalButton = event.target.closest("[data-open-modal]");
  const closeButton = event.target.closest("[data-close-drawer]");
  const addCartButton = event.target.closest("[data-add-cart]");
  const favoriteButton = event.target.closest("[data-toggle-favorite], [data-add-favorite]");
  const removeCartButton = event.target.closest("[data-remove-cart]");
  const removeFavoriteButton = event.target.closest("[data-remove-favorite]");
  const cityButton = event.target.closest("[data-city]");
  const logoutButton = event.target.closest("[data-logout]");
  const productButton = event.target.closest("[data-open-product]");
  const roleButton = event.target.closest("[data-account-role]");
  const reviewStar = event.target.closest("[data-review-star]");
  const openAdmin = event.target.closest("[data-open-admin]");
  const adminTab = event.target.closest("[data-admin-tab]");
  const acceptOrder = event.target.closest("[data-accept-order]");
  const editProduct = event.target.closest("[data-edit-product]");
  const cancelProductEdit = event.target.closest("[data-cancel-product-edit]");
  const deleteProduct = event.target.closest("[data-delete-product]");
  const loyaltyCardButton = event.target.closest("[data-toggle-loyalty-card]");
  const deleteReview = event.target.closest("[data-delete-review]");
  const consultantOption = event.target.closest("[data-consultant-option]");
  const consultantSkip = event.target.closest("[data-consultant-skip]");

  try {
    if (event.target.closest("[data-add-cart], [data-toggle-favorite], [data-add-favorite], [data-remove-cart], [data-remove-favorite]")) {
      event.stopPropagation();
    }

    if (roleButton) {
      state.accountMode = roleButton.dataset.accountRole;
      renderAccount();
      return;
    }

    if (drawerButton) {
      if (drawerButton.dataset.openDrawer === "checkout") {
        fillKnownUserData("checkout");
      }
      if (drawerButton.dataset.openDrawer === "support") {
        fillKnownUserData("support");
      }
      if (drawerButton.dataset.openDrawer === "consultant" && !state.consultantMessages.length) {
        resetConsultant();
      }
      openDrawer(drawerButton.dataset.openDrawer);
      return;
    }

    if (modalButton) {
      openModal(modalButton.dataset.openModal);
      return;
    }

    if (openAdmin) {
      await refreshAdmin();
      openDrawer("admin");
      return;
    }

    if (adminTab) {
      state.adminTab = adminTab.dataset.adminTab;
      renderAdmin();
      return;
    }

    if (closeButton || event.target === drawerBackdrop) {
      closeDrawer();
      return;
    }

    if (productButton && !event.target.closest("[data-add-cart], [data-toggle-favorite], [data-add-favorite], [data-remove-cart], [data-remove-favorite]")) {
      openProductCard(productButton.dataset.openProduct);
      return;
    }

    if (reviewStar) {
      state.reviewRating = Number(reviewStar.dataset.reviewStar);
      productContent.querySelectorAll("[data-review-star]").forEach(button => {
        button.classList.toggle("is-active", Number(button.dataset.reviewStar) <= state.reviewRating);
      });
      return;
    }

    if (consultantOption) {
      answerConsultantQuestion(consultantOption.dataset.consultantOption);
      return;
    }

    if (consultantSkip) {
      answerConsultantQuestion("", true);
      return;
    }

    if (cityButton) {
      state.session = await api("/api/city", {
        method: "POST",
        body: JSON.stringify({ city: cityButton.dataset.city })
      });
      renderCity();
      cityStatus.textContent = `Город изменен: ${state.session.city}`;
      if (citySearch) {
        citySearch.value = "";
        filterCityList("");
      }
      return;
    }

    if (logoutButton) {
      await api("/api/logout", { method: "POST" });
      state.accountMode = "guest";
      await Promise.all([refreshSession(), refreshCart(), refreshFavorites()]);
      return;
    }

    if (addCartButton) {
      await api("/api/cart", {
        method: "POST",
        body: JSON.stringify({ product_id: Number(addCartButton.dataset.addCart) })
      });
      await refreshCart();
      openDrawer("cart");
      return;
    }

    if (favoriteButton) {
      const productId = Number(favoriteButton.dataset.toggleFavorite || favoriteButton.dataset.addFavorite);
      await api("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ product_id: productId })
      });
      await refreshFavorites();
      return;
    }

    if (removeCartButton) {
      await api(`/api/cart/${removeCartButton.dataset.removeCart}`, { method: "DELETE" });
      await refreshCart();
      return;
    }

    if (removeFavoriteButton) {
      await api(`/api/favorites/${removeFavoriteButton.dataset.removeFavorite}`, { method: "DELETE" });
      await refreshFavorites();
      return;
    }

    if (acceptOrder) {
      await api(`/api/orders/${acceptOrder.dataset.acceptOrder}/accept`, { method: "POST" });
      await refreshAdmin();
      return;
    }

    if (editProduct) {
      state.adminEditingProductId = Number(editProduct.dataset.editProduct);
      renderAdmin();
      return;
    }

    if (cancelProductEdit) {
      state.adminEditingProductId = null;
      renderAdmin();
      return;
    }

    if (deleteProduct) {
      await api(`/api/products/${deleteProduct.dataset.deleteProduct}`, { method: "DELETE" });
      if (state.adminEditingProductId === Number(deleteProduct.dataset.deleteProduct)) {
        state.adminEditingProductId = null;
      }
      await refreshProducts();
      await refreshAdmin();
      return;
    }

    if (deleteReview) {
      await api(`/api/reviews/${deleteReview.dataset.deleteReview}`, { method: "DELETE" });
      await refreshReviews();
      renderProducts();
      await refreshAdmin();
      return;
    }

    if (loyaltyCardButton) {
      const flipped = loyaltyCardButton.classList.toggle("is-flipped");
      loyaltyCardButton.setAttribute("aria-pressed", String(flipped));
    }
  } catch (error) {
    alert(error.message);
  }
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const productCard = event.target.closest(".product-card[data-open-product]");
  if (!productCard || event.target.closest("button, a, input, textarea")) {
    return;
  }

  event.preventDefault();
  openProductCard(productCard.dataset.openProduct);
});

document.addEventListener("mouseover", event => {
  const peekButton = event.target.closest("[data-password-peek]");
  if (!peekButton) {
    return;
  }

  const input = document.querySelector(`#${CSS.escape(peekButton.dataset.passwordPeek)}`);
  if (input) {
    input.type = "text";
  }
});

document.addEventListener("mouseout", event => {
  const peekButton = event.target.closest("[data-password-peek]");
  if (!peekButton) {
    return;
  }

  const input = document.querySelector(`#${CSS.escape(peekButton.dataset.passwordPeek)}`);
  if (input) {
    input.type = "password";
  }
});

document.addEventListener("focusin", event => {
  const peekButton = event.target.closest("[data-password-peek]");
  if (!peekButton) {
    return;
  }

  const input = document.querySelector(`#${CSS.escape(peekButton.dataset.passwordPeek)}`);
  if (input) {
    input.type = "text";
  }
});

document.addEventListener("focusout", event => {
  const peekButton = event.target.closest("[data-password-peek]");
  if (!peekButton) {
    return;
  }

  const input = document.querySelector(`#${CSS.escape(peekButton.dataset.passwordPeek)}`);
  if (input) {
    input.type = "password";
  }
});

document.addEventListener("submit", async event => {
  const loginForm = event.target.closest("#login-form");
  const registerForm = event.target.closest("#register-form");
  const reviewForm = event.target.closest("#review-form");
  const replyForm = event.target.closest("[data-review-reply-form]");
  const adminProductForm = event.target.closest("#admin-product-form");

  if (!loginForm && !registerForm && !reviewForm && !replyForm && !adminProductForm) {
    return;
  }

  event.preventDefault();
  if (!validateForm(event.target)) {
    return;
  }

  const formData = Object.fromEntries(new FormData(event.target).entries());

  try {
    if (loginForm || registerForm) {
      const status = loginForm ? document.querySelector("#login-status") : document.querySelector("#register-status");
      status.textContent = "";
      await api(loginForm ? "/api/login" : "/api/register", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      await Promise.all([refreshSession(), refreshCart(), refreshFavorites()]);
      status.textContent = loginForm ? "Вы вошли в аккаунт." : "Аккаунт создан.";
      return;
    }

    if (reviewForm) {
      const status = document.querySelector("#review-status");
      const productId = Number(reviewForm.dataset.productId);
      status.textContent = "";
      await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, rating: state.reviewRating, text: formData.text })
      });
      await refreshReviews();
      renderProducts();
      renderProduct(productId);
      return;
    }

    if (replyForm) {
      const status = replyForm.querySelector(".form-status");
      const reviewId = Number(replyForm.dataset.reviewReplyForm);
      const review = state.reviews.find(item => item.review_id === reviewId);
      status.textContent = "";
      await api(`/api/reviews/${reviewId}/replies`, {
        method: "POST",
        body: JSON.stringify({ text: formData.text })
      });
      replyForm.reset();
      await refreshReviews();
      renderProducts();
      if (review?.product_id && state.activeDrawer?.id === "drawer-product") {
        renderProduct(review.product_id);
      }
      if (state.activeDrawer?.id === "drawer-admin") {
        await refreshAdmin();
      }
      return;
    }

    if (adminProductForm) {
      const status = document.querySelector("#admin-product-status");
      status.textContent = "";
      const editingId = Number(adminProductForm.dataset.productId || state.adminEditingProductId || 0);
      await api(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(formData)
      });
      state.adminEditingProductId = null;
      adminProductForm.reset();
      await refreshProducts();
      await refreshAdmin();
      const updatedStatus = document.querySelector("#admin-product-status");
      if (updatedStatus) {
        updatedStatus.textContent = editingId ? "Товар обновлен." : "Товар добавлен.";
      }
    }
  } catch (error) {
    const status = event.target.querySelector(".form-status");
    if (status) {
      status.textContent = error.message;
    } else {
      alert(error.message);
    }
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDrawer();
  }
});

if (supportForm) {
  supportForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validateForm(supportForm)) {
      return;
    }

    supportStatus.textContent = "";
    const formData = Object.fromEntries(new FormData(supportForm).entries());

    try {
      await api("/api/support", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      supportForm.reset();
      supportStatus.textContent = "Обращение отправлено. Мы скоро ответим.";
    } catch (error) {
      supportStatus.textContent = error.message;
    }
  });
}

if (consultantForm) {
  consultantForm.addEventListener("submit", event => {
    event.preventDefault();
    const value = consultantAnswer ? consultantAnswer.value : "";
    const question = currentConsultantQuestion();
    const isFirstZoneQuestion = question?.key === "zone" && state.consultantStep === 0 && !state.consultantQuickMode;
    const isTypedFreeQuery = isFirstZoneQuestion
      && String(value || "").trim()
      && !question.options.some(option => option.toLowerCase() === String(value).trim().toLowerCase());

    if (isTypedFreeQuery) {
      startConsultantFromFreeQuery(value);
      return;
    }

    answerConsultantQuestion(value);
  });
}

function filterCityList(query) {
  const normalized = query.trim().toLowerCase();
  document.querySelectorAll("[data-city]").forEach(button => {
    const city = button.dataset.city.toLowerCase();
    button.hidden = normalized && !city.includes(normalized);
  });
}

if (citySearch) {
  citySearch.addEventListener("input", event => {
    filterCityList(event.target.value);
  });
}

function ensureRussianPhonePrefix() {
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    const value = input.value.trim();
    if (!value || value === "+") {
      input.value = "+7 ";
    }
  });
}

function normalizePhoneField(event) {
  const input = event.target;
  input.value = normalizeRussianPhone(input.value);
  setFieldValidity(input);
}

document.querySelectorAll('input[type="tel"]').forEach(input => {
  if (!input.value.trim()) {
    input.value = "+7 ";
  }

  input.addEventListener("focus", ensureRussianPhonePrefix);
  input.addEventListener("input", normalizePhoneField);
  input.addEventListener("blur", normalizePhoneField);
});

document.addEventListener("input", event => {
  if (event.target.matches("input, textarea")) {
    setFieldValidity(event.target);
  }
});

document.addEventListener("invalid", event => {
  if (event.target.matches("input, textarea")) {
    setFieldValidity(event.target);
  }
}, true);

if (requestForm) {
  requestForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validateForm(requestForm)) {
      return;
    }

    requestStatus.textContent = "";
    const formData = Object.fromEntries(new FormData(requestForm).entries());

    try {
      await api("/api/product-requests", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      requestForm.reset();
      requestStatus.textContent = "Заявка отправлена администратору.";
    } catch (error) {
      requestStatus.textContent = error.message;
    }
  });
}

if (loyaltyForm) {
  loyaltyForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validateForm(loyaltyForm)) {
      return;
    }

    loyaltyStatus.textContent = "";
    const formData = Object.fromEntries(new FormData(loyaltyForm).entries());

    try {
      await api("/api/loyalty", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      loyaltyForm.reset();
      await refreshSession();
      loyaltyStatus.textContent = "Карта оформлена и добавлена в Account.";
    } catch (error) {
      loyaltyStatus.textContent = error.message;
    }
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validateForm(checkoutForm)) {
      return;
    }

    checkoutStatus.textContent = "";
    const formData = Object.fromEntries(new FormData(checkoutForm).entries());

    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      checkoutForm.reset();
      ensureRussianPhonePrefix();
      renderCheckoutLoyaltyField();
      fillCheckoutCity();
      checkoutStatus.textContent = "Заказ создан и отправлен администратору.";
      await Promise.all([refreshCart(), refreshSession()]);
    } catch (error) {
      checkoutStatus.textContent = error.message;
    }
  });
}

if (priceRange) {
  state.maxPrice = Number(priceRange.value);
  renderPriceRange();

  priceRange.addEventListener("input", event => {
    state.maxPrice = Number(event.target.value);
    renderPriceRange();
    renderProducts();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", event => {
    state.search = event.target.value;
    renderProducts();
  });
}

categoryFilters.forEach(input => {
  input.addEventListener("change", () => {
    syncFilterState();
    renderProducts();
  });
});

textureFilters.forEach(input => {
  input.addEventListener("change", () => {
    syncFilterState();
    renderProducts();
  });
});

syncFilterState();

loadInitialData().catch(error => {
  productsContainer.innerHTML = `<p class="loading-message">Не удалось загрузить каталог. Запустите сайт через backend: <strong>node server.js</strong>, затем откройте <strong>http://localhost:3000</strong>. Детали: ${escapeHtml(error.message)}</p>`;
});

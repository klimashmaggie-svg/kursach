const http = require("http");
const fs = require("fs");
const net = require("net");
const path = require("path");
const tls = require("tls");

const PORT = 3000;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data.json");
const ENV_PATH = path.join(ROOT, ".env");

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return;
  }

  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isPhone(value) {
  return /^\+?[0-9\s().-]{10,20}$/.test(String(value || "").trim());
}

function hasMinLength(value, length) {
  return String(value || "").trim().length >= length;
}

function isValidUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return true;
  }

  if (text.startsWith("/assets/")) {
    return true;
  }

  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function productsWithCategory(data) {
  return data.products.map(product => {
    const category = data.categories.find(item => item.category_id === product.category_id);
    return {
      ...product,
      category: category ? category.name : "Без категории",
      ingredients: product.ingredients || product.composition || "Вода, глицерин, растительные экстракты, натуральные масла, витамин E, мягкая парфюмерная композиция.",
      application: product.application || product.usage || "Нанесите небольшое количество на чистую кожу мягкими массажными движениями. Используйте утром и/или вечером.",
      composition: product.composition || product.ingredients || "Вода, глицерин, растительные экстракты, натуральные масла, витамин E, мягкая парфюмерная композиция.",
      usage: product.usage || product.application || "Нанесите небольшое количество на чистую кожу мягкими массажными движениями. Используйте утром и/или вечером.",
      effect: product.effect || "Помогает поддерживать увлажнение, мягкость и ухоженный вид кожи.",
      skin_type: product.skin_type || "Подходит для ежедневного ухода."
    };
  });
}

function currentUser(data) {
  return data.users.find(user => user.user_id === data.currentUserId) || null;
}

function isAdmin(data) {
  const user = currentUser(data);
  return Boolean(user && user.role === "admin");
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

function guestAccount(data) {
  return {
    user_id: null,
    name: "Гость",
    email: "",
    role: "guest",
    orders: [],
    city: data.city
  };
}

function accountDetails(data) {
  const user = currentUser(data);
  if (!user) {
    return guestAccount(data);
  }

  const safeUser = publicUser(user);
  const orderIds = user.orders || [];
  safeUser.orders = ordersDetails(data).filter(order => orderIds.includes(order.order_id));
  safeUser.notifications = (safeUser.notifications || []).sort((first, second) => {
    return new Date(second.created_at || 0) - new Date(first.created_at || 0);
  });
  return safeUser;
}

function makeLoyaltyNumber(userId) {
  const base = String(userId || Date.now()).replace(/\D/g, "").slice(-8).padStart(8, "0");
  return `AK${base}`;
}

function makePaymentUrl(req, orderId) {
  const host = req.headers.host || `localhost:${PORT}`;
  return `http://${host}/pay?order=${encodeURIComponent(orderId)}`;
}

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 0);
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

function encodeBase64(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

function smtpSendCommand(socket, command, expected = [250]) {
  return new Promise((resolve, reject) => {
    let response = "";

    const onData = chunk => {
      response += chunk.toString("utf8");
      const lines = response.trimEnd().split(/\r?\n/);
      const last = lines[lines.length - 1] || "";
      if (!/^\d{3} /.test(last)) {
        return;
      }

      socket.off("data", onData);
      const code = Number(last.slice(0, 3));
      if (!expected.includes(code)) {
        reject(new Error(`SMTP error ${code}: ${response.trim()}`));
        return;
      }

      resolve(response);
    };

    socket.on("data", onData);
    if (command) {
      socket.write(`${command}\r\n`);
    }
  });
}

function smtpConnect(config) {
  return new Promise((resolve, reject) => {
    const socket = config.port === 465
      ? tls.connect(config.port, config.host, { servername: config.host })
      : net.connect(config.port, config.host);

    socket.setTimeout(15000);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("SMTP connection timeout")));
    smtpSendCommand(socket, null, [220])
      .then(() => resolve(socket))
      .catch(reject);
  });
}

async function sendEmailViaSmtp({ to, subject, text }) {
  const config = smtpConfig();
  if (!config) {
    return { status: "skipped", detail: "SMTP is not configured" };
  }

  let socket = await smtpConnect(config);

  try {
    await smtpSendCommand(socket, `EHLO localhost`);

    if (config.port !== 465) {
      await smtpSendCommand(socket, "STARTTLS", [220]);
      socket = tls.connect({ socket, servername: config.host });
      await smtpSendCommand(socket, `EHLO localhost`);
    }

    await smtpSendCommand(socket, "AUTH LOGIN", [334]);
    await smtpSendCommand(socket, encodeBase64(config.user), [334]);
    await smtpSendCommand(socket, encodeBase64(config.pass), [235]);
    await smtpSendCommand(socket, `MAIL FROM:<${config.user}>`);
    await smtpSendCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpSendCommand(socket, "DATA", [354]);

    const headers = [
      `From: ${config.from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${encodeBase64(subject)}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit"
    ].join("\r\n");
    const body = `${headers}\r\n\r\n${text}\r\n.`;

    await smtpSendCommand(socket, body);
    await smtpSendCommand(socket, "QUIT", [221]);
    return { status: "sent", detail: "sent via SMTP" };
  } finally {
    socket.end();
  }
}

async function sendPaymentMail(data, order, paymentUrl) {
  const createdAt = new Date().toISOString();
  const subject = `Ссылка на оплату заказа #${order.order_id}`;
  const text = `Здравствуйте, ${order.name || "клиент"}!\n\nВаш заказ #${order.order_id} подтвержден администратором.\nСсылка на оплату: ${paymentUrl}\n\nA.Klimasy Cosmetic`;
  let delivery = { status: "skipped", detail: "SMTP is not configured" };

  try {
    delivery = await sendEmailViaSmtp({ to: order.email, subject, text });
  } catch (error) {
    delivery = { status: "failed", detail: error.message || "SMTP error" };
  }

  const message = {
    email_id: Date.now(),
    to: order.email,
    subject,
    text,
    order_id: order.order_id,
    payment_url: paymentUrl,
    status: delivery.status,
    detail: delivery.detail,
    created_at: createdAt
  };

  data.emailOutbox = data.emailOutbox || [];
  data.emailOutbox.push(message);
  return message;
}

function notifyPaymentLink(data, order, paymentUrl) {
  const user = data.users.find(item => item.user_id === order.user_id);
  if (!user) {
    return null;
  }

  const notification = {
    notification_id: Date.now(),
    type: "payment",
    title: `Заказ #${order.order_id} подтвержден`,
    message: `Ссылка на оплату отправлена на ${order.email}.`,
    order_id: order.order_id,
    payment_url: paymentUrl,
    read: false,
    created_at: new Date().toISOString()
  };

  user.notifications = user.notifications || [];
  user.notifications.unshift(notification);
  return notification;
}

function markOrderPaid(data, orderId) {
  const order = (data.orders || []).find(item => item.order_id === orderId);
  if (!order) {
    return null;
  }

  order.status = "paid";
  order.paid_at = order.paid_at || new Date().toISOString();
  const user = data.users.find(item => item.user_id === order.user_id);
  if (user) {
    user.notifications = (user.notifications || []).filter(notification => {
      return !(notification.type === "payment" && Number(notification.order_id) === Number(orderId));
    });
  }

  writeData(data);
  return order;
}

function cartDetails(data) {
  const user = currentUser(data);
  const cart = user ? user.cart : [];
  const products = productsWithCategory(data);
  const items = cart
    .map(item => {
      const product = products.find(entry => entry.product_id === item.product_id);
      if (!product) {
        return null;
      }

      return {
        ...product,
        quantity: item.quantity,
        line_total: product.price * item.quantity
      };
    })
    .filter(Boolean);

  return {
    items,
    total: items.reduce((sum, item) => sum + item.line_total, 0),
    count: items.reduce((sum, item) => sum + item.quantity, 0)
  };
}

function ordersDetails(data) {
  return (data.orders || []).map(order => {
    const user = data.users.find(item => item.user_id === order.user_id);
    const items = order.items.map(item => {
      const product = data.products.find(productItem => productItem.product_id === item.product_id);
      return {
        ...item,
        name: product ? product.name : "Товар удален"
      };
    });

    return {
      ...order,
      user_name: user ? user.name : "Гость",
      items
    };
  });
}

function reviewsDetails(data) {
  return (data.reviews || [])
    .map(review => {
      const user = data.users.find(item => item.user_id === review.user_id);
      const product = data.products.find(item => item.product_id === review.product_id);
      const deletedBy = data.users.find(item => item.user_id === review.deleted_by);
      const replies = (review.replies || []).map(reply => {
        const replyUser = data.users.find(item => item.user_id === reply.user_id);
        return {
          ...reply,
          user_name: reply.user_name || (replyUser ? replyUser.name : "Пользователь"),
          role: reply.role || (replyUser ? replyUser.role : "user")
        };
      });

      return {
        ...review,
        replies,
        user_name: review.user_name || (user ? user.name : "Гость"),
        product_name: product ? product.name : "Товар удален",
        deleted_by_name: deletedBy ? deletedBy.name : ""
      };
    })
    .sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0));
}

function favoriteDetails(data) {
  const user = currentUser(data);
  const favorites = user ? user.favorites : [];
  const products = productsWithCategory(data);
  return favorites
    .map(productId => products.find(product => product.product_id === productId))
    .filter(Boolean);
}

function sessionDetails(data) {
  return {
    city: data.city,
    user: publicUser(currentUser(data))
  };
}

async function handleApi(req, res, url) {
  const data = readData();
  const pathname = url.pathname.endsWith("/") && url.pathname !== "/"
    ? url.pathname.slice(0, -1)
    : url.pathname;

  if (req.method === "GET" && pathname === "/api/products") {
    sendJson(res, 200, productsWithCategory(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/products") {
    if (!isAdmin(data)) {
      sendError(res, 403, "Доступно только администратору");
      return;
    }

    const body = await readRequestBody(req);
    const name = String(body.name || "").trim();
    const brand = String(body.brand || "Новый бренд").trim();
    const shop = String(body.shop || "A.Klimasy Cosmetic").trim();
    const description = String(body.description || "Описание товара").trim();
    const texture = String(body.texture || "Крем").trim();
    const ingredients = String(body.ingredients || "").trim();
    const application = String(body.application || "").trim();
    const effect = String(body.effect || "").trim();
    const skinType = String(body.skin_type || "").trim();
    const imageUrl = String(body.image_url || "").trim();
    const price = Number(body.price);
    const categoryId = Number(body.category_id);

    if (!hasMinLength(name, 2) || !hasMinLength(brand, 2) || !hasMinLength(shop, 2) || !hasMinLength(texture, 2) || !hasMinLength(description, 10)) {
      sendError(res, 400, "Заполните название, бренд, магазин, текстуру и описание товара");
      return;
    }

    if (!Number.isFinite(price) || price < 1 || price > 100000 || !Number.isInteger(categoryId) || categoryId < 1 || categoryId > 7) {
      sendError(res, 400, "Проверьте цену и категорию товара");
      return;
    }

    if (!isValidUrl(imageUrl)) {
      sendError(res, 400, "Ссылка на фото должна начинаться с http или https");
      return;
    }

    const product = {
      product_id: Math.max(0, ...data.products.map(item => item.product_id)) + 1,
      name,
      brand,
      shop,
      description,
      price,
      category_id: categoryId,
      texture,
      rating: 5,
      color: String(body.color || "peach").trim(),
      image_url: imageUrl,
      ingredients: ingredients || "Вода, глицерин, растительные экстракты, натуральные масла, витамин E.",
      application: application || "Нанесите на чистую кожу мягкими массажными движениями. Используйте ежедневно.",
      composition: ingredients || "Вода, глицерин, растительные экстракты, натуральные масла, витамин E.",
      usage: application || "Нанесите на чистую кожу мягкими массажными движениями. Используйте ежедневно.",
      effect: effect || "Увлажняет, смягчает и помогает коже выглядеть более ухоженной.",
      skin_type: skinType || "Подходит для ежедневного ухода."
    };

    data.products.push(product);
    writeData(data);
    sendJson(res, 201, product);
    return;
  }

  if ((req.method === "PUT" || req.method === "DELETE") && pathname.startsWith("/api/products/")) {
    if (!isAdmin(data)) {
      sendError(res, 403, "Доступно только администратору");
      return;
    }

    const productId = Number(pathname.split("/").pop());
    const product = data.products.find(item => item.product_id === productId);

    if (!product) {
      sendError(res, 404, "Product not found");
      return;
    }

    if (req.method === "DELETE") {
      data.products = data.products.filter(item => item.product_id !== productId);
      writeData(data);
      sendJson(res, 200, productsWithCategory(data));
      return;
    }

    const body = await readRequestBody(req);
    const updated = {
      name: String(body.name ?? product.name).trim(),
      brand: String(body.brand ?? product.brand ?? "").trim(),
      shop: String(body.shop ?? product.shop ?? "").trim(),
      description: String(body.description ?? product.description).trim(),
      price: Number(body.price ?? product.price),
      category_id: Number(body.category_id ?? product.category_id),
      texture: String(body.texture ?? product.texture).trim(),
      image_url: String(body.image_url ?? product.image_url ?? "").trim(),
      ingredients: String(body.ingredients ?? product.ingredients ?? "").trim(),
      application: String(body.application ?? product.application ?? "").trim(),
      composition: String(body.ingredients ?? product.composition ?? product.ingredients ?? "").trim(),
      usage: String(body.application ?? product.usage ?? product.application ?? "").trim(),
      effect: String(body.effect ?? product.effect ?? "").trim(),
      skin_type: String(body.skin_type ?? product.skin_type ?? "").trim()
    };

    if (!hasMinLength(updated.name, 2) || !hasMinLength(updated.brand, 2) || !hasMinLength(updated.shop, 2) || !hasMinLength(updated.texture, 2) || !hasMinLength(updated.description, 10)) {
      sendError(res, 400, "Заполните название, бренд, магазин, текстуру и описание товара");
      return;
    }

    if (!Number.isFinite(updated.price) || updated.price < 1 || updated.price > 100000 || !Number.isInteger(updated.category_id) || updated.category_id < 1 || updated.category_id > 7) {
      sendError(res, 400, "Проверьте цену и категорию товара");
      return;
    }

    if (!isValidUrl(updated.image_url)) {
      sendError(res, 400, "Ссылка на фото должна начинаться с http или https");
      return;
    }

    Object.assign(product, updated);
    writeData(data);
    sendJson(res, 200, product);
    return;
  }

  if (req.method === "GET" && pathname === "/api/session") {
    sendJson(res, 200, sessionDetails(data));
    return;
  }

  if (req.method === "GET" && pathname === "/api/account") {
    sendJson(res, 200, accountDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readRequestBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = data.users.find(item => item.email.toLowerCase() === email && item.password === password);

    if (!user) {
      sendError(res, 401, "Неверный email или пароль");
      return;
    }

    data.currentUserId = user.user_id;
    writeData(data);
    sendJson(res, 200, sessionDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/register") {
    const body = await readRequestBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!hasMinLength(name, 2) || !isEmail(email) || password.length < 5) {
      sendError(res, 400, "Введите имя от 2 символов, корректный email и пароль от 5 символов");
      return;
    }

    if (data.users.some(user => user.email.toLowerCase() === email)) {
      sendError(res, 409, "Пользователь с таким email уже есть");
      return;
    }

    const user = {
      user_id: Date.now(),
      username: email.split("@")[0],
      name,
      email,
      password,
      role: "user",
      cart: [],
      favorites: [],
      orders: []
    };

    data.users.push(user);
    data.currentUserId = user.user_id;
    writeData(data);
    sendJson(res, 201, sessionDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    data.currentUserId = null;
    writeData(data);
    sendJson(res, 200, sessionDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/loyalty") {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт, чтобы карта появилась в личном кабинете");
      return;
    }

    const body = await readRequestBody(req);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!hasMinLength(name, 2) || !isPhone(phone) || !isEmail(email)) {
      sendError(res, 400, "Введите имя, корректный телефон и email");
      return;
    }

    user.loyalty_card = {
      card_id: user.loyalty_card?.card_id || makeLoyaltyNumber(user.user_id),
      name,
      phone,
      email,
      discount: 15,
      barcode: user.loyalty_card?.barcode || `462${String(user.user_id).replace(/\D/g, "").slice(-9).padStart(9, "0")}`,
      created_at: user.loyalty_card?.created_at || new Date().toISOString()
    };

    writeData(data);
    sendJson(res, 201, user.loyalty_card);
    return;
  }

  if (req.method === "POST" && pathname === "/api/city") {
    const body = await readRequestBody(req);
    const allowedCities = [
      "Москва",
      "Санкт-Петербург",
      "Казань",
      "Екатеринбург",
      "Новосибирск",
      "Нижний Новгород",
      "Самара",
      "Ростов-на-Дону",
      "Краснодар",
      "Уфа",
      "Пермь",
      "Красноярск",
      "Воронеж",
      "Волгоград",
      "Сочи",
      "Тюмень",
      "Омск",
      "Челябинск",
      "Иркутск",
      "Владивосток"
    ];
    const city = String(body.city || "").trim();

    if (!allowedCities.includes(city)) {
      sendError(res, 400, "Выберите город из списка");
      return;
    }

    data.city = city;
    writeData(data);
    sendJson(res, 200, sessionDetails(data));
    return;
  }

  if (req.method === "GET" && pathname === "/api/cart") {
    sendJson(res, 200, cartDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/cart") {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт, чтобы добавить товар в корзину");
      return;
    }

    const body = await readRequestBody(req);
    const productId = Number(body.product_id);
    const product = data.products.find(item => item.product_id === productId);

    if (!product) {
      sendError(res, 404, "Product not found");
      return;
    }

    const existing = user.cart.find(item => item.product_id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      user.cart.push({ product_id: productId, quantity: 1 });
    }

    writeData(data);
    sendJson(res, 200, cartDetails(data));
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/cart/")) {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт");
      return;
    }

    const productId = Number(pathname.split("/").pop());
    user.cart = user.cart.filter(item => item.product_id !== productId);
    writeData(data);
    sendJson(res, 200, cartDetails(data));
    return;
  }

  if (req.method === "GET" && pathname === "/api/favorites") {
    sendJson(res, 200, favoriteDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/favorites") {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт, чтобы добавить товар в избранное");
      return;
    }

    const body = await readRequestBody(req);
    const productId = Number(body.product_id);
    const product = data.products.find(item => item.product_id === productId);

    if (!product) {
      sendError(res, 404, "Product not found");
      return;
    }

    if (user.favorites.includes(productId)) {
      user.favorites = user.favorites.filter(item => item !== productId);
    } else {
      user.favorites.push(productId);
    }

    writeData(data);
    sendJson(res, 200, favoriteDetails(data));
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/favorites/")) {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт");
      return;
    }

    const productId = Number(pathname.split("/").pop());
    user.favorites = user.favorites.filter(item => item !== productId);
    writeData(data);
    sendJson(res, 200, favoriteDetails(data));
    return;
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    if (!isAdmin(data)) {
      const user = currentUser(data);
      sendJson(res, 200, user ? ordersDetails(data).filter(order => order.user_id === user.user_id) : []);
      return;
    }

    sendJson(res, 200, ordersDetails(data));
    return;
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт, чтобы оформить заказ");
      return;
    }

    const cart = cartDetails(data);
    if (!cart.items.length) {
      sendError(res, 400, "Корзина пустая");
      return;
    }

    const body = await readRequestBody(req);
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const name = String(body.name || "").trim();
    const pickupAddress = String(body.pickup_address || "").trim();
    const loyaltyBarcode = String(body.loyalty_barcode || "").replace(/\D/g, "");

    if (!isEmail(email) || !isPhone(phone) || !hasMinLength(name, 2) || !hasMinLength(pickupAddress, 8)) {
      sendError(res, 400, "Заполните данные для оформления заказа");
      return;
    }

    if (user.loyalty_card) {
      const expectedBarcode = String(user.loyalty_card.barcode || "").replace(/\D/g, "");
      if (!loyaltyBarcode || loyaltyBarcode !== expectedBarcode) {
        sendError(res, 400, "Введите корректный номер штрихкода карты лояльности");
        return;
      }
    }

    const order = {
      order_id: Date.now(),
      user_id: user.user_id,
      items: cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      })),
      total_amount: cart.total,
      status: "new",
      email,
      phone,
      name,
      pickup_address: pickupAddress,
      loyalty_barcode: user.loyalty_card ? loyaltyBarcode : "",
      loyalty_discount: user.loyalty_card ? 15 : 0,
      created_at: new Date().toISOString()
    };

    data.orders = data.orders || [];
    data.orders.push(order);
    user.orders = user.orders || [];
    user.orders.push(order.order_id);
    user.last_checkout = {
      email,
      phone,
      name,
      pickup_address: pickupAddress,
      updated_at: order.created_at
    };
    user.cart = [];
    writeData(data);
    sendJson(res, 201, order);
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/orders/") && pathname.endsWith("/accept")) {
    if (!isAdmin(data)) {
      sendError(res, 403, "Доступно только администратору");
      return;
    }

    const orderId = Number(pathname.split("/")[3]);
    const order = (data.orders || []).find(item => item.order_id === orderId);

    if (!order) {
      sendError(res, 404, "Order not found");
      return;
    }

    order.status = "accepted";
    order.accepted_at = new Date().toISOString();
    order.payment_url = order.payment_url || makePaymentUrl(req, order.order_id);
    order.payment_email_sent_at = new Date().toISOString();
    const emailMessage = await sendPaymentMail(data, order, order.payment_url);
    order.payment_email_status = emailMessage.status;
    order.payment_email_detail = emailMessage.detail;
    notifyPaymentLink(data, order, order.payment_url);
    writeData(data);
    sendJson(res, 200, order);
    return;
  }

  if (req.method === "GET" && pathname === "/api/reviews") {
    sendJson(res, 200, reviewsDetails(data));
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/reviews/")) {
    if (!isAdmin(data)) {
      sendError(res, 403, "Доступно только администратору");
      return;
    }

    const reviewId = Number(pathname.split("/").pop());
    const review = (data.reviews || []).find(item => item.review_id === reviewId);

    if (!review) {
      sendError(res, 404, "Review not found");
      return;
    }

    const admin = currentUser(data);
    review.status = "deleted";
    review.deleted_by = admin ? admin.user_id : null;
    review.deleted_at = new Date().toISOString();
    writeData(data);
    sendJson(res, 200, reviewsDetails(data));
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/reviews/") && pathname.endsWith("/replies")) {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт, чтобы ответить на отзыв");
      return;
    }

    const reviewId = Number(pathname.split("/")[3]);
    const review = (data.reviews || []).find(item => item.review_id === reviewId);
    if (!review) {
      sendError(res, 404, "Review not found");
      return;
    }

    if (review.status === "deleted") {
      sendError(res, 400, "Нельзя ответить на удаленный отзыв");
      return;
    }

    const body = await readRequestBody(req);
    const text = String(body.text || "").trim();
    if (!hasMinLength(text, 3)) {
      sendError(res, 400, "Напишите ответ от 3 символов");
      return;
    }

    review.replies = review.replies || [];
    review.replies.push({
      reply_id: Date.now(),
      user_id: user.user_id,
      user_name: user.name,
      role: user.role,
      text,
      created_at: new Date().toISOString()
    });

    writeData(data);
    sendJson(res, 201, reviewsDetails(data).find(item => item.review_id === reviewId));
    return;
  }

  if (req.method === "GET" && pathname === "/api/support") {
    if (!isAdmin(data)) {
      sendError(res, 403, "Доступно только администратору");
      return;
    }

    sendJson(res, 200, (data.supportTickets || []).slice().reverse());
    return;
  }

  if (req.method === "POST" && pathname === "/api/reviews") {
    const user = currentUser(data);
    if (!user) {
      sendError(res, 401, "Войдите в аккаунт, чтобы оставить отзыв");
      return;
    }

    const body = await readRequestBody(req);
    const productId = Number(body.product_id);
    const rating = Number(body.rating);
    const text = String(body.text || "").trim();

    if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 5) {
      sendError(res, 400, "Поставьте оценку и напишите отзыв");
      return;
    }

    const review = {
      review_id: Date.now(),
      user_id: user.user_id,
      product_id: productId,
      rating,
      text,
      status: "new",
      created_at: new Date().toISOString()
    };

    data.reviews = data.reviews || [];
    data.reviews.push(review);
    writeData(data);
    sendJson(res, 201, review);
    return;
  }

  if (req.method === "POST" && pathname === "/api/support") {
    const body = await readRequestBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!hasMinLength(name, 2) || !isEmail(email) || !hasMinLength(subject, 3) || !hasMinLength(message, 10)) {
      sendError(res, 400, "Заполните имя, email, тему и сообщение поддержки");
      return;
    }

    const ticket = {
      ticket_id: Date.now(),
      user_id: currentUser(data) ? currentUser(data).user_id : null,
      subject,
      message,
      email,
      name,
      status: "new",
      created_at: new Date().toISOString()
    };

    data.supportTickets.push(ticket);
    writeData(data);
    sendJson(res, 201, ticket);
    return;
  }

  if (req.method === "POST" && pathname === "/api/product-requests") {
    const body = await readRequestBody(req);
    const productName = String(body.product_name || "").trim();
    const description = String(body.description || "").trim();

    if (!hasMinLength(productName, 2) || !hasMinLength(description, 10)) {
      sendError(res, 400, "Заполните название товара и описание заявки");
      return;
    }

    const request = {
      request_id: Date.now(),
      user_id: currentUser(data) ? currentUser(data).user_id : null,
      product_name: productName,
      description,
      status: "new",
      created_at: new Date().toISOString()
    };

    data.productRequests.push(request);
    writeData(data);
    sendJson(res, 201, request);
    return;
  }

  sendError(res, 404, "API route not found");
}

function serveStatic(req, res, url) {
  if (url.pathname === "/pay") {
    const orderId = url.searchParams.get("order") || "";
    const numericOrderId = Number(orderId);
    const data = readData();
    const paidOrder = Number.isFinite(numericOrderId) ? markOrderPaid(data, numericOrderId) : null;
    const paymentText = paidOrder
      ? `Заказ #${paidOrder.order_id} оплачен. Ссылка на оплату заказа отправлена на почту.`
      : `Заказ #${String(orderId).replace(/[<>&"']/g, "")} готов к оплате.`;
    const content = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Оплата заказа A.Klimasy Cosmetic</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf7f1;color:#1f1b18;font-family:Arial,sans-serif}
    main{width:min(520px,calc(100% - 32px));padding:32px;border:1px solid #dfd0c3;border-radius:14px;background:white;box-shadow:0 20px 60px rgba(72,49,35,.12)}
    h1{margin:0 0 12px;font-family:Georgia,serif;font-size:42px;line-height:1}
    p{font-size:18px;line-height:1.45;color:#6b5f55}
    a{display:inline-flex;margin-top:12px;padding:14px 22px;border-radius:8px;background:#050505;color:white;text-decoration:none;font-weight:800}
  </style>
</head>
<body>
  <main>
    <h1>Оплата заказа</h1>
    <p>${paymentText}</p>
    <a href="/">Вернуться в магазин</a>
  </main>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(content);
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestPath));

  if (!filePath.startsWith(ROOT)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendError(res, 404, "File not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    sendError(res, 500, error.message || "Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`A.Klimasy Cosmetic is running at http://localhost:${PORT}`);
});

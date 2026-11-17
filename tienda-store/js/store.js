const DEFAULT_PRODUCTS = [
  { id: 101, sku: "SKU-4012", brand: "COSTEÑO", name: "Arroz Extra Bolsa 5 kg", category: "Abarrotes", emoji: "🍚", oldPrice: 24.90, price: 19.50 },
  { id: 102, sku: "SKU-4018", brand: "GLORIA", name: "Pack 6 Leche Evaporada Entera 400 g", category: "Lacteos", emoji: "🥛", oldPrice: 26.40, price: 21.90 },
  { id: 103, sku: "SKU-4025", brand: "PRIMOR", name: "Aceite Vegetal Clásico Botella 900 ml", category: "Abarrotes", emoji: "🫒", oldPrice: 11.50, price: 8.90 },
  { id: 104, sku: "SKU-4031", brand: "SAN FERNANDO", name: "Pechuga Especial de Pollo Bandeja 1 kg", category: "Frescos", emoji: "🍗", oldPrice: 18.90, price: 14.90 },
  { id: 105, sku: "SKU-4040", brand: "INCA KOLA", name: "Gaseosa Sabor Original Botella 3 L", category: "Bebidas", emoji: "🥤", oldPrice: null, price: 11.50 },
  { id: 106, sku: "SKU-4052", brand: "BOLÍVAR", name: "Detergente en Polvo Floral Bolsa 2.6 kg", category: "Limpieza", emoji: "🧼", oldPrice: 32.00, price: 24.90 },
  { id: 107, sku: "SKU-4066", brand: "LAIVE", name: "Yogurt Bebible Fresa Galonera 1.8 kg", category: "Lacteos", emoji: "🍓", oldPrice: 14.20, price: 11.20 },
  { id: 108, sku: "SKU-4079", brand: "GLORIA", name: "Mantequilla con Sal Barra 200 g", category: "Lacteos", emoji: "🧈", oldPrice: null, price: 7.80 }
];

const Store = {
  // Inicializa la cuenta maestro con contraseña hasheada SHA-256
  async initSecurity() {
    let users = JSON.parse(localStorage.getItem("tottus_users"));
    if (!users || users.length === 0) {
      const adminHash = await Security.hashSHA256("Admin1234");
      users = [{
        name: "Administrador Maestro",
        dni: "00000000",
        email: "admin@tottus.pe",
        passwordHash: adminHash,
        role: "admin"
      }];
      localStorage.setItem("tottus_users", JSON.stringify(users));
    }
  },

  getProducts() {
    const data = localStorage.getItem("tottus_products");
    if (!data) {
      localStorage.setItem("tottus_products", JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    return JSON.parse(data);
  },

  saveProducts(products) {
    localStorage.setItem("tottus_products", JSON.stringify(products));
  },

  getUsers() {
    return JSON.parse(localStorage.getItem("tottus_users")) || [];
  },

  saveUsers(users) {
    localStorage.setItem("tottus_users", JSON.stringify(users));
  },

  // Crea una sesión con Token, Timestamp de expiración y Firma de integridad
  async createSession(user) {
    const token = Security.generateSecureToken();
    const csrfToken = Security.generateSecureToken();
    const expiresAt = Date.now() + Security.SESSION_TTL_MS;
    const signature = await Security.hashSHA256(`${user.email}|${user.role}|${token}|${expiresAt}`);

    const sessionPayload = {
      name: user.name,
      email: user.email,
      role: user.role,
      token,
      csrfToken,
      expiresAt,
      signature
    };
    sessionStorage.setItem("tottus_active_session", JSON.stringify(sessionPayload));
    Security.logEvent("LOGIN_SUCCESS", `Inicio de sesión: ${user.email} (${user.role})`);
  },

  // Verifica que la sesión no haya expirado ni haya sido manipulada
  async getValidSession() {
    const raw = sessionStorage.getItem("tottus_active_session");
    if (!raw) return null;

    try {
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        this.destroySession();
        Security.logEvent("SESSION_EXPIRED", `Sesión expirada para ${session.email}`);
        return null;
      }

      const expectedSig = await Security.hashSHA256(`${session.email}|${session.role}|${session.token}|${session.expiresAt}`);
      if (session.signature !== expectedSig) {
        this.destroySession();
        Security.logEvent("SECURITY_ALERT", `Manipulación de sesión detectada para ${session.email}`);
        return null;
      }
      return session;
    } catch {
      this.destroySession();
      return null;
    }
  },

  destroySession() {
    sessionStorage.removeItem("tottus_active_session");
  },

  getPromoText() {
    return localStorage.getItem("tottus_promo") || "¡OFERTA DE LA SEMANA! Envío GRATIS por compras mayores a S/ 99.00";
  },

  setPromoText(text) {
    localStorage.setItem("tottus_promo", text);
  },

  getCart() {
    return JSON.parse(localStorage.getItem("tottus_cart")) || [];
  },

  saveCart(cart) {
    localStorage.setItem("tottus_cart", JSON.stringify(cart));
  },

  addToCart(productId) {
    const products = this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const cart = this.getCart();
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.qty += 1;
    else cart.push({ ...product, qty: 1 });

    this.saveCart(cart);
  }
};
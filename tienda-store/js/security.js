/**
 * Módulo de Seguridad Frontend (Estándares OWASP)
 * - Sanitización Anti-XSS
 * - Hashing SHA-256 con Web Crypto API
 * - Rate Limiting (Anti Fuerza Bruta)
 * - Algoritmo de Luhn (Validación PCI-DSS básica)
 * - Tokens Anti-CSRF y control de expiración de sesión
 */
const Security = {
  SALT: "TOTTUS_SEC_2026_PERU_#99!",
  SESSION_TTL_MS: 30 * 60 * 1000, // 30 minutos de expiración de sesión
  MAX_LOGIN_ATTEMPTS: 3,
  LOCKOUT_TIME_MS: 60 * 1000,     // 60 segundos de bloqueo

  // 1. Sanitización estricta contra inyección HTML/XSS
  escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  // 2. Hash SHA-256 asíncrono para contraseñas y firmas de integridad
  async hashSHA256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + this.SALT);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  },

  // 3. Generador de tokens aleatorios criptográficamente seguros (CSRF / Session ID)
  generateSecureToken() {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
  },

  // 4. Protección contra ataques de fuerza bruta en el Login
  checkLoginRateLimit() {
    const state = JSON.parse(localStorage.getItem("sec_login_attempts")) || { count: 0, lockUntil: 0 };
    const now = Date.now();
    if (state.lockUntil > now) {
      const secondsLeft = Math.ceil((state.lockUntil - now) / 1000);
      return { blocked: true, secondsLeft };
    }
    return { blocked: false, secondsLeft: 0 };
  },

  recordFailedLogin() {
    const state = JSON.parse(localStorage.getItem("sec_login_attempts")) || { count: 0, lockUntil: 0 };
    state.count += 1;
    if (state.count >= this.MAX_LOGIN_ATTEMPTS) {
      state.lockUntil = Date.now() + this.LOCKOUT_TIME_MS;
      state.count = 0;
    }
    localStorage.setItem("sec_login_attempts", JSON.stringify(state));
  },

  resetLoginAttempts() {
    localStorage.removeItem("sec_login_attempts");
  },

  // 5. Validación de contraseña robusta (mínimo 8 caracteres, 1 mayúscula, 1 número)
  isStrongPassword(password) {
    const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  },

  // 6. Algoritmo de Luhn para validar tarjetas de crédito/débito
  validateCardLuhn(cardNumber) {
    const clean = cardNumber.replace(/\D/g, "");
    if (clean.length < 13 || clean.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
  },

  // 7. Registro de auditoría (Security Audit Log)
  logEvent(eventType, details) {
    const logs = JSON.parse(localStorage.getItem("sec_audit_logs")) || [];
    logs.unshift({
      timestamp: new Date().toISOString(),
      event: eventType,
      details: this.escapeHTML(details)
    });
    // Mantener solo los últimos 50 eventos
    localStorage.setItem("sec_audit_logs", JSON.stringify(logs.slice(0, 50)));
  }
};
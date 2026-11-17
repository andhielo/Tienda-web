document.addEventListener("DOMContentLoaded", async () => {
  await Store.initSecurity();

  // Actualizar texto informativo de contraseña segura
  const infoNote = document.querySelector(".info-note");
  if (infoNote) {
    infoNote.innerHTML = `
      <strong>Acceso Cuenta Maestro (Admin):</strong><br>
      Correo: <code>admin@tottus.pe</code> | Contraseña: <code>Admin1234</code>
    `;
  }

  // Iniciar Sesión con Protección Fuerza Bruta
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";

    // 1. Verificar bloqueo temporal por intentos fallidos
    const rateCheck = Security.checkLoginRateLimit();
    if (rateCheck.blocked) {
      errorEl.textContent = `Demasiados intentos fallidos. Espera ${rateCheck.secondsLeft} segundos.`;
      return;
    }

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const inputHash = await Security.hashSHA256(password);

    const users = Store.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email && u.passwordHash === inputHash);

    if (!user) {
      Security.recordFailedLogin();
      Security.logEvent("LOGIN_FAILED", `Intento fallido para: ${email}`);
      errorEl.textContent = "Credenciales inválidas. Verifica tu correo y contraseña.";
      return;
    }

    Security.resetLoginAttempts();
    await Store.createSession(user);

    if (user.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "index.html";
    }
  });

  // Registro con Validación de Contraseña Robusta
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("reg-error");
    errorEl.textContent = "";

    const name = document.getElementById("reg-name").value.trim();
    const dni = document.getElementById("reg-dni").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const password = document.getElementById("reg-password").value;

    if (!/^\d{8}$/.test(dni)) {
      errorEl.textContent = "El DNI debe contener exactamente 8 dígitos numéricos.";
      return;
    }

    if (!Security.isStrongPassword(password)) {
      errorEl.textContent = "La contraseña debe tener mínimo 8 caracteres, una letra mayúscula y un número.";
      return;
    }

    const users = Store.getUsers();
    if (users.some(u => u.email.toLowerCase() === email)) {
      errorEl.textContent = "Este correo electrónico ya está registrado.";
      return;
    }

    const passwordHash = await Security.hashSHA256(password);
    const newUser = { name, dni, email, passwordHash, role: "customer" };

    users.push(newUser);
    Store.saveUsers(users);
    await Store.createSession(newUser);

    Security.logEvent("USER_REGISTERED", `Nuevo cliente registrado: ${email}`);
    alert("Cuenta creada de forma segura.");
    window.location.href = "index.html";
  });
});
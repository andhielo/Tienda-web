document.addEventListener("DOMContentLoaded", async () => {
  await Store.initSecurity();

  const cartListEl = document.getElementById("checkout-cart-list");
  const subtotalEl = document.getElementById("summary-subtotal");
  const shippingEl = document.getElementById("summary-shipping");
  const totalEl = document.getElementById("summary-total");
  const shippingHintEl = document.getElementById("shipping-hint");
  const errorEl = document.getElementById("checkout-error");

  const session = await Store.getValidSession();
  if (session) {
    document.getElementById("ship-name").value = session.name;
  }

  const cardNumberInput = document.getElementById("card-number");
  cardNumberInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 16);
    e.target.value = val.replace(/(.{4})/g, "$1 ").trim();
  });

  const cardExpInput = document.getElementById("card-exp");
  cardExpInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 4);
    if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);
    e.target.value = val;
  });

  document.querySelectorAll("input[name='payment_method']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      document.getElementById("method-card-box").classList.add("hidden");
      document.getElementById("method-yape-box").classList.add("hidden");
      document.getElementById("method-cash-box").classList.add("hidden");
      document.getElementById(`method-${e.target.value}-box`).classList.remove("hidden");
    });
  });

  function renderCheckoutCart() {
    const cart = Store.getCart();
    cartListEl.innerHTML = "";

    if (cart.length === 0) {
      cartListEl.innerHTML = `<p>No tienes productos en tu carrito. <a href="index.html">Volver al catálogo</a></p>`;
      subtotalEl.textContent = "S/ 0.00";
      shippingEl.textContent = "S/ 0.00";
      totalEl.textContent = "S/ 0.00";
      shippingHintEl.textContent = "";
      return;
    }

    let subtotal = 0;

    cart.forEach(item => {
      subtotal += item.price * item.qty;
      const row = document.createElement("div");
      row.className = "checkout-cart-row";
      row.innerHTML = `
        <div>
          <strong>${Security.escapeHTML(item.emoji)} ${Security.escapeHTML(item.name)}</strong>
          <div style="font-size:11px; color:#666;">Marca: ${Security.escapeHTML(item.brand)} | Unitario: S/ ${Number(item.price).toFixed(2)}</div>
        </div>
        <div class="qty-controls">
          <button type="button" class="btn-minus">-</button>
          <span>${item.qty}</span>
          <button type="button" class="btn-plus">+</button>
        </div>
        <div>
          <strong>S/ ${(item.price * item.qty).toFixed(2)}</strong>
        </div>
      `;

      row.querySelector(".btn-minus").addEventListener("click", () => updateItemQty(item.id, -1));
      row.querySelector(".btn-plus").addEventListener("click", () => updateItemQty(item.id, 1));
      cartListEl.appendChild(row);
    });

    const shipping = subtotal >= 99 ? 0 : 10.00;
    const total = subtotal + shipping;

    subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
    shippingEl.textContent = shipping === 0 ? "GRATIS (S/ 0.00)" : `S/ ${shipping.toFixed(2)}`;
    totalEl.textContent = `S/ ${total.toFixed(2)}`;

    shippingHintEl.textContent = shipping === 0
      ? "✓ ¡Felicidades! Tu pedido califica para envío GRATIS."
      : `Agrega S/ ${(99 - subtotal).toFixed(2)} más para obtener envío GRATIS.`;
  }

  function updateItemQty(id, delta) {
    const cart = Store.getCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    Store.saveCart(cart);
    renderCheckoutCart();
  }

  // Procesar Pago con Validaciones de Seguridad
  document.getElementById("confirm-payment-btn").addEventListener("click", async () => {
    errorEl.textContent = "";
    const cart = Store.getCart();

    if (cart.length === 0) {
      errorEl.textContent = "Tu carrito está vacío.";
      return;
    }

    const activeSession = await Store.getValidSession();
    if (!activeSession) {
      alert("Tu sesión ha expirado o no has iniciado sesión. Serás redirigido al acceso seguro.");
      window.location.href = "login.html";
      return;
    }

    const shipName = document.getElementById("ship-name").value.trim();
    const shipPhone = document.getElementById("ship-phone").value.trim();
    const shipDistrict = document.getElementById("ship-district").value;
    const shipAddress = document.getElementById("ship-address").value.trim();

    if (!shipName || !shipAddress || !/^\d{9}$/.test(shipPhone.replace(/\s/g, ""))) {
      errorEl.textContent = "Completa los datos de entrega (el teléfono debe tener 9 dígitos).";
      return;
    }

    const method = document.querySelector("input[name='payment_method']:checked").value;
    let paymentLabel = "";

    if (method === "card") {
      const cardNum = cardNumberInput.value.replace(/\s/g, "");
      const holder = document.getElementById("card-holder").value.trim();
      const exp = cardExpInput.value.trim();
      const cvv = document.getElementById("card-cvv").value.trim();

      // Validación matemática de tarjeta mediante Algoritmo de Luhn
      if (!Security.validateCardLuhn(cardNum)) {
        errorEl.textContent = "Número de tarjeta inválido (falló verificación de seguridad Luhn).";
        return;
      }
      if (!holder || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp) || !/^\d{3}$/.test(cvv)) {
        errorEl.textContent = "Verifica el titular, fecha de vencimiento (MM/AA) y código CVV (3 dígitos).";
        return;
      }

      // Enmascaramiento PCI-DSS: solo conservamos los últimos 4 dígitos
      paymentLabel = `Tarjeta autorizada **** **** **** ${cardNum.slice(-4)}`;
      cardNumberInput.value = "";
      document.getElementById("card-cvv").value = "";
    } else if (method === "yape") {
      const code = document.getElementById("yape-code").value.trim();
      if (!/^\d{6}$/.test(code)) {
        errorEl.textContent = "Ingresa un código de operación válido de 6 dígitos.";
        return;
      }
      paymentLabel = `Yape / Plin (Operación #${code})`;
    } else {
      paymentLabel = "Pago Contra Entrega (POS Inalámbrico)";
    }

    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const shipping = subtotal >= 99 ? 0 : 10.00;
    const total = subtotal + shipping;
    const orderNumber = "BOL-" + Math.floor(100000 + Math.random() * 900000);
    const authHash = (await Security.hashSHA256(`${orderNumber}|${total}|${activeSession.email}`)).slice(0, 16).toUpperCase();
    const now = new Date().toLocaleString("es-PE");

    Security.logEvent("PAYMENT_COMPLETED", `Orden ${orderNumber} por S/ ${total.toFixed(2)} - Usuario: ${activeSession.email}`);

    document.getElementById("checkout-main-container").classList.add("hidden");
    document.getElementById("receipt-container").classList.remove("hidden");

    document.getElementById("receipt-content").innerHTML = `
      <div class="info-note">
        <strong>TRANSACCIÓN VERIFICADA Y APROBADA</strong><br>
        Firma Digital de Operación: <code>${authHash}</code>
      </div>
      <p><strong>N° de Comprobante:</strong> ${orderNumber}</p>
      <p><strong>Fecha y Hora:</strong> ${now}</p>
      <p><strong>Cliente:</strong> ${Security.escapeHTML(shipName)} (${Security.escapeHTML(activeSession.email)})</p>
      <p><strong>Dirección de Entrega:</strong> ${Security.escapeHTML(shipAddress)}, ${Security.escapeHTML(shipDistrict)} (Tel: ${Security.escapeHTML(shipPhone)})</p>
      <p><strong>Medio de Pago:</strong> ${Security.escapeHTML(paymentLabel)}</p>
      <hr style="margin:12px 0; border:0; border-top:1px solid #ccc;">
      <table class="classic-table mb-16">
        <thead>
          <tr><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr>
        </thead>
        <tbody>
          ${cart.map(i => `<tr><td>${Security.escapeHTML(i.name)}</td><td>${i.qty}</td><td>S/ ${(i.price * i.qty).toFixed(2)}</td></tr>`).join("")}
        </tbody>
      </table>
      <p style="text-align:right;">Envío: <strong>S/ ${shipping.toFixed(2)}</strong></p>
      <p style="text-align:right; font-size:16px; margin-top:4px;">TOTAL PAGADO: <strong style="color:#1b8a2e;">S/ ${total.toFixed(2)}</strong></p>
      <div style="margin-top:20px;">
        <a href="index.html" class="btn-primary-square" style="display:block; text-align:center; text-decoration:none;">VOLVER A LA TIENDA PRINCIPAL</a>
      </div>
    `;

    Store.saveCart([]);
  });

  renderCheckoutCart();
});
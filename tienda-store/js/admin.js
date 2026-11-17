document.addEventListener("DOMContentLoaded", async () => {
  await Store.initSecurity();

  // Verificación criptográfica de sesión y rol de administrador
  const session = await Store.getValidSession();
  if (!session || session.role !== "admin") {
    Security.logEvent("UNAUTHORIZED_ACCESS", "Intento de acceso no autorizado a admin.html");
    alert("Acceso denegado: Sesión inválida, expirada o sin privilegios de Cuenta Maestro.");
    window.location.href = "login.html";
    return;
  }

  const promoInput = document.getElementById("admin-promo-input");
  const productForm = document.getElementById("product-form");
  const tbody = document.getElementById("admin-inventory-tbody");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");

  // Token Anti-CSRF inyectado en el formulario del administrador
  const csrfInput = document.createElement("input");
  csrfInput.type = "hidden";
  csrfInput.id = "admin-csrf-token";
  csrfInput.value = session.csrfToken;
  productForm.appendChild(csrfInput);

  promoInput.value = Store.getPromoText();

  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    Store.destroySession();
    window.location.href = "index.html";
  });

  document.getElementById("save-promo-btn").addEventListener("click", async () => {
    const activeSession = await Store.getValidSession();
    if (!activeSession || activeSession.role !== "admin") return window.location.reload();

    const text = promoInput.value.trim();
    if (!text) return;
    Store.setPromoText(text);
    Security.logEvent("ADMIN_PROMO_UPDATED", `Banner actualizado por ${activeSession.email}`);
    alert("Promoción global actualizada en toda la tienda.");
  });

  function renderInventory() {
    const products = Store.getProducts();
    document.getElementById("total-admin-products").textContent = products.length;
    tbody.innerHTML = "";

    products.forEach(p => {
      const isOffer = p.oldPrice && p.oldPrice > p.price;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${Security.escapeHTML(p.sku)}</td>
        <td>${Security.escapeHTML(p.emoji)} ${Security.escapeHTML(p.name)}</td>
        <td>${Security.escapeHTML(p.brand)}</td>
        <td>${Security.escapeHTML(p.category)}</td>
        <td>${isOffer ? "S/ " + Number(p.oldPrice).toFixed(2) : "-"}</td>
        <td><strong>S/ ${Number(p.price).toFixed(2)}</strong></td>
        <td>${isOffer ? "<strong style='color:#d90000;'>EN OFERTA</strong>" : "Precio Regular"}</td>
        <td>
          <button type="button" class="btn-tbl-edit">Editar</button>
          <button type="button" class="btn-tbl-del">Eliminar</button>
        </td>
      `;

      tr.querySelector(".btn-tbl-edit").addEventListener("click", () => loadProductToEdit(p.id));
      tr.querySelector(".btn-tbl-del").addEventListener("click", () => deleteProduct(p.id));
      tbody.appendChild(tr);
    });
  }

  function loadProductToEdit(id) {
    const prod = Store.getProducts().find(p => p.id === id);
    if (!prod) return;

    document.getElementById("form-section-title").textContent = `EDITANDO PRODUCTO (${prod.sku})`;
    document.getElementById("edit-prod-id").value = prod.id;
    document.getElementById("prod-name").value = prod.name;
    document.getElementById("prod-brand").value = prod.brand;
    document.getElementById("prod-category").value = prod.category;
    document.getElementById("prod-emoji").value = prod.emoji;
    document.getElementById("prod-price").value = prod.price;
    document.getElementById("prod-old-price").value = prod.oldPrice || "";
    cancelEditBtn.classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  async function deleteProduct(id) {
    const activeSession = await Store.getValidSession();
    if (!activeSession || activeSession.role !== "admin") return window.location.reload();

    if (!confirm("¿Confirmas que deseas eliminar este producto del catálogo?")) return;
    const updated = Store.getProducts().filter(p => p.id !== id);
    Store.saveProducts(updated);
    Security.logEvent("ADMIN_PRODUCT_DELETED", `Producto ID ${id} eliminado por ${activeSession.email}`);
    renderInventory();
  }

  function resetForm() {
    productForm.reset();
    document.getElementById("edit-prod-id").value = "";
    document.getElementById("form-section-title").textContent = "2. AGREGAR NUEVO PRODUCTO AL CATÁLOGO";
    cancelEditBtn.classList.add("hidden");
  }

  cancelEditBtn.addEventListener("click", resetForm);

  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validar sesión activa y token Anti-CSRF
    const activeSession = await Store.getValidSession();
    const submittedCsrf = document.getElementById("admin-csrf-token").value;
    if (!activeSession || activeSession.role !== "admin" || submittedCsrf !== activeSession.csrfToken) {
      alert("Token de seguridad inválido o sesión expirada.");
      return window.location.reload();
    }

    const products = Store.getProducts();
    const editId = document.getElementById("edit-prod-id").value;

    const name = document.getElementById("prod-name").value.trim();
    const brand = document.getElementById("prod-brand").value.trim().toUpperCase();
    const category = document.getElementById("prod-category").value;
    const emoji = document.getElementById("prod-emoji").value.trim() || "📦";
    const price = parseFloat(document.getElementById("prod-price").value);
    const oldPriceVal = parseFloat(document.getElementById("prod-old-price").value);

    if (isNaN(price) || price <= 0) return alert("Precio inválido.");
    const oldPrice = (!isNaN(oldPriceVal) && oldPriceVal > price) ? oldPriceVal : null;

    if (editId) {
      const idx = products.findIndex(p => p.id === parseInt(editId, 10));
      if (idx !== -1) {
        products[idx] = { ...products[idx], name, brand, category, emoji, price, oldPrice };
        Security.logEvent("ADMIN_PRODUCT_EDITED", `Producto ${products[idx].sku} modificado`);
      }
    } else {
      const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 101;
      const newSku = `SKU-${4000 + newId}`;
      products.unshift({ id: newId, sku: newSku, name, brand, category, emoji, price, oldPrice });
      Security.logEvent("ADMIN_PRODUCT_CREATED", `Producto ${newSku} creado`);
    }

    Store.saveProducts(products);
    resetForm();
    renderInventory();
  });

  renderInventory();
});
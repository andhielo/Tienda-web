document.addEventListener("DOMContentLoaded", async () => {
  await Store.initSecurity();

  const productsGrid = document.getElementById("products-grid");
  const resultsCounter = document.getElementById("results-counter");
  const searchInput = document.getElementById("search-input");
  const sortSelect = document.getElementById("sort-select");
  const catCheckboxes = document.querySelectorAll(".cat-checkbox");
  const minPriceInput = document.getElementById("min-price");
  const maxPriceInput = document.getElementById("max-price");
  const onlyOffersCheckbox = document.getElementById("only-offers-checkbox");

  async function renderHeaderState() {
    // textContent previene XSS automáticamente
    document.getElementById("global-promo-text").textContent = Store.getPromoText();
    const userControls = document.getElementById("header-user-controls");
    const session = await Store.getValidSession();

    if (session) {
      const safeName = Security.escapeHTML(session.name);
      userControls.innerHTML = `
        <span>Hola, <strong>${safeName}</strong></span>
        ${session.role === "admin" ? `<a href="admin.html" class="admin-badge-link">[PANEL CUENTA MAESTRO]</a>` : ""}
        <button type="button" id="logout-btn" class="top-link">CERRAR SESIÓN</button>
      `;
      document.getElementById("logout-btn").addEventListener("click", () => {
        Store.destroySession();
        renderHeaderState();
      });
    } else {
      userControls.innerHTML = `
        <span>Bienvenido, Invitado</span> |
        <a href="login.html" class="top-link">INICIAR SESIÓN / REGISTRARSE</a>
      `;
    }
    updateHeaderCartSummary();
  }

  function updateHeaderCartSummary() {
    const cart = Store.getCart();
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    document.getElementById("header-cart-count").textContent = count;
    document.getElementById("header-cart-total").textContent = `S/ ${total.toFixed(2)}`;
  }

  function renderBrandFilters() {
    const container = document.getElementById("dynamic-brands-list");
    const products = Store.getProducts();
    const uniqueBrands = [...new Set(products.map(p => p.brand))].sort();

    container.innerHTML = "";
    uniqueBrands.forEach(brand => {
      const safeBrand = Security.escapeHTML(brand);
      const label = document.createElement("label");
      label.className = "check-row";
      label.innerHTML = `<input type="checkbox" class="brand-checkbox" value="${safeBrand}"> ${safeBrand}`;
      label.querySelector("input").addEventListener("change", filterAndRender);
      container.appendChild(label);
    });
  }

  function filterAndRender() {
    const products = Store.getProducts();
    const query = searchInput.value.trim().toLowerCase();
    const selectedCats = Array.from(catCheckboxes).filter(c => c.checked).map(c => c.value);
    const selectedBrands = Array.from(document.querySelectorAll(".brand-checkbox")).filter(b => b.checked).map(b => b.value);
    const minPrice = parseFloat(minPriceInput.value);
    const maxPrice = parseFloat(maxPriceInput.value);
    const onlyOffers = onlyOffersCheckbox.checked;
    const sortBy = sortSelect.value;

    let filtered = products.filter(item => {
      const hasOffer = item.oldPrice && item.oldPrice > item.price;
      const matchQuery = item.name.toLowerCase().includes(query) ||
                         item.brand.toLowerCase().includes(query) ||
                         item.sku.toLowerCase().includes(query);
      const matchCat = selectedCats.length === 0 || selectedCats.includes(item.category);
      const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(item.brand);
      const matchMin = isNaN(minPrice) || item.price >= minPrice;
      const matchMax = isNaN(maxPrice) || item.price <= maxPrice;
      const matchOffer = !onlyOffers || hasOffer;

      return matchQuery && matchCat && matchBrand && matchMin && matchMax && matchOffer;
    });

    if (sortBy === "price-asc") filtered.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") filtered.sort((a, b) => b.price - a.price);
    else if (sortBy === "name-asc") filtered.sort((a, b) => a.name.localeCompare(b.name));

    resultsCounter.textContent = `Mostrando ${filtered.length} producto(s)`;
    productsGrid.innerHTML = "";

    if (filtered.length === 0) {
      productsGrid.innerHTML = `<div style="background:#fff; border:1px solid #ccc; padding:20px; grid-column:1/-1;">No se encontraron productos con los filtros seleccionados.</div>`;
      return;
    }

    filtered.forEach(p => {
      const hasOffer = p.oldPrice && p.oldPrice > p.price;
      const discountPct = hasOffer ? `-${Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)}%` : null;

      // Sanitización de todos los campos antes de inyectar en HTML
      const safeSku = Security.escapeHTML(p.sku);
      const safeBrand = Security.escapeHTML(p.brand);
      const safeName = Security.escapeHTML(p.name);
      const safeEmoji = Security.escapeHTML(p.emoji);

      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        ${discountPct ? `<div class="offer-flag">OFERTA ${discountPct}</div>` : ""}
        <div>
          <div class="product-img-box">${safeEmoji}</div>
          <div class="product-sku">${safeSku}</div>
          <div class="product-brand">${safeBrand}</div>
          <div class="product-name">${safeName}</div>
        </div>
        <div>
          <div class="price-section">
            ${hasOffer ? `<span class="old-price">Normal: S/ ${Number(p.oldPrice).toFixed(2)}</span>` : `<span class="old-price">&nbsp;</span>`}
            <span class="${hasOffer ? 'final-price' : 'regular-price'}">S/ ${Number(p.price).toFixed(2)}</span>
          </div>
          <button type="button" class="btn-add-cart">AGREGAR AL CARRITO</button>
        </div>
      `;
      card.querySelector(".btn-add-cart").addEventListener("click", (e) => {
        Store.addToCart(p.id);
        updateHeaderCartSummary();
        e.target.textContent = "✓ AGREGADO";
        setTimeout(() => { e.target.textContent = "AGREGAR AL CARRITO"; }, 800);
      });
      productsGrid.appendChild(card);
    });
  }

  catCheckboxes.forEach(cb => cb.addEventListener("change", filterAndRender));
  onlyOffersCheckbox.addEventListener("change", filterAndRender);
  document.getElementById("apply-price-btn").addEventListener("click", filterAndRender);
  sortSelect.addEventListener("change", filterAndRender);
  document.getElementById("search-btn").addEventListener("click", filterAndRender);
  searchInput.addEventListener("keyup", (e) => { if (e.key === "Enter") filterAndRender(); });

  document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      link.classList.add("active");
      const cat = link.dataset.quickCat;
      document.getElementById("breadcrumb-current").textContent = link.textContent;
      catCheckboxes.forEach(cb => { cb.checked = (cat !== "todos" && cb.value === cat); });
      filterAndRender();
    });
  });

  document.getElementById("clear-filters-btn").addEventListener("click", () => {
    searchInput.value = "";
    minPriceInput.value = "";
    maxPriceInput.value = "";
    onlyOffersCheckbox.checked = false;
    sortSelect.value = "default";
    catCheckboxes.forEach(cb => cb.checked = false);
    document.querySelectorAll(".brand-checkbox").forEach(cb => cb.checked = false);
    filterAndRender();
  });

  await renderHeaderState();
  renderBrandFilters();
  filterAndRender();
});
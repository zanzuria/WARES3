const state = {
  counters: { item: 1, bundle: 1, event: 1, sale: 1, store: 1, delivery: 1 },
  items: [],
  bundles: [],
  inventoryEntries: [],
  stock: {},
  events: [],
  sales: [],
  stores: [],
  deliveries: [],
  ui: { activeScreen: 'dashboard', activeEventId: null, summaryEventId: null }
};

const screens = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'items', label: 'Items' },
  { id: 'bundles', label: 'Bundles' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'events', label: 'Events' },
  { id: 'pos', label: 'Active Event POS' },
  { id: 'summary', label: 'Event Summary' },
  { id: 'stores', label: 'Stores' },
  { id: 'deliveries', label: 'Deliveries' }
];

const app = document.getElementById('app');
const nav = document.getElementById('navLinks');

function money(n) {
  return Number(n || 0).toFixed(2);
}

function stockKey(kind, id) {
  return `${kind}:${id}`;
}

function getProduct(kind, id) {
  return kind === 'item' ? state.items.find(i => i.id === id) : state.bundles.find(b => b.id === id);
}

function productLabel(kind, id) {
  const p = getProduct(kind, id);
  if (!p) return 'Unknown';
  return kind === 'item' ? `${p.code} - ${p.name}` : `Bundle: ${p.name}`;
}

function bundleProductionCost(bundle) {
  return bundle.components.reduce((sum, c) => {
    const item = state.items.find(i => i.id === Number(c.itemId));
    return sum + (item ? item.productionCost * Number(c.quantity || 0) : 0);
  }, 0);
}

function getStock(kind, id) {
  return state.stock[stockKey(kind, id)] || 0;
}

function setStock(kind, id, qty) {
  state.stock[stockKey(kind, id)] = Number(qty);
}

function adjustStock(kind, id, delta) {
  setStock(kind, id, getStock(kind, id) + Number(delta));
}

function addInventoryEntry(kind, id, qty, dateAdded) {
  state.inventoryEntries.push({ kind, id: Number(id), quantity: Number(qty), dateAdded });
}

function getLatestEventId() {
  if (!state.events.length) return null;
  const sorted = [...state.events].sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted[0].id;
}

function getEventSales(eventId) {
  return state.sales.filter(s => s.eventId === Number(eventId));
}

function soldCountForEvent(eventId, kind, id) {
  return getEventSales(eventId).filter(s => s.kind === kind && s.productId === id).length;
}

function eventTakenQty(event, kind, id) {
  return event.taken[stockKey(kind, id)] || 0;
}

function renderNav() {
  nav.innerHTML = '';
  screens.forEach(s => {
    const btn = document.createElement('button');
    btn.textContent = s.label;
    btn.className = state.ui.activeScreen === s.id ? 'active' : '';
    btn.onclick = () => {
      state.ui.activeScreen = s.id;
      render();
    };
    nav.appendChild(btn);
  });
}

function render() {
  renderNav();
  app.innerHTML = screens.map(s => `<section id="screen-${s.id}" class="section ${state.ui.activeScreen === s.id ? 'active' : ''}"></section>`).join('');
  renderDashboard();
  renderItems();
  renderBundles();
  renderInventory();
  renderEvents();
  renderPOS();
  renderSummary();
  renderStores();
  renderDeliveries();
}

function renderDashboard() {
  const el = document.getElementById('screen-dashboard');
  const now = new Date();
  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly.push({ key, sales: 0, profit: 0 });
  }

  state.sales.forEach(s => {
    const d = new Date(s.datetime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = monthly.find(m => m.key === key);
    if (row) {
      row.sales += s.salePrice;
      row.profit += s.salePrice - s.productionCost;
    }
  });

  const bestMap = {};
  state.sales.forEach(s => {
    const k = stockKey(s.kind, s.productId);
    bestMap[k] = (bestMap[k] || 0) + 1;
  });
  const bestRows = Object.entries(bestMap)
    .map(([k, count]) => {
      const [kind, id] = k.split(':');
      return { product: productLabel(kind, Number(id)), count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  el.innerHTML = `
    <h2>Dashboard (Last 12 Months)</h2>
    <div class="layout-two">
      <div class="flex-2 card">
        <h3>Monthly Sales & Profit</h3>
        <table>
          <thead><tr><th>Month</th><th>Sales</th><th>Profit</th></tr></thead>
          <tbody>
            ${monthly.map(m => `<tr><td>${m.key}</td><td>${money(m.sales)}</td><td>${money(m.profit)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="flex-1 card">
        <h3>Best Selling Products</h3>
        <table>
          <thead><tr><th>Product</th><th>Sold Qty</th></tr></thead>
          <tbody>
            ${bestRows.map(r => `<tr><td>${r.product}</td><td>${r.count}</td></tr>`).join('') || '<tr><td colspan="2">No sales yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderItems() {
  const el = document.getElementById('screen-items');
  el.innerHTML = `
    <h2>Items</h2>
    <div class="card">
      <div class="row">
        <label>Code<input id="itemCode" /></label>
        <label>Name<input id="itemName" /></label>
        <label>Type<input id="itemType" /></label>
        <label>Production Cost<input id="itemProd" type="number" step="0.01" /></label>
        <label>Sale Price<input id="itemSale" type="number" step="0.01" /></label>
        <button id="addItemBtn">Add Item</button>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Production Cost</th><th>Sale Price</th><th>Stock</th><th>Actions</th></tr></thead>
        <tbody>
          ${state.items.map(i => `
            <tr>
              <td>${i.code}</td><td>${i.name}</td><td>${i.type}</td><td>${money(i.productionCost)}</td><td>${money(i.salePrice)}</td><td>${getStock('item', i.id)}</td>
              <td>
                <button data-edit-item="${i.id}">Edit</button>
                <button data-del-item="${i.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('addItemBtn').onclick = () => {
    const code = document.getElementById('itemCode').value.trim();
    const name = document.getElementById('itemName').value.trim();
    if (!code || !name) return;
    state.items.push({
      id: state.counters.item++,
      code,
      name,
      type: document.getElementById('itemType').value.trim(),
      productionCost: Number(document.getElementById('itemProd').value || 0),
      salePrice: Number(document.getElementById('itemSale').value || 0)
    });
    render();
  };

  el.querySelectorAll('[data-del-item]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.delItem);
      state.items = state.items.filter(i => i.id !== id);
      state.bundles.forEach(b => b.components = b.components.filter(c => Number(c.itemId) !== id));
      delete state.stock[stockKey('item', id)];
      render();
    };
  });

  el.querySelectorAll('[data-edit-item]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.editItem);
      const item = state.items.find(i => i.id === id);
      if (!item) return;
      const code = prompt('Code', item.code);
      const name = prompt('Name', item.name);
      if (!code || !name) return;
      item.code = code;
      item.name = name;
      item.type = prompt('Type', item.type) || '';
      item.productionCost = Number(prompt('Production Cost', item.productionCost) || item.productionCost);
      item.salePrice = Number(prompt('Sale Price', item.salePrice) || item.salePrice);
      render();
    };
  });
}

function renderBundles() {
  const el = document.getElementById('screen-bundles');
  const itemOptions = state.items.map(i => `<option value="${i.id}">${i.code} - ${i.name}</option>`).join('');
  el.innerHTML = `
    <h2>Bundles</h2>
    <div class="card">
      <div class="row">
        <label>Bundle Name<input id="bundleName" /></label>
        <label>Sale Price<input id="bundleSale" type="number" step="0.01" /></label>
      </div>
      <div id="bundleComponents"></div>
      <button id="addComponentRowBtn">Add Component</button>
      <button id="createBundleBtn">Create Bundle</button>
      <p class="muted">Bundle production cost is auto-calculated from component item costs.</p>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Components</th><th>Production Cost</th><th>Sale Price</th><th>Stock</th><th>Actions</th></tr></thead>
        <tbody>
          ${state.bundles.map(b => {
            const components = b.components.map(c => `${productLabel('item', Number(c.itemId))} x${c.quantity}`).join(', ');
            const prod = bundleProductionCost(b);
            return `<tr>
              <td>${b.name}</td><td>${components}</td><td>${money(prod)}</td><td>${money(b.salePrice)}</td><td>${getStock('bundle', b.id)}</td>
              <td><button data-del-bundle="${b.id}">Delete</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  const compWrap = document.getElementById('bundleComponents');
  const addRow = () => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <label>Item<select class="comp-item">${itemOptions}</select></label>
      <label>Quantity<input class="comp-qty" type="number" min="1" value="1" /></label>
      <button class="remove-comp">Remove</button>
    `;
    row.querySelector('.remove-comp').onclick = () => row.remove();
    compWrap.appendChild(row);
  };

  document.getElementById('addComponentRowBtn').onclick = addRow;
  addRow();

  document.getElementById('createBundleBtn').onclick = () => {
    const name = document.getElementById('bundleName').value.trim();
    if (!name) return;
    const salePrice = Number(document.getElementById('bundleSale').value || 0);
    const components = [...compWrap.querySelectorAll('.row')].map(r => ({
      itemId: Number(r.querySelector('.comp-item').value),
      quantity: Number(r.querySelector('.comp-qty').value || 0)
    })).filter(c => c.itemId && c.quantity > 0);
    if (!components.length) return;
    state.bundles.push({ id: state.counters.bundle++, name, components, salePrice });
    render();
  };

  el.querySelectorAll('[data-del-bundle]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.delBundle);
      state.bundles = state.bundles.filter(b => b.id !== id);
      delete state.stock[stockKey('bundle', id)];
      render();
    };
  });
}

function renderInventory() {
  const el = document.getElementById('screen-inventory');
  const options = [
    ...state.items.map(i => `<option value="item:${i.id}">Item - ${i.code} ${i.name}</option>`),
    ...state.bundles.map(b => `<option value="bundle:${b.id}">Bundle - ${b.name}</option>`)
  ].join('');

  let totalQty = 0;
  let totalProd = 0;
  let totalSale = 0;
  Object.entries(state.stock).forEach(([key, qty]) => {
    const [kind, idStr] = key.split(':');
    const id = Number(idStr);
    const p = getProduct(kind, id);
    if (!p || qty <= 0) return;
    const productionCost = kind === 'item' ? p.productionCost : bundleProductionCost(p);
    totalQty += qty;
    totalProd += qty * productionCost;
    totalSale += qty * p.salePrice;
  });

  el.innerHTML = `
    <h2>Inventory</h2>
    <div class="grid">
      <div class="card"><h3>Total Quantity</h3><div>${totalQty}</div></div>
      <div class="card"><h3>Total Production Value</h3><div>${money(totalProd)}</div></div>
      <div class="card"><h3>Total Sale Value</h3><div>${money(totalSale)}</div></div>
    </div>
    <div class="card">
      <h3>Add Stock</h3>
      <div class="row">
        <label>Product<select id="invProduct">${options}</select></label>
        <label>Quantity<input id="invQty" type="number" min="1" value="1" /></label>
        <label>Date Added<input id="invDate" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <button id="invAddBtn">Add</button>
      </div>
      <div id="invMsg" class="warning"></div>
    </div>
    <div class="card">
      <h3>Current Stock</h3>
      <table>
        <thead><tr><th>Product</th><th>Quantity</th><th>Prod Cost</th><th>Sale Price</th></tr></thead>
        <tbody>
          ${Object.entries(state.stock).map(([k, qty]) => {
            const [kind, idStr] = k.split(':');
            const id = Number(idStr);
            const p = getProduct(kind, id);
            if (!p) return '';
            const prod = kind === 'item' ? p.productionCost : bundleProductionCost(p);
            return `<tr><td>${productLabel(kind, id)}</td><td>${qty}</td><td>${money(prod)}</td><td>${money(p.salePrice)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('invAddBtn').onclick = () => {
    const [kind, idStr] = document.getElementById('invProduct').value.split(':');
    const id = Number(idStr);
    const qty = Number(document.getElementById('invQty').value || 0);
    const dateAdded = document.getElementById('invDate').value;
    const msg = document.getElementById('invMsg');
    msg.textContent = '';
    if (qty <= 0) return;

    if (kind === 'bundle') {
      const bundle = state.bundles.find(b => b.id === id);
      if (!bundle) return;
      for (const comp of bundle.components) {
        const needed = Number(comp.quantity) * qty;
        const available = getStock('item', Number(comp.itemId));
        if (available < needed) {
          msg.textContent = `Not enough component stock for ${productLabel('item', Number(comp.itemId))}. Need ${needed}, have ${available}.`;
          return;
        }
      }
      bundle.components.forEach(comp => adjustStock('item', Number(comp.itemId), -Number(comp.quantity) * qty));
    }

    adjustStock(kind, id, qty);
    addInventoryEntry(kind, id, qty, dateAdded);
    render();
  };
}

function renderEvents() {
  const el = document.getElementById('screen-events');
  const eventOptions = state.events.map(e => `<option value="${e.id}">${e.name} (${e.date})</option>`).join('');
  const productOptions = [
    ...state.items.map(i => `<option value="item:${i.id}">Item - ${i.code} ${i.name}</option>`),
    ...state.bundles.map(b => `<option value="bundle:${b.id}">Bundle - ${b.name}</option>`)
  ].join('');

  el.innerHTML = `
    <h2>Events (Conventions)</h2>
    <div class="card">
      <div class="row">
        <label>Name<input id="eventName" /></label>
        <label>Date<input id="eventDate" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <button id="createEventBtn">Create Event</button>
      </div>
    </div>

    <div class="card">
      <h3>Prepare "Go To Event" Stock</h3>
      <div class="row">
        <label>Event<select id="prepEvent">${eventOptions}</select></label>
        <label>Product<select id="prepProduct">${productOptions}</select></label>
        <label>Quantity<input id="prepQty" type="number" min="1" value="1" /></label>
        <button id="prepAddBtn">Send To Event</button>
        <button id="copyLeftoversBtn">Copy leftovers from previous event</button>
      </div>
      <div id="prepMsg" class="warning"></div>
    </div>

    <div class="card">
      <h3>Event Stock</h3>
      ${state.events.map(e => {
        const lines = Object.entries(e.taken).map(([k, q]) => `<li>${productLabel(...[k.split(':')[0], Number(k.split(':')[1])])}: ${q}</li>`).join('');
        return `<div><strong>${e.name} (${e.date})</strong><ul>${lines || '<li>No stock yet</li>'}</ul></div>`;
      }).join('')}
    </div>
  `;

  document.getElementById('createEventBtn').onclick = () => {
    const name = document.getElementById('eventName').value.trim();
    const date = document.getElementById('eventDate').value;
    if (!name || !date) return;
    const id = state.counters.event++;
    state.events.push({ id, name, date, taken: {}, closed: false });
    state.ui.activeEventId = id;
    render();
  };

  const prepAddBtn = document.getElementById('prepAddBtn');
  if (prepAddBtn) {
    prepAddBtn.onclick = () => {
      const eventId = Number(document.getElementById('prepEvent').value);
      const [kind, idStr] = document.getElementById('prepProduct').value.split(':');
      const id = Number(idStr);
      const qty = Number(document.getElementById('prepQty').value || 0);
      const msg = document.getElementById('prepMsg');
      msg.textContent = '';
      const event = state.events.find(e => e.id === eventId);
      if (!event || qty <= 0) return;
      const available = getStock(kind, id);
      if (available < qty) {
        msg.textContent = `Not enough inventory. Need ${qty}, have ${available}.`;
        return;
      }
      adjustStock(kind, id, -qty);
      const key = stockKey(kind, id);
      event.taken[key] = (event.taken[key] || 0) + qty;
      render();
    };
  }

  const copyBtn = document.getElementById('copyLeftoversBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const currentId = Number(document.getElementById('prepEvent').value);
      const current = state.events.find(e => e.id === currentId);
      if (!current) return;
      const prev = [...state.events].filter(e => e.id !== currentId).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (!prev) return;
      const msg = document.getElementById('prepMsg');
      msg.textContent = '';
      const leftovers = {};
      Object.entries(prev.taken).forEach(([k, q]) => {
        const [kind, idStr] = k.split(':');
        const sold = soldCountForEvent(prev.id, kind, Number(idStr));
        const left = q - sold;
        if (left > 0) leftovers[k] = left;
      });

      for (const [k, left] of Object.entries(leftovers)) {
        const [kind, idStr] = k.split(':');
        const id = Number(idStr);
        if (getStock(kind, id) < left) {
          msg.textContent = `Cannot copy leftovers. Missing stock for ${productLabel(kind, id)}.`;
          return;
        }
      }

      Object.entries(leftovers).forEach(([k, left]) => {
        const [kind, idStr] = k.split(':');
        const id = Number(idStr);
        adjustStock(kind, id, -left);
        current.taken[k] = (current.taken[k] || 0) + left;
      });
      render();
    };
  }
}

function renderPOS() {
  const el = document.getElementById('screen-pos');
  const latest = getLatestEventId();
  if (!state.ui.activeEventId && latest) state.ui.activeEventId = latest;

  const eventOptions = state.events.map(e => `<option value="${e.id}" ${state.ui.activeEventId === e.id ? 'selected' : ''}>${e.name} (${e.date})</option>`).join('');
  const active = state.events.find(e => e.id === state.ui.activeEventId);
  const sales = active ? getEventSales(active.id) : [];
  const totalRevenue = sales.reduce((s, x) => s + x.salePrice, 0);
  const totalProfit = sales.reduce((s, x) => s + (x.salePrice - x.productionCost), 0);

  const productButtons = active ? Object.entries(active.taken).map(([k, qty]) => {
    const [kind, idStr] = k.split(':');
    const id = Number(idStr);
    const sold = soldCountForEvent(active.id, kind, id);
    const left = qty - sold;
    const p = getProduct(kind, id);
    if (!p || left <= 0) return '';
    return `
      <div class="product-card">
        <div><strong>${productLabel(kind, id)}</strong></div>
        <div>Left: ${left}</div>
        <div>Price: ${money(p.salePrice)}</div>
        <div class="actions">
          <button data-sale="${active.id}|${kind}|${id}|cash">Cash</button>
          <button data-credit="${active.id}|${kind}|${id}">Credit</button>
        </div>
      </div>
    `;
  }).join('') : '';

  el.innerHTML = `
    <h2>Active Event POS</h2>
    <div class="row">
      <label>Active Event<select id="activeEventSelect">${eventOptions}</select></label>
      <button id="closeDayBtn">Close Day</button>
    </div>
    <div class="layout-two">
      <div class="flex-2 card">
        <h3>Products</h3>
        <div class="product-buttons">${productButtons || 'No available products in active event stock.'}</div>
      </div>
      <div class="flex-1 card">
        <h3>Sales Panel</h3>
        <div>Total sales count: ${sales.length}</div>
        <div>Total revenue: ${money(totalRevenue)}</div>
        <div>Total profit: ${money(totalProfit)}</div>
        <table>
          <thead><tr><th>When</th><th>Product</th><th>Method</th><th>Sale</th><th>Profit</th><th></th></tr></thead>
          <tbody>
            ${sales.map(s => `
              <tr>
                <td>${new Date(s.datetime).toLocaleString()}</td>
                <td>${productLabel(s.kind, s.productId)}</td>
                <td>${s.paymentMethod}</td>
                <td>${money(s.salePrice)}</td>
                <td>${money(s.salePrice - s.productionCost)}</td>
                <td><button data-del-sale="${s.id}">Delete</button></td>
              </tr>
            `).join('') || '<tr><td colspan="6">No sales yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const activeSelect = document.getElementById('activeEventSelect');
  if (activeSelect) {
    activeSelect.onchange = () => {
      state.ui.activeEventId = Number(activeSelect.value);
      render();
    };
  }

  el.querySelectorAll('[data-sale]').forEach(btn => {
    btn.onclick = () => {
      const [eventId, kind, idStr, method] = btn.dataset.sale.split('|');
      registerSale(Number(eventId), kind, Number(idStr), method);
    };
  });

  el.querySelectorAll('[data-credit]').forEach(btn => {
    btn.onclick = () => {
      const [eventId, kind, idStr] = btn.dataset.credit.split('|');
      const method = prompt('Credit method: bit / paybox / transfer', 'bit');
      if (!method) return;
      const normalized = method.toLowerCase();
      if (!['bit', 'paybox', 'transfer'].includes(normalized)) return;
      registerSale(Number(eventId), kind, Number(idStr), normalized);
    };
  });

  el.querySelectorAll('[data-del-sale]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.delSale);
      state.sales = state.sales.filter(s => s.id !== id);
      render();
    };
  });

  const closeBtn = document.getElementById('closeDayBtn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (!state.ui.activeEventId) return;
      state.ui.summaryEventId = state.ui.activeEventId;
      const ev = state.events.find(e => e.id === state.ui.activeEventId);
      if (ev) ev.closed = true;
      state.ui.activeScreen = 'summary';
      render();
    };
  }
}

function registerSale(eventId, kind, productId, paymentMethod) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;
  const taken = eventTakenQty(event, kind, productId);
  const sold = soldCountForEvent(eventId, kind, productId);
  if (sold >= taken) return;
  const p = getProduct(kind, productId);
  if (!p) return;
  const productionCost = kind === 'item' ? p.productionCost : bundleProductionCost(p);
  state.sales.push({
    id: state.counters.sale++,
    eventId,
    kind,
    productId,
    paymentMethod,
    salePrice: p.salePrice,
    productionCost,
    datetime: new Date().toISOString()
  });
  render();
}

function renderSummary() {
  const el = document.getElementById('screen-summary');
  const eventId = state.ui.summaryEventId || state.ui.activeEventId || getLatestEventId();
  const event = state.events.find(e => e.id === eventId);
  if (!event) {
    el.innerHTML = '<h2>Event Summary</h2><p>No event selected.</p>';
    return;
  }

  const sales = getEventSales(event.id);
  const soldMap = {};
  sales.forEach(s => {
    const key = stockKey(s.kind, s.productId);
    soldMap[key] = (soldMap[key] || 0) + 1;
  });

  const rows = Object.entries(soldMap).map(([k, count]) => {
    const [kind, idStr] = k.split(':');
    return `<tr><td>${productLabel(kind, Number(idStr))}</td><td>${count}</td></tr>`;
  }).join('');

  const revenue = sales.reduce((s, x) => s + x.salePrice, 0);
  const profit = sales.reduce((s, x) => s + (x.salePrice - x.productionCost), 0);

  el.innerHTML = `
    <h2>Event Summary: ${event.name}</h2>
    <div class="card">
      <table>
        <thead><tr><th>Product</th><th>Sold</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2">No sales</td></tr>'}</tbody>
      </table>
      <p>Total revenue: ${money(revenue)}</p>
      <p>Total profit: ${money(profit)}</p>
    </div>
  `;
}

function renderStores() {
  const el = document.getElementById('screen-stores');
  el.innerHTML = `
    <h2>Stores</h2>
    <div class="card">
      <div class="row">
        <label>Store Name<input id="storeName" /></label>
        <button id="addStoreBtn">Add Store</button>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Actions</th></tr></thead>
        <tbody>
          ${state.stores.map(s => `<tr><td>${s.name}</td><td><button data-del-store="${s.id}">Delete</button></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('addStoreBtn').onclick = () => {
    const name = document.getElementById('storeName').value.trim();
    if (!name) return;
    state.stores.push({ id: state.counters.store++, name });
    render();
  };

  el.querySelectorAll('[data-del-store]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.delStore);
      state.stores = state.stores.filter(s => s.id !== id);
      render();
    };
  });
}

function renderDeliveries() {
  const el = document.getElementById('screen-deliveries');
  const storeOptions = state.stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const productOptions = [
    ...state.items.map(i => `<option value="item:${i.id}">Item - ${i.code} ${i.name}</option>`),
    ...state.bundles.map(b => `<option value="bundle:${b.id}">Bundle - ${b.name}</option>`)
  ].join('');

  el.innerHTML = `
    <h2>Deliveries</h2>
    <div class="card">
      <h3>Create Delivery</h3>
      <div class="row">
        <label>Store<select id="delStore">${storeOptions}</select></label>
        <label>Date<input id="delDate" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <label>Discount %<input id="delDiscount" type="number" value="40" /></label>
        <button id="createDeliveryBtn">Create</button>
      </div>
      <div id="delMsg" class="warning"></div>
    </div>

    <div class="card">
      <h3>Add Items to Delivery</h3>
      <div class="row">
        <label>Delivery<select id="pickDelivery">${state.deliveries.map(d => `<option value="${d.id}">#${d.id} - ${storeName(d.storeId)} (${d.date})</option>`).join('')}</select></label>
        <label>Product<select id="delProduct">${productOptions}</select></label>
        <label>Qty<input id="delQty" type="number" min="1" value="1" /></label>
        <button id="sendDeliveryBtn">Send</button>
      </div>
    </div>

    <div class="card">
      <h3>Close Delivery</h3>
      <div class="row">
        <label>Delivery<select id="closeDelivery">${state.deliveries.map(d => `<option value="${d.id}">#${d.id} - ${storeName(d.storeId)} (${d.date})</option>`).join('')}</select></label>
        <label>Product<select id="retProduct">${productOptions}</select></label>
        <label>Returned Qty<input id="retQty" type="number" min="0" value="0" /></label>
        <button id="markReturnBtn">Mark Return</button>
        <button id="closeDeliveryBtn">Close Delivery</button>
        <button id="prepaidBtn">Prepaid</button>
      </div>
    </div>

    <div class="card">
      <h3>Delivery List</h3>
      <table>
        <thead><tr><th>ID</th><th>Store</th><th>Date</th><th>Discount</th><th>Sent</th><th>Returned</th><th>Closed</th><th>Prepaid</th><th>Amount Due</th></tr></thead>
        <tbody>
          ${state.deliveries.map(d => `
            <tr>
              <td>${d.id}</td>
              <td>${storeName(d.storeId)}</td>
              <td>${d.date}</td>
              <td>${d.discountPercent}%</td>
              <td>${Object.entries(d.itemsSent).map(([k, q]) => `${productLabel(...[k.split(':')[0], Number(k.split(':')[1])])} x${q}`).join(', ')}</td>
              <td>${Object.entries(d.itemsReturned).map(([k, q]) => `${productLabel(...[k.split(':')[0], Number(k.split(':')[1])])} x${q}`).join(', ')}</td>
              <td>${d.closed ? 'Yes' : 'No'}</td>
              <td>${d.prepaid ? 'Yes' : 'No'}</td>
              <td>${money(d.amountDue)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const createBtn = document.getElementById('createDeliveryBtn');
  if (createBtn) createBtn.onclick = () => {
    const storeId = Number(document.getElementById('delStore').value);
    const date = document.getElementById('delDate').value;
    const discountPercent = Number(document.getElementById('delDiscount').value || 40);
    if (!storeId || !date) return;
    state.deliveries.push({
      id: state.counters.delivery++,
      storeId,
      date,
      discountPercent,
      itemsSent: {},
      itemsReturned: {},
      prepaid: false,
      closed: false,
      amountDue: 0
    });
    render();
  };

  const sendBtn = document.getElementById('sendDeliveryBtn');
  if (sendBtn) sendBtn.onclick = () => {
    const delId = Number(document.getElementById('pickDelivery').value);
    const [kind, idStr] = document.getElementById('delProduct').value.split(':');
    const id = Number(idStr);
    const qty = Number(document.getElementById('delQty').value || 0);
    if (!delId || qty <= 0) return;
    const delivery = state.deliveries.find(d => d.id === delId);
    if (!delivery || delivery.closed) return;
    if (getStock(kind, id) < qty) {
      document.getElementById('delMsg').textContent = `Not enough stock for ${productLabel(kind, id)}.`;
      return;
    }
    adjustStock(kind, id, -qty);
    const key = stockKey(kind, id);
    delivery.itemsSent[key] = (delivery.itemsSent[key] || 0) + qty;
    render();
  };

  const markReturnBtn = document.getElementById('markReturnBtn');
  if (markReturnBtn) markReturnBtn.onclick = () => {
    const delId = Number(document.getElementById('closeDelivery').value);
    const [kind, idStr] = document.getElementById('retProduct').value.split(':');
    const id = Number(idStr);
    const qty = Number(document.getElementById('retQty').value || 0);
    const delivery = state.deliveries.find(d => d.id === delId);
    if (!delivery || delivery.closed || qty < 0) return;
    const key = stockKey(kind, id);
    const sent = delivery.itemsSent[key] || 0;
    if (qty > sent) return;
    delivery.itemsReturned[key] = qty;
    render();
  };

  const closeBtn = document.getElementById('closeDeliveryBtn');
  if (closeBtn) closeBtn.onclick = () => {
    const delId = Number(document.getElementById('closeDelivery').value);
    const delivery = state.deliveries.find(d => d.id === delId);
    if (!delivery || delivery.closed) return;
    let due = 0;
    Object.entries(delivery.itemsSent).forEach(([k, sent]) => {
      const returned = delivery.itemsReturned[k] || 0;
      const sold = sent - returned;
      const [kind, idStr] = k.split(':');
      const p = getProduct(kind, Number(idStr));
      if (!p) return;
      due += sold * p.salePrice * ((100 - delivery.discountPercent) / 100);
      if (returned > 0) adjustStock(kind, Number(idStr), returned);
    });
    delivery.amountDue = delivery.prepaid ? 0 : due;
    delivery.closed = true;
    render();
  };

  const prepaidBtn = document.getElementById('prepaidBtn');
  if (prepaidBtn) prepaidBtn.onclick = () => {
    const delId = Number(document.getElementById('closeDelivery').value);
    const delivery = state.deliveries.find(d => d.id === delId);
    if (!delivery) return;
    delivery.prepaid = true;
    delivery.amountDue = 0;
    render();
  };
}

function storeName(id) {
  return state.stores.find(s => s.id === id)?.name || 'Unknown Store';
}

function setupSaveLoad() {
  document.getElementById('saveBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  document.getElementById('loadInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Object.keys(state).forEach(k => delete state[k]);
        Object.assign(state, data);
        state.ui = state.ui || { activeScreen: 'dashboard', activeEventId: null, summaryEventId: null };
        render();
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
}

setupSaveLoad();
render();

// Vanilla-JS client for the Inventory & Stock Management API.

const $ = (sel) => document.querySelector(sel);
const content = $('#content');
const toolbar = $('#toolbar');

// ---------- session ------------------------------------------------------
let session = null; // { token, user }

function loadSession() {
  try { session = JSON.parse(localStorage.getItem('ims-session')); } catch { session = null; }
}
function saveSession(s) {
  session = s;
  try { s ? localStorage.setItem('ims-session', JSON.stringify(s)) : localStorage.removeItem('ims-session'); } catch { /* storage blocked */ }
}

// What each role may change (mirrors the server-side checks).
const BUYING = ['Admin', 'Purchase Manager'];
const SELLING = ['Admin', 'Sales Staff'];
const PERMS = {
  categories: BUYING, suppliers: BUYING, products: BUYING, warehouses: ['Admin'], customers: SELLING,
  'purchase-orders': BUYING, 'sales-orders': SELLING, transfer: BUYING, delete: ['Admin'], users: ['Admin'],
};
const can = (action) => !!session && (PERMS[action] || []).includes(session.user.Role);

// ---------- helpers ----------------------------------------------------
async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch('/api' + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && !url.startsWith('/auth/login')) {
    saveSession(null);
    showLogin('Your session has ended. Please sign in again.');
    throw new Error('Please log in');
  }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (v) => '₹' + Math.round(Number(v || 0)).toLocaleString('en-IN');
const num = (v) => Number(v || 0).toLocaleString('en-IN');
const monthName = (m) => new Date(m + '-01T00:00:00').toLocaleString('en-IN', { month: 'short', year: '2-digit' });

function toast(msg, ok = true) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + (ok ? 'ok' : 'err');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = ''), 3000);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// columns: [{ key, label, type?: 'money'|'num'|'badge'|'date', render?(row) }]
function table(rows, columns, { actions, rowClass } = {}) {
  if (!rows.length) return '<div class="empty">No records found.</div>';
  const head = columns.map((c) => `<th class="${['money', 'num'].includes(c.type) ? 'num' : ''}">${c.label}</th>`).join('');
  const body = rows.map((r) => {
    const cells = columns.map((c) => {
      const v = r[c.key];
      if (c.render) return `<td>${c.render(r)}</td>`;
      if (c.type === 'money') return `<td class="num">${money(v)}</td>`;
      if (c.type === 'num') return `<td class="num">${num(v)}</td>`;
      if (c.type === 'badge') return `<td><span class="badge ${esc(v)}">${esc(v)}</span></td>`;
      return `<td${c.type === 'date' ? ' class="nowrap"' : ''}>${esc(v)}</td>`;
    }).join('');
    const act = actions ? `<td class="actions">${actions(r)}</td>` : '';
    return `<tr class="${rowClass ? rowClass(r) : ''}">${cells}${act}</tr>`;
  }).join('');
  return `<table><thead><tr>${head}${actions ? '<th></th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
}

const panel = (title, html, sub = '') => `<div class="panel">${title ? `<h3>${title}</h3>` : ''}${sub ? `<p class="sub">${sub}</p>` : ''}${html}</div>`;
const options = (rows, valueKey, labelKey, selected) =>
  rows.map((r) => ({ value: r[valueKey], label: r[labelKey], selected: r[valueKey] === selected }));

// ---------- form dialog -----------------------------------------------
// fields: [{ name, label, type: 'text'|'number'|'date'|'select'|'password', options?, required?, value?, step?, min? }]
function openForm({ title, fields, hint = '', onChange, onSubmit }) {
  const dialog = $('#dialog');
  $('#form-title').textContent = title;
  $('#form-error').textContent = '';
  $('#form-hint').textContent = hint;
  $('#form-fields').innerHTML = fields.map((f) => {
    const req = f.required ? 'required' : '';
    if (f.type === 'select') {
      const opts = f.options.map((o) => `<option value="${esc(o.value)}" ${o.selected ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<label>${f.label}<select name="${f.name}" ${req}>${f.noBlank ? '' : '<option value="">— select —</option>'}${opts}</select></label>`;
    }
    const attrs = [f.step && `step="${f.step}"`, f.min !== undefined && `min="${f.min}"`, f.placeholder && `placeholder="${esc(f.placeholder)}"`].filter(Boolean).join(' ');
    return `<label>${f.label}<input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value)}" ${attrs} ${req}></label>`;
  }).join('');

  const form = $('#form');
  const values = () => Object.fromEntries(new FormData(form).entries());
  form.oninput = onChange ? () => onChange(values(), $('#form-hint')) : null;
  if (onChange) onChange(values(), $('#form-hint'));

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(values());
      dialog.close();
    } catch (err) {
      $('#form-error').textContent = err.message;
    }
  };
  $('#form-cancel').onclick = () => dialog.close();
  dialog.showModal();
}

// Converts '' to null so optional fields are sent as NULL.
const clean = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v]));

// ---------- master data views ------------------------------------------
const masters = {
  categories: {
    title: 'Categories', pk: 'Category_ID', label: 'category',
    columns: [{ key: 'Category_ID', label: 'ID' }, { key: 'Category_Name', label: 'Name' }, { key: 'Description', label: 'Description' }],
    fields: async (r = {}) => [
      { name: 'Category_Name', label: 'Name', required: true, value: r.Category_Name },
      { name: 'Description', label: 'Description', value: r.Description },
    ],
  },
  suppliers: {
    title: 'Suppliers', pk: 'Supplier_ID', label: 'supplier',
    columns: [{ key: 'Supplier_ID', label: 'ID' }, { key: 'Supplier_Name', label: 'Name' }, { key: 'Contact_Person', label: 'Contact' },
      { key: 'Phone', label: 'Phone' }, { key: 'Email', label: 'Email' }, { key: 'City', label: 'City' }],
    fields: async (r = {}) => [
      { name: 'Supplier_Name', label: 'Name', required: true, value: r.Supplier_Name },
      { name: 'Contact_Person', label: 'Contact person', value: r.Contact_Person },
      { name: 'Phone', label: 'Phone', value: r.Phone },
      { name: 'Email', label: 'Email', type: 'email', value: r.Email },
      { name: 'City', label: 'City', value: r.City },
    ],
  },
  warehouses: {
    title: 'Warehouses', pk: 'Warehouse_ID', label: 'warehouse',
    columns: [{ key: 'Warehouse_ID', label: 'ID' }, { key: 'Warehouse_Name', label: 'Name' }, { key: 'Location', label: 'Location' },
      { key: 'Capacity', label: 'Capacity', type: 'num' }, { key: 'Units_Stored', label: 'Stored', type: 'num' },
      { key: 'Utilization_Pct', label: 'Used', render: (r) => `${r.Utilization_Pct}%` }, { key: 'Stock_Value', label: 'Stock value', type: 'money' }],
    fields: async (r = {}) => [
      { name: 'Warehouse_Name', label: 'Name', required: true, value: r.Warehouse_Name },
      { name: 'Location', label: 'Location', required: true, value: r.Location },
      { name: 'Capacity', label: 'Capacity (units)', type: 'number', min: 1, required: true, value: r.Capacity },
    ],
  },
  customers: {
    title: 'Customers', pk: 'Customer_ID', label: 'customer',
    columns: [{ key: 'Customer_ID', label: 'ID' }, { key: 'Customer_Name', label: 'Name' }, { key: 'Phone', label: 'Phone' },
      { key: 'Email', label: 'Email' }, { key: 'City', label: 'City' }],
    fields: async (r = {}) => [
      { name: 'Customer_Name', label: 'Name', required: true, value: r.Customer_Name },
      { name: 'Phone', label: 'Phone', value: r.Phone },
      { name: 'Email', label: 'Email', type: 'email', value: r.Email },
      { name: 'City', label: 'City', value: r.City },
    ],
  },
  products: {
    title: 'Products', pk: 'Product_ID', label: 'product',
    columns: [{ key: 'Product_ID', label: 'ID' }, { key: 'Product_Name', label: 'Name' }, { key: 'Category_Name', label: 'Category' },
      { key: 'Supplier_Name', label: 'Supplier' }, { key: 'Cost_Price', label: 'Cost', type: 'money' },
      { key: 'Selling_Price', label: 'Price', type: 'money' }, { key: 'Reorder_Level', label: 'Reorder at', type: 'num' },
      { key: 'Total_Stock', label: 'In stock', type: 'num' }],
    rowClass: (r) => (r.Total_Stock <= r.Reorder_Level ? 'low' : ''),
    fields: async (r = {}) => {
      const [cats, sups] = await Promise.all([api('GET', '/categories'), api('GET', '/suppliers')]);
      return [
        { name: 'Product_Name', label: 'Name', required: true, value: r.Product_Name },
        { name: 'Category_ID', label: 'Category', type: 'select', required: true, options: options(cats, 'Category_ID', 'Category_Name', r.Category_ID) },
        { name: 'Supplier_ID', label: 'Supplier', type: 'select', required: true, options: options(sups, 'Supplier_ID', 'Supplier_Name', r.Supplier_ID) },
        { name: 'Cost_Price', label: 'Cost price (₹)', type: 'number', step: '0.01', min: 0, required: true, value: r.Cost_Price },
        { name: 'Selling_Price', label: 'Selling price (₹)', type: 'number', step: '0.01', min: 0, required: true, value: r.Selling_Price },
        { name: 'Reorder_Level', label: 'Reorder level', type: 'number', min: 0, required: true, value: r.Reorder_Level ?? 10 },
      ];
    },
  },
};

function masterView(path) {
  const cfg = masters[path];
  let q = '';
  return {
    title: cfg.title,
    async render() {
      const canWrite = can(path);
      const canDelete = can('delete');
      toolbar.innerHTML = `<input id="search" placeholder="Search…" value="${esc(q)}">${canWrite ? `<button id="add">+ Add ${cfg.label}</button>` : ''}`;
      $('#search').oninput = debounce((e) => { q = e.target.value; load(); }, 250);
      if (canWrite) {
        $('#add').onclick = async () => openForm({
          title: `New ${cfg.label}`,
          fields: await cfg.fields(),
          onSubmit: async (v) => { await api('POST', `/${path}`, clean(v)); toast(`${cfg.label} created`); load(); },
        });
      }
      const load = async () => {
        const rows = await api('GET', `/${path}${q ? '?q=' + encodeURIComponent(q) : ''}`);
        const actions = canWrite || canDelete
          ? (r) => `${canWrite ? `<button class="small secondary" data-edit="${r[cfg.pk]}">Edit</button>` : ''}${canDelete ? `<button class="small danger" data-del="${r[cfg.pk]}">Delete</button>` : ''}`
          : null;
        content.innerHTML = panel('', table(rows, cfg.columns, { rowClass: cfg.rowClass, actions }));
        content.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = async () => {
          const row = rows.find((r) => String(r[cfg.pk]) === b.dataset.edit);
          openForm({
            title: `Edit ${cfg.label} #${row[cfg.pk]}`,
            fields: await cfg.fields(row),
            onSubmit: async (v) => { await api('PUT', `/${path}/${row[cfg.pk]}`, clean(v)); toast('Saved'); load(); },
          });
        }));
        content.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
          if (!confirm(`Delete ${cfg.label} #${b.dataset.del}?`)) return;
          try { await api('DELETE', `/${path}/${b.dataset.del}`); toast('Deleted'); load(); } catch (e) { toast(e.message, false); }
        }));
      };
      await load();
    },
  };
}

// ---------- order views -------------------------------------------------
function orderView({ path, title, pk, party, partyPath, partyName, priceField, priceLabel, totalKey, statuses, actions }) {
  let status = '';
  return {
    title,
    async render() {
      const canWrite = can(path);
      toolbar.innerHTML = `<select id="status"><option value="">All statuses</option>${statuses.map((s) => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        ${canWrite ? '<button id="add">+ New order</button>' : ''}`;
      $('#status').onchange = (e) => { status = e.target.value; load(); };
      if (canWrite) $('#add').onclick = newOrder;

      const columns = [
        { key: pk, label: '#' }, { key: 'Order_Date', label: 'Date', type: 'date' }, { key: partyName, label: party },
        { key: 'Product_Name', label: 'Product' }, { key: 'Warehouse_Name', label: 'Warehouse' },
        { key: 'Quantity', label: 'Qty', type: 'num' }, { key: priceField, label: priceLabel, type: 'money' },
        { key: totalKey, label: 'Total', type: 'money' }, { key: 'Status', label: 'Status', type: 'badge' },
      ];

      const load = async () => {
        const rows = await api('GET', `/${path}${status ? '?status=' + status : ''}`);
        content.innerHTML = panel('', table(rows, columns, {
          actions: canWrite ? (r) => r.Status !== 'Pending' ? '' : actions.map((a) =>
            `<button class="small ${a.cls}" data-act="${a.action}" data-id="${r[pk]}">${a.label}</button>`).join('') : null,
        }));
        content.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
          try {
            await api('POST', `/${path}/${b.dataset.id}/${b.dataset.act}`);
            toast(`Order #${b.dataset.id}: ${b.dataset.act === 'cancel' ? 'cancelled' : b.dataset.act === 'ship' ? 'shipped' : 'received'}`);
            load();
          } catch (e) { toast(e.message, false); }
        }));
      };

      async function newOrder() {
        const [parties, products, warehouses] = await Promise.all([api('GET', `/${partyPath}`), api('GET', '/products'), api('GET', '/warehouses')]);
        const partyKey = party + '_ID';
        const isSale = path === 'sales-orders';
        openForm({
          title: `New ${isSale ? 'sales' : 'purchase'} order`,
          fields: [
            { name: partyKey, label: party + (isSale ? '' : ' (blank = product\'s supplier)'), type: 'select', required: isSale, options: options(parties, partyKey, partyName) },
            { name: 'Product_ID', label: 'Product', type: 'select', required: true, options: options(products, 'Product_ID', 'Product_Name') },
            { name: 'Warehouse_ID', label: 'Warehouse', type: 'select', required: true, options: options(warehouses, 'Warehouse_ID', 'Warehouse_Name') },
            { name: 'Quantity', label: 'Quantity', type: 'number', min: 1, required: true },
            { name: priceField, label: `${priceLabel} (₹, blank = product default)`, type: 'number', step: '0.01', min: 0 },
            { name: 'Order_Date', label: 'Order date', type: 'date', value: new Date().toISOString().slice(0, 10) },
          ],
          onChange: debounce(async (v, hint) => {
            const p = products.find((x) => String(x.Product_ID) === v.Product_ID);
            if (!p) { hint.textContent = ''; return; }
            let text = `Default ${priceLabel.toLowerCase()}: ${money(isSale ? p.Selling_Price : p.Cost_Price)}.`;
            if (v.Warehouse_ID) {
              const a = await api('GET', `/stock/available?Product_ID=${v.Product_ID}&Warehouse_ID=${v.Warehouse_ID}`);
              text += ` Available in warehouse: ${num(a.Available)} units.`;
            }
            hint.textContent = text;
          }, 150),
          onSubmit: async (v) => {
            const o = await api('POST', `/${path}`, clean(v));
            toast(`Order #${o[pk]} created`);
            load();
          },
        });
      }
      await load();
    },
  };
}

// ---------- dashboard ---------------------------------------------------
// Each widget fetches what it needs from `data` and returns HTML (or mounts into its element).
const widgets = {
  stockLevels: {
    title: 'Stock vs reorder level',
    sub: 'Total units across all warehouses. Red bars need reordering.',
    html: ({ products }) => {
      const rows = [...products].sort((a, b) => (a.Total_Stock / Math.max(a.Reorder_Level, 1)) - (b.Total_Stock / Math.max(b.Reorder_Level, 1)));
      return Charts.bars(rows, {
        label: (r) => r.Product_Name, value: (r) => r.Total_Stock, marker: (r) => r.Reorder_Level,
        markerLabel: 'Reorder level', low: (r) => r.Total_Stock <= r.Reorder_Level, fmt: (v) => `${num(v)} units`,
      }) + Charts.table(rows, [
        { key: 'Product_Name', label: 'Product' }, { key: 'Total_Stock', label: 'In stock', num: true },
        { key: 'Reorder_Level', label: 'Reorder level', num: true }]);
    },
  },
  warehouses: {
    title: 'Warehouse capacity',
    sub: 'Units stored as a share of each warehouse\'s capacity.',
    html: ({ warehouses }) => `<div class="meters">${warehouses.map((w) =>
      Charts.meter(w.Warehouse_Name, Number(w.Utilization_Pct), `${num(w.Units_Stored)} of ${num(w.Capacity)} units · ${w.Location}`)).join('')}</div>`,
  },
  monthlyBoth: {
    title: 'Purchases vs sales by month',
    sub: 'Value of received purchase orders and shipped sales orders.',
    mount: (el, { monthly }) => Charts.lines(el, monthly, {
      x: (r) => monthName(r.Month), fmt: money0,
      series: [{ key: 'Purchases', label: 'Purchases', color: 'var(--series-1)' }, { key: 'Sales', label: 'Sales', color: 'var(--series-2)' }],
    }),
    table: ({ monthly }) => Charts.table(monthly, [{ key: 'Month', label: 'Month', fmt: monthName },
      { key: 'Purchases', label: 'Purchases', num: true, fmt: money0 }, { key: 'Sales', label: 'Sales', num: true, fmt: money0 }]),
  },
  monthlySales: {
    title: 'Sales by month',
    sub: 'Value of shipped sales orders.',
    html: ({ monthly }) => Charts.columns(monthly, { x: (r) => monthName(r.Month), y: (r) => r.Sales, fmt: money0 })
      + Charts.table(monthly, [{ key: 'Month', label: 'Month', fmt: monthName }, { key: 'Sales', label: 'Sales', num: true, fmt: money0 }]),
  },
  monthlyPurchases: {
    title: 'Purchases by month',
    sub: 'Value of received purchase orders.',
    html: ({ monthly }) => Charts.columns(monthly, { x: (r) => monthName(r.Month), y: (r) => r.Purchases, fmt: money0 })
      + Charts.table(monthly, [{ key: 'Month', label: 'Month', fmt: monthName }, { key: 'Purchases', label: 'Purchases', num: true, fmt: money0 }]),
  },
  salesByCategory: {
    title: 'Revenue by category',
    sub: 'Shipped sales orders.',
    html: ({ byCategory }) => Charts.bars(byCategory, { label: (r) => r.Category_Name, value: (r) => r.Revenue, fmt: money0 })
      + Charts.table(byCategory, [{ key: 'Category_Name', label: 'Category' }, { key: 'Units_Sold', label: 'Units', num: true },
        { key: 'Revenue', label: 'Revenue', num: true, fmt: money0 }]),
  },
  topProducts: {
    title: 'Top products by revenue',
    sub: 'Shipped sales orders.',
    html: ({ byProduct }) => {
      const rows = byProduct.slice(0, 8);
      return Charts.bars(rows, { label: (r) => r.Product_Name, value: (r) => r.Revenue, fmt: money0 })
        + Charts.table(rows, [{ key: 'Product_Name', label: 'Product' }, { key: 'Units_Sold', label: 'Units', num: true },
          { key: 'Revenue', label: 'Revenue', num: true, fmt: money0 }]);
    },
  },
  profitByProduct: {
    title: 'Gross profit by product',
    sub: 'Quantity × (selling price − cost price), shipped orders.',
    html: ({ byProduct }) => {
      const rows = [...byProduct].sort((a, b) => b.Profit - a.Profit).slice(0, 8);
      return Charts.bars(rows, { label: (r) => r.Product_Name, value: (r) => r.Profit, fmt: money0 })
        + Charts.table(rows, [{ key: 'Product_Name', label: 'Product' }, { key: 'Revenue', label: 'Revenue', num: true, fmt: money0 },
          { key: 'Profit', label: 'Profit', num: true, fmt: money0 }]);
    },
  },
  topCustomers: {
    title: 'Top customers',
    sub: 'Total value of shipped orders.',
    html: ({ customers }) => Charts.bars(customers, { label: (r) => r.Customer_Name, value: (r) => r.Total_Spent, fmt: money0 })
      + Charts.table(customers, [{ key: 'Customer_Name', label: 'Customer' }, { key: 'Orders', label: 'Orders', num: true },
        { key: 'Total_Spent', label: 'Total spent', num: true, fmt: money0 }]),
  },
  supplierPurchases: {
    title: 'Purchases by supplier',
    sub: 'Value of received purchase orders.',
    html: ({ suppliers }) => Charts.bars(suppliers, { label: (r) => r.Supplier_Name, value: (r) => r.Received_Value, fmt: money0 })
      + Charts.table(suppliers, [{ key: 'Supplier_Name', label: 'Supplier' }, { key: 'Received_Value', label: 'Received', num: true, fmt: money0 },
        { key: 'Pending_Value', label: 'Pending', num: true, fmt: money0 }]),
  },
  orderStatus: {
    title: 'Order status',
    sub: 'How many orders are pending, completed or cancelled.',
    html: ({ status }, types = ['Purchase', 'Sales']) => Charts.statusBars(status, types),
  },
  purchaseStatus: { title: 'Purchase order status', sub: 'Pending orders still need to be received.', html: (d) => widgets.orderStatus.html(d, ['Purchase']) },
  salesStatus: { title: 'Sales order status', sub: 'Pending orders still need to be shipped.', html: (d) => widgets.orderStatus.html(d, ['Sales']) },
};

// KPI tiles and chart rows for each role.
const DASHBOARDS = {
  Admin: {
    kpis: ['Inventory_Value', 'Total_Revenue', 'Total_Profit', 'Low_Stock_Products', 'Pending_Purchase_Orders', 'Pending_Sales_Orders'],
    rows: [['monthlyBoth', 'orderStatus'], ['stockLevels', 'warehouses'], ['salesByCategory', 'topCustomers']],
  },
  'Purchase Manager': {
    kpis: ['Inventory_Value', 'Units_In_Stock', 'Low_Stock_Products', 'Pending_Purchase_Orders'],
    rows: [['stockLevels', 'warehouses'], ['monthlyPurchases', 'supplierPurchases'], ['purchaseStatus']],
  },
  'Sales Staff': {
    kpis: ['Total_Revenue', 'Pending_Sales_Orders', 'Customers', 'Low_Stock_Products'],
    rows: [['monthlySales', 'topProducts'], ['stockLevels', 'topCustomers'], ['salesStatus']],
  },
  Viewer: {
    kpis: ['Inventory_Value', 'Total_Revenue', 'Total_Profit', 'Low_Stock_Products'],
    rows: [['monthlyBoth', 'profitByProduct'], ['stockLevels', 'warehouses'], ['salesByCategory', 'orderStatus']],
  },
};

const KPI_INFO = {
  Inventory_Value: ['Inventory value', money0, 'at cost price'],
  Units_In_Stock: ['Units in stock', num, 'all warehouses'],
  Total_Revenue: ['Revenue', money0, 'shipped orders'],
  Total_Profit: ['Gross profit', money0, 'shipped orders'],
  Low_Stock_Products: ['Low-stock products', num, 'at or below reorder level'],
  Pending_Purchase_Orders: ['Pending purchase orders', num, 'awaiting receipt'],
  Pending_Sales_Orders: ['Pending sales orders', num, 'awaiting shipment'],
  Customers: ['Customers', num, 'registered'],
};

const dashboardView = {
  title: 'Dashboard',
  async render() {
    toolbar.innerHTML = '';
    const dash = DASHBOARDS[session.user.Role];
    const [kpi, products, warehouses, monthly, byCategory, byProduct, customers, suppliers, status] = await Promise.all([
      api('GET', '/reports/dashboard'), api('GET', '/products'), api('GET', '/reports/warehouse-utilization'),
      api('GET', '/reports/monthly'), api('GET', '/reports/sales-by-category'), api('GET', '/reports/sales-by-product'),
      api('GET', '/reports/top-customers'), api('GET', '/reports/supplier-purchases'), api('GET', '/reports/order-status'),
    ]);
    const data = { products, warehouses, monthly, byCategory, byProduct, customers, suppliers, status };

    const tiles = dash.kpis.map((k) => {
      const [label, fmt, note] = KPI_INFO[k];
      return `<div class="kpi"><div class="label">${label}</div><div class="value">${fmt(kpi[k])}</div><div class="note">${note}</div></div>`;
    }).join('');
    const card = (name) => {
      const w = widgets[name];
      const body = w.mount ? `<div data-mount="${name}"></div>${w.table ? w.table(data) : ''}` : w.html(data);
      return panel(w.title, body, w.sub);
    };
    content.innerHTML = `<p class="muted" style="margin:-8px 0 14px">Welcome, ${esc(session.user.Full_Name)}. Showing the ${esc(session.user.Role.toLowerCase())} view.</p>
      <div class="kpis">${tiles}</div>
      ${dash.rows.map((row) => `<div class="${row.length > 1 ? 'grid2' : ''} stack-gap">${row.map(card).join('')}</div>`).join('')}`;
    const mountAll = () => content.querySelectorAll('[data-mount]').forEach((el) => widgets[el.dataset.mount].mount(el, data));
    mountAll();
    dashboardView._resize = debounce(mountAll, 150);
  },
};
window.addEventListener('resize', () => dashboardView._resize && currentView === dashboardView && dashboardView._resize());

// ---------- other views -----------------------------------------------
const views = {
  dashboard: dashboardView,

  stock: {
    title: 'Stock',
    async render() {
      const warehouses = await api('GET', '/warehouses');
      let wid = '';
      toolbar.innerHTML = `<select id="wh"><option value="">All warehouses</option>${warehouses.map((w) => `<option value="${w.Warehouse_ID}">${esc(w.Warehouse_Name)}</option>`).join('')}</select>
        ${can('transfer') ? '<button id="transfer">Transfer stock</button>' : ''}`;
      $('#wh').onchange = (e) => { wid = e.target.value; load(); };
      if (can('transfer')) {
        $('#transfer').onclick = async () => {
          const products = await api('GET', '/products');
          const whOpts = () => options(warehouses, 'Warehouse_ID', 'Warehouse_Name');
          openForm({
            title: 'Transfer stock between warehouses',
            fields: [
              { name: 'Product_ID', label: 'Product', type: 'select', required: true, options: options(products, 'Product_ID', 'Product_Name') },
              { name: 'From_Warehouse_ID', label: 'From', type: 'select', required: true, options: whOpts() },
              { name: 'To_Warehouse_ID', label: 'To', type: 'select', required: true, options: whOpts() },
              { name: 'Quantity', label: 'Quantity', type: 'number', min: 1, required: true },
            ],
            onSubmit: async (v) => { await api('POST', '/stock/transfer', v); toast('Stock transferred'); load(); },
          });
        };
      }
      const load = async () => {
        const rows = await api('GET', `/stock${wid ? '?Warehouse_ID=' + wid : ''}`);
        content.innerHTML = panel('', table(rows, [
          { key: 'Product_Name', label: 'Product' }, { key: 'Category_Name', label: 'Category' },
          { key: 'Warehouse_Name', label: 'Warehouse' }, { key: 'Quantity', label: 'Quantity', type: 'num' },
          { key: 'Stock_Value', label: 'Value (cost)', type: 'money' }, { key: 'Last_Updated', label: 'Last updated', type: 'date' }]),
        'Stock updates automatically when purchase orders are received and sales orders are shipped.');
      };
      await load();
    },
  },

  'purchase-orders': orderView({
    path: 'purchase-orders', title: 'Purchase Orders', pk: 'PO_ID', party: 'Supplier', partyPath: 'suppliers',
    partyName: 'Supplier_Name', priceField: 'Unit_Cost', priceLabel: 'Unit cost', totalKey: 'Total_Cost',
    statuses: ['Pending', 'Received', 'Cancelled'],
    actions: [{ action: 'receive', label: 'Receive', cls: 'ok' }, { action: 'cancel', label: 'Cancel', cls: 'danger' }],
  }),

  'sales-orders': orderView({
    path: 'sales-orders', title: 'Sales Orders', pk: 'SO_ID', party: 'Customer', partyPath: 'customers',
    partyName: 'Customer_Name', priceField: 'Unit_Price', priceLabel: 'Unit price', totalKey: 'Total_Amount',
    statuses: ['Pending', 'Shipped', 'Cancelled'],
    actions: [{ action: 'ship', label: 'Ship', cls: 'ok' }, { action: 'cancel', label: 'Cancel', cls: 'danger' }],
  }),

  reports: {
    title: 'Reports',
    async render() {
      toolbar.innerHTML = '';
      const [byProduct, byCategory, customers, suppliers, monthly] = await Promise.all(
        ['sales-by-product', 'sales-by-category', 'top-customers', 'supplier-purchases', 'monthly'].map((r) => api('GET', '/reports/' + r)));
      content.innerHTML = `
        ${panel('Sales by product (shipped)', table(byProduct, [
          { key: 'Product_Name', label: 'Product' }, { key: 'Units_Sold', label: 'Units', type: 'num' },
          { key: 'Revenue', label: 'Revenue', type: 'money' }, { key: 'Profit', label: 'Profit', type: 'money' }]))}
        <div class="grid2 stack-gap">
          ${panel('Sales by category', table(byCategory, [
            { key: 'Category_Name', label: 'Category' }, { key: 'Orders', label: 'Orders', type: 'num' },
            { key: 'Units_Sold', label: 'Units', type: 'num' }, { key: 'Revenue', label: 'Revenue', type: 'money' }]))}
          ${panel('Top customers', table(customers, [
            { key: 'Customer_Name', label: 'Customer' }, { key: 'Orders', label: 'Orders', type: 'num' },
            { key: 'Total_Spent', label: 'Total spent', type: 'money' }]))}
          ${panel('Purchases by supplier', table(suppliers, [
            { key: 'Supplier_Name', label: 'Supplier' }, { key: 'Orders', label: 'Orders', type: 'num' },
            { key: 'Received_Value', label: 'Received', type: 'money' }, { key: 'Pending_Value', label: 'Pending', type: 'money' }]))}
          ${panel('Monthly purchases vs sales', table(monthly.map((m) => ({ ...m, Month: monthName(m.Month) })), [
            { key: 'Month', label: 'Month' }, { key: 'Purchases', label: 'Purchases', type: 'money' },
            { key: 'Sales', label: 'Sales', type: 'money' }]))}
        </div>`;
    },
  },

  users: {
    title: 'Users',
    async render() {
      toolbar.innerHTML = '<button id="add">+ Add user</button>';
      const roles = Object.keys(DASHBOARDS);
      const fields = (u = {}) => [
        { name: 'Full_Name', label: 'Full name', required: true, value: u.Full_Name },
        { name: 'Email', label: 'Email', type: 'email', required: true, value: u.Email },
        { name: 'Role', label: 'Role', type: 'select', required: true, noBlank: true, options: roles.map((r) => ({ value: r, label: r, selected: r === (u.Role || 'Viewer') })) },
        { name: 'Is_Active', label: 'Status', type: 'select', noBlank: true, options: [{ value: 1, label: 'Active', selected: u.Is_Active !== 0 }, { value: 0, label: 'Deactivated', selected: u.Is_Active === 0 }] },
        { name: 'Password', label: u.User_ID ? 'New password (leave blank to keep)' : 'Password (min 6 characters)', type: 'password', required: !u.User_ID },
      ];
      $('#add').onclick = () => openForm({
        title: 'New user', fields: fields(),
        onSubmit: async (v) => { await api('POST', '/users', clean(v)); toast('User created'); load(); },
      });
      const load = async () => {
        const rows = (await api('GET', '/users')).map((u) => ({ ...u, State: u.Is_Active ? 'Active' : 'Deactivated' }));
        content.innerHTML = panel('', table(rows, [
          { key: 'Full_Name', label: 'Name' }, { key: 'Email', label: 'Email' }, { key: 'Role', label: 'Role' },
          { key: 'State', label: 'Status', type: 'badge' }, { key: 'Last_Login', label: 'Last login', type: 'date' }], {
          actions: (u) => `<button class="small secondary" data-edit="${u.User_ID}">Edit</button>${u.User_ID === session.user.User_ID ? '' : `<button class="small danger" data-del="${u.User_ID}">Delete</button>`}`,
        }), 'Each role sees a different dashboard and can only change what its job needs.');
        content.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
          const u = rows.find((r) => String(r.User_ID) === b.dataset.edit);
          openForm({
            title: `Edit ${u.Full_Name}`, fields: fields(u),
            onSubmit: async (v) => { await api('PUT', `/users/${u.User_ID}`, clean(v)); toast('Saved'); load(); },
          });
        }));
        content.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
          if (!confirm('Delete this user?')) return;
          try { await api('DELETE', `/users/${b.dataset.del}`); toast('User deleted'); load(); } catch (e) { toast(e.message, false); }
        }));
      };
      await load();
    },
  },
};
for (const path of Object.keys(masters)) views[path] = masterView(path);

// ---------- navigation ---------------------------------------------------
const NAV = [
  ['dashboard', 'Dashboard'], ['stock', 'Stock'], ['purchase-orders', 'Purchases'], ['sales-orders', 'Sales'],
  ['products', 'Products'], ['categories', 'Categories'], ['suppliers', 'Suppliers'], ['warehouses', 'Warehouses'],
  ['customers', 'Customers'], ['reports', 'Reports'], ['users', 'Users'],
];
let currentView = null;

function buildNav() {
  $('#nav').innerHTML = NAV.filter(([v]) => v !== 'users' || can('users'))
    .map(([v, label]) => `<a data-view="${v}" href="#${v}">${label}</a>`).join('');
}

async function show() {
  if (!session) return showLogin();
  let name = location.hash.slice(1) || 'dashboard';
  if (name === 'users' && !can('users')) name = 'dashboard';
  const view = views[name] || views.dashboard;
  currentView = view;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  $('#title').textContent = view.title;
  content.innerHTML = '<div class="empty">Loading…</div>';
  try {
    await view.render();
  } catch (e) {
    if (session) content.innerHTML = panel('', `<div class="error">${esc(e.message)}</div>`);
  }
}

// ---------- login / logout -----------------------------------------------
async function showLogin(message = '') {
  $('#app').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-error').textContent = message;
  try {
    const demo = await api('GET', '/auth/demo-accounts');
    $('#demo-accounts').innerHTML = demo.length ? `<div class="title">Demo accounts (click to fill in)</div>${demo.map((d) =>
      `<button type="button" class="demo" data-email="${esc(d.Email)}" data-pw="${esc(d.Password)}"><span>${esc(d.Role)}</span><small>${esc(d.Email)}</small></button>`).join('')}` : '';
    document.querySelectorAll('.demo').forEach((b) => (b.onclick = () => {
      $('#login-form').Email.value = b.dataset.email;
      $('#login-form').Password.value = b.dataset.pw;
    }));
  } catch { /* demo list is optional */ }
}

function showApp() {
  $('#login-screen').hidden = true;
  $('#app').hidden = false;
  $('#user-name').textContent = session.user.Full_Name;
  $('#user-role').textContent = session.user.Role;
  buildNav();
  show();
}

$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const res = await api('POST', '/auth/login', { Email: f.Email.value, Password: f.Password.value });
    saveSession(res);
    f.reset();
    location.hash = 'dashboard';
    showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
};

$('#user-btn').onclick = () => ($('#user-menu').hidden = !$('#user-menu').hidden);
document.addEventListener('click', (e) => { if (!e.target.closest('.user')) $('#user-menu').hidden = true; });
$('#logout').onclick = () => { saveSession(null); $('#user-menu').hidden = true; showLogin(); };
$('#change-pw').onclick = () => {
  $('#user-menu').hidden = true;
  openForm({
    title: 'Change password',
    fields: [
      { name: 'Current_Password', label: 'Current password', type: 'password', required: true },
      { name: 'New_Password', label: 'New password (min 6 characters)', type: 'password', required: true },
    ],
    onSubmit: async (v) => { await api('POST', '/auth/change-password', v); toast('Password changed'); },
  });
};

window.addEventListener('hashchange', show);
Charts.initTooltip();
loadSession();
if (session) {
  // confirm the stored session is still valid (and pick up role changes)
  api('GET', '/auth/me').then((user) => { saveSession({ ...session, user }); showApp(); }).catch(() => {});
} else {
  showLogin();
}

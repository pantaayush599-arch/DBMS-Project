// Simple vanilla-JS client for the Inventory & Stock Management API.

const $ = (sel) => document.querySelector(sel);
const content = $('#content');
const toolbar = $('#toolbar');

// ---------- helpers ----------------------------------------------------
async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number(v || 0).toLocaleString('en-IN');

function toast(msg, ok = true) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + (ok ? 'ok' : 'err');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = ''), 3000);
}

// columns: [{ key, label, type?: 'money'|'num'|'badge'|'bar'|'date', render?(row) }]
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
      if (c.type === 'bar') return `<td><div class="bar" title="${v}%"><div style="width:${Math.min(v, 100)}%"></div></div> ${v}%</td>`;
      return `<td${c.type === 'date' ? ' class="nowrap"' : ''}>${esc(v)}</td>`;
    }).join('');
    const act = actions ? `<td class="actions">${actions(r)}</td>` : '';
    return `<tr class="${rowClass ? rowClass(r) : ''}">${cells}${act}</tr>`;
  }).join('');
  return `<table><thead><tr>${head}${actions ? '<th></th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
}

const panel = (title, html) => `<div class="panel">${title ? `<h3>${title}</h3>` : ''}${html}</div>`;
const options = (rows, valueKey, labelKey, selected) =>
  rows.map((r) => ({ value: r[valueKey], label: r[labelKey], selected: r[valueKey] === selected }));

// ---------- form dialog -----------------------------------------------
// fields: [{ name, label, type: 'text'|'number'|'date'|'select', options?, required?, value?, step?, min? }]
function openForm({ title, fields, hint = '', onChange, onSubmit }) {
  const dialog = $('#dialog');
  $('#form-title').textContent = title;
  $('#form-error').textContent = '';
  $('#form-hint').textContent = hint;
  $('#form-fields').innerHTML = fields.map((f) => {
    const req = f.required ? 'required' : '';
    if (f.type === 'select') {
      const opts = f.options.map((o) => `<option value="${esc(o.value)}" ${o.selected ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<label>${f.label}<select name="${f.name}" ${req}><option value="">— select —</option>${opts}</select></label>`;
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
      { key: 'Utilization_Pct', label: 'Utilization', type: 'bar' }, { key: 'Stock_Value', label: 'Stock value', type: 'money' }],
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
      toolbar.innerHTML = `<input id="search" placeholder="Search…" value="${esc(q)}"><button id="add">+ Add ${cfg.label}</button>`;
      $('#search').oninput = debounce((e) => { q = e.target.value; load(); }, 250);
      $('#add').onclick = async () => openForm({
        title: `New ${cfg.label}`,
        fields: await cfg.fields(),
        onSubmit: async (v) => { await api('POST', `/${path}`, clean(v)); toast(`${cfg.label} created`); load(); },
      });
      const load = async () => {
        const rows = await api('GET', `/${path}${q ? '?q=' + encodeURIComponent(q) : ''}`);
        content.innerHTML = panel('', table(rows, cfg.columns, {
          rowClass: cfg.rowClass,
          actions: (r) => `<button class="small secondary" data-edit="${r[cfg.pk]}">Edit</button><button class="small danger" data-del="${r[cfg.pk]}">Delete</button>`,
        }));
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
      toolbar.innerHTML = `<select id="status"><option value="">All statuses</option>${statuses.map((s) => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button id="add">+ New order</button>`;
      $('#status').onchange = (e) => { status = e.target.value; load(); };
      $('#add').onclick = newOrder;

      const columns = [
        { key: pk, label: '#' }, { key: 'Order_Date', label: 'Date', type: 'date' }, { key: partyName, label: party },
        { key: 'Product_Name', label: 'Product' }, { key: 'Warehouse_Name', label: 'Warehouse' },
        { key: 'Quantity', label: 'Qty', type: 'num' }, { key: priceField, label: priceLabel, type: 'money' },
        { key: totalKey, label: 'Total', type: 'money' }, { key: 'Status', label: 'Status', type: 'badge' },
      ];
      if (path === 'sales-orders') columns.splice(8, 0, { key: 'Profit', label: 'Profit', type: 'money' });

      const load = async () => {
        const rows = await api('GET', `/${path}${status ? '?status=' + status : ''}`);
        content.innerHTML = panel('', table(rows, columns, {
          actions: (r) => r.Status !== 'Pending' ? '' : actions.map((a) =>
            `<button class="small ${a.cls}" data-act="${a.action}" data-id="${r[pk]}">${a.label}</button>`).join(''),
        }));
        content.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
          try {
            await api('POST', `/${path}/${b.dataset.id}/${b.dataset.act}`);
            toast(`Order #${b.dataset.id}: ${b.textContent.toLowerCase()} done`);
            load();
          } catch (e) { toast(e.message, false); }
        }));
      };

      async function newOrder() {
        const [parties, products, warehouses] = await Promise.all([api('GET', `/${partyPath}`), api('GET', '/products'), api('GET', '/warehouses')]);
        const partyKey = party + '_ID';
        const isSale = path === 'sales-orders';
        openForm({
          title: `New ${title.replace(/s$/, '').toLowerCase()}`,
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

// ---------- other views -----------------------------------------------
const views = {
  dashboard: {
    title: 'Dashboard',
    async render() {
      toolbar.innerHTML = '';
      const [d, low, wh] = await Promise.all([api('GET', '/reports/dashboard'), api('GET', '/stock/low'), api('GET', '/reports/warehouse-utilization')]);
      const card = (label, value, cls = '') => `<div class="card ${cls}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
      content.innerHTML = `
        <div class="cards">
          ${card('Products', num(d.Products))}
          ${card('Units in stock', num(d.Units_In_Stock))}
          ${card('Inventory value', money(d.Inventory_Value))}
          ${card('Low-stock products', num(d.Low_Stock_Products), d.Low_Stock_Products ? 'warn' : '')}
          ${card('Pending purchase orders', num(d.Pending_Purchase_Orders))}
          ${card('Pending sales orders', num(d.Pending_Sales_Orders))}
          ${card('Revenue (shipped)', money(d.Total_Revenue))}
          ${card('Gross profit', money(d.Total_Profit))}
        </div>
        <div class="grid2">
          ${panel('Low-stock list (at or below reorder level)', table(low, [
            { key: 'Product_Name', label: 'Product' }, { key: 'Supplier_Name', label: 'Supplier' },
            { key: 'Total_Stock', label: 'Stock', type: 'num' }, { key: 'Reorder_Level', label: 'Reorder at', type: 'num' },
            { key: 'Shortfall', label: 'Shortfall', type: 'num' }]))}
          ${panel('Warehouse utilization', table(wh, [
            { key: 'Warehouse_Name', label: 'Warehouse' }, { key: 'Units_Stored', label: 'Units', type: 'num' },
            { key: 'Capacity', label: 'Capacity', type: 'num' }, { key: 'Utilization_Pct', label: 'Used', type: 'bar' }]))}
        </div>`;
    },
  },

  stock: {
    title: 'Stock',
    async render() {
      const warehouses = await api('GET', '/warehouses');
      let wid = '';
      toolbar.innerHTML = `<select id="wh"><option value="">All warehouses</option>${warehouses.map((w) => `<option value="${w.Warehouse_ID}">${esc(w.Warehouse_Name)}</option>`).join('')}</select>
        <button id="transfer">Transfer stock</button>`;
      $('#wh').onchange = (e) => { wid = e.target.value; load(); };
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
      const load = async () => {
        const rows = await api('GET', `/stock${wid ? '?Warehouse_ID=' + wid : ''}`);
        content.innerHTML = panel('Stock is updated automatically when purchase orders are received and sales orders are shipped.', table(rows, [
          { key: 'Product_Name', label: 'Product' }, { key: 'Category_Name', label: 'Category' },
          { key: 'Warehouse_Name', label: 'Warehouse' }, { key: 'Quantity', label: 'Quantity', type: 'num' },
          { key: 'Stock_Value', label: 'Value (cost)', type: 'money' }, { key: 'Last_Updated', label: 'Last updated', type: 'date' }]));
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
        <div class="grid2">
          ${panel('Sales by category', table(byCategory, [
            { key: 'Category_Name', label: 'Category' }, { key: 'Orders', label: 'Orders', type: 'num' },
            { key: 'Units_Sold', label: 'Units', type: 'num' }, { key: 'Revenue', label: 'Revenue', type: 'money' }]))}
          ${panel('Top customers', table(customers, [
            { key: 'Customer_Name', label: 'Customer' }, { key: 'Orders', label: 'Orders', type: 'num' },
            { key: 'Total_Spent', label: 'Total spent', type: 'money' }]))}
          ${panel('Purchases by supplier', table(suppliers, [
            { key: 'Supplier_Name', label: 'Supplier' }, { key: 'Orders', label: 'Orders', type: 'num' },
            { key: 'Received_Value', label: 'Received', type: 'money' }, { key: 'Pending_Value', label: 'Pending', type: 'money' }]))}
          ${panel('Monthly purchases vs sales', table(monthly, [
            { key: 'Month', label: 'Month' }, { key: 'Purchases', label: 'Purchases', type: 'money' },
            { key: 'Sales', label: 'Sales', type: 'money' }]))}
        </div>`;
    },
  },
};
for (const path of Object.keys(masters)) views[path] = masterView(path);

// ---------- routing -----------------------------------------------------
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function show() {
  const name = location.hash.slice(1) || 'dashboard';
  const view = views[name] || views.dashboard;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  $('#title').textContent = view.title;
  content.innerHTML = '<div class="empty">Loading…</div>';
  try {
    await view.render();
  } catch (e) {
    content.innerHTML = panel('', `<div class="error">${esc(e.message)}</div>`);
  }
}

document.querySelectorAll('#nav a').forEach((a) => (a.onclick = () => (location.hash = a.dataset.view)));
window.addEventListener('hashchange', show);
show();

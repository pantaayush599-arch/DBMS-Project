// End-to-end tests against a real MySQL database (inventory_test by default).
// Requires the DB credentials in .env; the test database is recreated on every run.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

process.env.DB_NAME = process.env.TEST_DB_NAME || 'inventory_test';
execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'init-db.js')], {
  env: process.env, stdio: 'ignore',
});

const app = require('../src/app');
const { pool } = require('../src/db');

let server;
let base;
let adminToken;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
  adminToken = await login('admin@inventory.demo', 'Admin@123');
});

after(async () => {
  server.close();
  await pool.end();
});

async function api(method, url, body, token = adminToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

async function login(Email, Password) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Email, Password }),
  });
  assert.equal(res.status, 200, `login ${Email}`);
  return (await res.json()).token;
}

async function stockOf(productId, warehouseId) {
  const { data } = await api('GET', `/stock/available?Product_ID=${productId}&Warehouse_ID=${warehouseId}`);
  return data.Available;
}

test('master data CRUD and validation', async () => {
  const created = await api('POST', '/categories', { Category_Name: 'Toys', Description: 'Kids toys' });
  assert.equal(created.status, 201);
  const catId = created.data.Category_ID;

  assert.equal((await api('POST', '/categories', { Category_Name: 'Toys' })).status, 409, 'duplicate name');
  assert.equal((await api('POST', '/categories', {})).status, 400, 'missing name');

  const updated = await api('PUT', `/categories/${catId}`, { Description: 'Toys and games' });
  assert.equal(updated.data.Description, 'Toys and games');

  assert.equal((await api('DELETE', `/categories/${catId}`)).status, 204);
  assert.equal((await api('GET', `/categories/${catId}`)).status, 404);
});

test('foreign keys: invalid reference rejected, referenced row cannot be deleted', async () => {
  const bad = await api('POST', '/products', {
    Product_Name: 'Ghost', Category_ID: 999, Supplier_ID: 1, Cost_Price: 1, Selling_Price: 2, Reorder_Level: 1,
  });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /Category_ID/);

  const del = await api('DELETE', '/categories/1'); // Electronics has products
  assert.equal(del.status, 409);
});

test('check constraints: negative price rejected', async () => {
  const res = await api('POST', '/products', {
    Product_Name: 'Bad Price', Category_ID: 1, Supplier_ID: 1, Cost_Price: -5, Selling_Price: 2, Reorder_Level: 1,
  });
  assert.equal(res.status, 400);
});

test('receiving a purchase order increases stock', async () => {
  const before = await stockOf(2, 2); // earbuds in Bhiwandi: no stock row yet
  const po = await api('POST', '/purchase-orders', { Product_ID: 2, Warehouse_ID: 2, Quantity: 50 });
  assert.equal(po.status, 201);
  assert.equal(po.data.Status, 'Pending');
  assert.equal(po.data.Supplier_ID, 1, 'supplier defaults to product supplier');
  assert.equal(po.data.Unit_Cost, 900, 'unit cost defaults to product cost');
  assert.equal(await stockOf(2, 2), before, 'pending order does not touch stock');

  const rec = await api('POST', `/purchase-orders/${po.data.PO_ID}/receive`);
  assert.equal(rec.status, 200);
  assert.equal(rec.data.Status, 'Received');
  assert.equal(await stockOf(2, 2), before + 50);

  const again = await api('POST', `/purchase-orders/${po.data.PO_ID}/receive`);
  assert.equal(again.status, 400, 'cannot receive twice');
  assert.equal(await stockOf(2, 2), before + 50);
  assert.equal((await api('DELETE', `/purchase-orders/${po.data.PO_ID}`)).status, 400);
});

test('shipping a sales order reduces stock; oversized orders are rejected', async () => {
  const available = await stockOf(1, 1);
  const tooBig = await api('POST', '/sales-orders', { Customer_ID: 1, Product_ID: 1, Warehouse_ID: 1, Quantity: available + 1 });
  assert.equal(tooBig.status, 400);
  assert.match(tooBig.data.error, /Insufficient stock/);

  const so = await api('POST', '/sales-orders', { Customer_ID: 1, Product_ID: 1, Warehouse_ID: 1, Quantity: 10 });
  assert.equal(so.status, 201);
  assert.equal(so.data.Unit_Price, 599);
  const shipped = await api('POST', `/sales-orders/${so.data.SO_ID}/ship`);
  assert.equal(shipped.data.Status, 'Shipped');
  assert.equal(await stockOf(1, 1), available - 10);
  assert.equal((await api('POST', `/sales-orders/${so.data.SO_ID}/cancel`)).status, 400, 'shipped is final');
});

test('ship re-checks stock: two pending orders cannot oversell', async () => {
  const available = await stockOf(7, 1);
  const a = await api('POST', '/sales-orders', { Customer_ID: 2, Product_ID: 7, Warehouse_ID: 1, Quantity: available });
  const b = await api('POST', '/sales-orders', { Customer_ID: 3, Product_ID: 7, Warehouse_ID: 1, Quantity: available });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal((await api('POST', `/sales-orders/${a.data.SO_ID}/ship`)).status, 200);
  const second = await api('POST', `/sales-orders/${b.data.SO_ID}/ship`);
  assert.equal(second.status, 400);
  assert.match(second.data.error, /Cannot ship/);
  assert.equal(await stockOf(7, 1), 0);
  assert.equal((await api('GET', `/sales-orders/${b.data.SO_ID}`)).data.Status, 'Pending', 'failed ship rolled back');
});

test('low-stock list reflects reorder levels', async () => {
  const { data } = await api('GET', '/stock/low');
  const ids = data.map((r) => r.Product_ID);
  assert.ok(ids.includes(7), 'green tea is now at 0');
  for (const r of data) assert.ok(r.Total_Stock <= r.Reorder_Level);
});

test('stock transfer is atomic and validated', async () => {
  const from = await stockOf(4, 2);
  const to = await stockOf(4, 3);
  const ok = await api('POST', '/stock/transfer', { Product_ID: 4, From_Warehouse_ID: 2, To_Warehouse_ID: 3, Quantity: 100 });
  assert.equal(ok.status, 200);
  assert.equal(await stockOf(4, 2), from - 100);
  assert.equal(await stockOf(4, 3), to + 100);

  const bad = await api('POST', '/stock/transfer', { Product_ID: 4, From_Warehouse_ID: 2, To_Warehouse_ID: 3, Quantity: 1e6 });
  assert.equal(bad.status, 400);
  assert.equal(await stockOf(4, 2), from - 100, 'nothing changed');
});

test('warehouse capacity is enforced', async () => {
  const wh = await api('POST', '/warehouses', { Warehouse_Name: 'Tiny Shed', Location: 'Dadar', Capacity: 10 });
  const id = wh.data.Warehouse_ID;
  const po = await api('POST', '/purchase-orders', { Product_ID: 5, Warehouse_ID: id, Quantity: 11 });
  const rec = await api('POST', `/purchase-orders/${po.data.PO_ID}/receive`);
  assert.equal(rec.status, 400);
  assert.match(rec.data.error, /capacity/);

  const po2 = await api('POST', '/purchase-orders', { Product_ID: 5, Warehouse_ID: id, Quantity: 8 });
  assert.equal((await api('POST', `/purchase-orders/${po2.data.PO_ID}/receive`)).status, 200);
  assert.equal((await api('PUT', `/warehouses/${id}`, { Capacity: 5 })).status, 400, 'cannot shrink below usage');
});

test('reports return data', async () => {
  const dash = await api('GET', '/reports/dashboard');
  assert.equal(dash.status, 200);
  assert.ok(dash.data.Products >= 10);
  for (const r of ['sales-by-product', 'sales-by-category', 'top-customers', 'supplier-purchases', 'monthly', 'warehouse-utilization']) {
    const res = await api('GET', `/reports/${r}`);
    assert.equal(res.status, 200, r);
    assert.ok(Array.isArray(res.data) && res.data.length > 0, r);
  }
});

test('authentication: login required, bad credentials and tampered tokens rejected', async () => {
  assert.equal((await api('GET', '/products', null, null)).status, 401);
  assert.equal((await api('GET', '/products', null, 'garbage.token')).status, 401);
  assert.equal((await api('GET', '/products', null, adminToken + 'x')).status, 401);
  const bad = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Email: 'admin@inventory.demo', Password: 'wrong' }),
  });
  assert.equal(bad.status, 401);
  const me = await api('GET', '/auth/me');
  assert.equal(me.data.Role, 'Admin');
});

test('role permissions', async () => {
  const purchase = await login('purchase@inventory.demo', 'Purchase@123');
  const sales = await login('sales@inventory.demo', 'Sales@123');
  const viewer = await login('viewer@inventory.demo', 'Viewer@123');
  const po = { Product_ID: 5, Warehouse_ID: 3, Quantity: 1 };
  const so = { Customer_ID: 1, Product_ID: 5, Warehouse_ID: 3, Quantity: 1 };

  // everyone can read
  for (const t of [purchase, sales, viewer]) {
    assert.equal((await api('GET', '/stock', null, t)).status, 200);
    assert.equal((await api('GET', '/reports/dashboard', null, t)).status, 200);
  }
  // purchase manager: purchase orders yes, sales orders no
  const created = await api('POST', '/purchase-orders', po, purchase);
  assert.equal(created.status, 201);
  assert.equal((await api('POST', `/purchase-orders/${created.data.PO_ID}/receive`, null, purchase)).status, 200);
  assert.equal((await api('POST', '/sales-orders', so, purchase)).status, 403);
  // sales staff: sales orders yes, purchase orders / transfers no
  assert.equal((await api('POST', '/sales-orders', so, sales)).status, 201);
  assert.equal((await api('POST', '/purchase-orders', po, sales)).status, 403);
  assert.equal((await api('POST', '/stock/transfer', { Product_ID: 5, From_Warehouse_ID: 3, To_Warehouse_ID: 1, Quantity: 1 }, sales)).status, 403);
  // viewer: read only
  assert.equal((await api('POST', '/purchase-orders', po, viewer)).status, 403);
  assert.equal((await api('POST', '/customers', { Customer_Name: 'X' }, viewer)).status, 403);
  // only admin deletes and manages users
  assert.equal((await api('DELETE', '/customers/1', null, sales)).status, 403);
  assert.equal((await api('GET', '/users', null, purchase)).status, 403);
  assert.equal((await api('GET', '/users')).status, 200);
});

test('user management and last-admin protection', async () => {
  const u = await api('POST', '/users', { Full_Name: 'Temp', Email: 'temp@inventory.demo', Role: 'Viewer', Password: 'secret1' });
  assert.equal(u.status, 201);
  assert.equal(u.data.Password_Hash, undefined, 'hash never returned');
  await login('temp@inventory.demo', 'secret1');
  assert.equal((await api('POST', '/users', { Full_Name: 'B', Email: 'b@inventory.demo', Role: 'Boss', Password: 'secret1' })).status, 400);

  const tempToken = await login('temp@inventory.demo', 'secret1');
  await api('PUT', `/users/${u.data.User_ID}`, { Is_Active: 0 });
  assert.equal((await api('GET', '/products', null, tempToken)).status, 401, 'deactivated user is locked out at once');

  const me = await api('GET', '/auth/me');
  const demote = await api('PUT', `/users/${me.data.User_ID}`, { Role: 'Viewer' });
  assert.equal(demote.status, 400);
  assert.match(demote.data.error, /active Admin/);
  assert.equal((await api('DELETE', `/users/${me.data.User_ID}`)).status, 400);
  assert.equal((await api('DELETE', `/users/${u.data.User_ID}`)).status, 204);
});

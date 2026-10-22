// Purchase orders and sales orders. Status changes go through stored
// procedures; the triggers behind them update stock and enforce the rules.
const express = require('express');
const { query, call } = require('../db');
const { HttpError } = require('../errors');
const { pick, id } = require('../validate');

function buildOrderRouter({ table, view, pk, label, partyField, priceField, actions, statuses }) {
  const router = express.Router();

  const fields = {
    [partyField]: { type: 'int', required: partyField === 'Customer_ID' },
    Product_ID: { type: 'int', required: true },
    Warehouse_ID: { type: 'int', required: true },
    Quantity: { type: 'int', required: true, min: 1 },
    [priceField]: { type: 'money', min: 0 }, // optional: trigger defaults it from the product
    Order_Date: { type: 'date' },
  };

  router.get('/', async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, `status must be one of ${statuses.join(', ')}`);
      where.push('Status = ?'); params.push(req.query.status);
    }
    for (const f of [partyField, 'Product_ID', 'Warehouse_ID']) {
      if (req.query[f]) { where.push(`${f} = ?`); params.push(id(req.query[f])); }
    }
    if (req.query.from) { where.push('Order_Date >= ?'); params.push(pick(req.query, { from: { type: 'date' } }).from); }
    if (req.query.to) { where.push('Order_Date <= ?'); params.push(pick(req.query, { to: { type: 'date' } }).to); }
    const sql = `SELECT * FROM ${view}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${pk} DESC`;
    res.json(await query(sql, params));
  });

  router.get('/:id', async (req, res) => {
    const rows = await query(`SELECT * FROM ${view} WHERE ${pk} = ?`, [id(req.params.id)]);
    if (!rows.length) throw new HttpError(404, `${label} not found`);
    res.json(rows[0]);
  });

  router.post('/', async (req, res) => {
    const data = pick(req.body, fields);
    if (data[priceField] === undefined) data[priceField] = null;
    if (data[partyField] === undefined) data[partyField] = null;
    if (!data.Order_Date) delete data.Order_Date;
    const result = await query(`INSERT INTO ${table} SET ?`, [data]);
    const [row] = await query(`SELECT * FROM ${view} WHERE ${pk} = ?`, [result.insertId]);
    res.status(201).json(row);
  });

  for (const [action, procedure] of Object.entries(actions)) {
    router.post(`/:id/${action}`, async (req, res) => {
      const key = id(req.params.id);
      await call(procedure, [key]);
      const [row] = await query(`SELECT * FROM ${view} WHERE ${pk} = ?`, [key]);
      res.json(row);
    });
  }

  router.delete('/:id', async (req, res) => {
    const result = await query(`DELETE FROM ${table} WHERE ${pk} = ?`, [id(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, `${label} not found`);
    res.status(204).end();
  });

  return router;
}

const router = express.Router();

router.use('/purchase-orders', buildOrderRouter({
  table: 'purchase_order', view: 'v_purchase_order_details', pk: 'PO_ID', label: 'Purchase order',
  partyField: 'Supplier_ID', priceField: 'Unit_Cost',
  statuses: ['Pending', 'Received', 'Cancelled'],
  actions: { receive: 'sp_receive_purchase_order', cancel: 'sp_cancel_purchase_order' },
}));

router.use('/sales-orders', buildOrderRouter({
  table: 'sales_order', view: 'v_sales_order_details', pk: 'SO_ID', label: 'Sales order',
  partyField: 'Customer_ID', priceField: 'Unit_Price',
  statuses: ['Pending', 'Shipped', 'Cancelled'],
  actions: { ship: 'sp_ship_sales_order', cancel: 'sp_cancel_sales_order' },
}));

module.exports = router;

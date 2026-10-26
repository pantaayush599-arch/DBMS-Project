const express = require('express');
const { query, call } = require('../db');
const { pick, id } = require('../validate');
const { allow } = require('../auth');

const router = express.Router();

// Stock per product per warehouse (filterable).
router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.Product_ID) { where.push('Product_ID = ?'); params.push(id(req.query.Product_ID)); }
  if (req.query.Warehouse_ID) { where.push('Warehouse_ID = ?'); params.push(id(req.query.Warehouse_ID)); }
  if (req.query.q) { where.push('(Product_Name LIKE ? OR Warehouse_Name LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const sql = `SELECT * FROM v_stock_details${where.length ? ' WHERE ' + where.join(' AND ') : ''}
               ORDER BY Product_Name, Warehouse_Name`;
  res.json(await query(sql, params));
});

// Products at or below their reorder level.
router.get('/low', async (req, res) => {
  res.json(await query('SELECT * FROM v_low_stock ORDER BY Shortfall DESC, Product_Name'));
});

// Availability of one product in one warehouse (used by the order form).
router.get('/available', async (req, res) => {
  const p = id(req.query.Product_ID);
  const w = id(req.query.Warehouse_ID);
  const [row] = await query('SELECT fn_stock_in_warehouse(?, ?) AS Available', [p, w]);
  res.json({ Product_ID: p, Warehouse_ID: w, Available: row.Available });
});

// Move stock between warehouses (atomic, via stored procedure).
router.post('/transfer', allow('Admin', 'Purchase Manager'), async (req, res) => {
  const data = pick(req.body, {
    Product_ID: { type: 'int', required: true },
    From_Warehouse_ID: { type: 'int', required: true },
    To_Warehouse_ID: { type: 'int', required: true },
    Quantity: { type: 'int', required: true, min: 1 },
  });
  await call('sp_transfer_stock', [data.Product_ID, data.From_Warehouse_ID, data.To_Warehouse_ID, data.Quantity]);
  const rows = await query(
    'SELECT * FROM v_stock_details WHERE Product_ID = ? AND Warehouse_ID IN (?, ?)',
    [data.Product_ID, data.From_Warehouse_ID, data.To_Warehouse_ID]);
  res.json(rows);
});

module.exports = router;

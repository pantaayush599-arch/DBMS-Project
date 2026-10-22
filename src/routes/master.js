// Generic CRUD routes for the master-data tables
// (category, supplier, warehouse, customer, product).
const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { pick, id } = require('../validate');

const entities = {
  categories: {
    table: 'category', pk: 'Category_ID', label: 'Category',
    fields: {
      Category_Name: { type: 'string', required: true, max: 60 },
      Description: { type: 'string', max: 255 },
    },
    search: ['Category_Name', 'Description'],
    order: 'Category_Name',
  },
  suppliers: {
    table: 'supplier', pk: 'Supplier_ID', label: 'Supplier',
    fields: {
      Supplier_Name: { type: 'string', required: true, max: 100 },
      Contact_Person: { type: 'string', max: 100 },
      Phone: { type: 'string', max: 20 },
      Email: { type: 'string', max: 100 },
      City: { type: 'string', max: 60 },
    },
    search: ['Supplier_Name', 'Contact_Person', 'City', 'Email'],
    order: 'Supplier_Name',
  },
  warehouses: {
    table: 'warehouse', pk: 'Warehouse_ID', label: 'Warehouse',
    // listing comes from the utilization view so the UI can show usage
    listFrom: 'v_warehouse_utilization',
    fields: {
      Warehouse_Name: { type: 'string', required: true, max: 100 },
      Location: { type: 'string', required: true, max: 100 },
      Capacity: { type: 'int', required: true, min: 1 },
    },
    search: ['Warehouse_Name', 'Location'],
    order: 'Warehouse_Name',
  },
  customers: {
    table: 'customer', pk: 'Customer_ID', label: 'Customer',
    fields: {
      Customer_Name: { type: 'string', required: true, max: 100 },
      Phone: { type: 'string', max: 20 },
      Email: { type: 'string', max: 100 },
      City: { type: 'string', max: 60 },
    },
    search: ['Customer_Name', 'City', 'Email'],
    order: 'Customer_Name',
  },
  products: {
    table: 'product', pk: 'Product_ID', label: 'Product',
    listFrom: 'v_product_details',
    fields: {
      Product_Name: { type: 'string', required: true, max: 100 },
      Category_ID: { type: 'int', required: true },
      Supplier_ID: { type: 'int', required: true },
      Cost_Price: { type: 'money', required: true, min: 0 },
      Selling_Price: { type: 'money', required: true, min: 0 },
      Reorder_Level: { type: 'int', required: true, min: 0 },
    },
    search: ['Product_Name', 'Category_Name', 'Supplier_Name'],
    filters: ['Category_ID', 'Supplier_ID'],
    order: 'Product_Name',
  },
};

function buildRouter(cfg) {
  const router = express.Router();
  const source = cfg.listFrom || cfg.table;

  router.get('/', async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q) {
      where.push('(' + cfg.search.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
      cfg.search.forEach(() => params.push(`%${req.query.q}%`));
    }
    for (const f of cfg.filters || []) {
      if (req.query[f]) { where.push(`${f} = ?`); params.push(id(req.query[f])); }
    }
    const sql = `SELECT * FROM ${source}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${cfg.order}`;
    res.json(await query(sql, params));
  });

  router.get('/:id', async (req, res) => {
    const rows = await query(`SELECT * FROM ${source} WHERE ${cfg.pk} = ?`, [id(req.params.id)]);
    if (!rows.length) throw new HttpError(404, `${cfg.label} not found`);
    res.json(rows[0]);
  });

  router.post('/', async (req, res) => {
    const data = pick(req.body, cfg.fields);
    const result = await query(`INSERT INTO ${cfg.table} SET ?`, [data]);
    const [row] = await query(`SELECT * FROM ${source} WHERE ${cfg.pk} = ?`, [result.insertId]);
    res.status(201).json(row);
  });

  router.put('/:id', async (req, res) => {
    const key = id(req.params.id);
    const data = pick(req.body, cfg.fields, { partial: true });
    if (!Object.keys(data).length) throw new HttpError(400, 'No fields to update');
    const result = await query(`UPDATE ${cfg.table} SET ? WHERE ${cfg.pk} = ?`, [data, key]);
    if (!result.affectedRows) throw new HttpError(404, `${cfg.label} not found`);
    const [row] = await query(`SELECT * FROM ${source} WHERE ${cfg.pk} = ?`, [key]);
    res.json(row);
  });

  router.delete('/:id', async (req, res) => {
    const result = await query(`DELETE FROM ${cfg.table} WHERE ${cfg.pk} = ?`, [id(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, `${cfg.label} not found`);
    res.status(204).end();
  });

  return router;
}

const router = express.Router();
for (const [path, cfg] of Object.entries(entities)) router.use(`/${path}`, buildRouter(cfg));

module.exports = router;

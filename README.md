# Inventory and Stock Management System

CSE-SY DBMS Mini Project, Batch B1:
Aryan Manurkar (2025800075), Aayush Pant (2025800087), Manas Patani (2025800088)

A relational database for a distributor that buys goods from suppliers, keeps them in warehouses and sells them to customers. It stores categories, suppliers, warehouses, customers, products, stock, purchase orders and sales orders, so stock levels and order records can be tracked.

- **Database:** MySQL 8 (schema in 3NF, with constraints, triggers, stored procedures, functions and views)
- **Backend:** Node.js + Express REST API (`mysql2`)
- **Frontend:** a plain HTML/CSS/JS single page, served by the same server

## How the rules are enforced

The business rules live in MySQL itself, so they hold for every client: the web app, the `mysql` CLI, or anything else.

| Requirement (from the abstract) | Where it is enforced |
|---|---|
| Purchase order marked **Received** → stock increases | `trg_po_after_update` (inserts or updates the `stock` row) |
| Sales order marked **Shipped** → stock decreases | `trg_so_after_update` |
| An order larger than the available stock is rejected | `trg_so_before_insert` (when the order is placed) and `trg_so_before_update` (checked again at ship time, so two pending orders can't oversell) |
| Stock never becomes negative | `CHECK (Quantity >= 0)` + `trg_stock_before_update` |
| Referential integrity | Foreign keys with `ON DELETE RESTRICT` |
| Products at or below their reorder level appear in a low-stock list | `v_low_stock` view |
| Order totals are not stored (3NF) | Computed in `v_purchase_order_details` / `v_sales_order_details` |

Extra rules:
- Orders follow `Pending → Received/Shipped/Cancelled`. A closed order can't be edited, re-processed or deleted.
- Warehouse capacity: stock can't exceed `Capacity`, and capacity can't be lowered below what is stored.
- `Unit_Cost` / `Unit_Price` / `Supplier_ID` default from the product when left blank.
- `sp_transfer_stock` moves stock between warehouses in one transaction.

### Database objects (`db/schema.sql`)

- **Tables (8):** `category`, `supplier`, `warehouse`, `customer`, `product`, `stock` (composite PK), `purchase_order`, `sales_order`
- **Triggers:** stock (×2), warehouse, purchase order (×3), sales order (×3)
- **Procedures:** `sp_receive_purchase_order`, `sp_cancel_purchase_order`, `sp_ship_sales_order`, `sp_cancel_sales_order`, `sp_transfer_stock`, each a transaction that rolls back on error
- **Functions:** `fn_total_stock`, `fn_stock_in_warehouse`
- **Views:** `v_product_details`, `v_stock_details`, `v_low_stock`, `v_purchase_order_details`, `v_sales_order_details`, `v_warehouse_utilization`

## Setup

Requirements: **MySQL 8.0.16+** and **Node.js 18+**.

```bash
npm install
cp .env.example .env          # then set DB_USER / DB_PASSWORD for your MySQL
npm run db:init               # creates inventory_db and loads sample data
npm start                     # http://localhost:3000
```

Or load the SQL directly with the MySQL client:

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/seed.sql
```

> On Linux, MySQL's `root` account often uses socket authentication, which Node can't use. If you get an access error, create a password user:
> `CREATE USER 'inventory'@'localhost' IDENTIFIED BY 'inventory123'; GRANT ALL ON *.* TO 'inventory'@'localhost';`

`npm run db:init` **drops and recreates** `inventory_db`. Use `npm run db:init -- --no-seed` for an empty database.

### Tests

```bash
npm test
```

The tests run against a separate `inventory_test` database, which is recreated on every run. They cover CRUD, FK/CHECK errors, receiving and shipping, overselling, transfers, capacity limits and reports.

### SQL demo

`db/demo.sql` walks through the triggers step by step in the MySQL CLI. The statements that are expected to fail are commented out so you can run them one at a time.

## REST API

All endpoints are under `/api`. Errors come back as `{ "error": "message" }`. A trigger's `SIGNAL` message is passed through as a 400 response.

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/categories`, `/suppliers`, `/warehouses`, `/customers`, `/products` | List (`?q=` search) / create |
| GET/PUT/DELETE | `/<entity>/:id` | Read / update (partial) / delete |
| GET | `/products?Category_ID=&Supplier_ID=` | Filter products |
| GET | `/stock?Warehouse_ID=&Product_ID=` | Stock per product per warehouse |
| GET | `/stock/low` | Low-stock list |
| GET | `/stock/available?Product_ID=&Warehouse_ID=` | Units available |
| POST | `/stock/transfer` | `{Product_ID, From_Warehouse_ID, To_Warehouse_ID, Quantity}` |
| GET/POST | `/purchase-orders` | List (`?status=&Supplier_ID=&from=&to=`) / create |
| POST | `/purchase-orders/:id/receive` · `/cancel` | Status changes |
| GET/POST | `/sales-orders` | List (`?status=&Customer_ID=&from=&to=`) / create |
| POST | `/sales-orders/:id/ship` · `/cancel` | Status changes |
| DELETE | `/purchase-orders/:id`, `/sales-orders/:id` | Only if not Received/Shipped |
| GET | `/reports/dashboard` | KPIs |
| GET | `/reports/sales-by-product`, `/sales-by-category`, `/top-customers`, `/supplier-purchases`, `/monthly`, `/warehouse-utilization` | Reports |

Example:

```bash
curl -X POST localhost:3000/api/sales-orders -H 'Content-Type: application/json' \
     -d '{"Customer_ID":1,"Product_ID":2,"Warehouse_ID":1,"Quantity":5}'
curl -X POST localhost:3000/api/sales-orders/14/ship
```

## Project structure

```
db/
  schema.sql        tables, constraints, functions, triggers, procedures, views
  seed.sql          sample data (stock is built by receiving POs through the triggers)
  demo.sql          step-by-step demo for the mysql CLI
scripts/init-db.js  runs schema.sql + seed.sql (handles DELIMITER)
src/
  app.js, server.js
  db.js             connection pool
  errors.js         maps MySQL errors (SIGNAL, FK, CHECK, duplicate) to HTTP errors
  validate.js       request validation
  routes/           master.js (generic CRUD), orders.js, stock.js, reports.js
public/             index.html, app.js, styles.css (frontend)
test/api.test.js    end-to-end tests
```

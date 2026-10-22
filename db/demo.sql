-- =====================================================================
--  Demo script: run step by step in the mysql client to show how the
--  database enforces the rules from the abstract.
--     mysql -u root -p inventory_db < db/demo.sql     (or paste blocks)
-- =====================================================================
USE inventory_db;

-- 1) Current stock of Wireless Earbuds (Product 2) per warehouse
SELECT * FROM v_stock_details WHERE Product_ID = 2;

-- 2) Place a purchase order (Unit_Cost and Supplier default from product)
INSERT INTO purchase_order (Supplier_ID, Product_ID, Warehouse_ID, Quantity, Unit_Cost)
VALUES (NULL, 2, 2, 40, NULL);
SET @po = LAST_INSERT_ID();
SELECT * FROM v_purchase_order_details WHERE PO_ID = @po;

-- 3) Mark it Received -> trigger adds 40 units to warehouse 2
CALL sp_receive_purchase_order(@po);
SELECT * FROM v_stock_details WHERE Product_ID = 2;

-- 4) A sales order larger than available stock is rejected
--    (expected: ERROR 1644 Insufficient stock ...)
-- INSERT INTO sales_order (Customer_ID, Product_ID, Warehouse_ID, Quantity, Unit_Price)
-- VALUES (1, 2, 2, 100000, NULL);

-- 5) A valid sales order, then ship it -> trigger deducts stock
INSERT INTO sales_order (Customer_ID, Product_ID, Warehouse_ID, Quantity, Unit_Price)
VALUES (1, 2, 2, 15, NULL);
SET @so = LAST_INSERT_ID();
CALL sp_ship_sales_order(@so);
SELECT * FROM v_stock_details WHERE Product_ID = 2;

-- 6) Closed orders cannot change (expected: ERROR 1644 ... already closed)
-- CALL sp_cancel_sales_order(@so);

-- 7) Stock can never go negative, even with direct SQL (expected: ERROR 1644)
-- UPDATE stock SET Quantity = -1 WHERE Product_ID = 2 AND Warehouse_ID = 2;

-- 8) Referential integrity (expected: ERROR 1451 / 1452)
-- DELETE FROM category WHERE Category_ID = 1;
-- INSERT INTO product (Product_Name, Category_ID, Supplier_ID, Cost_Price, Selling_Price) VALUES ('X', 99, 1, 1, 2);

-- 9) Low-stock list and order totals (derived, not stored)
SELECT * FROM v_low_stock;
SELECT SO_ID, Product_Name, Quantity, Unit_Price, Total_Amount, Profit FROM v_sales_order_details ORDER BY SO_ID DESC LIMIT 5;

-- 10) Move stock between warehouses atomically
CALL sp_transfer_stock(4, 2, 3, 50);
SELECT * FROM v_stock_details WHERE Product_ID = 4;

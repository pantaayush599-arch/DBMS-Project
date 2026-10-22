const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  const [counts] = await query(`
    SELECT (SELECT COUNT(*) FROM product)   AS Products,
           (SELECT COUNT(*) FROM supplier)  AS Suppliers,
           (SELECT COUNT(*) FROM customer)  AS Customers,
           (SELECT COUNT(*) FROM warehouse) AS Warehouses,
           (SELECT COALESCE(SUM(Quantity), 0) FROM stock)        AS Units_In_Stock,
           (SELECT COALESCE(SUM(Stock_Value), 0) FROM v_stock_details) AS Inventory_Value,
           (SELECT COUNT(*) FROM v_low_stock) AS Low_Stock_Products,
           (SELECT COUNT(*) FROM purchase_order WHERE Status = 'Pending') AS Pending_Purchase_Orders,
           (SELECT COUNT(*) FROM sales_order    WHERE Status = 'Pending') AS Pending_Sales_Orders,
           (SELECT COALESCE(SUM(Total_Amount), 0) FROM v_sales_order_details WHERE Status = 'Shipped') AS Total_Revenue,
           (SELECT COALESCE(SUM(Profit), 0)       FROM v_sales_order_details WHERE Status = 'Shipped') AS Total_Profit`);
  res.json(counts);
});

// Revenue, cost and profit per product (shipped orders only).
router.get('/sales-by-product', async (req, res) => {
  res.json(await query(`
    SELECT Product_ID, Product_Name,
           SUM(Quantity) AS Units_Sold,
           SUM(Total_Amount) AS Revenue,
           SUM(Profit) AS Profit
      FROM v_sales_order_details
     WHERE Status = 'Shipped'
     GROUP BY Product_ID, Product_Name
     ORDER BY Revenue DESC`));
});

router.get('/sales-by-category', async (req, res) => {
  res.json(await query(`
    SELECT c.Category_Name,
           COUNT(*) AS Orders,
           SUM(so.Quantity) AS Units_Sold,
           SUM(so.Quantity * so.Unit_Price) AS Revenue
      FROM sales_order so
      JOIN product p  ON p.Product_ID = so.Product_ID
      JOIN category c ON c.Category_ID = p.Category_ID
     WHERE so.Status = 'Shipped'
     GROUP BY c.Category_ID, c.Category_Name
     ORDER BY Revenue DESC`));
});

router.get('/top-customers', async (req, res) => {
  res.json(await query(`
    SELECT Customer_ID, Customer_Name,
           COUNT(*) AS Orders,
           SUM(Total_Amount) AS Total_Spent
      FROM v_sales_order_details
     WHERE Status = 'Shipped'
     GROUP BY Customer_ID, Customer_Name
     ORDER BY Total_Spent DESC
     LIMIT 10`));
});

router.get('/supplier-purchases', async (req, res) => {
  res.json(await query(`
    SELECT s.Supplier_ID, s.Supplier_Name,
           COUNT(po.PO_ID) AS Orders,
           COALESCE(SUM(CASE WHEN po.Status = 'Received' THEN po.Quantity * po.Unit_Cost END), 0) AS Received_Value,
           COALESCE(SUM(CASE WHEN po.Status = 'Pending'  THEN po.Quantity * po.Unit_Cost END), 0) AS Pending_Value
      FROM supplier s
      LEFT JOIN purchase_order po ON po.Supplier_ID = s.Supplier_ID
     GROUP BY s.Supplier_ID, s.Supplier_Name
     ORDER BY Received_Value DESC`));
});

// Month-by-month purchases vs sales.
router.get('/monthly', async (req, res) => {
  res.json(await query(`
    SELECT m.Month,
           COALESCE(p.Purchases, 0) AS Purchases,
           COALESCE(s.Sales, 0)     AS Sales
      FROM (SELECT DATE_FORMAT(Order_Date, '%Y-%m') AS Month FROM purchase_order WHERE Status = 'Received'
            UNION
            SELECT DATE_FORMAT(Order_Date, '%Y-%m') FROM sales_order WHERE Status = 'Shipped') m
      LEFT JOIN (SELECT DATE_FORMAT(Order_Date, '%Y-%m') AS Month, SUM(Quantity * Unit_Cost) AS Purchases
                   FROM purchase_order WHERE Status = 'Received' GROUP BY Month) p ON p.Month = m.Month
      LEFT JOIN (SELECT DATE_FORMAT(Order_Date, '%Y-%m') AS Month, SUM(Quantity * Unit_Price) AS Sales
                   FROM sales_order WHERE Status = 'Shipped' GROUP BY Month) s ON s.Month = m.Month
     ORDER BY m.Month`));
});

router.get('/warehouse-utilization', async (req, res) => {
  res.json(await query('SELECT * FROM v_warehouse_utilization ORDER BY Warehouse_Name'));
});

module.exports = router;

-- =====================================================================
--  Sample data. Stock is NOT inserted directly: purchase orders are
--  created as Pending and then marked Received, so the triggers build
--  the stock table — the same path the application uses.
-- =====================================================================
USE inventory_db;

INSERT INTO category (Category_Name, Description) VALUES
 ('Electronics', 'Phones, accessories and small devices'),
 ('Stationery',  'Office and school supplies'),
 ('Groceries',   'Packaged food and daily essentials'),
 ('Furniture',   'Office chairs, desks and storage'),
 ('Personal Care','Hygiene and grooming products');

INSERT INTO supplier (Supplier_Name, Contact_Person, Phone, Email, City) VALUES
 ('TechSource Distributors', 'Rohan Mehta',   '9820011111', 'sales@techsource.in',   'Mumbai'),
 ('PaperWorks Pvt Ltd',      'Sneha Kulkarni','9820022222', 'orders@paperworks.in',  'Pune'),
 ('FreshFarm Foods',         'Imran Shaikh',  '9820033333', 'supply@freshfarm.in',   'Nashik'),
 ('Urban Furnish Co.',       'Priya Nair',    '9820044444', 'b2b@urbanfurnish.in',   'Bengaluru'),
 ('CareWell Brands',         'Amit Joshi',    '9820055555', 'trade@carewell.in',     'Ahmedabad');

INSERT INTO warehouse (Warehouse_Name, Location, Capacity) VALUES
 ('Andheri Central',  'Andheri East, Mumbai', 5000),
 ('Bhiwandi Hub',     'Bhiwandi, Thane',      8000),
 ('Pune Depot',       'Hinjewadi, Pune',      3000);

INSERT INTO customer (Customer_Name, Phone, Email, City) VALUES
 ('Shree Ganesh Retail',   '9930011111', 'accounts@shreeganesh.in', 'Mumbai'),
 ('Campus Book Store',     '9930022222', 'buy@campusbooks.in',      'Mumbai'),
 ('Daily Needs Mart',      '9930033333', 'po@dailyneeds.in',        'Thane'),
 ('WorkSpace Solutions',   '9930044444', 'admin@workspace.in',      'Pune'),
 ('City Pharmacy & More',  '9930055555', 'store@citypharma.in',     'Navi Mumbai');

INSERT INTO product (Product_Name, Category_ID, Supplier_ID, Cost_Price, Selling_Price, Reorder_Level) VALUES
 ('USB-C Charger 20W',        1, 1,  350.00,  599.00, 40),
 ('Wireless Earbuds',         1, 1,  900.00, 1499.00, 25),
 ('Power Bank 10000mAh',      1, 1,  650.00,  999.00, 30),
 ('A4 Notebook (200 pages)',  2, 2,   45.00,   80.00, 200),
 ('Gel Pen (Pack of 10)',     2, 2,   60.00,  110.00, 150),
 ('Basmati Rice 5kg',         3, 3,  420.00,  560.00, 60),
 ('Green Tea (100 bags)',     3, 3,  180.00,  275.00, 50),
 ('Ergonomic Office Chair',   4, 4, 4200.00, 6499.00, 10),
 ('Herbal Shampoo 400ml',     5, 5,  150.00,  245.00, 80),
 ('Hand Sanitizer 500ml',     5, 5,   90.00,  160.00, 100);

-- Purchase orders (Unit_Cost NULL -> defaults to product Cost_Price via trigger)
INSERT INTO purchase_order (Supplier_ID, Product_ID, Warehouse_ID, Quantity, Unit_Cost, Order_Date) VALUES
 (1,  1, 1, 300, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 120 DAY)),
 (1,  2, 1, 120, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 118 DAY)),
 (1,  3, 2, 150, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 110 DAY)),
 (2,  4, 2, 1500, 42.00, DATE_SUB(CURRENT_DATE, INTERVAL 100 DAY)),
 (2,  5, 3, 600, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 95 DAY)),
 (3,  6, 2, 250, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 80 DAY)),
 (3,  7, 1, 200, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 75 DAY)),
 (4,  8, 3,  30, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 70 DAY)),
 (5,  9, 1, 400, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 60 DAY)),
 (5, 10, 2, 500, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 55 DAY)),
 (1,  1, 3, 100, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)),
 (2,  4, 1, 400, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY)),
 (4,  8, 1,  20, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY)),   -- stays Pending
 (3,  6, 1, 100, NULL,  DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY));   -- stays Pending

-- Receive the first 12 POs -> triggers populate stock
UPDATE purchase_order SET Status = 'Received' WHERE PO_ID BETWEEN 1 AND 12;

-- Sales orders (Unit_Price NULL -> defaults to product Selling_Price via trigger)
INSERT INTO sales_order (Customer_ID, Product_ID, Warehouse_ID, Quantity, Unit_Price, Order_Date) VALUES
 (1,  1, 1, 120, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)),
 (1,  2, 1,  40, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 85 DAY)),
 (2,  4, 2, 900, 75.00,  DATE_SUB(CURRENT_DATE, INTERVAL 70 DAY)),
 (2,  5, 3, 300, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 65 DAY)),
 (3,  6, 2, 210, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 50 DAY)),
 (3,  7, 1, 170, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 45 DAY)),
 (4,  8, 3,  24, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 40 DAY)),
 (5,  9, 1, 150, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)),
 (5, 10, 2, 420, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 25 DAY)),
 (1,  3, 2, 130, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 15 DAY)),
 (4,  1, 3,  50, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 10 DAY)),
 (2,  4, 1, 100, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY)),  -- stays Pending
 (3,  9, 1,  60, NULL,   DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY));  -- stays Pending

-- Ship the first 11 SOs -> triggers deduct stock
UPDATE sales_order SET Status = 'Shipped' WHERE SO_ID BETWEEN 1 AND 11;

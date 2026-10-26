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

-- Demo staff accounts (one per role). Passwords are stored as scrypt hashes.
--   admin@inventory.demo     / Admin@123     (Admin)
--   purchase@inventory.demo  / Purchase@123  (Purchase Manager)
--   sales@inventory.demo     / Sales@123     (Sales Staff)
--   viewer@inventory.demo    / Viewer@123    (Viewer)
INSERT INTO app_user (Full_Name, Email, Password_Hash, Role) VALUES
 ('Aayush Pant',    'admin@inventory.demo',    'scrypt$d1710c8d729b9cf7d8c6dfca7b3789f8$aa34a6b42d95f32eedba0423129ae4b36a8e414055169b71bb1281a6c83b5b4aeda6e4f044ce3d7a2616af210402e9a4647f6de6be5ac473c32e1bb1b449d7e7', 'Admin'),
 ('Aryan Manurkar', 'purchase@inventory.demo', 'scrypt$c5d423924e6fccf7b9960d4bfa965eb4$c1beec50d0cd321baa87e7763e7ce69eb0230861479ef978df4adc5a311cb58d2dbb1412a968bc7450134245be18d732651f4dc5ff7fcaacfe969e2607cc2682', 'Purchase Manager'),
 ('Manas Patani',   'sales@inventory.demo',    'scrypt$6bc68f244f43c5a08e9abcf4fcd40ad6$42b59dd0b7615f1c25782afa30fc0f5cc0fb23c8b1fd63b40054fede5f0ff37e69e5544477d96fdc3c2f2be987b844bb92ac0fcdfd3c730f3079c6d5b1e7c31b', 'Sales Staff'),
 ('Accounts Team',  'viewer@inventory.demo',   'scrypt$6ec79950ecc15c05291ff06a55c18d5f$380a7b34486ad8dd8a9f4678602ee2e246e2e38d22ea1cc9abaec29446d117083be84e28808df629f6be6366771a39ed4d8f040b5f83a9449e438ebddf347989', 'Viewer');

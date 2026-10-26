-- =====================================================================
--  Inventory and Stock Management System — MySQL 8 schema
--  CSE-SY DBMS Mini Project (Batch B1)
--
--  8 business relations in 3NF:
--    category, supplier, warehouse, customer, product, stock,
--    purchase_order, sales_order
--  plus app_user (staff logins and roles for the web application).
--
--  The business rules are enforced inside the database (constraints,
--  triggers, stored procedures), so they hold for every client — the
--  web app, the mysql CLI, or anything else.
-- =====================================================================

DROP DATABASE IF EXISTS inventory_db;
CREATE DATABASE inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_db;

-- ---------------------------------------------------------------------
--  1. Category(Category_ID PK, Category_Name, Description)
-- ---------------------------------------------------------------------
CREATE TABLE category (
    Category_ID    INT          AUTO_INCREMENT PRIMARY KEY,
    Category_Name  VARCHAR(60)  NOT NULL,
    Description    VARCHAR(255),
    CONSTRAINT uq_category_name UNIQUE (Category_Name)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  2. Supplier(Supplier_ID PK, Supplier_Name, Contact_Person, Phone, Email, City)
-- ---------------------------------------------------------------------
CREATE TABLE supplier (
    Supplier_ID     INT          AUTO_INCREMENT PRIMARY KEY,
    Supplier_Name   VARCHAR(100) NOT NULL,
    Contact_Person  VARCHAR(100),
    Phone           VARCHAR(20),
    Email           VARCHAR(100),
    City            VARCHAR(60),
    CONSTRAINT uq_supplier_email UNIQUE (Email),
    CONSTRAINT chk_supplier_email CHECK (Email IS NULL OR Email LIKE '%_@_%._%')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  3. Warehouse(Warehouse_ID PK, Warehouse_Name, Location, Capacity)
--     Capacity = maximum total units the warehouse can hold.
-- ---------------------------------------------------------------------
CREATE TABLE warehouse (
    Warehouse_ID    INT          AUTO_INCREMENT PRIMARY KEY,
    Warehouse_Name  VARCHAR(100) NOT NULL,
    Location        VARCHAR(100) NOT NULL,
    Capacity        INT          NOT NULL,
    CONSTRAINT uq_warehouse_name UNIQUE (Warehouse_Name),
    CONSTRAINT chk_warehouse_capacity CHECK (Capacity > 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  4. Customer(Customer_ID PK, Customer_Name, Phone, Email, City)
-- ---------------------------------------------------------------------
CREATE TABLE customer (
    Customer_ID    INT          AUTO_INCREMENT PRIMARY KEY,
    Customer_Name  VARCHAR(100) NOT NULL,
    Phone          VARCHAR(20),
    Email          VARCHAR(100),
    City           VARCHAR(60),
    CONSTRAINT uq_customer_email UNIQUE (Email),
    CONSTRAINT chk_customer_email CHECK (Email IS NULL OR Email LIKE '%_@_%._%')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  5. Product(Product_ID PK, Product_Name, Category_ID FK, Supplier_ID FK,
--             Cost_Price, Selling_Price, Reorder_Level)
-- ---------------------------------------------------------------------
CREATE TABLE product (
    Product_ID     INT           AUTO_INCREMENT PRIMARY KEY,
    Product_Name   VARCHAR(100)  NOT NULL,
    Category_ID    INT           NOT NULL,
    Supplier_ID    INT           NOT NULL,
    Cost_Price     DECIMAL(10,2) NOT NULL,
    Selling_Price  DECIMAL(10,2) NOT NULL,
    Reorder_Level  INT           NOT NULL DEFAULT 10,
    CONSTRAINT uq_product_name UNIQUE (Product_Name),
    CONSTRAINT chk_product_cost    CHECK (Cost_Price >= 0),
    CONSTRAINT chk_product_selling CHECK (Selling_Price >= 0),
    CONSTRAINT chk_product_reorder CHECK (Reorder_Level >= 0),
    CONSTRAINT fk_product_category FOREIGN KEY (Category_ID)
        REFERENCES category (Category_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_product_supplier FOREIGN KEY (Supplier_ID)
        REFERENCES supplier (Supplier_ID) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  6. Stock(Product_ID PK FK, Warehouse_ID PK FK, Quantity, Last_Updated)
--     Composite PK => exactly one stock row per product per warehouse.
-- ---------------------------------------------------------------------
CREATE TABLE stock (
    Product_ID    INT       NOT NULL,
    Warehouse_ID  INT       NOT NULL,
    Quantity      INT       NOT NULL DEFAULT 0,
    Last_Updated  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (Product_ID, Warehouse_ID),
    CONSTRAINT chk_stock_quantity CHECK (Quantity >= 0),
    CONSTRAINT fk_stock_product FOREIGN KEY (Product_ID)
        REFERENCES product (Product_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stock_warehouse FOREIGN KEY (Warehouse_ID)
        REFERENCES warehouse (Warehouse_ID) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  7. Purchase_Order(PO_ID PK, Supplier_ID FK, Product_ID FK, Warehouse_ID FK,
--                    Quantity, Unit_Cost, Order_Date, Status)
--     Total is derived (Quantity * Unit_Cost) and therefore not stored.
-- ---------------------------------------------------------------------
CREATE TABLE purchase_order (
    PO_ID         INT           AUTO_INCREMENT PRIMARY KEY,
    Supplier_ID   INT           NOT NULL,
    Product_ID    INT           NOT NULL,
    Warehouse_ID  INT           NOT NULL,
    Quantity      INT           NOT NULL,
    Unit_Cost     DECIMAL(10,2) NOT NULL,
    Order_Date    DATE          NOT NULL DEFAULT (CURRENT_DATE),
    Status        ENUM('Pending','Received','Cancelled') NOT NULL DEFAULT 'Pending',
    CONSTRAINT chk_po_quantity  CHECK (Quantity > 0),
    CONSTRAINT chk_po_unit_cost CHECK (Unit_Cost >= 0),
    CONSTRAINT fk_po_supplier FOREIGN KEY (Supplier_ID)
        REFERENCES supplier (Supplier_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_po_product FOREIGN KEY (Product_ID)
        REFERENCES product (Product_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_po_warehouse FOREIGN KEY (Warehouse_ID)
        REFERENCES warehouse (Warehouse_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_po_status (Status),
    INDEX idx_po_date (Order_Date)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
--  8. Sales_Order(SO_ID PK, Customer_ID FK, Product_ID FK, Warehouse_ID FK,
--                 Quantity, Unit_Price, Order_Date, Status)
--     Total is derived (Quantity * Unit_Price) and therefore not stored.
-- ---------------------------------------------------------------------
CREATE TABLE sales_order (
    SO_ID         INT           AUTO_INCREMENT PRIMARY KEY,
    Customer_ID   INT           NOT NULL,
    Product_ID    INT           NOT NULL,
    Warehouse_ID  INT           NOT NULL,
    Quantity      INT           NOT NULL,
    Unit_Price    DECIMAL(10,2) NOT NULL,
    Order_Date    DATE          NOT NULL DEFAULT (CURRENT_DATE),
    Status        ENUM('Pending','Shipped','Cancelled') NOT NULL DEFAULT 'Pending',
    CONSTRAINT chk_so_quantity   CHECK (Quantity > 0),
    CONSTRAINT chk_so_unit_price CHECK (Unit_Price >= 0),
    CONSTRAINT fk_so_customer FOREIGN KEY (Customer_ID)
        REFERENCES customer (Customer_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_so_product FOREIGN KEY (Product_ID)
        REFERENCES product (Product_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_so_warehouse FOREIGN KEY (Warehouse_ID)
        REFERENCES warehouse (Warehouse_ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_so_status (Status),
    INDEX idx_so_date (Order_Date)
) ENGINE = InnoDB;


-- ---------------------------------------------------------------------
--  9. App_User(User_ID PK, Full_Name, Email, Password_Hash, Role,
--              Is_Active, Created_At, Last_Login)
--     Staff accounts for the web application (not part of the business
--     data model). Passwords are stored as salted scrypt hashes.
--     Roles: Admin | Purchase Manager | Sales Staff | Viewer
-- ---------------------------------------------------------------------
CREATE TABLE app_user (
    User_ID        INT          AUTO_INCREMENT PRIMARY KEY,
    Full_Name      VARCHAR(100) NOT NULL,
    Email          VARCHAR(100) NOT NULL,
    Password_Hash  VARCHAR(200) NOT NULL,
    Role           ENUM('Admin','Purchase Manager','Sales Staff','Viewer') NOT NULL DEFAULT 'Viewer',
    Is_Active      BOOLEAN      NOT NULL DEFAULT TRUE,
    Created_At     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Last_Login     TIMESTAMP    NULL,
    CONSTRAINT uq_app_user_email UNIQUE (Email),
    CONSTRAINT chk_app_user_email CHECK (Email LIKE '%_@_%._%')
) ENGINE = InnoDB;


-- =====================================================================
--  STORED FUNCTIONS
-- =====================================================================
DELIMITER $$

-- Total units of a product across all warehouses.
CREATE FUNCTION fn_total_stock(p_product_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_total INT;
    SELECT COALESCE(SUM(Quantity), 0) INTO v_total
      FROM stock WHERE Product_ID = p_product_id;
    RETURN v_total;
END$$

-- Units of a product in one warehouse (0 if no stock row exists).
CREATE FUNCTION fn_stock_in_warehouse(p_product_id INT, p_warehouse_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_qty INT;
    SELECT COALESCE(SUM(Quantity), 0) INTO v_qty
      FROM stock WHERE Product_ID = p_product_id AND Warehouse_ID = p_warehouse_id;
    RETURN v_qty;
END$$


-- =====================================================================
--  TRIGGERS
-- =====================================================================

-- ---------- STOCK: never negative, never above warehouse capacity -----
CREATE TRIGGER trg_stock_before_insert
BEFORE INSERT ON stock FOR EACH ROW
BEGIN
    DECLARE v_used INT;
    DECLARE v_capacity INT;

    IF NEW.Quantity < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock quantity cannot be negative';
    END IF;

    SELECT COALESCE(SUM(Quantity), 0) INTO v_used
      FROM stock
     WHERE Warehouse_ID = NEW.Warehouse_ID AND Product_ID <> NEW.Product_ID;
    SELECT Capacity INTO v_capacity FROM warehouse WHERE Warehouse_ID = NEW.Warehouse_ID;

    IF v_used + NEW.Quantity > v_capacity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Warehouse capacity exceeded';
    END IF;
END$$

CREATE TRIGGER trg_stock_before_update
BEFORE UPDATE ON stock FOR EACH ROW
BEGIN
    DECLARE v_used INT;
    DECLARE v_capacity INT;

    IF NEW.Quantity < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock: quantity cannot become negative';
    END IF;

    IF NEW.Quantity > OLD.Quantity THEN
        SELECT COALESCE(SUM(Quantity), 0) INTO v_used
          FROM stock
         WHERE Warehouse_ID = NEW.Warehouse_ID AND Product_ID <> NEW.Product_ID;
        SELECT Capacity INTO v_capacity FROM warehouse WHERE Warehouse_ID = NEW.Warehouse_ID;

        IF v_used + NEW.Quantity > v_capacity THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Warehouse capacity exceeded';
        END IF;
    END IF;
END$$

-- ---------- WAREHOUSE: capacity cannot drop below what is stored -----
CREATE TRIGGER trg_warehouse_before_update
BEFORE UPDATE ON warehouse FOR EACH ROW
BEGIN
    DECLARE v_used INT;
    SELECT COALESCE(SUM(Quantity), 0) INTO v_used
      FROM stock WHERE Warehouse_ID = NEW.Warehouse_ID;
    IF NEW.Capacity < v_used THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Capacity cannot be lower than the units currently stored';
    END IF;
END$$

-- ---------- PURCHASE ORDER --------------------------------------------
-- New POs start as Pending; Unit_Cost / Supplier default from the product.
CREATE TRIGGER trg_po_before_insert
BEFORE INSERT ON purchase_order FOR EACH ROW
BEGIN
    IF NEW.Status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new purchase order must start as Pending';
    END IF;
    IF NEW.Unit_Cost IS NULL THEN
        SET NEW.Unit_Cost = (SELECT Cost_Price FROM product WHERE Product_ID = NEW.Product_ID);
    END IF;
    IF NEW.Supplier_ID IS NULL THEN
        SET NEW.Supplier_ID = (SELECT Supplier_ID FROM product WHERE Product_ID = NEW.Product_ID);
    END IF;
END$$

-- Only Pending POs may change; allowed transitions: Pending -> Received | Cancelled.
CREATE TRIGGER trg_po_before_update
BEFORE UPDATE ON purchase_order FOR EACH ROW
BEGIN
    IF OLD.Status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Purchase order is already closed (Received/Cancelled) and cannot be changed';
    END IF;
END$$

-- Pending -> Received: add the quantity to stock (creates the stock row if needed).
CREATE TRIGGER trg_po_after_update
AFTER UPDATE ON purchase_order FOR EACH ROW
BEGIN
    IF OLD.Status = 'Pending' AND NEW.Status = 'Received' THEN
        INSERT INTO stock (Product_ID, Warehouse_ID, Quantity)
        VALUES (NEW.Product_ID, NEW.Warehouse_ID, NEW.Quantity)
        ON DUPLICATE KEY UPDATE Quantity = Quantity + NEW.Quantity;
    END IF;
END$$

CREATE TRIGGER trg_po_before_delete
BEFORE DELETE ON purchase_order FOR EACH ROW
BEGIN
    IF OLD.Status = 'Received' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A received purchase order cannot be deleted';
    END IF;
END$$

-- ---------- SALES ORDER -----------------------------------------------
-- New SOs start as Pending, default Unit_Price from product, and are rejected
-- if larger than the stock currently in that warehouse.
CREATE TRIGGER trg_so_before_insert
BEFORE INSERT ON sales_order FOR EACH ROW
BEGIN
    DECLARE v_available INT;
    DECLARE v_msg VARCHAR(255);

    IF NEW.Status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A new sales order must start as Pending';
    END IF;
    IF NEW.Unit_Price IS NULL THEN
        SET NEW.Unit_Price = (SELECT Selling_Price FROM product WHERE Product_ID = NEW.Product_ID);
    END IF;

    SET v_available = fn_stock_in_warehouse(NEW.Product_ID, NEW.Warehouse_ID);
    IF NEW.Quantity > v_available THEN
        SET v_msg = CONCAT('Insufficient stock: requested ', NEW.Quantity,
                           ', available ', v_available, ' in this warehouse');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;
END$$

-- Only Pending SOs may change; Pending -> Shipped re-checks stock (it may have
-- been consumed by other orders since this one was placed).
CREATE TRIGGER trg_so_before_update
BEFORE UPDATE ON sales_order FOR EACH ROW
BEGIN
    DECLARE v_available INT;
    DECLARE v_msg VARCHAR(255);

    IF OLD.Status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Sales order is already closed (Shipped/Cancelled) and cannot be changed';
    END IF;

    IF NEW.Status = 'Shipped' THEN
        SELECT COALESCE(SUM(Quantity), 0) INTO v_available
          FROM stock
         WHERE Product_ID = NEW.Product_ID AND Warehouse_ID = NEW.Warehouse_ID
           FOR UPDATE;
        IF NEW.Quantity > v_available THEN
            SET v_msg = CONCAT('Cannot ship: requested ', NEW.Quantity,
                               ', available ', v_available, ' in this warehouse');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
        END IF;
    END IF;
END$$

-- Pending -> Shipped: deduct the quantity from stock.
CREATE TRIGGER trg_so_after_update
AFTER UPDATE ON sales_order FOR EACH ROW
BEGIN
    IF OLD.Status = 'Pending' AND NEW.Status = 'Shipped' THEN
        UPDATE stock
           SET Quantity = Quantity - NEW.Quantity
         WHERE Product_ID = NEW.Product_ID AND Warehouse_ID = NEW.Warehouse_ID;
    END IF;
END$$

CREATE TRIGGER trg_so_before_delete
BEFORE DELETE ON sales_order FOR EACH ROW
BEGIN
    IF OLD.Status = 'Shipped' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A shipped sales order cannot be deleted';
    END IF;
END$$


-- ---------- APP USER: there must always be at least one active Admin ---
CREATE TRIGGER trg_user_before_update
BEFORE UPDATE ON app_user FOR EACH ROW
BEGIN
    IF OLD.Role = 'Admin' AND OLD.Is_Active
       AND (NEW.Role <> 'Admin' OR NOT NEW.Is_Active)
       AND (SELECT COUNT(*) FROM app_user
             WHERE Role = 'Admin' AND Is_Active AND User_ID <> OLD.User_ID) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'At least one active Admin account is required';
    END IF;
END$$

CREATE TRIGGER trg_user_before_delete
BEFORE DELETE ON app_user FOR EACH ROW
BEGIN
    IF OLD.Role = 'Admin' AND OLD.Is_Active
       AND (SELECT COUNT(*) FROM app_user
             WHERE Role = 'Admin' AND Is_Active AND User_ID <> OLD.User_ID) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'At least one active Admin account is required';
    END IF;
END$$


-- =====================================================================
--  STORED PROCEDURES (transactional entry points used by the API)
-- =====================================================================

CREATE PROCEDURE sp_receive_purchase_order(IN p_po_id INT)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT Status INTO v_status FROM purchase_order WHERE PO_ID = p_po_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Purchase order not found';
    END IF;
    UPDATE purchase_order SET Status = 'Received' WHERE PO_ID = p_po_id;  -- trigger adds stock
    COMMIT;
END$$

CREATE PROCEDURE sp_cancel_purchase_order(IN p_po_id INT)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT Status INTO v_status FROM purchase_order WHERE PO_ID = p_po_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Purchase order not found';
    END IF;
    UPDATE purchase_order SET Status = 'Cancelled' WHERE PO_ID = p_po_id;
    COMMIT;
END$$

CREATE PROCEDURE sp_ship_sales_order(IN p_so_id INT)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT Status INTO v_status FROM sales_order WHERE SO_ID = p_so_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sales order not found';
    END IF;
    UPDATE sales_order SET Status = 'Shipped' WHERE SO_ID = p_so_id;  -- trigger deducts stock
    COMMIT;
END$$

CREATE PROCEDURE sp_cancel_sales_order(IN p_so_id INT)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT Status INTO v_status FROM sales_order WHERE SO_ID = p_so_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sales order not found';
    END IF;
    UPDATE sales_order SET Status = 'Cancelled' WHERE SO_ID = p_so_id;
    COMMIT;
END$$

-- Move units of one product between two warehouses atomically.
CREATE PROCEDURE sp_transfer_stock(
    IN p_product_id INT, IN p_from_warehouse INT, IN p_to_warehouse INT, IN p_quantity INT)
BEGIN
    DECLARE v_available INT;
    DECLARE v_msg VARCHAR(255);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transfer quantity must be positive';
    END IF;
    IF p_from_warehouse = p_to_warehouse THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source and destination warehouse must differ';
    END IF;

    START TRANSACTION;
    SELECT Quantity INTO v_available
      FROM stock
     WHERE Product_ID = p_product_id AND Warehouse_ID = p_from_warehouse
       FOR UPDATE;
    IF v_available IS NULL OR v_available < p_quantity THEN
        SET v_msg = CONCAT('Insufficient stock in source warehouse: available ',
                           COALESCE(v_available, 0), ', requested ', p_quantity);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
    END IF;

    UPDATE stock SET Quantity = Quantity - p_quantity
     WHERE Product_ID = p_product_id AND Warehouse_ID = p_from_warehouse;

    INSERT INTO stock (Product_ID, Warehouse_ID, Quantity)
    VALUES (p_product_id, p_to_warehouse, p_quantity)
    ON DUPLICATE KEY UPDATE Quantity = Quantity + p_quantity;
    COMMIT;
END$$

DELIMITER ;


-- =====================================================================
--  VIEWS (read models used by the API / reports)
-- =====================================================================

CREATE VIEW v_product_details AS
SELECT  p.Product_ID, p.Product_Name,
        p.Category_ID, c.Category_Name,
        p.Supplier_ID, s.Supplier_Name,
        p.Cost_Price, p.Selling_Price,
        (p.Selling_Price - p.Cost_Price)            AS Unit_Margin,
        p.Reorder_Level,
        COALESCE(st.Total_Stock, 0)                 AS Total_Stock
FROM product p
JOIN category c ON c.Category_ID = p.Category_ID
JOIN supplier s ON s.Supplier_ID = p.Supplier_ID
LEFT JOIN (SELECT Product_ID, SUM(Quantity) AS Total_Stock
             FROM stock GROUP BY Product_ID) st ON st.Product_ID = p.Product_ID;

CREATE VIEW v_stock_details AS
SELECT  st.Product_ID, p.Product_Name, c.Category_Name,
        st.Warehouse_ID, w.Warehouse_Name, w.Location,
        st.Quantity, p.Reorder_Level,
        (st.Quantity * p.Cost_Price)                AS Stock_Value,
        st.Last_Updated
FROM stock st
JOIN product   p ON p.Product_ID   = st.Product_ID
JOIN category  c ON c.Category_ID  = p.Category_ID
JOIN warehouse w ON w.Warehouse_ID = st.Warehouse_ID;

-- Products whose total stock is at or below their reorder level.
CREATE VIEW v_low_stock AS
SELECT  Product_ID, Product_Name, Category_Name, Supplier_ID, Supplier_Name,
        Total_Stock, Reorder_Level,
        (Reorder_Level - Total_Stock)               AS Shortfall
FROM v_product_details
WHERE Total_Stock <= Reorder_Level;

CREATE VIEW v_purchase_order_details AS
SELECT  po.PO_ID, po.Order_Date, po.Status,
        po.Supplier_ID, s.Supplier_Name,
        po.Product_ID, p.Product_Name,
        po.Warehouse_ID, w.Warehouse_Name,
        po.Quantity, po.Unit_Cost,
        (po.Quantity * po.Unit_Cost)                AS Total_Cost
FROM purchase_order po
JOIN supplier  s ON s.Supplier_ID  = po.Supplier_ID
JOIN product   p ON p.Product_ID   = po.Product_ID
JOIN warehouse w ON w.Warehouse_ID = po.Warehouse_ID;

CREATE VIEW v_sales_order_details AS
SELECT  so.SO_ID, so.Order_Date, so.Status,
        so.Customer_ID, cu.Customer_Name,
        so.Product_ID, p.Product_Name,
        so.Warehouse_ID, w.Warehouse_Name,
        so.Quantity, so.Unit_Price,
        (so.Quantity * so.Unit_Price)                       AS Total_Amount,
        (so.Quantity * (so.Unit_Price - p.Cost_Price))      AS Profit
FROM sales_order so
JOIN customer  cu ON cu.Customer_ID  = so.Customer_ID
JOIN product   p  ON p.Product_ID    = so.Product_ID
JOIN warehouse w  ON w.Warehouse_ID  = so.Warehouse_ID;

CREATE VIEW v_warehouse_utilization AS
SELECT  w.Warehouse_ID, w.Warehouse_Name, w.Location, w.Capacity,
        COALESCE(SUM(st.Quantity), 0)                               AS Units_Stored,
        ROUND(COALESCE(SUM(st.Quantity), 0) * 100 / w.Capacity, 2)  AS Utilization_Pct,
        COALESCE(SUM(st.Quantity * p.Cost_Price), 0)                AS Stock_Value
FROM warehouse w
LEFT JOIN stock   st ON st.Warehouse_ID = w.Warehouse_ID
LEFT JOIN product p  ON p.Product_ID    = st.Product_ID
GROUP BY w.Warehouse_ID, w.Warehouse_Name, w.Location, w.Capacity;

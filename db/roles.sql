-- =====================================================================
--  Database-level roles (MySQL 8 CREATE ROLE / GRANT).
--  The same four roles as the web app, enforced by MySQL itself, so
--  access control can also be demonstrated directly in the mysql CLI.
--  Run as root after schema.sql:   mysql -u root -p < db/roles.sql
-- =====================================================================
USE inventory_db;

DROP ROLE IF EXISTS 'ims_admin', 'ims_purchase', 'ims_sales', 'ims_viewer';
CREATE ROLE 'ims_admin', 'ims_purchase', 'ims_sales', 'ims_viewer';

-- Admin: everything in this database
GRANT ALL PRIVILEGES ON inventory_db.* TO 'ims_admin';

-- Viewer: read-only on business tables and views (NOT app_user, which holds password hashes)
GRANT SELECT ON inventory_db.category                 TO 'ims_viewer';
GRANT SELECT ON inventory_db.supplier                 TO 'ims_viewer';
GRANT SELECT ON inventory_db.warehouse                TO 'ims_viewer';
GRANT SELECT ON inventory_db.customer                 TO 'ims_viewer';
GRANT SELECT ON inventory_db.product                  TO 'ims_viewer';
GRANT SELECT ON inventory_db.stock                    TO 'ims_viewer';
GRANT SELECT ON inventory_db.purchase_order           TO 'ims_viewer';
GRANT SELECT ON inventory_db.sales_order              TO 'ims_viewer';
GRANT SELECT ON inventory_db.v_product_details        TO 'ims_viewer';
GRANT SELECT ON inventory_db.v_stock_details          TO 'ims_viewer';
GRANT SELECT ON inventory_db.v_low_stock              TO 'ims_viewer';
GRANT SELECT ON inventory_db.v_purchase_order_details TO 'ims_viewer';
GRANT SELECT ON inventory_db.v_sales_order_details    TO 'ims_viewer';
GRANT SELECT ON inventory_db.v_warehouse_utilization  TO 'ims_viewer';
GRANT EXECUTE ON FUNCTION inventory_db.fn_total_stock        TO 'ims_viewer';
GRANT EXECUTE ON FUNCTION inventory_db.fn_stock_in_warehouse TO 'ims_viewer';

-- Purchase Manager: viewer + buying side (suppliers, products, purchase orders, transfers).
-- Stock is never granted directly: it only changes through the procedures and triggers.
GRANT 'ims_viewer' TO 'ims_purchase';
GRANT INSERT, UPDATE ON inventory_db.category       TO 'ims_purchase';
GRANT INSERT, UPDATE ON inventory_db.supplier       TO 'ims_purchase';
GRANT INSERT, UPDATE ON inventory_db.product        TO 'ims_purchase';
GRANT INSERT         ON inventory_db.purchase_order TO 'ims_purchase';
GRANT EXECUTE ON PROCEDURE inventory_db.sp_receive_purchase_order TO 'ims_purchase';
GRANT EXECUTE ON PROCEDURE inventory_db.sp_cancel_purchase_order  TO 'ims_purchase';
GRANT EXECUTE ON PROCEDURE inventory_db.sp_transfer_stock         TO 'ims_purchase';

-- Sales Staff: viewer + selling side (customers, sales orders)
GRANT 'ims_viewer' TO 'ims_sales';
GRANT INSERT, UPDATE ON inventory_db.customer    TO 'ims_sales';
GRANT INSERT         ON inventory_db.sales_order TO 'ims_sales';
GRANT EXECUTE ON PROCEDURE inventory_db.sp_ship_sales_order   TO 'ims_sales';
GRANT EXECUTE ON PROCEDURE inventory_db.sp_cancel_sales_order TO 'ims_sales';

-- One demo MySQL login per role
DROP USER IF EXISTS 'ims_admin_user'@'localhost', 'ims_purchase_user'@'localhost',
                    'ims_sales_user'@'localhost', 'ims_viewer_user'@'localhost';
CREATE USER 'ims_admin_user'@'localhost'    IDENTIFIED BY 'Admin@123'    DEFAULT ROLE 'ims_admin';
CREATE USER 'ims_purchase_user'@'localhost' IDENTIFIED BY 'Purchase@123' DEFAULT ROLE 'ims_purchase';
CREATE USER 'ims_sales_user'@'localhost'    IDENTIFIED BY 'Sales@123'    DEFAULT ROLE 'ims_sales';
CREATE USER 'ims_viewer_user'@'localhost'   IDENTIFIED BY 'Viewer@123'   DEFAULT ROLE 'ims_viewer';

-- Try it:
--   mysql -u ims_sales_user -pSales@123 inventory_db
--   CALL sp_ship_sales_order(12);                 -- allowed
--   CALL sp_receive_purchase_order(13);           -- ERROR 1370: execute command denied
--   UPDATE stock SET Quantity = 9999;             -- ERROR 1142: UPDATE command denied
--   SELECT * FROM app_user;                       -- ERROR 1142: SELECT command denied
--   SHOW GRANTS FOR CURRENT_USER() USING 'ims_sales';

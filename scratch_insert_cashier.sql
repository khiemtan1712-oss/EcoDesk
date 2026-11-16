USE ecodesk_db;
INSERT INTO users (id, name, email, password, role, phone, created_at, active, hidden, base_salary, permissions_json)
VALUES ('U_CASHIER_01', 'Trần Thị Thu Ngân', 'thungan@ecodesk.vn', 'cashier123', 'cashier', '0934567890', '2026-11-15T08:00:00.000Z', 1, 0, 9000000, '["pos:access","pos:shift","orders:view"]')
ON DUPLICATE KEY UPDATE name='Trần Thị Thu Ngân', role='cashier', active=1;


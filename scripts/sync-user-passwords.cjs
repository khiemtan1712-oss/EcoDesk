const fs = require('fs');

const passwords = {
  'khiemtan1712@gmail.com': '$2a$10$vE80ojG22QQeU03IAkqUrOsxRj3IxfA2FiNTJMaMxasbzRIpmVx0m',
  'admin@ecodesk.vn': '$2a$10$RRbEmWFJ4gchLEVLk9kXq.cs.FDnLuDlghcnT3SoKjdWZnOnzlqP2',
  'thungan@ecodesk.vn': 'cashier123',
  'khachhang@gmail.com': 'Khach123@',
  'thuha.setup@gmail.com': 'Khach123@',
  'nhanvien@ecodesk.vn': 'staff123',
  'kythuat@ecodesk.vn': 'staff123'
};

const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
users.forEach(u => {
  if (passwords[u.email]) {
    u.password = passwords[u.email];
  } else if (!u.password) {
    u.password = '123456';
  }
});

fs.writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf8');
fs.writeFileSync('backend/users.json', JSON.stringify(users, null, 2), 'utf8');
console.log('Successfully written users with exact BCrypt hashes to users.json and backend/users.json');

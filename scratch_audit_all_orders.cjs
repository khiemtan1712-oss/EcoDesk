const http = require('http');

http.get('http://127.0.0.1:8080/api/orders', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const orders = JSON.parse(data);
    console.log(`=== TỔNG CỘNG: ${orders.length} ĐƠN HÀNG TRÊN HỆ THỐNG ===\n`);
    
    const byStatus = {};
    orders.forEach(o => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });
    console.log('Thống kê trạng thái:', JSON.stringify(byStatus, null, 2));

    console.log('\n--- CÁC ĐƠN ĐANG XỬ LÝ / ĐANG GIAO / CHỜ XÁC NHẬN ---');
    orders.filter(o => o.status !== 'Hoàn thành' && o.status !== 'Đã hủy').forEach(o => {
      console.log(`[${o.id}] Khách: ${o.customerName} (${o.userId}) | Tổng: ${o.total.toLocaleString()}đ | PTTT: ${o.paymentMethod} | TT Thanh toán: ${o.paymentStatus} | Trạng thái: ${o.status} | Tạo lúc: ${o.createdAt}`);
    });

    console.log('\n--- CÁC ĐƠN ĐÃ HOÀN THÀNH ---');
    orders.filter(o => o.status === 'Hoàn thành').forEach(o => {
      console.log(`[${o.id}] Khách: ${o.customerName} (${o.userId}) | Tổng: ${o.total.toLocaleString()}đ | PTTT: ${o.paymentMethod} | TT Thanh toán: ${o.paymentStatus} | Hoàn tất lúc: ${o.completedAt || '(chưa có completedAt)'} | Thu tiền lúc: ${o.paidAt || '(chưa có paidAt)'}`);
    });

    console.log('\n--- CÁC ĐƠN ĐÃ HỦY ---');
    orders.filter(o => o.status === 'Đã hủy').forEach(o => {
      console.log(`[${o.id}] Khách: ${o.customerName} (${o.userId}) | Tổng: ${o.total.toLocaleString()}đ | Lý do: ${o.cancelReason}`);
    });
  });
});


const http = require('http');

http.get('http://127.0.0.1:8080/api/orders', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const orders = JSON.parse(data);
    console.log('Total orders:', orders.length);
    orders.forEach(o => {
      console.log(`[${o.id}] user=${o.userId} | status="${o.status}" | payStatus="${o.paymentStatus}" | method="${o.paymentMethod}" | total=${o.total} | created=${o.createdAt} | updated=${o.updatedAt} | completedAt=${o.completedAt} | completedBy=${o.completedBy}`);
    });
  });
});


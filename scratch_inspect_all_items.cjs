const http = require('http');

http.get('http://127.0.0.1:8080/api/orders', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const orders = JSON.parse(data);
    orders.forEach(o => {
      console.log(`=== ORDER [${o.id}] ===`);
      console.log(`Customer: ${o.customerName} (${o.userId}) | Phone: ${o.customerPhone} | Address: ${o.shippingAddress}`);
      console.log(`Status: ${o.status} | PayMethod: ${o.paymentMethod} | PayStatus: ${o.paymentStatus}`);
      console.log(`Total: ${o.total} | Subtotal: ${o.subtotal} | ShippingFee: ${o.shippingFee} | Discount: ${o.discount}`);
      console.log(`Items:`, o.itemsJson);
      console.log(`Created: ${o.createdAt} | Updated: ${o.updatedAt} | CompletedAt: ${o.completedAt} | CompletedBy: ${o.completedBy}`);
      console.log(`PaidAt: ${o.paidAt} | PaidAmount: ${o.paidAmount}`);
      console.log(`-------------------------------------------\n`);
    });
  });
});


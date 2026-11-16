const http = require('http');

http.get('http://127.0.0.1:8080/api/orders', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const orders = JSON.parse(data);
    orders.forEach((o, idx) => {
      console.log(`--- [${idx+1}/${orders.length}] ID: ${o.id} ---`);
      console.log(`User: ${o.userId} | Customer: ${o.customerName} (${o.customerEmail}) | Total: ${o.total}`);
      console.log(`Status: ${o.status} | PayStatus: ${o.paymentStatus} | Method: ${o.paymentMethod}`);
      console.log(`Created: ${o.createdAt} | Updated: ${o.updatedAt} | CompletedAt: ${o.completedAt} | By: ${o.completedBy}`);
      console.log(`PaidAt: ${o.paidAt} | PaidAmount: ${o.paidAmount} | SepayTx: ${o.sepayTransactionId}`);
      console.log(`StatusHistory: ${o.statusHistoryJson}`);
      console.log(`CancelStatus: ${o.cancelRequestStatus} | CancelReason: ${o.cancelReason}`);
    });
  });
});


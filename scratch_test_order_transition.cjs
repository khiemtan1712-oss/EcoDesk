const http = require('http');

function requestJson(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'X-EcoDesk-User-Id': 'U_ADMIN',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Kiểm tra trạng thái đơn ORD-1793792947297 trước khi cập nhật ---');
  const checkBefore = await requestJson('GET', '/api/orders/ORD-1793792947297');
  console.log({
    id: checkBefore.body.id,
    status: checkBefore.body.status,
    paymentStatus: checkBefore.body.paymentStatus,
    paymentMethod: checkBefore.body.paymentMethod,
    completedAt: checkBefore.body.completedAt,
    completedBy: checkBefore.body.completedBy
  });

  console.log('\n--- 2. Thực hiện chuyển trạng thái sang Hoàn thành (có xác nhận giao hàng thành công) ---');
  const updateRes = await requestJson('PATCH', '/api/orders/ORD-1793792947297/status', {
    status: 'Hoàn thành',
    completedBy: 'Quản trị viên EcoDesk',
    actorUserId: 'U_ADMIN'
  });
  console.log('Update HTTP Status:', updateRes.status);
  console.log({
    id: updateRes.body.id,
    status: updateRes.body.status,
    paymentStatus: updateRes.body.paymentStatus,
    completedAt: updateRes.body.completedAt,
    completedBy: updateRes.body.completedBy,
    statusHistoryJson: updateRes.body.statusHistoryJson
  });

  console.log('\n--- 3. Kiểm tra tính chống chạy lặp (Idempotency) khi gọi lại lần 2 ---');
  const updateRes2 = await requestJson('PATCH', '/api/orders/ORD-1793792947297/status', {
    status: 'Hoàn thành',
    completedBy: 'Quản trị viên EcoDesk',
    actorUserId: 'U_ADMIN'
  });
  console.log('Second update HTTP Status:', updateRes2.status);
  console.log('History length unchanged:', JSON.parse(updateRes.body.statusHistoryJson).length === JSON.parse(updateRes2.body.statusHistoryJson).length);

  console.log('\n--- 4. Kiểm tra lại Báo cáo tài chính sau khi đơn được giao thành công ---');
  const summaryAll = await requestJson('GET', '/api/finance/summary');
  console.log('Summary All Time sau khi đơn hoàn tất:');
  console.log({
    completedSales: summaryAll.body.completedOrderSales,
    completedCount: summaryAll.body.completedOrderCount,
    collectedCash: summaryAll.body.collectedCash,
    paidOrderCount: summaryAll.body.paidOrderCount,
    pendingReceivable: summaryAll.body.pendingReceivable,
    pendingReceivableCount: summaryAll.body.pendingReceivableCount
  });

  const summaryMonth = await requestJson('GET', '/api/finance/summary?from=2026-11-01&to=2026-11-15');
  console.log('Summary Month sau khi đơn hoàn tất:');
  console.log({
    completedSales: summaryMonth.body.completedOrderSales,
    completedCount: summaryMonth.body.completedOrderCount,
    collectedCash: summaryMonth.body.collectedCash,
    paidOrderCount: summaryMonth.body.paidOrderCount,
    pendingReceivable: summaryMonth.body.pendingReceivable,
    pendingReceivableCount: summaryMonth.body.pendingReceivableCount
  });
}

run();


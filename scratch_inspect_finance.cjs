const http = require('http');

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: 'GET',
      headers: {
        'X-EcoDesk-User-Id': 'U_ADMIN',
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const summaryMonth = await fetchJson('/api/finance/summary?from=2026-11-01&to=2026-11-15');
  console.log('=== KỲ THÁNG NÀY (01/11 - 15/11/2026) ===');
  console.log({
    completedSales: summaryMonth.completedOrderSales,
    completedCount: summaryMonth.completedOrderCount,
    collectedCash: summaryMonth.collectedCash,
    paidOrderCount: summaryMonth.paidOrderCount,
    pending: summaryMonth.pendingReceivable,
    pendingCount: summaryMonth.pendingReceivableCount,
    expenses: summaryMonth.totalExpenses,
    expensesBreakdown: summaryMonth.expensesBreakdown,
    debt: summaryMonth.totalDebt,
    debtsBreakdown: summaryMonth.debtsBreakdown,
    netCashFlow: summaryMonth.netCashFlow,
    missingCostCount: summaryMonth.missingCostProductsCount
  });

  const summaryPrevMonth = await fetchJson('/api/finance/summary?from=2026-10-01&to=2026-10-31');
  console.log('\n=== KỲ THÁNG TRƯỚC (01/10 - 31/10/2026) ===');
  console.log({
    completedSales: summaryPrevMonth.completedOrderSales,
    completedCount: summaryPrevMonth.completedOrderCount,
    collectedCash: summaryPrevMonth.collectedCash,
    paidOrderCount: summaryPrevMonth.paidOrderCount,
    pending: summaryPrevMonth.pendingReceivable,
    pendingCount: summaryPrevMonth.pendingReceivableCount,
    expenses: summaryPrevMonth.totalExpenses,
    debt: summaryPrevMonth.totalDebt,
    netCashFlow: summaryPrevMonth.netCashFlow
  });

  const summaryAll = await fetchJson('/api/finance/summary');
  console.log('\n=== KỲ TẤT CẢ THỜI GIAN (ALL TIME) ===');
  console.log({
    completedSales: summaryAll.completedOrderSales,
    completedCount: summaryAll.completedOrderCount,
    collectedCash: summaryAll.collectedCash,
    paidOrderCount: summaryAll.paidOrderCount,
    pending: summaryAll.pendingReceivable,
    pendingCount: summaryAll.pendingReceivableCount,
    expenses: summaryAll.totalExpenses,
    expensesBreakdown: summaryAll.expensesBreakdown,
    debt: summaryAll.totalDebt,
    debtsBreakdown: summaryAll.debtsBreakdown,
    netCashFlow: summaryAll.netCashFlow
  });

  const payrolls = await fetchJson('/api/finance/payrolls');
  console.log('\n=== DANH SÁCH BẢNG LƯƠNG HIỆN TẠI ===');
  payrolls.forEach(p => {
    console.log(`[${p.id}] Kỳ: ${p.periodMonth} | NV: ${p.employeeName} (${p.employeeUserId}) | Lương cơ bản: ${p.baseSalary.toLocaleString()}đ | Thực lĩnh: ${p.netAmount.toLocaleString()}đ | Hạn: ${p.dueDate} | Trạng thái: ${p.status}`);
  });
}

run();

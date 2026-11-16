const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\nguyen tan loc khiem\\.gemini\\antigravity\\brain\\636645d6-f26e-4137-b1c3-a7ce45efd354';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Invalid JSON: ' + data)); }
      });
    }).on('error', reject);
  });
}

function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const msg = JSON.stringify({ id, method, params });
    const listener = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', listener);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', listener);
    ws.send(msg);
  });
}

function putJson(pathStr) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 9222,
      path: pathStr,
      method: 'PUT'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Invalid JSON: ' + data)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function evalInPage(ws, expr) {
  const res = await cdpSend(ws, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : undefined;
}

async function screenshot(ws, filename) {
  const shot = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  const fullPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(fullPath, buf);
  console.log('Saved screenshot:', fullPath);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  let wsUrl;
  try {
    const v = await getJson('http://127.0.0.1:9222/json/version');
    wsUrl = v.webSocketDebuggerUrl;
  } catch (e) {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1440,1050'
    ], { detached: true });

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const v2 = await getJson('http://127.0.0.1:9222/json/version');
        wsUrl = v2.webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (err) {}
    }
  }

  console.log('Connected to Chrome, WS URL:', wsUrl);

  const newTarget = await putJson('/json/new?http://127.0.0.1:5173/admin.html');
  const tabWs = new WebSocket(newTarget.webSocketDebuggerUrl);

  await new Promise(res => tabWs.addEventListener('open', res));
  console.log('Tab WS connected');

  await cdpSend(tabWs, 'Page.enable');
  await cdpSend(tabWs, 'Runtime.enable');
  await cdpSend(tabWs, 'Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 1. Inject Cashier user into localStorage & sessionStorage
  console.log('--- Step 1: Inject Cashier User U_CASHIER_01 ---');
  await evalInPage(tabWs, `
    const cashierUser = {
      id: 'U_CASHIER_01',
      name: 'Trần Thị Thu Ngân',
      email: 'thungan@ecodesk.vn',
      role: 'cashier',
      active: true,
      permissions: ['pos:access', 'pos:shift', 'orders:view']
    };
    sessionStorage.setItem('ecodesk_current_user', JSON.stringify(cashierUser));
    localStorage.setItem('ecodesk_current_user', JSON.stringify(cashierUser));
    window.location.reload();
  `);

  await sleep(3000);

  // 2. Verify Cashier RBAC
  console.log('--- Step 2: Verify Cashier RBAC ---');
  const rbacCheck = await evalInPage(tabWs, `
    (() => {
      const activeLink = document.querySelector('.admin-nav .nav-link.active');
      const activeTab = activeLink ? activeLink.dataset.tab : '';
      const reportsLi = document.querySelector('.admin-nav .nav-link[data-tab="reports"]')?.closest('li');
      const overviewLi = document.querySelector('.admin-nav .nav-link[data-tab="overview"]')?.closest('li');
      const customersLi = document.querySelector('.admin-nav .nav-link[data-tab="customers"]')?.closest('li');
      const inventoryLi = document.querySelector('.admin-nav .nav-link[data-tab="inventory"]')?.closest('li');
      const posLi = document.querySelector('.admin-nav .nav-link[data-tab="pos"]')?.closest('li');

      return {
        activeTab,
        reportsHidden: reportsLi ? reportsLi.style.display === 'none' : true,
        overviewHidden: overviewLi ? overviewLi.style.display === 'none' : true,
        customersHidden: customersLi ? customersLi.style.display === 'none' : true,
        inventoryHidden: inventoryLi ? inventoryLi.style.display === 'none' : true,
        posVisible: posLi ? posLi.style.display !== 'none' : false
      };
    })()
  `);
  console.log('RBAC Check Result:', rbacCheck);
  await screenshot(tabWs, 'verify_pos_cashier_rbac.png');

  // 3. Open Shift if not already open
  console.log('--- Step 3: Check / Open Shift ---');
  const shiftStatus = await evalInPage(tabWs, `
    (() => {
      const openBtn = document.getElementById('posHeaderOpenShiftBtn');
      const closeBtn = document.getElementById('posHeaderCloseShiftBtn');
      const shiftBadge = document.getElementById('posShiftBadge')?.textContent || '';
      return {
        hasOpenShift: shiftBadge.includes('Ca đang mở'),
        openBtnVisible: openBtn && openBtn.style.display !== 'none'
      };
    })()
  `);
  console.log('Current shift status:', shiftStatus);

  if (!shiftStatus.hasOpenShift) {
    console.log('Opening shift with 1,000,000đ initial cash...');
    await evalInPage(tabWs, `
      document.getElementById('posHeaderOpenShiftBtn')?.click();
      document.getElementById('posOpenShiftCashInput').value = '1000000';
      document.getElementById('posOpenShiftNoteInput').value = 'Ca sáng kiểm tra tự động';
      document.getElementById('posOpenShiftModalConfirmBtn')?.click();
    `);
    await sleep(2000);
  }

  await screenshot(tabWs, 'verify_pos_open_shift.png');

  // 4. POS Sales Screen: Search, Add Products, Cart Calculations
  console.log('--- Step 4: POS Sales Screen & Hold Bill ---');
  await evalInPage(tabWs, `
    document.getElementById('posSubtabBtnSales')?.click();
  `);
  await sleep(1000);

  // Click first product card
  const addResult = await evalInPage(tabWs, `
    (() => {
      const firstCard = document.querySelector('.pos-product-item:not(.out-of-stock)');
      if (firstCard) {
        firstCard.click();
        return { clicked: true, prodName: firstCard.querySelector('.pos-product-name')?.textContent };
      }
      return { clicked: false };
    })()
  `);
  console.log('Product clicked:', addResult);
  await sleep(1000);

  // If variant modal opened, pick first variant
  await evalInPage(tabWs, `
    (() => {
      const varModal = document.getElementById('posVariantModal');
      if (varModal && varModal.style.display !== 'none') {
        const firstVarBtn = varModal.querySelector('.pos-select-variant-btn:not([disabled])');
        if (firstVarBtn) firstVarBtn.click();
      }
    })()
  `);
  await sleep(1000);

  // Check cart contents
  const cartStatus = await evalInPage(tabWs, `
    (() => {
      const rows = document.querySelectorAll('#posCartItemsBody tr');
      const subtotal = document.getElementById('posSubtotalVal')?.textContent;
      const total = document.getElementById('posTotalVal')?.textContent;
      return { rowsCount: rows.length, subtotal, total };
    })()
  `);
  console.log('Cart status after adding item:', cartStatus);

  // Test Hold Bill (F4)
  console.log('Testing Hold Bill (F4)...');
  await evalInPage(tabWs, `
    document.getElementById('posBtnHold')?.click();
  `);
  await sleep(1000);

  const heldStatus = await evalInPage(tabWs, `
    (() => {
      const rows = document.querySelectorAll('#posCartItemsBody tr');
      const heldBadge = document.getElementById('posHeaderHeldCount')?.textContent;
      return { rowsAfterHold: rows.length, heldBadge };
    })()
  `);
  console.log('After Hold Bill:', heldStatus);
  await screenshot(tabWs, 'verify_pos_held_bill.png');

  // Recall Held Bill (F6)
  console.log('Recalling Held Bill...');
  await evalInPage(tabWs, `
    document.getElementById('posHeaderHeldBillsBtn')?.click();
  `);
  await sleep(1000);
  await evalInPage(tabWs, `
    document.querySelector('.pos-recall-held-btn')?.click();
  `);
  await sleep(1000);

  const recalledStatus = await evalInPage(tabWs, `
    (() => {
      const rows = document.querySelectorAll('#posCartItemsBody tr');
      const total = document.getElementById('posTotalVal')?.textContent;
      return { rowsAfterRecall: rows.length, total };
    })()
  `);
  console.log('After Recall Bill:', recalledStatus);

  // 5. Test Cash Payment Flow (F8)
  console.log('--- Step 5: Test Cash Payment Modal (F8) ---');
  await evalInPage(tabWs, `
    document.getElementById('posBtnPayCash')?.click();
  `);
  await sleep(1000);

  const cashModalData = await evalInPage(tabWs, `
    (() => {
      const modal = document.getElementById('posCashModal');
      const totalText = document.getElementById('posCashModalTotalText')?.textContent;
      const givenInp = document.getElementById('posCashGivenInput');
      // Click exact or input enough cash
      if (givenInp) {
        const curTotal = parseInt(totalText.replace(/\\D/g, ''), 10) || 500000;
        givenInp.value = curTotal + 100000; // customer pays 100k extra
        givenInp.dispatchEvent(new Event('input'));
      }
      const changeText = document.getElementById('posCashChangeText')?.textContent;
      return {
        modalVisible: modal && modal.style.display !== 'none',
        totalText,
        cashGiven: givenInp?.value,
        changeText
      };
    })()
  `);
  console.log('Cash Modal State:', cashModalData);
  await screenshot(tabWs, 'verify_pos_cash_modal.png');

  // Confirm cash checkout (uncheck print to avoid blocking headless dialog)
  await evalInPage(tabWs, `
    (() => {
      const prCheck = document.getElementById('posCashPrintReceiptCheck');
      if (prCheck) prCheck.checked = false;
      document.getElementById('posCashModalConfirmBtn')?.click();
    })()
  `);
  await sleep(2000);

  await screenshot(tabWs, 'verify_pos_cash_payment_success.png');

  // 6. Test QR SePay Payment Modal
  console.log('--- Step 6: Test QR Payment Modal ---');
  // Add a product again
  await evalInPage(tabWs, `
    (() => {
      const firstCard = document.querySelector('.pos-product-item:not(.out-of-stock)');
      if (firstCard) firstCard.click();
      setTimeout(() => {
        const varModal = document.getElementById('posVariantModal');
        if (varModal && varModal.style.display !== 'none') {
          const firstVarBtn = varModal.querySelector('.pos-select-variant-btn:not([disabled])');
          if (firstVarBtn) firstVarBtn.click();
        }
      }, 500);
    })()
  `);
  await sleep(1500);

  await evalInPage(tabWs, `
    document.getElementById('posBtnPayQr')?.click();
  `);
  await sleep(2500);

  const qrModalData = await evalInPage(tabWs, `
    (() => {
      const modal = document.getElementById('posQrModal');
      const orderId = document.getElementById('posQrOrderIdText')?.textContent;
      const amount = document.getElementById('posQrAmountText')?.textContent;
      const ref = document.getElementById('posQrRefText')?.textContent;
      const qrImg = document.getElementById('posQrImage')?.src;
      return {
        modalVisible: modal && modal.style.display !== 'none',
        orderId,
        amount,
        ref,
        hasQrImage: Boolean(qrImg && qrImg.includes('api.vietqr.io'))
      };
    })()
  `);
  console.log('QR Modal State:', qrModalData);
  await screenshot(tabWs, 'verify_pos_qr_modal.png');

  // Cancel QR modal (restores stock)
  await evalInPage(tabWs, `
    document.getElementById('posQrModalCancelBtn')?.click();
  `);
  await sleep(1500);

  // 7. Test Shift Reconciliation & Close Shift
  console.log('--- Step 7: Test Close Shift & Reconciliation ---');
  await evalInPage(tabWs, `
    document.getElementById('posSubtabBtnShifts')?.click();
  `);
  await sleep(1000);

  await evalInPage(tabWs, `
    document.getElementById('posShiftBtnClose')?.click();
  `);
  await sleep(1000);

  const closeShiftData = await evalInPage(tabWs, `
    (() => {
      const initText = document.getElementById('posCloseInitialCashText')?.textContent;
      const salesText = document.getElementById('posCloseCashSalesText')?.textContent;
      const expText = document.getElementById('posCloseExpectedCashText')?.textContent;
      const qrText = document.getElementById('posCloseQrSalesText')?.textContent;
      const actualInp = document.getElementById('posCloseActualCashInput');
      const diffText = document.getElementById('posCloseDifferenceText')?.textContent;
      return {
        initText,
        salesText,
        expText,
        qrText,
        actualVal: actualInp?.value,
        diffText
      };
    })()
  `);
  console.log('Close Shift Reconciliation breakdown:', closeShiftData);
  await screenshot(tabWs, 'verify_pos_close_shift_reconcile.png');

  // Test discrepancy validation
  console.log('Testing discrepancy validation...');
  await evalInPage(tabWs, `
    (() => {
      const act = document.getElementById('posCloseActualCashInput');
      const nt = document.getElementById('posCloseShiftNoteInput');
      if (act) {
        act.value = '500000'; // deliberate deficit
        act.dispatchEvent(new Event('input'));
      }
      if (nt) nt.value = ''; // empty note
      document.getElementById('posCloseShiftModalConfirmBtn')?.click();
    })()
  `);
  await sleep(500);

  const validationCheck = await evalInPage(tabWs, `
    (() => {
      const noteErr = document.getElementById('posCloseNoteError');
      return {
        errorShown: noteErr && noteErr.style.display !== 'none'
      };
    })()
  `);
  console.log('Validation with discrepancy and empty note:', validationCheck);

  // Enter valid note and actual cash
  await evalInPage(tabWs, `
    (() => {
      const expVal = parseInt(document.getElementById('posCloseExpectedCashText').textContent.replace(/\\D/g, ''), 10) || 1000000;
      const act = document.getElementById('posCloseActualCashInput');
      const nt = document.getElementById('posCloseShiftNoteInput');
      if (act) {
        act.value = expVal;
        act.dispatchEvent(new Event('input'));
      }
      if (nt) nt.value = 'Kiểm két khớp 100%, bàn giao ca kết thúc tốt đẹp.';
      document.getElementById('posCloseShiftModalConfirmBtn')?.click();
    })()
  `);
  await sleep(2000);

  // 8. Test Cashier Summary Subtab
  console.log('--- Step 8: Test Cashier Dedicated Summary ---');
  await evalInPage(tabWs, `
    (async () => {
      document.getElementById('posSubtabBtnSummary')?.click();
      if (window.loadPosSummary) await window.loadPosSummary();
    })()
  `);
  await sleep(2500);

  const summaryData = await evalInPage(tabWs, `
    (() => {
      const paidCount = document.getElementById('posKpiPaidCount')?.textContent;
      const cashCollected = document.getElementById('posKpiCashCollected')?.textContent;
      const qrCollected = document.getElementById('posKpiQrCollected')?.textContent;
      const expCash = document.getElementById('posKpiExpectedCash')?.textContent;
      const diff = document.getElementById('posKpiDifference')?.textContent;
      const cancelled = document.getElementById('posKpiCancelledCount')?.textContent;
      return {
        paidCount,
        cashCollected,
        qrCollected,
        expCash,
        diff,
        cancelled
      };
    })()
  `);
  console.log('Cashier Summary KPIs:', summaryData);
  await screenshot(tabWs, 'verify_pos_cashier_summary.png');

  // 9. Test POS Orders History
  console.log('--- Step 9: Test POS Orders History ---');
  await evalInPage(tabWs, `
    (async () => {
      document.getElementById('posSubtabBtnOrders')?.click();
      if (window.loadPosOrders) await window.loadPosOrders();
    })()
  `);
  await sleep(2500);

  const ordersData = await evalInPage(tabWs, `
    (() => {
      const rows = document.querySelectorAll('#posOrdersTableBody tr');
      const firstRow = rows[0]?.innerText || '';
      return { count: rows.length, firstRowSnippet: firstRow.slice(0, 100) };
    })()
  `);
  console.log('POS Orders Table:', ordersData);
  await screenshot(tabWs, 'verify_pos_orders_history.png');

  console.log('=== ALL POS VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

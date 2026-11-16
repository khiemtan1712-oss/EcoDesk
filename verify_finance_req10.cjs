const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/nguyen tan loc khiem/.gemini/antigravity/brain/636645d6-f26e-4137-b1c3-a7ce45efd354';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const msg = JSON.stringify({ id, method, params });
    const listener = (event) => {
      const res = JSON.parse(event.data);
      if (res.id === id) {
        ws.removeEventListener('message', listener);
        if (res.error) reject(res.error);
        else resolve(res.result);
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

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const v = await getJson('http://127.0.0.1:9222/json/version');
        if (v && v.webSocketDebuggerUrl) {
          wsUrl = v.webSocketDebuggerUrl;
          break;
        }
      } catch (err) {}
    }
  }

  console.log('WS URL:', wsUrl);

  const newTarget = await putJson('/json/new?http://127.0.0.1:5173/admin.html');
  console.log('Target created:', newTarget.id);
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

  // Inject currentUser as U_ADMIN
  await cdpSend(tabWs, 'Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const adminObj = JSON.stringify({
        id: 'U_ADMIN',
        name: 'Quản trị viên EcoDesk',
        email: 'admin@ecodesk.vn',
        role: 'admin',
        active: true
      });
      localStorage.setItem('ecodesk_current_user', adminObj);
      sessionStorage.setItem('ecodesk_current_user', adminObj);
    `
  });

  await cdpSend(tabWs, 'Page.navigate', { url: 'http://127.0.0.1:5173/admin.html' });
  await new Promise(r => setTimeout(r, 2500));

  // Navigate to reports tab
  console.log('Switching to reports tab...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const tab = document.querySelector('[data-tab="reports"]');
      if (tab) tab.click();
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot 1: Overview of Reports & Analytics with 6 Top KPIs, Secondary Strip, and Processing Orders
  console.log('Capturing Screenshot 1: 6 Top KPIs & Processing Orders (Month filter)...');
  const ss1 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_6_kpis_overview.png'), Buffer.from(ss1.data, 'base64'));

  // Switch Period to "all" (Tất cả thời gian)
  console.log('Switching Period to "Tất cả thời gian"...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const sel = document.getElementById('finPeriodPreset');
      if (sel) {
        sel.value = 'all';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot 2: All time reports showing 44,210,000đ across 7 orders
  console.log('Capturing Screenshot 2: All Time Financial Overview...');
  const ss2 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_all_time_period.png'), Buffer.from(ss2.data, 'base64'));

  // Open KPI Drill-down for Completed Orders
  console.log('Opening Completed Orders Drilldown Modal...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const drillBtn = document.querySelector('[data-kpi-drill="completed_orders"]');
      if (drillBtn) drillBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 3: Completed Orders Drilldown Modal
  console.log('Capturing Screenshot 3: KPI Drilldown Modal (Completed Orders)...');
  const ss3 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_kpi_drilldown_modal.png'), Buffer.from(ss3.data, 'base64'));

  // Close drilldown modal
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      document.getElementById('finKpiDrilldownCloseBtn')?.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Confirm Delivery for processing order ORD-1793792947297
  console.log('Testing Processing Orders delivery confirmation...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      window.confirm = () => true; // auto-confirm dialog
      const btn = document.querySelector('[data-confirm-delivery]');
      if (btn) btn.click();
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot 4: After confirming delivery, order moved to Hoàn thành
  console.log('Capturing Screenshot 4: Processing Order Confirmed to Hoàn Thành...');
  const ss4 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_delivery_confirmed.png'), Buffer.from(ss4.data, 'base64'));

  // Switch to Payroll tab
  console.log('Switching to Payroll subtab...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const payTab = document.querySelector('[data-fin-subtab="payrolls"]');
      if (payTab) payTab.click();
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot 5: Payroll records table showing "THIẾU MỨC LƯƠNG" and 10th due date
  console.log('Capturing Screenshot 5: Payroll Table with Missing Salary warnings...');
  const ss5 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_payroll_missing_salary.png'), Buffer.from(ss5.data, 'base64'));

  // Open "Nhập lương" modal for employee U_STAFF_01
  console.log('Opening Nhập lương modal for U_STAFF_01...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const editBtn = document.querySelector('[data-edit-payroll*="U_STAFF_01"]');
      if (editBtn) editBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 6: Salary edit modal
  console.log('Capturing Screenshot 6: Enter Salary Modal...');
  const ss6 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_payroll_edit_modal.png'), Buffer.from(ss6.data, 'base64'));

  // Submit salary: 12,000,000 base, 1,000,000 bonus, 500,000 deduction
  console.log('Submitting salary form...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      document.getElementById('finPayrollEditBaseSalary').value = '12000000';
      document.getElementById('finPayrollEditBonus').value = '1000000';
      document.getElementById('finPayrollEditDeduction').value = '500000';
      document.getElementById('finPayrollEditNote').value = 'Lương cứng + thưởng KPI';
      document.getElementById('finPayrollEditForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot 7: Payroll record updated to "ĐẾN HẠN THANH TOÁN" with 12,500,000đ net amount
  console.log('Capturing Screenshot 7: Payroll record updated to DUE status...');
  const ss7 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_payroll_due_updated.png'), Buffer.from(ss7.data, 'base64'));

  // Confirm Payment for the due payroll
  console.log('Confirming payment for the payroll...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      window.confirm = () => true;
      const payBtn = document.querySelector('[data-pay-payroll*="U_STAFF_01"]');
      if (payBtn) payBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot 8: Payroll record marked as PAID
  console.log('Capturing Screenshot 8: Payroll record marked as PAID...');
  const ss8 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_payroll_paid_success.png'), Buffer.from(ss8.data, 'base64'));

  // Close tab and exit
  tabWs.close();
  try {
    await getJson(`http://127.0.0.1:9222/json/close/${newTarget.id}`);
  } catch(e) {}
  console.log('Done all verification and saved 8 screenshots!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});


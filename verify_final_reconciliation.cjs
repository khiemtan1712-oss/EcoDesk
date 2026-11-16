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
      await new Promise(r => setTimeout(r, 500));
      try {
        const v2 = await getJson('http://127.0.0.1:9222/json/version');
        wsUrl = v2.webSocketDebuggerUrl;
        if (wsUrl) break;
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

  // Screenshot 1: Overview of Reports & Analytics (Month filter)
  console.log('Capturing Screenshot 1: Month filter Overview...');
  const ss1 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_reconcile_month_overview.png'), Buffer.from(ss1.data, 'base64'));

  // Switch Period to "all" (Tất cả thời gian)
  console.log('Switching Period to "Tất cả thời gian"...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const sel = document.getElementById('finPeriodPreset');
      if (sel) {
        sel.value = 'all';
        sel.dispatchEvent(new Event('change'));
      }
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot 2: All Time Financial Overview
  console.log('Capturing Screenshot 2: All Time Financial Overview (56.8M completed, 720k collected, 21.95M debt)...');
  const ss2 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_reconcile_all_time_overview.png'), Buffer.from(ss2.data, 'base64'));

  // Open KPI Drill-down for Pending Receivables
  console.log('Opening Pending Receivables Drilldown Modal...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const drillBtn = document.querySelector('[data-kpi-drill="pending_orders"]');
      if (drillBtn) drillBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 3: Pending Receivables Drilldown Modal
  console.log('Capturing Screenshot 3: Pending Receivables Drilldown Modal (showing COD reconciliation & QR pending)...');
  const ss3 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_reconcile_pending_drilldown.png'), Buffer.from(ss3.data, 'base64'));

  // Close drilldown modal
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      document.getElementById('finKpiDrilldownCloseBtn')?.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Click on Missing Cost / Gross Profit card to view products without cost price
  console.log('Opening Missing Cost Price Drilldown Modal...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const costCard = document.querySelector('[data-kpi-drill="missing_cost"]');
      if (costCard) costCard.click();
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 4: Missing Cost Price Drilldown Modal
  console.log('Capturing Screenshot 4: Missing Cost Price Drilldown Modal...');
  const ss4 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_reconcile_missing_cost_modal.png'), Buffer.from(ss4.data, 'base64'));

  // Close drilldown modal
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      document.getElementById('finKpiDrilldownCloseBtn')?.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Switch to Payroll subtab
  console.log('Switching to Payroll subtab...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const payTab = document.querySelector('[data-fin-subtab="payrolls"]');
      if (payTab) payTab.click();
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 5: Payroll Table with DUE for Oct, PAID for Nov, MISSING_SALARY for others
  console.log('Capturing Screenshot 5: Payroll Table...');
  const ss5 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_reconcile_payroll_table.png'), Buffer.from(ss5.data, 'base64'));

  tabWs.close();
  console.log('Verification script completed cleanly!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});


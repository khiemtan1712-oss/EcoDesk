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
  
  // Create a new target/tab using PUT
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

  // Inject currentUser as U_ADMIN in localStorage and sessionStorage
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
      const tab = document.querySelector('[data-tab=\"reports\"]');
      if (tab) tab.click();
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 1: Overview of Reports & Analytics with 10 KPIs and Chart
  console.log('Capturing Screenshot 1: Reports Overview & KPIs...');
  const ss1 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_reports_overview.png'), Buffer.from(ss1.data, 'base64'));

  // Test Granularity: Switch to "month"
  console.log('Testing Granularity: switching to month...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const mBtn = document.querySelector('#finChartGranularityGroup [data-granularity=\"month\"]');
      if (mBtn) mBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Screenshot 2: Monthly Breakdown & Detailed Table
  console.log('Capturing Screenshot 2: Granularity Month & Breakdown Table...');
  const ss2 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_granularity_month.png'), Buffer.from(ss2.data, 'base64'));

  // Switch to Transactions subtab & Search
  console.log('Testing Sổ thu chi search...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const sInput = document.getElementById('finTxSearchInput');
      if (sInput) {
        sInput.value = 'mặt bằng';
        sInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Click on "Xem" button for the transaction
  console.log('Opening Transaction Detail modal...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      const viewBtn = document.querySelector('[data-view-fintx]');
      if (viewBtn) viewBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 3: Transaction Detail Modal with Attachment and Audit History
  console.log('Capturing Screenshot 3: Transaction Detail Modal...');
  const ss3 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_tx_detail_modal.png'), Buffer.from(ss3.data, 'base64'));

  // Close Detail Modal & Open "Ghi nhận thu chi" modal to show attachment & linked ref fields
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      document.getElementById('finTxDetailModalCloseBtn')?.click();
      setTimeout(() => {
        document.getElementById('finAddTxBtn')?.click();
      }, 300);
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot 4: Add Transaction Form Modal
  console.log('Capturing Screenshot 4: Add Transaction Modal...');
  const ss4 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_create_tx_modal.png'), Buffer.from(ss4.data, 'base64'));

  // Close Add modal & Switch to Audit tab
  console.log('Switching to Audit Tab...');
  await cdpSend(tabWs, 'Runtime.evaluate', {
    expression: `
      document.getElementById('finTxCancelBtn')?.click();
      const auditTab = document.querySelector('[data-fin-subtab=\"audit\"]');
      if (auditTab) auditTab.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // Screenshot 5: Audit Logs Tab
  console.log('Capturing Screenshot 5: Finance Audit Logs...');
  const ss5 = await cdpSend(tabWs, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verify_finance_audit_tab.png'), Buffer.from(ss5.data, 'base64'));

  // Close tab
  tabWs.close();
  try {
    await getJson(`http://127.0.0.1:9222/json/close/${newTarget.id}`);
  } catch(e) {}
  console.log('Done all verification and saved 5 screenshots!');
}

run().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});

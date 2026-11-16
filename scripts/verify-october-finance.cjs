const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/nguyen tan loc khiem/.gemini/antigravity/brain/636645d6-f26e-4137-b1c3-a7ce45efd354';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTargetWs(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await wait(300);
  }
  throw new Error('Could not get WebSocket debugger URL');
}

function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (err) {
        reject(err);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const result = await sendCommand(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error('Eval failed: ' + JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function captureScreenshot(ws, filename) {
  const res = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  const outPath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`Saved ${filename} (${buf.length} bytes)`);
}

async function main() {
  const port = 9334;
  const profileDir = 'C:/tmp/chrome-october-verify';
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1440,960',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  try {
    const wsUrl = await getTargetWs(port);
    console.log('Connected to Chrome via CDP:', wsUrl);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'Runtime.enable');
    await sendCommand(ws, 'DOM.enable');

    console.log('Navigating to http://localhost:5173/index.html to set auth session...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/index.html' });
    await wait(1500);

    // Setup Admin session in localStorage and sessionStorage
    await evaluate(ws, `(() => {
      const adminUser = {
        id: 'U_ADMIN',
        name: 'Quản trị viên EcoDesk',
        email: 'admin@ecodesk.vn',
        role: 'admin',
        active: true
      };
      localStorage.setItem('ecodesk_current_user', JSON.stringify(adminUser));
      sessionStorage.setItem('ecodesk_current_user', JSON.stringify(adminUser));
      localStorage.setItem('ecodesk_logged_in_user', JSON.stringify(adminUser));
      localStorage.setItem('ecodesk_auth_user', JSON.stringify(adminUser));
      sessionStorage.setItem('ecodesk_auth_user', JSON.stringify(adminUser));
    })()`);

    console.log('Navigating to http://localhost:5173/admin.html ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/admin.html' });
    await wait(2500);

    console.log('Switching to Reports tab & filtering period 01/10/2026 - 31/10/2026...');
    await evaluate(ws, `(() => {
      const link = document.querySelector('[data-tab="reports"]');
      if (link) link.click();
      else if (window.location.hash !== '#reports') window.location.hash = '#reports';
    })()`);
    await wait(2000);

    console.log('Setting period to Tháng trước (10/2026) and applying filter...');
    await evaluate(ws, `(() => {
      const preset = document.getElementById('finPeriodPreset');
      if (preset) {
        preset.value = 'last_month';
        preset.dispatchEvent(new Event('change'));
      }
      const applyBtn = document.getElementById('finApplyFilterBtn');
      if (applyBtn) applyBtn.click();
    })()`);

    // Poll until summary for 2026-10 is loaded
    for (let i = 0; i < 30; i++) {
      const isOctober = await evaluate(ws, `(() => {
        return !!(window.financeState && window.financeState.summary && window.financeState.summary.from === '2026-10-01');
      })()`);
      if (isOctober) {
        console.log('Finance summary for October 2026 loaded!');
        break;
      }
      await wait(300);
    }
    await wait(1500);

    console.log('Capturing Finance Overview for October 2026...');
    await captureScreenshot(ws, 'verify_finance_october_reconcile.png');

    const debugInfo = await evaluate(ws, `(() => {
      const grid = document.getElementById('finKpiGrid');
      const btns = Array.from(document.querySelectorAll('[data-kpi-drill]')).map(b => b.getAttribute('data-kpi-drill'));
      return {
        hasGrid: !!grid,
        gridChildren: grid ? grid.children.length : 0,
        btns,
        activeTab: document.querySelector('.admin-nav-item.active')?.getAttribute('data-tab')
      };
    })()`);
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    console.log('Opening Card 3 drilldown modal...');
    const modalOpened = await evaluate(ws, `(() => {
      const btn = document.querySelector('[data-kpi-drill="pending_orders"]');
      if (btn) {
        btn.click();
        const modal = document.getElementById('finKpiDrilldownModalBackdrop');
        return modal ? modal.classList.contains('show') : false;
      }
      return false;
    })()`);
    console.log('Modal opened status:', modalOpened);
    await wait(1000);

    console.log('Capturing drilldown modal...');
    await captureScreenshot(ws, 'verify_finance_october_drilldown.png');

    console.log('All verification screenshots captured successfully!');
    ws.close();
  } finally {
    try {
      process.kill(chromeProc.pid);
    } catch {}
  }
}

main().catch(err => {
  console.error('Error in verification:', err);
  process.exit(1);
});

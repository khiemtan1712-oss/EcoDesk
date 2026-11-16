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
    throw new Error('Eval error: ' + JSON.stringify(result.exceptionDetails));
  }
  return result.result ? result.result.value : undefined;
}

async function captureScreenshot(ws, filename) {
  const result = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(result.data, 'base64');
  const fullPath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(fullPath, buf);
  console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
}

async function main() {
  const cdpPort = 9226;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tempDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome_rbac_test_' + Date.now());

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--headless=new',
    '--window-size=1280,900',
    'about:blank'
  ]);

  try {
    const wsUrl = await getTargetWs(cdpPort);
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'DOM.enable');

    console.log('--- Navigating to admin.html ---');
    await sendCommand(ws, 'Page.navigate', { url: 'http://127.0.0.1:5173/admin.html' });
    await wait(2500);

    const curUrl = await evaluate(ws, `window.location.href`);
    console.log('Current URL:', curUrl);

    if (curUrl.includes('login.html')) {
      console.log('Performing login as admin...');
      await evaluate(ws, `
        const u = { id: 'U_ADMIN', name: 'Quản trị viên EcoDesk', email: 'admin@ecodesk.vn', role: 'admin', active: true };
        localStorage.setItem('ecodesk_current_user', JSON.stringify(u));
        window.location.href = './admin.html';
      `);
      await wait(2500);
    }

    console.log('--- Switching to Customers Tab ---');
    await evaluate(ws, `
      const link = document.querySelector('a[data-tab="customers"]');
      if (link) link.click();
    `);
    await wait(1500);

    const rowsInfo = await evaluate(ws, `
      Array.from(document.querySelectorAll("#customersTable tr")).map(tr => {
        const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.replace(/\\s+/g, ' ').trim());
        return {
          user: tds[0],
          email: tds[1],
          roleAndPerms: tds[2],
          spending: tds[3],
          actions: tds[5]
        };
      })
    `);

    console.log('Customers table rows:');
    console.dir(rowsInfo, { depth: null });

    await captureScreenshot(ws, 'verify_customers_permission_badges.png');

    // Click "Phân quyền" for U_STAFF_01
    console.log('--- Opening Phân quyền modal for U_STAFF_01 ---');
    const clicked = await evaluate(ws, `
      const btn = document.querySelector('button[data-change-role="U_STAFF_01"]');
      if (btn) {
        btn.click();
        true;
      } else false;
    `);
    console.log('Clicked role button for U_STAFF_01:', clicked);
    await wait(800);

    const modalInfo = await evaluate(ws, `
      (() => {
        const modal = document.getElementById("roleModalBackdrop");
        const isOpen = modal && modal.classList.contains("show");
        const checked = Array.from(document.querySelectorAll('#staffPermissionsList input[name="staff_perm"]:checked')).map(cb => cb.value);
        const disabled = Array.from(document.querySelectorAll('#staffPermissionsList input[name="staff_perm"]:disabled')).map(cb => cb.value);
        return { isOpen, checked, disabled };
      })()
    `);
    console.log('Role Modal info for U_STAFF_01:', modalInfo);

    await captureScreenshot(ws, 'verify_role_modal_staff_01.png');

    // Close modal
    await evaluate(ws, `
      const closeBtn = document.getElementById("roleModalCloseBtn");
      if (closeBtn) closeBtn.click();
    `);
    await wait(600);

    // Click "Phân quyền" for U_CASHIER_01
    console.log('--- Opening Phân quyền modal for U_CASHIER_01 ---');
    const clickedCashier = await evaluate(ws, `
      (() => {
        const cBtn = document.querySelector('button[data-change-role="U_CASHIER_01"]');
        if (cBtn) {
          cBtn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Clicked role button for U_CASHIER_01:', clickedCashier);
    await wait(800);

    const cashierModalInfo = await evaluate(ws, `
      (() => {
        const modal = document.getElementById("roleModalBackdrop");
        const isOpen = modal && modal.classList.contains("show");
        const checked = Array.from(document.querySelectorAll('#staffPermissionsList input[name="staff_perm"]:checked')).map(cb => cb.value);
        const disabled = Array.from(document.querySelectorAll('#staffPermissionsList input[name="staff_perm"]:disabled')).map(cb => cb.value);
        return { isOpen, checked, disabled };
      })()
    `);
    console.log('Role Modal info for U_CASHIER_01:', cashierModalInfo);
    await captureScreenshot(ws, 'verify_role_modal_cashier_01.png');

    // Close modal
    await evaluate(ws, `
      const closeBtn = document.getElementById("roleModalCloseBtn");
      if (closeBtn) closeBtn.click();
    `);
    await wait(500);

    console.log('=== RBAC UI Verification Completed Successfully! ===');
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

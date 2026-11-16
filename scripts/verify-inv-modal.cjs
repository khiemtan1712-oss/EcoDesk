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
  console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
}

async function main() {
  const port = 9336;
  const profileDir = 'C:/tmp/chrome-invmodal-verify';
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
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'Runtime.enable');
    await sendCommand(ws, 'DOM.enable');

    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/index.html' });
    await wait(1200);

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
    })()`);

    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/admin.html' });
    await wait(2500);

    // Open inventory adjustment modal for P025
    const invAdjResult = await evaluate(ws, `(() => {
      // Find openAdjustInventoryModal or trigger button
      const pSel = document.getElementById("invAdjProductSelect");
      const modal = document.getElementById("invAdjustModalBackdrop");
      const vSel = document.getElementById("invAdjVariantSelect");

      // Trigger the modal via the inventory button or direct trigger
      const adjBtn = document.getElementById("invOpenAdjustTopBtn");
      if (adjBtn) adjBtn.click();

      if (pSel) {
        pSel.value = "P025";
        pSel.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const options = vSel ? Array.from(vSel.options).map(o => o.text) : [];
      return {
        modalShown: modal ? modal.classList.contains("show") : false,
        options
      };
    })()`);

    console.log('Inventory adjustment modal options:', invAdjResult);
    await wait(600);
    await captureScreenshot(ws, 'verify_p025_inv_adjust_modal_fixed.png');
    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

main();

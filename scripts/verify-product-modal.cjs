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

async function setViewport(ws, width, height, isMobile = false) {
  await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: isMobile
  });
  await wait(300);
}

async function main() {
  const port = 9335;
  const profileDir = 'C:/tmp/chrome-prodmodal-verify';
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

    // 1. Setup Auth
    console.log('1. Setting up admin session at http://localhost:5173/index.html ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/index.html' });
    await wait(1500);

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

    // 2. Navigate to admin.html
    console.log('2. Navigating to http://localhost:5173/admin.html ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/admin.html' });
    await wait(2500);

    // Switch to Products Tab
    console.log('3. Switching to Products tab ...');
    const tabSwitched = await evaluate(ws, `(() => {
      const prodNav = document.querySelector('.admin-nav-item[data-tab="products"]');
      if (prodNav) {
        prodNav.click();
        return true;
      }
      return false;
    })()`);
    console.log('Products tab switched:', tabSwitched);
    await wait(1000);

    // 4. Test Opening "Thêm sản phẩm" Modal
    console.log('4. Clicking "Thêm sản phẩm" button ...');
    const modalOpened = await evaluate(ws, `(() => {
      const addBtn = document.getElementById('openAddProductModalBtn');
      if (addBtn) {
        addBtn.click();
        const backdrop = document.getElementById('productModalBackdrop');
        return {
          clicked: true,
          isOpen: backdrop ? backdrop.classList.contains('show') : false,
          title: document.getElementById('productModalTitle')?.textContent || '',
          badge: document.getElementById('productModalModeBadge')?.textContent || ''
        };
      }
      return { clicked: false };
    })()`);
    console.log('Add modal result:', modalOpened);
    await wait(800);

    // Capture screenshot: Add Product Modal (Desktop)
    await captureScreenshot(ws, 'verify_add_product_modal_desktop.png');

    // 5. Test Responsive on Mobile Viewport (390 x 844)
    console.log('5. Testing mobile viewport (390 x 844) ...');
    await setViewport(ws, 390, 844, true);
    await wait(500);
    await captureScreenshot(ws, 'verify_add_product_modal_mobile.png');

    // Reset back to Desktop
    await setViewport(ws, 1440, 960, false);
    await wait(500);

    // 6. Test Dirty check on Close
    console.log('6. Testing dirty check when typing into modalProductName ...');
    const dirtyCheckResult = await evaluate(ws, `(() => {
      const nameInp = document.getElementById('modalProductName');
      if (nameInp) {
        nameInp.value = 'Ghế công thái học thử nghiệm Dirty Check';
        nameInp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      let confirmTriggered = false;
      const originalConfirm = window.confirm;
      window.confirm = (msg) => {
        confirmTriggered = true;
        return false; // User cancels closing
      };

      const closeBtn = document.getElementById('productModalCloseBtn');
      if (closeBtn) closeBtn.click();

      window.confirm = originalConfirm;
      const backdrop = document.getElementById('productModalBackdrop');
      return {
        confirmTriggered,
        stillOpen: backdrop ? backdrop.classList.contains('show') : false
      };
    })()`);
    console.log('Dirty check confirmation result:', dirtyCheckResult);

    // Force close modal now
    await evaluate(ws, `(() => {
      const backdrop = document.getElementById('productModalBackdrop');
      if (backdrop) backdrop.classList.remove('show');
      document.body.style.overflow = '';
    })()`);
    await wait(400);

    // 7. Test Opening "Chỉnh sửa sản phẩm" for P025 (máy xoa bóp)
    console.log('7. Opening Edit Modal for P025 ...');
    const editResult = await evaluate(ws, `(() => {
      const editBtn = document.querySelector('[data-edit-product="P025"]');
      if (editBtn) {
        editBtn.click();
        const backdrop = document.getElementById('productModalBackdrop');
        const title = document.getElementById('productModalTitle')?.textContent || '';
        const badge = document.getElementById('productModalModeBadge')?.textContent || '';
        const code = document.getElementById('modalProductCode')?.value || '';
        const name = document.getElementById('modalProductName')?.value || '';
        const variantOptions = Array.from(document.querySelectorAll('.var-name')).map(el => el.value);

        return {
          clicked: true,
          isOpen: backdrop ? backdrop.classList.contains('show') : false,
          title,
          badge,
          code,
          name,
          variantOptions
        };
      }
      return { clicked: false };
    })()`);
    console.log('Edit P025 result:', editResult);
    await wait(800);

    // Capture screenshot: Edit P025 Modal (Desktop)
    await captureScreenshot(ws, 'verify_edit_product_modal_p025.png');

    // 8. Test redirect from add.html
    console.log('8. Testing redirect from http://localhost:5173/add.html ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/add.html' });
    await wait(2500);
    const addRedirectResult = await evaluate(ws, `(() => {
      const backdrop = document.getElementById('productModalBackdrop');
      return {
        currentUrl: window.location.href,
        isOpen: backdrop ? backdrop.classList.contains('show') : false,
        title: document.getElementById('productModalTitle')?.textContent || ''
      };
    })()`);
    console.log('Add.html redirect result:', addRedirectResult);

    // 9. Test redirect from edit.html?id=P025
    console.log('9. Testing redirect from http://localhost:5173/edit.html?id=P025 ...');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/edit.html?id=P025' });
    await wait(2500);
    const editRedirectResult = await evaluate(ws, `(() => {
      const backdrop = document.getElementById('productModalBackdrop');
      return {
        currentUrl: window.location.href,
        isOpen: backdrop ? backdrop.classList.contains('show') : false,
        title: document.getElementById('productModalTitle')?.textContent || '',
        name: document.getElementById('modalProductName')?.value || ''
      };
    })()`);
    console.log('Edit.html redirect result:', editRedirectResult);

    console.log('All verification checks completed successfully!');
    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

main();


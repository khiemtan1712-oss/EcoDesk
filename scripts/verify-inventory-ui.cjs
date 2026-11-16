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
  const cdpPort = 9225;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tempDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome_inv_test_' + Date.now());

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

    // Login as admin if redirected
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

    // Switch to Inventory tab
    console.log('--- Switching to Inventory Tab ---');
    await evaluate(ws, `
      if (typeof window.switchTab === 'function') {
        window.switchTab('inventory');
      } else {
        const link = document.querySelector('a[data-tab="inventory"]');
        if (link) link.click();
      }
    `);
    await wait(1500);

    // Check inventory table headers and action buttons
    const invCheck = await evaluate(ws, `
      (() => {
        const topPoBtn = document.getElementById("invOpenCreatePoTopBtn");
        const topAdjBtn = document.getElementById("invOpenAdjustTopBtn");
        const headers = Array.from(document.querySelectorAll("#pane-inventory table thead th")).map(th => th.textContent.trim());
        const rows = Array.from(document.querySelectorAll("#inventoryTable tr")).slice(0, 5).map(tr => {
          const cells = tr.querySelectorAll("td");
          if (cells.length < 7) return null;
          return {
            product: cells[0].innerText.replace(/\\s+/g, ' ').trim(),
            price: cells[2].innerText.trim(),
            cost: cells[3].innerText.replace(/\\s+/g, ' ').trim(),
            stock: cells[4].innerText.replace(/\\s+/g, ' ').trim(),
            actions: Array.from(cells[6].querySelectorAll("button")).map(b => ({
              text: b.innerText.replace(/\\s+/g, ' ').trim(),
              title: b.title || ""
            }))
          };
        }).filter(Boolean);

        return {
          topPoBtn: { text: topPoBtn?.innerText?.trim(), title: topPoBtn?.title },
          topAdjBtn: { text: topAdjBtn?.innerText?.trim(), title: topAdjBtn?.title },
          headers,
          sampleRows: rows
        };
      })()
    `);

    console.log('Inventory Table Overview:', JSON.stringify(invCheck, null, 2));
    await captureScreenshot(ws, 'verify_inventory_table_clear_labels.png');

    // Click "Xem số lượng từng phiên bản" for product P025 (máy xoa bóp)
    console.log('--- Expanding Variants for P025 ---');
    const varRowCheck = await evaluate(ws, `
      (() => {
        const toggleBtn = document.querySelector('[data-toggle-inv-vars="P025"]');
        if (toggleBtn) toggleBtn.click();
        const subRow = document.getElementById('inv-variants-P025');
        return {
          expanded: subRow && subRow.style.display !== 'none',
          content: subRow ? subRow.innerText.replace(/\\s+/g, ' ').trim() : ''
        };
      })()
    `);
    console.log('P025 Expanded Variant Details:', JSON.stringify(varRowCheck, null, 2));
    await wait(600);
    await captureScreenshot(ws, 'verify_inventory_variants_expanded_p025.png');

    // Open "Nhập hàng từ nhà cung cấp" modal
    console.log('--- Testing Create PO Modal ---');
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('[data-open-create-po="P025"]');
        if (btn) btn.click();
      })()
    `);
    await wait(600);
    const poModalCheck = await evaluate(ws, `
      (() => {
        const modal = document.getElementById('finPurchaseModalBackdrop');
        const title = modal?.querySelector('h3')?.innerText?.trim();
        const info = modal?.querySelector('.po-modal-body > div')?.innerText?.replace(/\\s+/g, ' ').trim();
        const firstProdSel = modal?.querySelector('.po-item-prod-sel')?.value;
        const firstUnitCost = modal?.querySelector('.po-item-unit-cost-inp')?.value;
        return {
          isOpen: modal?.classList.contains('show'),
          title,
          info,
          firstProdSel,
          firstUnitCost
        };
      })()
    `);
    console.log('Create PO Modal Check:', JSON.stringify(poModalCheck, null, 2));
    await captureScreenshot(ws, 'verify_po_modal_clear_labels.png');

    // Close PO modal
    await evaluate(ws, `(() => { document.getElementById('finPurchaseCancelBtn')?.click(); })()`);
    await wait(400);

    // Open "Điều chỉnh số lượng" modal
    console.log('--- Testing Adjust Stock Modal ---');
    await evaluate(ws, `
      (() => {
        const btn = document.querySelector('[data-open-adjust-stock="P025"]');
        if (btn) btn.click();
      })()
    `);
    await wait(600);
    const adjModalCheck = await evaluate(ws, `
      (() => {
        const modal = document.getElementById('invAdjustModalBackdrop');
        const title = modal?.querySelector('h3')?.innerText?.trim();
        const info = modal?.querySelector('.admin-modal-body > div')?.innerText?.replace(/\\s+/g, ' ').trim();
        const prod = modal?.querySelector('#invAdjProductSelect')?.value;
        const variantOpts = Array.from(modal?.querySelectorAll('#invAdjVariantSelect option') || []).map(o => o.text);
        return {
          isOpen: modal?.classList.contains('show'),
          title,
          info,
          prod,
          variantOpts
        };
      })()
    `);
    console.log('Adjust Modal Check:', JSON.stringify(adjModalCheck, null, 2));
    await captureScreenshot(ws, 'verify_adjust_stock_modal_clear_labels.png');

    ws.close();
    console.log('=== Inventory verification completed successfully! ===');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(err => {
  console.error('Fatal error during inventory verification:', err);
  process.exit(1);
});

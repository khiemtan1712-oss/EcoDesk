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
  const port = 9338;
  const profileDir = 'C:/tmp/chrome-reviews-verify';
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1440,1050',
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

    // 1. Setup Admin session
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

    // 2. Test Admin Reviews Tab
    console.log('--- Testing Admin Reviews Tab ---');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/admin.html' });
    await wait(2500);

    const adminReviewsCheck = await evaluate(ws, `(() => {
      // Click Reviews tab
      const tabBtn = document.querySelector('[data-tab="reviews"]');
      if (tabBtn) tabBtn.click();

      const kpis = {
        total: document.getElementById('revKpiTotal')?.textContent,
        avg: document.getElementById('revKpiAvg')?.textContent,
        unreplied: document.getElementById('revKpiUnreplied')?.textContent,
        comments: document.getElementById('revKpiComments')?.textContent,
        verified: document.getElementById('revKpiVerified')?.textContent
      };

      const reviewCards = Array.from(document.querySelectorAll('#adminReviewsList .admin-review-card')).map(card => {
        const id = card.getAttribute('data-review-id');
        const author = card.querySelector('.admin-review-author-line strong')?.textContent;
        const isVerified = Boolean(card.querySelector('.admin-review-badge-verified'));
        const isUnverified = Boolean(card.querySelector('.admin-review-badge-unverified'));
        const order = card.querySelector('.admin-review-badge-order')?.textContent;
        const starsText = card.querySelector('.admin-review-stars span')?.textContent;
        const firstStarSvg = card.querySelector('.admin-review-stars svg');
        const starFill = firstStarSvg ? firstStarSvg.getAttribute('fill') : null;
        return { id, author, isVerified, isUnverified, order, starsText, starFill };
      });

      return { kpis, reviewCards };
    })()`);

    console.log('Admin Reviews Check:', JSON.stringify(adminReviewsCheck, null, 2));
    await wait(600);
    await captureScreenshot(ws, 'verify_admin_reviews_solid_stars.png');

    // 3. Test Inventory Adjust Modal for P025 (Clean Vietnamese check)
    console.log('--- Testing Inventory Adjust Modal for P025 ---');
    const invAdjCheck = await evaluate(ws, `(() => {
      const invTabBtn = document.querySelector('[data-tab="inventory"]');
      if (invTabBtn) invTabBtn.click();

      const adjBtn = document.getElementById("invOpenAdjustTopBtn");
      if (adjBtn) adjBtn.click();

      const pSel = document.getElementById("invAdjProductSelect");
      const vSel = document.getElementById("invAdjVariantSelect");
      if (pSel) {
        pSel.value = "P025";
        pSel.dispatchEvent(new Event("change", { bubbles: true }));
      }

      return {
        selectedProduct: pSel ? pSel.value : null,
        variantOptions: vSel ? Array.from(vSel.options).map(o => o.text) : []
      };
    })()`);

    console.log('Inventory Adjust Modal for P025:', JSON.stringify(invAdjCheck, null, 2));
    await wait(600);
    await captureScreenshot(ws, 'verify_p025_inv_adjust_clean_vietnamese.png');

    // Close modal
    await evaluate(ws, `(() => {
      const closeBtn = document.getElementById("invAdjustCloseBtn");
      if (closeBtn) closeBtn.click();
    })()`);
    await wait(400);

    // 4. Test Product Detail Page for P001 (Has verified review & admin reply)
    console.log('--- Testing Detail Page for P001 ---');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/detail.html?id=P001' });
    await wait(2500);

    const detailP001Check = await evaluate(ws, `(() => {
      const topScore = document.getElementById('pdpTopRatingScore')?.textContent;
      const jumpLink = document.getElementById('jumpToReviewsLink')?.textContent;
      const bigScore = document.querySelector('.pdp-big-score')?.textContent;
      const reviewCards = Array.from(document.querySelectorAll('#reviewsContainer .pdp-review-card')).map(card => {
        const id = card.getAttribute('data-review-id');
        const reviewer = card.querySelector('.pdp-reviewer-name')?.textContent;
        const verified = Boolean(card.querySelector('.pdp-verified-badge'));
        const comment = card.querySelector('.pdp-review-comment')?.textContent;
        const adminReply = card.querySelector('.admin-ecodesk-reply-body')?.textContent?.trim();
        const commentsCount = card.querySelectorAll('.pdp-comment-item').length;
        return { id, reviewer, verified, comment, adminReply, commentsCount };
      });
      return { topScore, jumpLink, bigScore, reviewCards };
    })()`);

    console.log('Detail Page P001 Check:', JSON.stringify(detailP001Check, null, 2));
    await wait(600);
    // Scroll down to reviews section
    await evaluate(ws, `(() => {
      const sec = document.getElementById('reviewsSection');
      if (sec) sec.scrollIntoView({ behavior: 'instant' });
    })()`);
    await wait(600);
    await captureScreenshot(ws, 'verify_detail_reviews_p001.png');

    // 5. Test Product Detail Page for P003 (Has NO reviews -> Should show "Chưa có đánh giá")
    console.log('--- Testing Detail Page for P003 (No reviews) ---');
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:5173/detail.html?id=P003' });
    await wait(2500);

    const detailP003Check = await evaluate(ws, `(() => {
      const topScore = document.getElementById('pdpTopRatingScore')?.textContent;
      const jumpLink = document.getElementById('jumpToReviewsLink')?.hidden;
      const bigScore = document.querySelector('.pdp-big-score')?.textContent;
      const emptyMsg = document.querySelector('.pdp-reviews-empty h4')?.textContent;
      return { topScore, jumpLinkHidden: jumpLink, bigScore, emptyMsg };
    })()`);

    console.log('Detail Page P003 Check:', JSON.stringify(detailP003Check, null, 2));
    await wait(600);
    await evaluate(ws, `(() => {
      const sec = document.getElementById('reviewsSection');
      if (sec) sec.scrollIntoView({ behavior: 'instant' });
    })()`);
    await wait(600);
    await captureScreenshot(ws, 'verify_detail_no_reviews_p003.png');

    ws.close();
    console.log('=== All visual verifications finished successfully! ===');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try { chromeProc.kill(); } catch {}
  }
}

main();


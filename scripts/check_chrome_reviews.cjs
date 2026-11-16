const { spawn } = require('child_process');
const fs = require('fs');

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
  return result.result?.value;
}

async function main() {
  const port = 9337;
  // Use existing temp chrome user data dir if available or check if default chrome has remote debugging
  // Let's first test port 9222
  let wsUrl = null;
  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    if (res.ok) {
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    }
  } catch {}

  console.log('Port 9222 wsUrl:', wsUrl);
}

main();


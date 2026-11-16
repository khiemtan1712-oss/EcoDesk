import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readConfiguredPort() {
  if (process.env.SERVER_PORT && /^\d+$/.test(process.env.SERVER_PORT.trim())) {
    return Number(process.env.SERVER_PORT.trim());
  }
  const envPath = path.join(ROOT_DIR, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*SERVER_PORT\s*=\s*(\d+)\s*$/);
      if (m) return Number(m[1]);
    }
  }
  return 8080;
}

function checkEcoDeskMailStatus(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: "/api/auth/mail-status", timeout: 2500 },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            resolve({ isEcoDesk: false, statusCode: res.statusCode });
            return;
          }
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed?.configured === "boolean") {
              resolve({ isEcoDesk: true, configured: parsed.configured });
              return;
            }
          } catch {
            // Non-JSON response belongs to another service
          }
          resolve({ isEcoDesk: false, statusCode: res.statusCode });
        });
      }
    );
    req.on("error", () => resolve({ isEcoDesk: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ isEcoDesk: false });
    });
  });
}

function isTcpPortListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 1200 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function isPortOccupied(port) {
  const [v4, v6] = await Promise.all([
    isTcpPortListening("127.0.0.1", port),
    isTcpPortListening("::1", port)
  ]);
  return v4 || v6;
}

function getDockerApiStatus() {
  try {
    const out = execFileSync(
      "docker",
      ["ps", "--filter", "name=^/ecodesk-api$", "--format", "{{.Status}}"],
      { encoding: "utf8", timeout: 2500, stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

function detectPortOwner(port) {
  try {
    if (process.platform === "win32") {
      const netOut = execFileSync("netstat", ["-ano", "-p", "TCP"], {
        encoding: "utf8",
        timeout: 3000,
        stdio: ["ignore", "pipe", "ignore"]
      });
      const pids = new Set();
      for (const line of netOut.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
        if (m && Number(m[1]) === port && m[2] !== "0") {
          pids.add(m[2]);
        }
      }
      const owners = [];
      for (const pid of pids) {
        try {
          const taskOut = execFileSync(
            "tasklist",
            ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
            { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }
          ).trim();
          const name = taskOut.split(",")[0]?.replace(/^"|"$/g, "") || "unknown";
          owners.push(`${name} (PID ${pid})`);
        } catch {
          owners.push(`PID ${pid}`);
        }
      }
      return owners;
    }

    const lsofOut = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      timeout: 2500,
      stdio: ["ignore", "pipe", "ignore"]
    });
    return lsofOut
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((row) => {
        const cols = row.trim().split(/\s+/);
        return `${cols[0]} (PID ${cols[1]})`;
      });
  } catch {
    return [];
  }
}

async function main() {
  const port = readConfiguredPort();
  const ecoStatus = await checkEcoDeskMailStatus(port);

  if (ecoStatus.isEcoDesk) {
    const dockerStatus = getDockerApiStatus();
    console.log(
      `[EcoDesk] Backend EcoDesk da dang hoat dong tai http://127.0.0.1:${port} (mail configured: ${ecoStatus.configured}).`
    );
    console.log("[EcoDesk] Bo qua khoi chay ban Maven thu hai de tranh xung dot cong.");
    if (dockerStatus) {
      console.log(`[EcoDesk] Nguon dang chay: Docker container 'ecodesk-api' (${dockerStatus}).`);
      console.log("[EcoDesk] - Nap lai .env moi cho Docker: docker compose up -d ecodesk-backend");
      console.log("[EcoDesk] - Chuyen sang chay Maven local: docker compose stop ecodesk-backend && npm run backend");
    } else {
      console.log("[EcoDesk] Nguon dang chay: tien trinh backend EcoDesk local tren cong " + port + ".");
    }
    process.exit(0);
  }

  if (await isPortOccupied(port)) {
    const owners = detectPortOwner(port);
    console.error(`[EcoDesk] Cong ${port} dang bi mot dich vu/tien trinh khac chiem dung.`);
    if (owners.length > 0) {
      console.error(`[EcoDesk] Tien trinh dang giu cong ${port}: ${owners.join(", ")}`);
    } else {
      console.error("[EcoDesk] Khong xac dinh duoc ten tien trinh (hoac khac dich vu EcoDesk).");
    }
    console.error("[EcoDesk] Script khong tu y dung tien trinh ben ngoai.");
    console.error(
      `[EcoDesk] Vui long dung dich vu dang chiem cong ${port}, hoac dat SERVER_PORT=<cong_khac> trong .env (Vite proxy va backend se tu dong bo theo SERVER_PORT).`
    );
    process.exit(1);
  }

  console.log(`[EcoDesk] Cong ${port} dang trong. Dang khoi chay Spring Boot backend (Maven) tren cong ${port}...`);
  const isWin = process.platform === "win32";
  const child = isWin
    ? spawn("cmd.exe", ["/d", "/s", "/c", "mvn.cmd spring-boot:run"], {
        cwd: path.join(ROOT_DIR, "backend"),
        stdio: "inherit",
        env: { ...process.env, SERVER_PORT: String(port) }
      })
    : spawn("mvn", ["spring-boot:run"], {
        cwd: path.join(ROOT_DIR, "backend"),
        stdio: "inherit",
        env: { ...process.env, SERVER_PORT: String(port) }
      });

  const forwardSignal = (sig) => {
    if (!child.killed) child.kill(sig);
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main();


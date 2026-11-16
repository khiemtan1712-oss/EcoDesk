import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort = env.SERVER_PORT || process.env.SERVER_PORT || "8080";
  const assistantPort = env.ASSISTANT_PORT || process.env.ASSISTANT_PORT || "3001";

  return {
    server: {
      proxy: {
        "/api/assistant": `http://127.0.0.1:${assistantPort}`,
        "/api": `http://127.0.0.1:${backendPort}`
      }
    },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        products: path.resolve(import.meta.dirname, "products.html"),
        detail: path.resolve(import.meta.dirname, "detail.html"),
        cart: path.resolve(import.meta.dirname, "cart.html"),
        checkout: path.resolve(import.meta.dirname, "checkout.html"),
        account: path.resolve(import.meta.dirname, "account.html"),
        login: path.resolve(import.meta.dirname, "login.html"),
        register: path.resolve(import.meta.dirname, "register.html"),
        admin: path.resolve(import.meta.dirname, "admin.html"),
        add: path.resolve(import.meta.dirname, "add.html"),
        edit: path.resolve(import.meta.dirname, "edit.html"),
        customerOrders: path.resolve(import.meta.dirname, "customer-orders.html"),
        paymentSupport: path.resolve(import.meta.dirname, "payment-support.html")
      }
    }
  },
  plugins: [
    {
      name: "ecodesk-file-sync",
      configureServer(server) {
        const usersFile = path.resolve(process.cwd(), "users.json");
        const chatFile = path.resolve(process.cwd(), "chat_threads.json");
        const notifFile = path.resolve(process.cwd(), "notifications.json");
        const resetFile = path.resolve(process.cwd(), "password_resets.json");
        const reviewsFile = path.resolve(process.cwd(), "reviews.json");

        const handleJsonSync = (req, res, filePath, defaultData = "[]") => {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");

          if (req.method === "GET") {
            try {
              if (fs.existsSync(filePath)) {
                res.end(fs.readFileSync(filePath, "utf8"));
              } else {
                res.end(defaultData);
              }
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return true;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => { body += chunk; });
            req.on("end", () => {
              try {
                const parsed = JSON.parse(body);
                fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf8");
                res.end(JSON.stringify({ success: true, count: Array.isArray(parsed) ? parsed.length : 1 }));
              } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return true;
          }

          return false;
        };

        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split("?")[0] : "";
          if (url === "/api-users") {
            if (handleJsonSync(req, res, usersFile, "[]")) return;
          } else if (url === "/api-chat") {
            if (handleJsonSync(req, res, chatFile, "[]")) return;
          } else if (url === "/api-notifications") {
            if (handleJsonSync(req, res, notifFile, "[]")) return;
          } else if (url === "/api-resets") {
            if (handleJsonSync(req, res, resetFile, "[]")) return;
          } else if (url === "/api-reviews") {
            if (handleJsonSync(req, res, reviewsFile, "{}")) return;
          }
          next();
        });
      }
    }
  ]
  };
};


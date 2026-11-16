import { initStore, getProducts, getCategories } from "./storage.js";
import { getPricing } from "./commerce.js";
import { formatPrice, isAuthPagePath } from "./utils.js";
import { renderIcon } from "./icons.js";

const escapeText = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi");
const shopScope = /\b(ecodesk|danh muc|san pham|ban nang ha|ban hoc|ban lam viec|ghe|den hoc|den ban|anh sang|phu kien|laptop|setup|combo|gia tien|gia ban|khuyen mai|sale|giam gia|ma uu dai|don hang|gio hang|bao hanh|doi tra|giao hang|van chuyen|ton kho|mua hang|tu van|noi that|ergonomic|smartdesk|epione|rgb|gaming|ngan sach|tai chinh|trieu|tr|nghin|ngan|dong|vnd|\d+\s*(?:k|m))\b/;

function parseBudget(question) {
  const text = normalize(question);
  const amounts = [];
  const suffixPattern = /(\d+(?:[.,]\d+)?)\s*(trieu|tr|million|m|k|nghin|ngan)\b/g;
  for (const match of text.matchAll(suffixPattern)) {
    const value = Number(match[1].replace(",", "."));
    const suffix = match[2];
    amounts.push(value * (suffix === "k" || suffix === "nghin" || suffix === "ngan" ? 1000 : 1_000_000));
  }
  if (!amounts.length) {
    for (const match of text.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+)\s*(?:d|dong|vnd)?\b/g)) {
      amounts.push(Number(match[1].replace(/[.,]/g, "")));
    }
    if (!amounts.length) {
      for (const match of text.matchAll(/\b(\d{6,})\s*(?:d|dong|vnd)?\b/g)) amounts.push(Number(match[1]));
    }
  }
  const hasBudgetIntent = /(ngan sach|tai chinh|co tam|toi co|em co|minh co|ban co|khach co|co khoang|chi toi da|duoi|toi da|trong kha nang|muc gia|tam gia|khoang|gia duoi)/.test(text);
  return hasBudgetIntent && amounts.length ? Math.max(...amounts) : 0;
}

function categoryMatches(product, categories, type) {
  const category = normalize(categories.find((entry) => entry.id === product.categoryId)?.name);
  const name = normalize(`${product.name} ${(product.tags || []).join(" ")}`);
  if (type === "ergonomic") return product.categoryId === "ergonomic";
  if (type === "chair") return /ghe|chair/.test(name);
  if (type === "lamp") return /den|lighting|anh sang/.test(`${category} ${name}`);
  if (type === "desk") return /ban|desk/.test(name);
  if (type === "accessory") return /phu kien|laptop|phu kien|accessor/.test(category) || /laptop|cap|ke man hinh|tay nang|gia do/.test(name);
  if (type === "combo") return /combo|setup/.test(`${category} ${name}`);
  if (type === "gaming") return /gaming|rgb|neon/.test(name);
  return true;
}

export function answerFor(question, products, categories) {
  const text = normalize(question);
  const currentPrice = (product) => getPricing(product).price;
  const ordered = [...products].sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0));
  const budget = parseBudget(question);

  if (!shopScope.test(text)) {
    return { text: "Mình chỉ hỗ trợ thông tin sản phẩm, giá, ưu đãi và dịch vụ của EcoDesk. Bạn muốn tìm món nào hoặc có ngân sách khoảng bao nhiêu?" };
  }

  if (/(bao nhieu|tong so|danh sach|liet ke|tat ca).{0,45}(san pham|mon hang|mat hang)|(san pham|mon hang).{0,35}(bao nhieu|co nhung gi|nao)|web.{0,30}(san pham|mon hang)/.test(text)) {
    const grouped = categories.map((category) => {
      const count = products.filter((product) => product.categoryId === category.id).length;
      return count ? `${category.name}: ${count}` : "";
    }).filter(Boolean).join("; ");
    return { text: `EcoDesk hiện có ${products.length} sản phẩm${grouped ? `, gồm ${grouped}` : ""}. Mình liệt kê toàn bộ bên dưới để bạn xem:`, products: ordered };
  }

  if (budget) {
    const withinBudget = ordered.filter((product) => currentPrice(product) <= budget && Number(product.stock ?? 1) > 0).sort((a, b) => currentPrice(b) - currentPrice(a));
    const categoryType = /ban ghe|ghe va ban/.test(text) ? "ergonomic" : /ghe|chair/.test(text) ? "chair" : /den|lighting/.test(text) ? "lamp" : /ban|desk/.test(text) ? "desk" : /phu kien|laptop|accessor/.test(text) ? "accessory" : /combo|setup/.test(text) ? "combo" : /gaming|rgb/.test(text) ? "gaming" : "all";
    const relevant = categoryType === "all" ? withinBudget : withinBudget.filter((product) => categoryMatches(product, categories, categoryType));
    const choices = (relevant.length ? relevant : categoryType === "all" ? [] : withinBudget).slice(0, 5);
    if (choices.length) {
      return { text: `Với ngân sách khoảng ${formatPrice(budget)}, ${categoryType !== "all" && relevant.length ? "đúng nhóm bạn quan tâm, " : ""}đây là các lựa chọn đang có giá không vượt ngân sách, sắp xếp từ gần mức ngân sách nhất:`, products: choices };
    }
    const nearest = products.filter((product) => Number(product.stock ?? 1) > 0).sort((a, b) => currentPrice(a) - currentPrice(b)).slice(0, 3);
    return { text: `Mình chưa thấy sản phẩm còn hàng phù hợp dưới ${formatPrice(budget)}${categoryType !== "all" ? " trong nhóm bạn chọn" : ""}. Đây là các lựa chọn có giá thấp nhất để bạn tham khảo:`, products: nearest };
  }

  if (/bao nhieu|tong so|danh sach|liet ke|tat ca/.test(text) && /danh muc|loai/.test(text)) {
    return { text: `Website có ${categories.length} danh mục. Bạn xem các sản phẩm thuộc từng nhóm bên dưới:`, products: ordered };
  }
  if (/ship|giao hang|van chuyen|bao lau/.test(text)) return { text: "Thông tin phí và thời gian giao hàng phụ thuộc địa chỉ; trang hiện chưa có dữ liệu cụ thể. Bạn vui lòng liên hệ EcoDesk ở mục Hỗ Trợ Khách Hàng để được xác nhận." };
  if (/doi tra|bao hanh|doi hang/.test(text)) return { text: "Trang hiện chưa có thông tin chi tiết về bảo hành/đổi trả. Bạn vui lòng liên hệ EcoDesk ở mục Hỗ Trợ Khách Hàng để được xác nhận chính sách trước khi đặt hàng." };
  if (/sale|giam|khuyen mai|ma uu dai/.test(text)) {
    const deals = products.filter((product) => getPricing(product).percent).sort((a, b) => getPricing(b).percent - getPricing(a).percent);
    if (deals.length) return { text: "Đây là các sản phẩm đang có ưu đãi. Mã và điều kiện riêng (nếu có) nằm trong mục Tài khoản sau khi đăng nhập:", products: deals };
    return { text: "Hiện chưa có sản phẩm đang giảm giá trong danh sách. Ưu đãi riêng của tài khoản xem tại mục Tài khoản sau khi đăng nhập." };
  }

  if (/^(website|trang web|web|catalog)?\s*(co )?(bao nhieu|tong so)?\s*(danh muc|loai)( nao)?\??$/.test(text)) {
    return { text: `Website có ${categories.length} danh mục: ${categories.map((category) => category.name).join(", ")}.`, products: ordered };
  }

  const intent = /ban ghe|ghe va ban/.test(text) ? "ergonomic"
    : /ghe|chair|ngoi|lung|ergonomic/.test(text) ? "chair"
    : /den|lighting|anh sang|chieu sang|mat/.test(text) ? "lamp"
      : /ban nang ha|ban hoc|smartdesk|ban lam viec|\bban\b/.test(text) ? "desk"
        : /phu kien|laptop|cap|ke man hinh|tay nang/.test(text) ? "accessory"
          : /combo|setup/.test(text) ? "combo"
            : /gaming|game|rgb|neon/.test(text) ? "gaming" : "all";

  if (intent !== "all") {
    const matches = ordered.filter((product) => categoryMatches(product, categories, intent));
    const label = { ergonomic: "bàn ghế công thái học", chair: "ghế công thái học", lamp: "đèn và ánh sáng", desk: "bàn làm việc", accessory: "phụ kiện setup", combo: "combo setup", gaming: "góc gaming" }[intent];
    return matches.length
      ? { text: `Mình tìm được ${matches.length} sản phẩm thuộc nhóm ${label}. Đây là danh sách phù hợp:`, products: matches }
      : { text: `Hiện mình chưa tìm thấy sản phẩm thuộc nhóm ${label} trong catalog.` };
  }

  const meaningfulTerms = text.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 2 && !/^(toi|minh|ban|muon|tim|cho|biet|cac|nhung|san|pham|nao|giup|voi|co|hay|la|web|trang)$/.test(term));
  const matches = products.filter((product) => {
    const searchable = normalize(`${product.name} ${product.description} ${(product.tags || []).join(" ")}`);
    return meaningfulTerms.some((term) => searchable.includes(term));
  });
  if (matches.length) return { text: `Mình tìm thấy ${matches.length} sản phẩm khớp nội dung bạn hỏi:`, products: matches };

  const bestSellers = [...products].sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0)).slice(0, 5);
  return { text: `Mình có thể tra ${products.length} sản phẩm trong catalog. Bạn cho mình biết nhóm món cần tìm hoặc ngân sách (ví dụ “ghế dưới 3 triệu”, “mình có 5 triệu”) để mình lọc đúng giá và liệt kê lựa chọn phù hợp nhé. Một vài sản phẩm được chọn nhiều:`, products: bestSellers };
}

function addMessage(list, text, role, products = []) {
  const bubble = document.createElement("div");
  bubble.className = `assistant-message assistant-${role}`;
  const content = document.createElement("p");
  content.textContent = text;
  bubble.append(content);
  if (products.length) {
    const recommendations = document.createElement("div");
    recommendations.className = "assistant-recommendations";
    recommendations.innerHTML = products.map((product) => {
      const pricing = getPricing(product);
      return `<a href="./detail.html?id=${encodeURIComponent(product.id)}"><img src="${escapeText(product.image)}" alt="${escapeText(product.name)}"><span><strong>${escapeText(product.name)}</strong><small>${formatPrice(pricing.price)}</small></span></a>`;
    }).join("");
    bubble.append(recommendations);
  }
  list.append(bubble);
  list.scrollTop = list.scrollHeight;
}

async function mountAssistant() {
  if (
    document.getElementById("assistantPanel") ||
    document.querySelector(".eco-assistant") ||
    window.location.pathname.includes("admin.html")
  ) {
    return;
  }

  await initStore();
  const products = getProducts();
  const categories = getCategories();
  const root = document.createElement("aside");
  root.className = "eco-assistant";
  root.innerHTML = `
    <section class="assistant-panel" id="assistantPanel" aria-label="Trợ lý tư vấn sản phẩm EcoDesk AI" hidden>
      <header>
        <div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-flex; color: #10b981;">${renderIcon("sparkles", { size: 16, strokeWidth: 2 })}</span>
            <strong>Trợ lý EcoDesk AI</strong>
          </div>
          <small>Tư vấn sản phẩm & gợi ý mua sắm</small>
        </div>
        <button type="button" class="assistant-close" aria-label="Đóng tư vấn" style="display:flex; align-items:center; justify-content:center;">
          ${renderIcon("x", { size: 16, strokeWidth: 1.8 })}
        </button>
      </header>
      <div class="assistant-messages" aria-live="polite"></div>
      <form class="assistant-form">
        <label class="sr-only" for="assistantInput">Câu hỏi về sản phẩm</label>
        <input id="assistantInput" maxlength="240" placeholder="Bạn đang tìm bàn nâng hạ, ghế, đèn học...?" required>
        <button type="submit" aria-label="Gửi câu hỏi">Gửi</button>
      </form>
    </section>
    <button type="button" class="assistant-launch" id="assistantLaunchBtn" aria-expanded="false" aria-controls="assistantPanel" aria-label="Hỏi EcoDesk AI" title="Hỏi EcoDesk AI">
      <span aria-hidden="true" style="display:inline-flex; align-items:center; justify-content:center; color: #34d399;">${renderIcon("sparkles", { size: 18, strokeWidth: 2 })}</span>
      <span class="assistant-launch-label">Hỏi EcoDesk AI</span>
    </button>
  `;
  document.body.append(root);

  const panel = root.querySelector(".assistant-panel");
  const launcher = root.querySelector(".assistant-launch");
  const messages = root.querySelector(".assistant-messages");
  const input = root.querySelector("#assistantInput");
  const submitButton = root.querySelector(".assistant-form button[type='submit']");

  const toggle = (open) => {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) {
      // Đóng chat CSKH nếu đang mở để tránh chồng chéo khung thoại
      const cskhBox = document.getElementById("chatWindowBox");
      const cskhBtn = document.getElementById("chatLauncherBtn");
      if (cskhBox && !cskhBox.classList.contains("hidden")) {
        cskhBox.classList.add("hidden");
        cskhBtn?.setAttribute("aria-expanded", "false");
      }
      input.focus();
    }
  };

  launcher.addEventListener("click", () => toggle(panel.hidden));
  root.querySelector(".assistant-close").addEventListener("click", () => {
    toggle(false);
    launcher.focus();
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      toggle(false);
      launcher.focus();
    }
  });

  root.querySelector(".assistant-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    addMessage(messages, question, "user");
    input.value = "";
    input.disabled = true;
    submitButton.disabled = true;
    submitButton.textContent = "Đang gửi";

    const fallback = answerFor(question, products, categories);
    const context = {
      categories: categories.map((category) => category.name),
      guidance: fallback.text,
      recommendedProductIds: (fallback.products || []).map((product) => product.id),
      products: products.map((product) => {
        const pricing = getPricing(product);
        return {
          id: product.id,
          name: product.name,
          category: categories.find((category) => category.id === product.categoryId)?.name || "Khác",
          description: product.description,
          tags: product.tags || [],
          price: pricing.price,
          originalPrice: pricing.original,
          salePercent: pricing.percent || 0,
          stock: product.stock,
          status: product.status
        };
      })
    };

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, context })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.fallback) {
        addMessage(messages, `Đang kết nối danh mục EcoDesk: ${fallback.text}`, "bot", fallback.products || []);
      } else {
        addMessage(messages, result.reply || fallback.text, "bot", result.inScope === false ? [] : fallback.products || []);
      }
    } catch (error) {
      addMessage(messages, `Đang trả lời từ danh mục EcoDesk: ${fallback.text}`, "bot", fallback.products || []);
    } finally {
      input.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = "Gửi";
      input.focus();
    }
  });

  addMessage(messages, "Chào bạn! Mình là EcoDesk AI, có thể tư vấn mẫu bàn nâng hạ, ghế công thái học, đèn và combo setup phù hợp với nhu cầu và ngân sách của bạn.", "bot");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAssistant, { once: true });
else mountAssistant();

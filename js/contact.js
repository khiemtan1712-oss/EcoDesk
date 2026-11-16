import { $, showToast } from "./utils.js";
import { validateContact } from "./validation.js";
import { revealOnScroll } from "./scroll-reveal.js";

const form = $("#contactForm");
requestAnimationFrame(() => revealOnScroll());

function showErrors(errors) {
  ["name", "email", "phone", "message"].forEach((name) => {
    const errorNode = $(`[data-error="${name}"]`);
    errorNode.textContent = errors[name] || "";
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const errors = validateContact(data);

  showErrors(errors);
  if (Object.keys(errors).length > 0) return;

  $("#contactNotice").textContent = "Cảm ơn bạn. EcoDesk sẽ phản hồi tư vấn setup sớm.";
  $("#contactNotice").classList.remove("hidden");
  showToast("Gửi yêu cầu hỗ trợ thành công.");
  form.reset();
});

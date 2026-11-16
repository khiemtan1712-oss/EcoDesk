import { renderIcon, initIcons } from "./icons.js";

document.addEventListener("DOMContentLoaded", () => {
  initIcons();
  // 1. Issue Cards Selection & Auto-Fill
  const issueCards = document.querySelectorAll(".sz-issue-card");
  const issueSelect = document.getElementById("issueType");
  const formSection = document.getElementById("requestFormSection");

  issueCards.forEach((card) => {
    card.addEventListener("click", () => {
      const issueKey = card.dataset.issue;
      
      // Highlight active card
      issueCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      // Update select field
      if (issueSelect && issueKey) {
        issueSelect.value = issueKey;
        issueSelect.dispatchEvent(new Event("change"));
      }

      // Smooth scroll to form
      formSection?.scrollIntoView({ behavior: "smooth", block: "start" });

      // Highlight corresponding FAQ if exists
      const relatedFaq = document.querySelector(`.sz-faq-item[data-faq="${issueKey}"]`);
      if (relatedFaq) {
        openFaq(relatedFaq);
      }
    });
  });

  // 2. FAQ Accordion Logic
  const faqItems = document.querySelectorAll(".sz-faq-item");
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector(".sz-faq-question");
    questionBtn?.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      faqItems.forEach((f) => f.classList.remove("open"));
      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });

  function openFaq(item) {
    faqItems.forEach((f) => f.classList.remove("open"));
    item.classList.add("open");
  }

  // 3. File Upload Feedback
  const fileInput = document.getElementById("receiptFile");
  const fileNameDisplay = document.getElementById("fileNameDisplay");

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Kích thước tệp quá lớn. Vui lòng chọn ảnh dưới 5MB.");
        fileInput.value = "";
        if (fileNameDisplay) fileNameDisplay.textContent = "";
        return;
      }
      if (fileNameDisplay) {
        fileNameDisplay.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("check", { size: 14, strokeWidth: 2 })} Đã chọn: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - Hãy chắc chắn bạn đã che số thẻ nhạy cảm.</span>`;
      }
    } else if (fileNameDisplay) {
      fileNameDisplay.textContent = "";
    }
  });

  // 4. Form Submit & Realistic Integration Notification
  const supportForm = document.getElementById("paymentSupportForm");
  const modalBackdrop = document.getElementById("statusModal");
  const modalCloseBtn = document.getElementById("closeModalBtn");
  const modalTicketId = document.getElementById("modalTicketId");
  const modalIssueType = document.getElementById("modalIssueType");
  const modalContact = document.getElementById("modalContact");
  const modalTimestamp = document.getElementById("modalTimestamp");

  supportForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const contactInfo = document.getElementById("contactInfo").value.trim();
    const issueType = document.getElementById("issueType").value;
    const orderCode = document.getElementById("orderCode").value.trim();
    const description = document.getElementById("description").value.trim();

    if (!fullName || !contactInfo || !issueType || !description) {
      alert("Vui lòng điền đầy đủ các thông tin bắt buộc có dấu (*)");
      return;
    }

    // Generate mock reference ID for display
    const generatedTicket = "SZ-PAY-" + Math.floor(100000 + Math.random() * 900000);
    const now = new Date().toLocaleString("vi-VN");

    // Populate modal data
    if (modalTicketId) modalTicketId.textContent = generatedTicket;
    if (modalIssueType) modalIssueType.textContent = issueSelect.options[issueSelect.selectedIndex].text;
    if (modalContact) modalContact.textContent = contactInfo;
    if (modalTimestamp) modalTimestamp.textContent = now;

    // Show modal
    modalBackdrop?.classList.add("active");

    // Reset form
    supportForm.reset();
    if (fileNameDisplay) fileNameDisplay.textContent = "";
    issueCards.forEach((c) => c.classList.remove("active"));
  });

  modalCloseBtn?.addEventListener("click", () => {
    modalBackdrop?.classList.remove("active");
  });

  modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) {
      modalBackdrop.classList.remove("active");
    }
  });
});

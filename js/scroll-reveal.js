import AOS from "aos";
import "aos/dist/aos.css";

let initialized = false;

const revealSelectors = [
  [".section-head", "fade-up", 0],
  [".category-band", "fade-up", 0],
  [".visual-category", "fade-up", 80],
  [".new-product-card", "fade-up", 60],
  [".featured-card", "fade-up", 60],
  [".product-card", "fade-up", 60],
  [".combo-card", "zoom-in", 100],
  [".feature-grid > *", "fade-up", 80],
  [".story-grid > *", "fade-up", 80],
  [".spec-grid > *", "fade-up", 60],
  [".benefit-grid > *", "fade-up", 60],
  [".blog-grid > *", "fade-up", 80],
  [".consult-cta", "fade-up", 0],
  [".auth-visual, .auth-card, .auth-picker, .detail-grid > *, .cart-summary, .admin-feature-panel, .form-card", "fade-right", 80],
  [".scheduled-banner-content", "fade-left", 0],
  [".hero-copy", "fade-right", 0],
  [".hero-product-strip > a", "flip-up", 100]
];

export function revealOnScroll(root = document) {
  if (!root?.querySelectorAll) return;

  revealSelectors.forEach(([selector, animation, interval], groupIndex) => {
    root.querySelectorAll(selector).forEach((element, index) => {
      if (element.hasAttribute("data-aos")) return;
      element.setAttribute("data-aos", animation);
      element.setAttribute("data-aos-duration", String(700 + (groupIndex % 3) * 100));
      element.setAttribute("data-aos-easing", "ease-out-cubic");
      element.setAttribute("data-aos-offset", "50");
      if (interval) element.setAttribute("data-aos-delay", String((index % 4) * interval));
    });
  });

  if (!initialized) {
    AOS.init({
      once: false,
      mirror: true,
      offset: 50,
      duration: 700,
      easing: "ease-out-cubic"
    });
    window.AOS = AOS;
    initialized = true;

    window.addEventListener("load", () => {
      AOS.refreshHard();
    });
  } else {
    AOS.refreshHard();
  }

  setTimeout(() => {
    AOS.refresh();
  }, 150);
}

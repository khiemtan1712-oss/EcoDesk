import {
  initStore,
  loginUser,
  getCurrentUser,
  getActiveCoupons,
  requestRegistrationOtp,
  verifyRegistrationOtp,
  requestPasswordReset,
  verifyAndResetPassword,
  isStrongPassword,
  isStrongRegisterPassword
} from "./storage.js";
import { processPendingFavoriteAfterLogin } from "./favorites.js";
import { resetPasswordToggles, updateControls } from "./interface.js";
import {
  $,
  getParam,
  showToast,
  HOME_PATH,
  resolvePostLoginRedirect,
  buildAuthUrl,
  consumeAuthRedirectState,
  AUTH_NOTICE_KEY,
  AUTH_NOTICE_TYPE_KEY,
  AUTH_NEXT_KEY
} from "./utils.js";

await initStore();

const form = $("#authForm");
const mode = form?.dataset.mode;
const authNoticeBanner = $("#authNoticeBanner");
const authSwitchLink = $("#authSwitchLink");

const rawQueryNext = getParam("next");
let postAuthRedirectStarted = false;

function navigateAfterAuth(targetUrl = HOME_PATH) {
  if (postAuthRedirectStarted) return;
  postAuthRedirectStarted = true;
  window.location.replace(targetUrl || HOME_PATH);
}

try {
  sessionStorage.removeItem(AUTH_NEXT_KEY);
} catch {}

if ((mode === "login" || mode === "register") && rawQueryNext !== null) {
  const normalizedAuthHref = buildAuthUrl(window.location.pathname);
  if (`${window.location.pathname}${window.location.search}` !== normalizedAuthHref) {
    window.history.replaceState(null, "", `${normalizedAuthHref}${window.location.hash}`);
  }
}

if (authSwitchLink) {
  const targetPage = mode === "login" ? "./register.html" : "./login.html";
  authSwitchLink.href = buildAuthUrl(targetPage);
}

function renderAuthNoticeBanner(message, type = "info") {
  if (!authNoticeBanner) return;
  const cleanMsg = String(message || "").trim();
  if (!cleanMsg) {
    authNoticeBanner.textContent = "";
    authNoticeBanner.hidden = true;
    return;
  }
  const allowedType = ["info", "warning", "error", "success"].includes(type) ? type : "info";
  authNoticeBanner.className = `auth-alert-banner is-${allowedType}`;
  authNoticeBanner.textContent = cleanMsg;
  authNoticeBanner.hidden = false;
}

if (mode === "login" || mode === "register") {
  let storedNotice = "";
  let storedNoticeType = "info";
  try {
    storedNotice = sessionStorage.getItem(AUTH_NOTICE_KEY) || "";
    storedNoticeType = sessionStorage.getItem(AUTH_NOTICE_TYPE_KEY) || "info";
    if (storedNotice) {
      sessionStorage.removeItem(AUTH_NOTICE_KEY);
      sessionStorage.removeItem(AUTH_NOTICE_TYPE_KEY);
    }
  } catch {}

  const bannerMessage = storedNotice;
  renderAuthNoticeBanner(bannerMessage, storedNotice ? storedNoticeType : "info");
}

if (getCurrentUser() && (mode === "login" || mode === "register") && !postAuthRedirectStarted) {
  const target = resolvePostLoginRedirect();
  consumeAuthRedirectState();
  navigateAfterAuth(target);
}

function setError(name, message = "") {
  const node = $(`[data-error="${name}"]`);
  if (node) node.textContent = message;
}

function clearErrors() {
  ["name", "email", "password", "confirm", "otp", "general"].forEach((name) => setError(name));
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validate(data) {
  const errors = {};
  if (mode === "register" && (data.name || "").trim().length < 2) {
    errors.name = "Vui lòng nhập họ tên ít nhất 2 ký tự.";
  }
  if (!validateEmail((data.email || "").trim())) {
    errors.email = "Email chưa đúng định dạng.";
  }
  if (mode === "register" && !isStrongRegisterPassword(data.password)) {
    errors.password = "Mật khẩu cần đáp ứng đầy đủ 5 yêu cầu bảo mật bên dưới.";
  } else if (mode === "login" && !data.password) {
    errors.password = "Vui lòng nhập mật khẩu.";
  }
  if (mode === "register" && data.password !== data.confirm) {
    errors.confirm = "Mật khẩu nhập lại chưa khớp.";
  }
  return errors;
}

function updatePasswordGuidance(password = "") {
  const rules = [
    ["length", password.length >= 10],
    ["lower", /[a-z]/.test(password)],
    ["upper", /[A-Z]/.test(password)],
    ["number", /\d/.test(password)],
    ["symbol", /[^A-Za-z0-9]/.test(password)]
  ];
  for (const [name, passed] of rules) {
    const item = document.querySelector(`[data-password-rule="${name}"]`);
    item?.classList.toggle("rule-passed", passed);
    if (item) {
      const labelText = item.textContent.trim();
      item.setAttribute("aria-label", `${passed ? "Đạt" : "Chưa đạt"}: ${labelText}`);
    }
  }
  const guidance = $("#passwordGuidance");
  guidance?.classList.toggle("password-ready", rules.every(([, passed]) => passed));
}

if (mode === "register") {
  const pwdInput = form?.querySelector("#password");
  const confirmInput = form?.querySelector("#confirm");
  if (pwdInput) {
    updatePasswordGuidance(pwdInput.value || "");
    pwdInput.addEventListener("input", (event) => {
      const val = event.target.value;
      updatePasswordGuidance(val);
      if (isStrongRegisterPassword(val)) {
        setError("password", "");
      }
      if (confirmInput?.value) {
        setError("confirm", confirmInput.value === val ? "" : "Mật khẩu nhập lại chưa khớp.");
      }
    });
  }
  confirmInput?.addEventListener("input", (event) => {
    const val = event.target.value;
    if (!val) {
      setError("confirm", "");
      return;
    }
    setError("confirm", val === (pwdInput?.value || "") ? "" : "Mật khẩu nhập lại chưa khớp.");
  });
}

function showErrors(errors) {
  Object.entries(errors).forEach(([name, message]) => setError(name, message));
}

function formatMmSs(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(sec / 60)).padStart(2, "0");
  const rem = String(sec % 60).padStart(2, "0");
  return `${mins}:${rem}`;
}

function createOtpTimerController({
  expiryEl,
  expiryBadgeEl,
  resendBtn,
  idleResendText = "Gửi lại mã"
}) {
  let intervalId = null;
  let expiresAtMs = 0;
  let resendReadyAtMs = 0;

  function render() {
    const now = Date.now();
    const expiryLeft = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
    const resendLeft = Math.max(0, Math.ceil((resendReadyAtMs - now) / 1000));

    if (expiryEl) {
      expiryEl.textContent = expiryLeft > 0 ? formatMmSs(expiryLeft) : "Đã hết hạn";
    }
    if (expiryBadgeEl) {
      expiryBadgeEl.classList.toggle("is-expired", expiryLeft <= 0);
    }

    if (resendBtn) {
      if (resendLeft > 0) {
        resendBtn.disabled = true;
        resendBtn.textContent = `${idleResendText} (${resendLeft}s)`;
      } else {
        resendBtn.disabled = false;
        resendBtn.textContent = idleResendText;
      }
    }

    if (expiryLeft <= 0 && resendLeft <= 0 && intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    start(expirySeconds = 900, cooldownSeconds = 60) {
      this.stop();
      const now = Date.now();
      expiresAtMs = now + Math.max(0, Number(expirySeconds) || 900) * 1000;
      resendReadyAtMs = now + Math.max(0, Number(cooldownSeconds) || 60) * 1000;
      render();
      intervalId = window.setInterval(render, 1000);
    },
    startCooldownOnly(cooldownSeconds = 60) {
      resendReadyAtMs = Date.now() + Math.max(0, Number(cooldownSeconds) || 60) * 1000;
      render();
      if (!intervalId) {
        intervalId = window.setInterval(render, 1000);
      }
    },
    stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }
  };
}

/* ==========================================================================
   ĐĂNG KÝ 2 BƯỚC VỚI XÁC THỰC EMAIL OTP THẬT
   ========================================================================== */
const registerStep1 = $("#registerStep1");
const registerStep2 = $("#registerStep2");
const registerOtpInput = $("#registerOtp");
const registerOtpEmailBadge = $("#registerOtpEmailBadge");
const registerOtpNotice = $("#registerOtpNotice");
const btnRegisterRequestOtp = $("#btnRegisterRequestOtp");
const btnVerifyRegisterOtp = $("#btnVerifyRegisterOtp");
const btnResendRegisterOtp = $("#btnResendRegisterOtp");
const btnBackToRegisterStep1 = $("#btnBackToRegisterStep1");

let pendingRegisterPayload = null;
let registerBusy = false;

const registerOtpTimers = createOtpTimerController({
  expiryEl: $("#registerOtpCountdown"),
  expiryBadgeEl: $("#registerOtpTimerBadge"),
  resendBtn: btnResendRegisterOtp
});

function showRegisterOtpStep(payload, apiResult) {
  pendingRegisterPayload = { ...payload };
  if (registerStep1) registerStep1.hidden = true;
  if (registerStep2) registerStep2.hidden = false;
  if (registerOtpEmailBadge) {
    registerOtpEmailBadge.textContent = apiResult.email || payload.email;
  }
  if (registerOtpNotice) {
    registerOtpNotice.className = "auth-alert-banner is-info";
  }
  setError("otp", "");
  registerOtpTimers.start(apiResult.expiresInSeconds || 900, apiResult.resendCooldownSeconds || 60);
  if (registerOtpInput) {
    registerOtpInput.value = "";
    registerOtpInput.focus();
  }
}

async function handleVerifyRegisterOtp() {
  if (!pendingRegisterPayload || registerBusy) return;
  const otp = (registerOtpInput?.value || "").trim();
  setError("otp", "");

  if (!/^\d{6}$/.test(otp)) {
    setError("otp", "Vui lòng nhập đúng mã xác thực gồm 6 chữ số.");
    registerOtpInput?.focus();
    return;
  }

  registerBusy = true;
  if (btnVerifyRegisterOtp) {
    btnVerifyRegisterOtp.disabled = true;
    btnVerifyRegisterOtp.textContent = "Đang xác thực...";
  }

  try {
    await verifyRegistrationOtp(pendingRegisterPayload.email, otp);
    registerOtpTimers.stop();
    consumeAuthRedirectState();
    sessionStorage.setItem(
      AUTH_NOTICE_KEY,
      "Đăng ký và xác thực email thành công! Phiếu giảm 10% cho đơn đầu tiên đã được thêm vào tài khoản."
    );
    showToast("Đăng ký thành công! Đang chuyển về trang chủ...");
    window.setTimeout(() => {
      navigateAfterAuth(HOME_PATH);
    }, 650);
  } catch (err) {
    setError("otp", err.message);
  } finally {
    registerBusy = false;
    if (btnVerifyRegisterOtp) {
      btnVerifyRegisterOtp.disabled = false;
      btnVerifyRegisterOtp.textContent = "Xác nhận & hoàn tất đăng ký";
    }
  }
}

btnVerifyRegisterOtp?.addEventListener("click", handleVerifyRegisterOtp);

registerOtpInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleVerifyRegisterOtp();
  }
});

btnBackToRegisterStep1?.addEventListener("click", () => {
  registerOtpTimers.stop();
  setError("otp", "");
  if (registerStep2) registerStep2.hidden = true;
  if (registerStep1) registerStep1.hidden = false;
});

btnResendRegisterOtp?.addEventListener("click", async () => {
  if (!pendingRegisterPayload || registerBusy) return;
  registerBusy = true;
  setError("otp", "");
  btnResendRegisterOtp.disabled = true;
  btnResendRegisterOtp.textContent = "Đang gửi lại...";

  try {
    const res = await requestRegistrationOtp(pendingRegisterPayload);
    registerOtpTimers.start(res.expiresInSeconds || 900, res.resendCooldownSeconds || 60);
    showToast("Đã gửi mã xác thực OTP mới tới email của bạn. Mã cũ đã hết hiệu lực.");
    if (registerOtpInput) {
      registerOtpInput.value = "";
      registerOtpInput.focus();
    }
  } catch (err) {
    setError("otp", err.message);
    if (err.data?.retryAfterSeconds) {
      registerOtpTimers.startCooldownOnly(err.data.retryAfterSeconds);
    } else {
      btnResendRegisterOtp.disabled = false;
      btnResendRegisterOtp.textContent = "Gửi lại mã";
    }
  } finally {
    registerBusy = false;
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (mode === "register" && registerStep2 && !registerStep2.hidden) {
    await handleVerifyRegisterOtp();
    return;
  }

  clearErrors();
  const data = Object.fromEntries(new FormData(form).entries());
  const errors = validate(data);
  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    return;
  }

  const submitButton = form.querySelector("#btnRegisterRequestOtp, #btnLoginSubmit, button[type=submit]");
  const defaultBtnHtml = submitButton ? submitButton.innerHTML : "";
  try {
    if (submitButton) submitButton.disabled = true;
    if (mode === "register") {
      if (btnRegisterRequestOtp) btnRegisterRequestOtp.textContent = "Đang gửi mã OTP...";
      const payload = {
        name: (data.name || "").trim(),
        email: (data.email || "").trim().toLowerCase(),
        password: data.password,
        phone: ""
      };
      const res = await requestRegistrationOtp(payload);
      showRegisterOtpStep(payload, res);
      showToast("Mã OTP đã được gửi tới email của bạn.");
    } else {
      if (submitButton) submitButton.textContent = "Đang đăng nhập...";
      const user = await loginUser(data.email, data.password);
      const savedSession = getCurrentUser();
      if (!user?.id || !savedSession?.id) {
        throw new Error("Không thể lưu phiên đăng nhập. Vui lòng thử lại.");
      }
      getActiveCoupons(user.id);

      const nextPage = resolvePostLoginRedirect();

      consumeAuthRedirectState();
      await processPendingFavoriteAfterLogin(user.id);
      sessionStorage.setItem(AUTH_NOTICE_KEY, "Đăng nhập thành công!");
      renderAuthNoticeBanner("Đăng nhập thành công! Đang chuyển về trang chủ...", "success");
      window.setTimeout(() => {
        navigateAfterAuth(nextPage);
      }, 450);
    }
  } catch (error) {
    setError("general", error?.message || "Đăng nhập không thành công. Vui lòng thử lại.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      if (mode === "register" && btnRegisterRequestOtp) {
        btnRegisterRequestOtp.textContent = "Tiếp tục & gửi mã OTP";
      } else if (defaultBtnHtml) {
        submitButton.innerHTML = defaultBtnHtml;
        updateControls();
      }
    }
  }
});

/* ==========================================================================
   XỬ LÝ MODAL QUÊN MẬT KHẨU / ĐẶT LẠI MẬT KHẨU OTP QUA EMAIL THẬT
   ========================================================================== */
const forgotModal = $("#forgotPasswordModal");
const forgotLink = $("#forgotPasswordLink");
const closeForgotBtn = $("#closeForgotModalBtn");
const forgotStep1 = $("#forgotStep1");
const forgotStep2 = $("#forgotStep2");
const forgotEmailInput = $("#forgotEmail");
const forgotEmailError = $("#forgotEmailError");
const btnRequestOtp = $("#btnRequestOtp");
const forgotOtpStatusBanner = $("#forgotOtpStatusBanner");
const forgotTokenInput = $("#forgotToken");
const forgotNewPasswordInput = $("#forgotNewPassword");
const forgotConfirmPasswordInput = $("#forgotConfirmPassword");
const forgotStrengthLabel = $("#forgotStrengthLabel");
const forgotResetError = $("#forgotResetError");
const btnConfirmReset = $("#btnConfirmReset");
const btnBackToStep1 = $("#btnBackToStep1");
const btnResendForgotOtp = $("#btnResendForgotOtp");

let resetSessionEmail = "";
let forgotBusy = false;

const forgotOtpTimers = createOtpTimerController({
  expiryEl: $("#forgotOtpCountdown"),
  expiryBadgeEl: $("#forgotOtpTimerBadge"),
  resendBtn: btnResendForgotOtp
});

function updateForgotStrength(pwd = "") {
  if (!forgotStrengthLabel) return;
  if (!pwd) {
    forgotStrengthLabel.textContent = "Chưa nhập";
    forgotStrengthLabel.style.color = "#64748b";
  } else if (isStrongPassword(pwd)) {
    forgotStrengthLabel.textContent = "Mạnh (Đạt yêu cầu)";
    forgotStrengthLabel.style.color = "#16a34a";
  } else {
    forgotStrengthLabel.textContent = "Yếu (Cần ít nhất 8 ký tự, gồm chữ hoa, thường & số)";
    forgotStrengthLabel.style.color = "#dc2626";
  }
}

function openForgotModal() {
  if (!forgotModal) return;
  forgotOtpTimers.stop();
  forgotModal.style.display = "flex";
  forgotStep1.style.display = "block";
  forgotStep2.style.display = "none";
  if (forgotEmailError) forgotEmailError.textContent = "";
  if (forgotResetError) forgotResetError.textContent = "";
  if (forgotTokenInput) forgotTokenInput.value = "";
  if (forgotNewPasswordInput) forgotNewPasswordInput.value = "";
  if (forgotConfirmPasswordInput) forgotConfirmPasswordInput.value = "";
  updateForgotStrength("");
  resetPasswordToggles(forgotModal);
  const currentLoginEmail = $("#email")?.value.trim();
  if (currentLoginEmail && forgotEmailInput) {
    forgotEmailInput.value = currentLoginEmail;
  }
}

function closeForgotModal() {
  if (!forgotModal) return;
  forgotOtpTimers.stop();
  resetPasswordToggles(forgotModal);
  forgotModal.style.display = "none";
}

forgotLink?.addEventListener("click", openForgotModal);
closeForgotBtn?.addEventListener("click", closeForgotModal);
forgotModal?.addEventListener("click", (e) => {
  if (e.target === forgotModal) closeForgotModal();
});

btnRequestOtp?.addEventListener("click", async () => {
  if (forgotBusy) return;
  const email = forgotEmailInput?.value.trim().toLowerCase() || "";
  if (!email || !validateEmail(email)) {
    if (forgotEmailError) forgotEmailError.textContent = "Vui lòng nhập địa chỉ email hợp lệ.";
    return;
  }

  forgotBusy = true;
  btnRequestOtp.disabled = true;
  btnRequestOtp.textContent = "Đang gửi mã OTP...";
  if (forgotEmailError) forgotEmailError.textContent = "";

  try {
    const res = await requestPasswordReset(email);
    resetSessionEmail = email;
    forgotStep1.style.display = "none";
    forgotStep2.style.display = "block";
    if (forgotOtpStatusBanner) {
      forgotOtpStatusBanner.textContent = res.message;
    }
    if (forgotTokenInput) {
      forgotTokenInput.value = "";
      forgotTokenInput.focus();
    }
    forgotOtpTimers.start(res.expiresInSeconds || 900, res.resendCooldownSeconds || 60);
    showToast(res.message);
  } catch (err) {
    if (forgotEmailError) forgotEmailError.textContent = err.message;
  } finally {
    forgotBusy = false;
    btnRequestOtp.disabled = false;
    btnRequestOtp.textContent = "Gửi mã xác thực";
  }
});

btnResendForgotOtp?.addEventListener("click", async () => {
  if (!resetSessionEmail || forgotBusy) return;
  forgotBusy = true;
  if (forgotResetError) forgotResetError.textContent = "";
  btnResendForgotOtp.disabled = true;
  btnResendForgotOtp.textContent = "Đang gửi lại...";

  try {
    const res = await requestPasswordReset(resetSessionEmail);
    forgotOtpTimers.start(res.expiresInSeconds || 900, res.resendCooldownSeconds || 60);
    if (forgotTokenInput) {
      forgotTokenInput.value = "";
      forgotTokenInput.focus();
    }
    showToast(res.message);
  } catch (err) {
    if (forgotResetError) forgotResetError.textContent = err.message;
    if (err.data?.retryAfterSeconds) {
      forgotOtpTimers.startCooldownOnly(err.data.retryAfterSeconds);
    } else {
      btnResendForgotOtp.disabled = false;
      btnResendForgotOtp.textContent = "Gửi lại mã";
    }
  } finally {
    forgotBusy = false;
  }
});

btnBackToStep1?.addEventListener("click", () => {
  forgotOtpTimers.stop();
  forgotStep2.style.display = "none";
  forgotStep1.style.display = "block";
});

forgotNewPasswordInput?.addEventListener("input", (e) => {
  updateForgotStrength(e.target.value);
});

btnConfirmReset?.addEventListener("click", async () => {
  if (forgotBusy) return;
  const token = forgotTokenInput?.value.trim() || "";
  const newPwd = forgotNewPasswordInput?.value || "";
  const confirmPwd = forgotConfirmPasswordInput?.value || "";

  if (forgotResetError) forgotResetError.textContent = "";

  if (!/^\d{6}$/.test(token)) {
    if (forgotResetError) forgotResetError.textContent = "Vui lòng nhập mã xác thực OTP gồm đúng 6 chữ số.";
    return;
  }
  if (!isStrongPassword(newPwd)) {
    if (forgotResetError) forgotResetError.textContent = "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.";
    return;
  }
  if (newPwd !== confirmPwd) {
    if (forgotResetError) forgotResetError.textContent = "Mật khẩu xác nhận không khớp.";
    return;
  }

  forgotBusy = true;
  btnConfirmReset.disabled = true;
  btnConfirmReset.textContent = "Đang xử lý...";

  try {
    const res = await verifyAndResetPassword(resetSessionEmail, token, newPwd);
    showToast(res.message);
    closeForgotModal();
    const loginEmailInput = $("#email");
    const loginPasswordInput = $("#password");
    if (loginEmailInput) loginEmailInput.value = resetSessionEmail;
    if (loginPasswordInput) {
      loginPasswordInput.value = "";
      loginPasswordInput.focus();
    }
  } catch (err) {
    if (forgotResetError) forgotResetError.textContent = err.message;
  } finally {
    forgotBusy = false;
    btnConfirmReset.disabled = false;
    btnConfirmReset.textContent = "Đặt lại mật khẩu";
  }
});

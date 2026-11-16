/**
 * EcoDesk PDF Export Helper
 * Xuất báo cáo kinh doanh, danh sách đơn hàng và hóa đơn trực tiếp sang PDF
 * Hỗ trợ định dạng tiền tệ Việt Nam, phân trang và giao diện chuyên nghiệp
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPrice } from "./utils.js";

function renderTable(doc, opts) {
  if (typeof doc.autoTable === "function") {
    return doc.autoTable(opts);
  }
  const fn = typeof autoTable === "function" ? autoTable : (autoTable?.default || autoTable);
  if (typeof fn === "function") {
    return fn(doc, opts);
  }
}

// Helper bỏ dấu tiếng Việt khi xuất font chuẩn PDF để tránh lỗi vỡ font ký tự đặc biệt
function removeVietnameseTones(str) {
  if (!str) return "";
  str = String(str);
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} ${formatDate(dateStr)}`;
}

/**
 * Xuất báo cáo kinh doanh tổng hợp sang file PDF
 */
export function exportReportToPDF({ orders = [], timeFilter = "all", kpis = {}, authorName = "Quan tri vien" }) {
  if (!orders || orders.length === 0) {
    throw new Error("Không có dữ liệu đơn hàng trong khoảng thời gian đã chọn để xuất PDF.");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();
  const timeFilterLabels = {
    all: "Toan bo thoi gian",
    today: "Hom nay",
    "7days": "7 ngay qua",
    month: "Thang nay"
  };
  const filterLabel = timeFilterLabels[timeFilter] || timeFilter;

  // 1. Header Banner
  doc.setFillColor(31, 122, 92); // #1f7a5c
  doc.rect(0, 0, 210, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("ECODESK STUDIO - BAO CAO KINH DOANH", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(230, 245, 238);
  doc.text("Giai phap noi that va setup khong gian lam viec thong minh", 14, 23);

  // 2. Metadata Information Block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 90, 100);

  const exportTime = formatDateTime(now);
  doc.text(`Ngay xuat: ${exportTime}`, 14, 40);
  doc.text(`Nguoi xuat: ${removeVietnameseTones(authorName)}`, 14, 46);
  doc.text(`Bo loc thoi gian: ${filterLabel}`, 120, 40);
  doc.text(`Tong so don xuat: ${orders.length} don hang`, 120, 46);

  // 3. KPI Summary Box (4 Cards)
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 52, 182, 24, 3, 3, "FD");

  const totalRevenue = kpis.revenue !== undefined ? kpis.revenue : orders.reduce((sum, o) => sum + (o.status !== "Da huy" && o.status !== "Đã hủy" ? (Number(o.total) || 0) : 0), 0);
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "Hoan thanh" || o.status === "Hoàn thành" || o.status === "Giao hang thanh cong").length;
  const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / (orders.filter(o => o.status !== "Da huy" && o.status !== "Đã hủy").length || 1)) : 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TONG DOANH THU", 22, 60);
  doc.text("SO DON HANG", 72, 60);
  doc.text("GIA TRI TB/DON", 118, 60);
  doc.text("HOAN TAT", 165, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(31, 122, 92);
  doc.text(formatPrice(totalRevenue), 22, 69);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalOrders} don`, 72, 69);
  doc.text(formatPrice(avgOrder), 118, 69);
  doc.setTextColor(37, 99, 235);
  doc.text(`${completedOrders}/${totalOrders}`, 165, 69);

  // 4. Data Table
  const tableRows = orders.map((o, idx) => {
    return [
      idx + 1,
      o.id || "-",
      removeVietnameseTones(o.customerName || "Khach hang"),
      o.customerPhone || "-",
      formatDate(o.createdAt),
      formatPrice(Number(o.total) || 0),
      removeVietnameseTones(o.status || "Cho xu ly")
    ];
  });

  renderTable(doc, {
    startY: 82,
    head: [["STT", "Ma don", "Khach hang", "So DT", "Ngay dat", "Tong tien", "Trang thai"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [31, 122, 92],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center"
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 32 },
      2: { cellWidth: 38 },
      3: { halign: "center", cellWidth: 26 },
      4: { halign: "center", cellWidth: 24 },
      5: { halign: "right", fontStyle: "bold", cellWidth: 26 },
      6: { halign: "center", cellWidth: 24 }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer phân trang
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `EcoDesk Studio - Hotline: 1900 1234 - Website: ecodesk.vn | Trang ${data.pageNumber} / ${pageCount}`,
        14,
        290
      );
    }
  });

  const fileDate = now.toISOString().split("T")[0];
  const fileName = `EcoDesk-Bao-Cao-Kinh-Doanh_${fileDate}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Xuất danh sách đơn hàng sang file PDF
 */
export function exportOrdersListToPDF(orders = [], filterName = "Tat ca") {
  if (!orders || orders.length === 0) {
    throw new Error("Không có đơn hàng nào trong danh sách để xuất PDF.");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Header
  doc.setFillColor(17, 29, 25);
  doc.rect(0, 0, 210, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("ECODESK STUDIO - DANH SACH DON HANG", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Bo loc: ${removeVietnameseTones(filterName)} | Tong so: ${orders.length} don | Xuat ngay: ${formatDateTime(new Date())}`, 14, 22);

  const tableRows = orders.map((o, idx) => {
    return [
      idx + 1,
      o.id || "-",
      removeVietnameseTones(o.customerName || "Khach hang"),
      o.customerPhone || "-",
      formatDate(o.createdAt),
      formatPrice(Number(o.total) || 0),
      removeVietnameseTones(o.paymentMethod || "COD"),
      removeVietnameseTones(o.status || "Cho xu ly")
    ];
  });

  renderTable(doc, {
    startY: 34,
    head: [["STT", "Ma don", "Khach hang", "Dien thoai", "Ngay dat", "Tong tien", "Thanh toan", "Trang thai"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [17, 29, 25],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center"
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 30 },
      2: { cellWidth: 36 },
      3: { halign: "center", cellWidth: 24 },
      4: { halign: "center", cellWidth: 22 },
      5: { halign: "right", fontStyle: "bold", cellWidth: 24 },
      6: { halign: "center", cellWidth: 18 },
      7: { halign: "center", cellWidth: 18 }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`EcoDesk Studio - Danh sach don hang | Trang ${data.pageNumber} / ${pageCount}`, 14, 290);
    }
  });

  const fileDate = new Date().toISOString().split("T")[0];
  const fileName = `EcoDesk-Danh-Sach-Don-Hang_${fileDate}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Xuất phiếu xuất kho / Hóa đơn chi tiết của 1 đơn hàng sang PDF
 */
export function exportOrderInvoiceToPDF(order) {
  if (!order) throw new Error("Thông tin đơn hàng không hợp lệ.");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // 1. Header
  doc.setFillColor(31, 122, 92);
  doc.rect(0, 0, 210, 36, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("ECODESK STUDIO", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 252, 231);
  doc.text("PHIEU GIAO HANG & HOA DON BAN LE", 14, 23);
  doc.text("Hotline: 1900 1234 | Email: support@ecodesk.vn | Website: ecodesk.vn", 14, 29);

  // 2. Order Information & Customer Details Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 42, 182, 38, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`MA DON HANG: #${order.id}`, 20, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Ngay dat: ${formatDateTime(order.createdAt)}`, 20, 56);
  doc.text(`Trang thai: ${removeVietnameseTones(order.status || "Cho xu ly")}`, 20, 62);
  doc.text(`Thanh toan: ${removeVietnameseTones(order.paymentMethod || "COD")}`, 20, 68);

  doc.setFont("helvetica", "bold");
  doc.text("NGUOI NHAN HANG:", 110, 50);
  doc.setFont("helvetica", "normal");
  doc.text(`Ho ten: ${removeVietnameseTones(order.customerName || "-")}`, 110, 56);
  doc.text(`Dien thoai: ${order.customerPhone || "-"}`, 110, 62);
  doc.text(`Dia chi: ${removeVietnameseTones(order.shippingAddress || "-")}`, 110, 68, { maxWidth: 80 });

  // 3. Items Table
  let items = [];
  try {
    if (order.itemsJson) items = JSON.parse(order.itemsJson);
    else if (Array.isArray(order.items)) items = order.items;
  } catch (e) {
    items = [];
  }

  const tableRows = items.map((item, idx) => {
    const varName = item.variantName ? ` (${removeVietnameseTones(item.variantName)})` : "";
    const name = removeVietnameseTones(item.name || "San pham") + varName;
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    const subtotal = price * qty;
    return [
      idx + 1,
      name,
      qty,
      formatPrice(price),
      formatPrice(subtotal)
    ];
  });

  renderTable(doc, {
    startY: 86,
    head: [["STT", "Ten san pham & Phan loai", "SL", "Don gia", "Thanh tien"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [31, 122, 92],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center"
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 95 },
      2: { halign: "center", cellWidth: 15 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", fontStyle: "bold", cellWidth: 30 }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = doc.lastAutoTable.finalY + 8;

  // 4. Summary Calculation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const subtotal = Number(order.subtotal || order.total) || 0;
  const shippingFee = Number(order.shippingFee) || 0;
  const discountAmount = Number(order.discountAmount) || 0;
  const finalTotal = Number(order.total) || subtotal;

  doc.text("Tam tinh:", 135, finalY);
  doc.text(formatPrice(subtotal), 196, finalY, { align: "right" });

  doc.text("Phi van chuyen:", 135, finalY + 6);
  doc.text(shippingFee > 0 ? formatPrice(shippingFee) : "Mien phi", 196, finalY + 6, { align: "right" });

  if (discountAmount > 0) {
    doc.text("Giam gia (Uu dai):", 135, finalY + 12);
    doc.text(`-${formatPrice(discountAmount)}`, 196, finalY + 12, { align: "right" });
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(135, finalY + 15, 196, finalY + 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(31, 122, 92);
  doc.text("TONG CONG:", 135, finalY + 22);
  doc.text(formatPrice(finalTotal), 196, finalY + 22, { align: "right" });

  // 5. Notes & Thank You Message
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Cam on quy khach da tin tuong va lua chon EcoDesk Studio!", 14, finalY + 32);
  doc.text("Quy khach duoc kiem tra hang truoc khi thanh toan. Bao hanh chinh hang 24 thang.", 14, finalY + 37);

  const fileName = `EcoDesk-Hoa-Don-${order.id}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Xuất Báo cáo Tài chính & Dòng tiền sang PDF
 */
export function exportFinancialReportToPDF({
  summary = {},
  transactions = [],
  from = "",
  to = "",
  authorName = "Quản trị viên"
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();
  const periodText = (from || to) ? `Tu ${from || "dau ky"} den ${to || "hien tai"}` : "Toan bo thoi gian";

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // dark slate #0f172a
  doc.rect(0, 0, 210, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("ECODESK STUDIO - BAO CAO TAI CHINH & DONG TIEN", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("Bao cao phan tich chuyen sau - Nguon du lieu: He thong may chu Backend", 14, 22);

  // 2. Metadata Block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const exportTime = formatDateTime(now);
  doc.text(`Ngay gio xuat: ${exportTime}`, 14, 39);
  doc.text(`Nguoi xuat: ${removeVietnameseTones(authorName)}`, 14, 45);
  doc.text(`Ky bao cao: ${periodText}`, 115, 39);
  doc.text(`Don vi tien te: VND`, 115, 45);

  // 3. KPI Summary Table
  const grossProfitText = summary.grossProfitStatus === "AVAILABLE"
    ? formatPrice(summary.grossProfit || 0)
    : (summary.grossProfitStatus === "NO_DATA" ? "Chua co don hoan tat" : "Chua du du lieu gia von");

  const kpiData = [
    ["1. Doanh so don hoan tat", formatPrice(summary.completedOrderSales || 0), "6. Tien nhap hang da tra (dong tien)", formatPrice(summary.purchaseCashOut || 0)],
    ["2. Tien da thu (da xac minh)", formatPrice(summary.collectedCash || 0), "7. Cong no NCC con phai tra", formatPrice(summary.supplierDebt || 0)],
    ["3. Cho thu (chua thanh toan)", formatPrice(summary.pendingReceivable || 0), "8. Chi phi van hanh", formatPrice(summary.operatingExpenses || 0)],
    ["4. Hoan tien thuc te", formatPrice(summary.refundedActual || 0), "9. Luong da chi / phai chi", summary.payrollRestricted ? "An theo phan quyen" : `${formatPrice(summary.payrollPaid || 0)} / ${formatPrice(summary.payrollPending || 0)}`],
    ["5. Tong gia tri phieu nhap", formatPrice(summary.totalPurchaseOrdersAmount || 0), "10. Dong tien rong (Net Cash)", formatPrice(summary.netCashFlow || 0)],
    ["Loi nhuan gop / uoc tinh", grossProfitText, "Gia tri ton kho (gia von)", formatPrice(summary.inventoryValuationAtCost || 0)]
  ];

  renderTable(doc, {
    startY: 49,
    head: [["Chi tieu", "Gia tri", "Chi tieu", "Gia tri"]],
    body: kpiData,
    theme: "grid",
    headStyles: {
      fillColor: [31, 122, 92],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center"
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right", fontStyle: "bold", cellWidth: 41, textColor: [15, 23, 42] },
      2: { fontStyle: "bold", cellWidth: 50 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 41, textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });

  const nextY = (doc.lastAutoTable?.finalY || 100) + 8;

  // 4. Section: Chi tiet giao dich
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`CHI TIET GIAO DICH THU / CHI TRONG KY (${transactions.length} giao dich)`, 14, nextY);

  const txRows = (transactions || []).slice(0, 150).map((tx, idx) => {
    const isIncome = tx.txType === "INCOME_OTHER";
    return [
      idx + 1,
      tx.txDate || "-",
      removeVietnameseTones(tx.txType || "-"),
      removeVietnameseTones(tx.category || "-"),
      `${isIncome ? "+" : "-"}${formatPrice(tx.amount || 0)}`,
      removeVietnameseTones(tx.paymentMethod || "-"),
      tx.reconciled ? "Da doi soat" : "Chua doi soat"
    ];
  });

  if (txRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Khong co giao dich thu/chi nao trong ky bao cao nay.", 14, nextY + 8);
  } else {
    renderTable(doc, {
      startY: nextY + 4,
      head: [["STT", "Ngay", "Loai", "Danh muc", "So tien", "Phuong thuc", "Doi soat"]],
      body: txRows,
      theme: "striped",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center"
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "center", cellWidth: 20 },
        2: { cellWidth: 32 },
        3: { cellWidth: 42 },
        4: { halign: "right", fontStyle: "bold", cellWidth: 30 },
        5: { cellWidth: 28 },
        6: { halign: "center", cellWidth: 20 }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `EcoDesk Studio - Bao cao Tai chinh & Dong tien | Trang ${data.pageNumber} / ${pageCount}`,
          14,
          290
        );
      }
    });
  }

  const fileDate = now.toISOString().split("T")[0];
  const fileName = `EcoDesk-Bao-Cao-Tai-Chinh_${fileDate}.pdf`;
  doc.save(fileName);
  return fileName;
}

import * as XLSX from "xlsx";

/**
 * Xuất danh sách dữ liệu ra file Excel (.xlsx)
 * @param {Array<Object>} rows - Danh sách các đối tượng dòng
 * @param {string} fileName - Tên file tải về (không cần đuôi .xlsx)
 * @param {string} sheetName - Tên sheet trong file Excel
 */
export function exportToExcel(rows, fileName = "EcoDesk-Export", sheetName = "Dữ liệu") {
  if (!rows || rows.length === 0) {
    throw new Error("Không có dữ liệu để xuất file Excel.");
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const validFileName = `${fileName.replace(/[^\w\s-]/gi, "")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, validFileName);
}

/**
 * Đọc file Excel từ input file và chuyển đổi thành mảng JSON
 * @param {File} file - File được chọn từ input[type="file"]
 * @returns {Promise<Array<Object>>}
 */
export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Vui lòng chọn một file Excel (.xlsx, .xls)."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("File Excel không có trang tính (sheet) nào.");
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(new Error("Lỗi khi đọc file Excel: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Không thể đọc tệp tin."));
    reader.readAsArrayBuffer(file);
  });
}

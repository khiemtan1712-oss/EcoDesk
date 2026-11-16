# Hướng dẫn Triển khai EcoDesk Studio lên Render.com

Dự án EcoDesk Studio đã được cấu hình sẵn tệp **Render Blueprint** ([render.yaml](file:///c:/Users/nguyen%20tan%20loc%20khiem/Downloads/JS/EcoDesk-Studio/render.yaml)) để bạn có thể triển khai tự động lên [Render](https://render.com) chỉ với vài thao tác.

---

## 1. Kiến trúc hệ thống trên Render

- **Frontend (`ecodesk-frontend`):** Render Static Site
  - **Chi phí:** **100% Miễn phí & Vĩnh viễn**, không giới hạn băng thông.
  - Tự động chạy lệnh `npm install && npm run build` và phục vụ thư mục `./dist`.
  - Đã cấu hình sẵn Rewrite Rule chuyển hướng toàn bộ `/api/*` sang Backend API.
- **Backend (`ecodesk-api`):** Render Web Service (Docker / Java 17 Spring Boot)
  - Chạy trên container Docker nhẹ, tối ưu port động theo biến môi trường `$PORT` của Render.
- **Database (MySQL):** 
  - Render cung cấp PostgreSQL miễn phí nhưng chưa có MySQL free tier tích hợp sẵn.
  - Bạn có thể kết nối Backend với 1 cơ sở dữ liệu MySQL miễn phí trên mây như **TiDB Cloud Serverless** (khuyên dùng - 5GB miễn phí vĩnh viễn), **Aiven for MySQL**, hoặc **Clever Cloud**.

---

## 2. Các bước triển khai chi tiết

### Bước 1: Đẩy mã nguồn lên GitHub / GitLab
Nếu bạn chưa đưa dự án lên GitHub:
```bash
git add .
git commit -m "feat: add render.yaml blueprint and deployment configs"
git push origin main
```

---

### Bước 2: Tạo Cơ sở dữ liệu MySQL miễn phí (Khuyên dùng TiDB Cloud)
1. Truy cập [tidbcloud.com](https://tidbcloud.com) hoặc [aiven.io](https://aiven.io) và đăng ký tài khoản miễn phí.
2. Chọn tạo **Serverless Cluster** (Miễn phí 5GB, tương thích 100% với MySQL 8.0).
3. Đặt tên database là `ecodesk_db`.
4. Lấy thông tin kết nối gồm:
   - **Host / URL:** ví dụ `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`
   - **Port:** `4000` (hoặc `3306` trên Aiven)
   - **Username & Password**
5. Chuỗi JDBC hoàn chỉnh có dạng:
   ```text
   jdbc:mysql://<HOST>:<PORT>/ecodesk_db?sslMode=VERIFY_IDENTITY&characterEncoding=UTF-8&serverTimezone=Asia/Ho_Chi_Minh
   ```

---

### Bước 3: Tạo Blueprint trên Render.com
1. Đăng nhập vào [dashboard.render.com](https://dashboard.render.com).
2. Bấm vào nút **New +** ở góc trên bên phải $\rightarrow$ Chọn **Blueprint**.
3. Kết nối với kho lưu trữ GitHub chứa dự án `EcoDesk-Studio`.
4. Render sẽ tự động quét và phát hiện file [render.yaml](file:///c:/Users/nguyen%20tan%20loc%20khiem/Downloads/JS/EcoDesk-Studio/render.yaml).

---

### Bước 4: Nhập các biến môi trường (Environment Variables)
Khi Render hiển thị bảng thông số cần cấu hình, bạn chỉ cần điền:

| Tên biến | Bắt buộc | Giá trị mẫu / Hướng dẫn |
| :--- | :---: | :--- |
| `SPRING_DATASOURCE_URL` | **Có** | Chuỗi JDBC MySQL từ Bước 2 |
| `SPRING_DATASOURCE_USERNAME` | **Có** | Tên người dùng MySQL của bạn |
| `SPRING_DATASOURCE_PASSWORD` | **Có** | Mật khẩu cơ sở dữ liệu MySQL |
| `SEPAY_API_TOKEN` | *Tùy chọn* | Token tài khoản SePay của bạn (nếu dùng đối soát SePay) |
| `SEPAY_BANK_CODE` | *Tùy chọn* | Mã ngân hàng (ví dụ: `MBBank`, `VCB`...) |
| `SEPAY_ACCOUNT_NUMBER` | *Tùy chọn* | Số tài khoản ngân hàng nhận tiền |
| `SEPAY_ACCOUNT_NAME` | *Tùy chọn* | Tên chủ tài khoản viết hoa không dấu |
| `GEMINI_API_KEY` | *Tùy chọn* | Khóa API Google Gemini (nếu muốn AI Assistant trả lời online) |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | *Tùy chọn* | Cấu hình gửi mail OTP qua Gmail App Password |

---

### Bước 5: Bấm "Apply" để hoàn tất
- Render sẽ tự động xây dựng container cho Spring Boot backend và đóng gói frontend tĩnh.
- Sau khi quá trình hoàn tất (khoảng 2-3 phút), Render sẽ cấp cho bạn 2 đường link:
  1. **Frontend:** `https://ecodesk-frontend.onrender.com`
  2. **Backend API:** `https://ecodesk-api.onrender.com`

> [!TIP]
> Nếu tên miền backend của bạn trên Render khác với `ecodesk-api.onrender.com`, bạn chỉ cần vào phần cài đặt của dịch vụ `ecodesk-frontend` trên Render Dashboard $\rightarrow$ mục **Redirects/Rewrites** $\rightarrow$ đổi địa chỉ đích của rule `/api/*` thành URL backend mới của bạn.

---

## 3. Lưu ý quan trọng khi dùng gói Free của Render

1. **Cơ chế Cold Start (Ngủ đông sau 15 phút):**
   - Trên gói Free, nếu sau 15 phút không có người truy cập, Render sẽ tạm thời đưa dịch vụ Web Service vào chế độ ngủ để tiết kiệm tài nguyên. Lần truy cập tiếp theo sẽ mất khoảng 30-50 giây để khởi động lại.
   - **Giải pháp giữ ấm miễn phí:** Bạn có thể đăng ký dịch vụ giám sát miễn phí như [UptimeRobot.com](https://uptimerobot.com) hoặc [cron-job.org](https://cron-job.org) để ping vào `https://<backend-url>/api/auth/mail-status` mỗi 10 phút một lần.

2. **Dữ liệu ban đầu (Seeder):**
   - Khi Backend khởi động lần đầu với database mới, lớp `DataSeeder` của dự án sẽ tự động khởi tạo dữ liệu danh mục, sản phẩm, và tài khoản quản trị viên mặc định (`admin@ecodesk.vn`).


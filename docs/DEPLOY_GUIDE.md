# Hướng dẫn Deploy & Cập nhật Ứng dụng Stories Reader Android

Hệ thống CI/CD được thiết lập tự động hoàn toàn dựa trên Git Commit. Bạn chỉ cần thao tác lệnh git bình thường, hệ thống sẽ tự phân loại: **Cập nhật mềm OTA (không cần cài lại)** hoặc **Build APK gửi về Telegram**.

---

## 📌 Bảng tra cứu nhanh: Khi nào dùng cách nào?

| Thay đổi thực hiện | Loại cập nhật | Có cần cài lại APK? | Cách thực hiện |
| :--- | :---: | :---: | :--- |
| Sửa giao diện React, Tailwind CSS, Font chữ | **OTA** | ❌ Không | Commit bình thường |
| Sửa logic Reader, TTS Web, Audio BGM, State | **OTA** | ❌ Không | Commit bình thường |
| Thêm màn hình, component, route mới | **OTA** | ❌ Không | Commit bình thường |
| Thêm quyền Android (`AndroidManifest.xml`) | **APK** | ✅ Có | Commit kèm `[apk]` |
| Nâng cấp thư viện Native (`@capacitor/android`...) | **APK** | ✅ Có | Commit kèm `[apk]` |
| Đổi Icon app, Splash screen, Package Name | **APK** | ✅ Có | Commit kèm `[apk]` |

---

## 🚀 Trường hợp 1: Cập nhật mềm OTA (95% các lần cập nhật)

Dùng cho toàn bộ thay đổi liên quan đến **Frontend / React / TypeScript / CSS**. Người dùng điện thoại không cần cài đè file mới, chỉ cần mở app là tự cập nhật.

### Các bước thao tác:

1. **Sửa code** trong thư mục `src/`.
2. **Tăng version** trong file [package.json](file:///Users/vula/Workspace/VuLA/stories/stories-reader/package.json):
   ```json
   "version": "1.0.4"
   ```
   *(Hệ thống so sánh phiên bản semver để kích hoạt tải OTA)*.
3. **Commit & Push lên GitHub** (Tuyệt đối **KHÔNG** chứa chữ `[apk]`):
   ```bash
   git add -A
   git commit -m "feat(reader): thêm hiệu ứng lật trang và sửa giao diện"
   git push origin main
   ```
4. **Hệ thống tự động thực hiện**:
   - GitHub Actions chạy workflow `Deploy Web and OTA Update`.
   - Tự động biên dịch web bundle, nén `bundle.zip`, tính mã băm SHA-256 vào `version.json`.
   - Deploy trực tiếp lên GitHub Pages CDN.
   - **Bỏ qua** bước build APK (không gửi file rác về Telegram).
5. **Kiểm tra trên điện thoại**:
   - Vuốt tắt app Stories Reader trong đa nhiệm rồi mở lại.
   - App tự động hiện màn hình `Đang tải bản cập nhật mới...` trong **3 - 5 giây** và tự reload sang bản mới.

---

## 📦 Trường hợp 2: Build file APK mới gửi qua Telegram

Chỉ dùng khi có thay đổi ở tầng **Native Android** (thư mục `android/`, cấu hình `capacitor.config.ts`, hoặc cập nhật plugin native).

### Các bước thao tác:

1. **Thực hiện thay đổi** native code hoặc cài đặt plugin.
2. **Tăng version** trong file [package.json](file:///Users/vula/Workspace/VuLA/stories/stories-reader/package.json):
   ```json
   "version": "1.1.0"
   ```
3. **Đồng bộ mã nguồn sang thư mục Android**:
   ```bash
   npm run cap:sync
   ```
4. **Commit & Push với cờ `[apk]`** trong nội dung commit:
   ```bash
   git add -A
   git commit -m "feat(native): cập nhật quyền bộ nhớ ngoài [apk]"
   git push origin main
   ```
5. **Hệ thống tự động thực hiện**:
   - GitHub Actions phát hiện cờ `[apk]` -> Khởi chạy máy ảo Gradle JDK 21.
   - Biên dịch file `StoriesReader-vX.X.X.apk`.
   - Bot Telegram (`vu_la_bot`) gửi file APK đính kèm trực tiếp vào khung chat cá nhân của bạn.
6. **Cài đặt**:
   - Nhấp vào file APK nhận được trong Telegram để cài đặt đè lên điện thoại.

---

## 🛠️ Công cụ kiểm tra & Giám sát

- **Kiểm tra phiên bản OTA hiện tại trên CDN**:
  ```bash
  curl -s https://anhvu0510.github.io/stories-reader/ota/version.json
  ```
- **Kiểm tra phiên bản OTA trên VPS Gateway**:
  ```bash
  curl -s https://api-anhvu0510.duckdns.org/api/app-update/version
  ```
- **Kiểm tra trực tiếp trên app Android**:
  - Mở app -> Bấm icon **Cài đặt** (Settings).
  - Header hiển thị badge phiên bản đang kích hoạt.
  - Tab **Server API** -> Khung **Phiên bản & Cập nhật OTA** -> Bấm nút **Kiểm tra cập nhật** để ép app kiểm tra ngay lập tức.

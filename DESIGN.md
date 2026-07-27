# TÀI LIỆU THIẾT KẾ GIAO DIỆN & CHỨC NĂNG (DESIGN.md)

Tài liệu này mô tả chi tiết toàn bộ chức năng, cấu trúc giao diện, và hệ thống thiết kế màu sắc (Design System) của ứng dụng **Stories Reader**.

---

## 1. Tổng Quan Hệ Thống

**Stories Reader** là một ứng dụng đọc truyện hiện đại với các tính năng vượt trội như:
- Dịch truyện thông minh sử dụng trí tuệ nhân tạo (Gemini AI thông qua Google Vertex API hoặc AI Studio).
- Công cụ chuyển văn bản thành giọng nói (Text-to-Speech - TTS) tích hợp, mô phỏng sóng âm sống động.
- Từ điển thay thế từ ngữ linh hoạt giúp tối ưu hóa bản dịch theo ngữ cảnh hoặc thói quen đọc.
- Chế độ đọc ngoại tuyến (Offline Mode) lưu trữ dữ liệu cục bộ vào IndexedDB, cho phép tiếp tục đọc mọi lúc mọi nơi không cần kết nối mạng.

Ứng dụng được xây dựng trên nền tảng **React (Single Page Application)**, định kiểu bằng **Tailwind CSS** kết hợp **Vanilla CSS** cho các chuyển động mượt mà và giao diện cao cấp.

---

## 2. Hệ Thống Thiết Kế & Màu Sắc (Design System)

Ứng dụng hỗ trợ hệ thống đa chủ đề (Multi-theme) cao cấp được định nghĩa thông qua các biến CSS tùy chỉnh trong [src/index.css](file:///Users/vula/Workspace/VuLA/stories-reader/src/index.css). Mỗi chủ đề mang lại trải nghiệm đọc phù hợp với các điều kiện ánh sáng và sở thích khác nhau.

### 2.1. Danh Sách Các Chủ Đề Màu (Themes)

| Tên Chủ Đề | ID CSS | Mô Tả Trực Quan | Màu Nền Chính | Màu Văn Bản | Màu Nhấn (Primary) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mặc định** | `default` | Tông tối xám than sang trọng, độ tương phản dịu mắt | `#1e1e1e` | `#e3e3e3` | Vàng đồng `#cda052` |
| **Modern VN** | `modern-vn` | Tông xanh Navy sẫm kết hợp với sắc cam ấm áp | `#0b1326` | `#dae2fd` | Cam ấm `#f39c12` |
| **AMOLED** | `amoled` | Màu đen tuyệt đối giúp tiết kiệm pin tối đa cho màn hình OLED | `#000000` | `#ececec` | Xám bạc `#a1a1aa` |
| **Midnight** | `midnight` | Xanh đêm sâu thẳm, mang cảm giác yên bình | `#0f172a` | `#cbd5e1` | Xanh dương `#3b82f6` |
| **Obsidian** | `obsidian` | Màu đen thạch anh huyền bí kết hợp ánh tím nhạt | `#0d0d12` | `#a1a1aa` | Tím thạch anh `#8b5cf6` |
| **Coffee** | `coffee` | Tông nâu cà phê hoài cổ, ấm cúng và cổ điển | `#1c1814` | `#d7c4b4` | Nâu đất sét `#b47a18` |

### 2.2. Hệ Thống Kiểu Chữ (Typography)
Người dùng có thể cá nhân hóa toàn bộ nội dung đọc thông qua các cấu hình:
- **Phông chữ (Font Family)**:
  - `Palatino` (Chữ có chân serif sang trọng, khoảng cách tối ưu).
  - `Bookerly` (Phông chữ chuyên dụng của Kindle, tối ưu cho việc đọc lâu dài).
  - `Viết tay` (`Patrick Hand` - Phông chữ mềm mại, tạo cảm giác thư giãn).
  - `Mặc định` (Sans-serif hiện đại, gọn gàng).
- **Cỡ chữ (Font Size)**: Điều chỉnh linh hoạt từ `14px` đến `32px` với thanh trượt trực quan.
- **Giãn dòng (Line Height)**: Gồm 4 mức cố định: `1.2`, `1.4`, `1.6`, `1.8` để tối ưu mật độ hiển thị.
- **Gộp dòng (Group Lines)**: Cho phép gộp nhiều dòng ngắn thành các đoạn văn dài từ `1` đến `10` dòng giúp nội dung dịch mạch lạc hơn, tránh bị ngắt dòng vụn vặt.

---

## 3. Cấu Trúc Các Màn Hình & Trải Nghiệm Người Dùng (Screens)

Giao diện ứng dụng được thiết kế theo tư duy **Mobile-First** nhưng vẫn tối ưu hóa cực tốt trên màn hình rộng Desktop. Các thành phần tương tác chính sử dụng **Bottom Sheets** (bảng kéo từ dưới lên) tạo cảm giác tự nhiên như ứng dụng di động bản địa.

### 3.1. Màn Hình Thư Viện (`LibraryScreen.tsx`)
- **Vai trò**: Điểm bắt đầu của ứng dụng, quản lý danh sách toàn bộ truyện.
- **Giao diện & Thành phần**:
  - **Thanh tìm kiếm (Search Bar)**: Tìm kiếm truyện tức thì theo tên truyện.
  - **Tab phân loại thư viện**:
    - *Tất cả*: Danh sách toàn bộ truyện có trên hệ thống.
    - *Lịch sử*: Các truyện người dùng đang đọc dở.
    - *Chờ dịch (AI)*: Các truyện đang trong tiến trình dịch thuật.
  - **Chế độ ngoại tuyến**: Nút gạt kích hoạt nhanh chế độ Offline. Khi bật, toàn bộ danh sách truyện được tải từ IndexedDB local.
  - **Đồng bộ đám mây (Sync Button)**: Cập nhật nhanh danh sách truyện mới nhất từ máy chủ API.
  - **Thẻ hiển thị thông tin truyện (Book Cards)**:
    - Ảnh bìa truyện giả lập với màu sắc chủ đề hài hòa.
    - Trạng thái tiến độ dịch: Hiển thị dạng nhãn (ví dụ: `28/50 chương` đã được dịch).
    - Tiến trình đọc dở: Liên kết nhanh để quay lại đọc tiếp chương gần nhất.

### 3.2. Màn Hình Danh Sách Chương (`ChapterListScreen.tsx`)
- **Vai trò**: Cung cấp cái nhìn toàn cảnh về cấu trúc truyện, tiến độ dịch và các thao tác dịch thuật hàng loạt.
- **Giao diện & Thành phần**:
  - **Thanh tiêu đề cố định (Sticky Header)**: Hiển thị tên truyện, tác giả, và nút quay lại thư viện.
  - **Thanh bộ lọc**: Cho phép tìm kiếm chương theo số/tiêu đề và lọc chương theo trạng thái (`Đã dịch`, `Chưa dịch`).
  - **Nút Dịch Thuật & Tải Ngoại Tuyến**:
    - Nút *Dịch thuật* (Biểu tượng Sparkles): Mở bảng dịch AI chuyên sâu.
    - Nút *Tải xuống* (Biểu tượng Download): Mở bảng ngoại tuyến để lưu trữ truyện về máy.
  - **Danh sách chương**: Hiển thị số chương nổi bật, tiêu đề dịch (nếu có), trạng thái dịch biểu thị bằng màu sắc:
    - *Đã dịch (SUCCEEDED)*: Huy hiệu màu xanh lục sáng kèm dấu tích.
    - *Chưa dịch/Đang dịch (PENDING)*: Huy hiệu màu vàng cam ấm.
    - *Lỗi (FAILED)*: Huy hiệu màu đỏ nhạt.

### 3.3. Màn Hình Trình Đọc (`ReaderScreen.tsx`)
- **Vai trò**: Giao diện quan trọng nhất của ứng dụng, tập trung hoàn toàn vào nội dung đọc và nghe truyện.
- **Giao diện & Thành phần**:
  - **Chế độ hiển thị không viền (Full Screen Mode)**: Toàn bộ thanh tiêu đề và điều khiển sẽ ẩn đi khi người dùng bắt đầu cuộn đọc, và tự động hiện lại khi chạm vào màn hình.
  - **Trình đọc văn bản**: Hiển thị chữ theo đúng cấu hình phông chữ, khoảng cách dòng và màu nền chủ đề được chọn.
  - **Nhấp đúp tra cứu (Double-click Interaction)**: Cho phép nhấp đúp vào bất kỳ cụm từ nào để tự động kích hoạt bảng thay thế từ điển nhanh.
  - **Thanh điều hướng dưới cùng thông minh (Bottom Navigation Bar)**:
    - Tự động thay đổi diện mạo dựa trên chế độ sử dụng:
      - **Chế độ Đọc tiêu chuẩn**: Các nút chuyển chương Trước/Sau, Nút phát âm thanh (Play), Nút dịch AI chương này, Nút Cấu hình.
      - **Chế độ Âm thanh (Audio Mode)**: Ẩn các nút phụ để thay bằng bộ điều khiển Audio chuyên dụng (Play/Pause, Tua đoạn trước/sau, Thoát chế độ âm thanh).
  - **Hiệu ứng Sóng âm nhạc hoạt họa (Audio Visualizer)**: Khi đang phát TTS, một sóng âm động chuyển động nhịp nhàng theo giọng đọc ở cạnh thanh điều khiển.

---

## 4. Các Thành Phần Giao Diện Tách Rời (Components)

Các thành phần giao diện đặc biệt được thiết kế dưới dạng Bottom Sheets trượt mượt mà từ cạnh dưới lên trên thiết bị di động, tự động chuyển thành Modals bo tròn sắc nét ở trung tâm màn hình lớn.

### 4.1. Thanh Cập Cạnh Dưới (`BottomDock.tsx`)
Thanh điều hướng nằm ở đáy màn hình chính, sử dụng đường cong SVG uốn lượn đặc biệt để bao quanh nút bấm nổi ở giữa. Có hiệu ứng bóng mờ mịn màng và hoạt ảnh phóng to nhẹ khi di chuột qua.

### 4.2. Bảng Cài Đặt Chung (`GlobalSettingsSheet.tsx`)
Hộp thoại cấu hình tập trung, chia làm 5 phân hệ (Tabs):
1. **Cơ bản**: Chọn Theme, Font, chỉnh cỡ chữ bằng thanh trượt, điều chỉnh giãn dòng và gộp dòng.
2. **Từ điển**: Quản lý các quy tắc thay thế từ ngữ. Hỗ trợ thêm/sửa/xóa quy tắc với 3 cấp độ phạm vi ứng dụng (Scope):
   - *Chương*: Chỉ áp dụng trong chương hiện hành.
   - *Truyện*: Áp dụng cho mọi chương thuộc truyện hiện tại.
   - *Toàn cục*: Áp dụng trên toàn bộ ứng dụng.
3. **Giọng đọc**: Chọn các công cụ phát âm TTS có sẵn trong hệ thống và điều chỉnh tốc độ đọc (0.2x đến 3.0x).
4. **AI**: Quản lý nâng cao gồm API Tokens và Cấu hình Quota của các model AI.
5. **API**: Cho phép cấu hình nhiều máy chủ API khác nhau, kiểm tra kết nối (ping) và chọn máy chủ hoạt động.

### 4.3. Bảng Dịch Thuật AI (`TranslationSheet.tsx`)
Giao diện điều khiển dịch thuật đa chế độ:
- **Các tab lựa chọn**: Dịch chương hiện tại, Dịch hàng loạt chương (chọn theo danh sách hoặc khoảng số chương), Dịch cả bộ truyện.
- **Cấu hình AI nâng cao (Accordion)**:
  - Lựa chọn Nền tảng (Vertex API / AI Studio).
  - Chọn model AI tương ứng (ví dụ: Gemini 2.5 Flash, Gemini Pro).
  - Điều chỉnh tham số sáng tạo (Temperature) và số lượng từ tối đa/tối thiểu mỗi chương.
  - Bật tắt tùy chọn dịch đè (Force Retranslate) và gộp ngữ cảnh (Batching Group).
  - Badge trạng thái giới hạn hạn ngạch (RPD - Requests per Day) còn lại của hệ thống.

### 4.4. Bảng Ngoại Tuyến (`OfflineManagerSheet.tsx`)
- Quản lý trạng thái kết nối mạng ảo (Offline Mode Toggle).
- Liệt kê toàn bộ các truyện đã tải xuống bộ nhớ cục bộ (IndexedDB).
- Hiển thị thông tin dung lượng và số lượng chương đã lưu, nút xóa nhanh truyện khỏi bộ nhớ thiết bị.

### 4.5. Bảng Quản Lý AI Token & Quota (`TokenManagerSheet.tsx` & `QuotaSettingsSheet.tsx`)
- Cung cấp giao diện trực quan cho quản trị viên/người dùng nâng cao để thêm mới, sửa đổi thông tin API Key, cấu hình thông tin dự án GCP (cho Vertex API) hoặc API Key (cho AI Studio).
- Định cấu hình hạn ngạch RPM (Request per minute), TPM (Token per minute) và RPD (Request per day) cho từng loại model nhằm tránh vượt quá mức phí mong muốn.

---

## 5. Hiệu Ứng Trực Quan & Vi Tương Tác (Micro-animations)

Để mang lại cảm giác cao cấp, ứng dụng tích hợp rất nhiều hiệu ứng chuyển động mượt mà:
- **Ping & Pulse**: Vòng tròn tỏa sáng lấp lánh xung quanh nút phát Audio khi đang nói.
- **Spinning Gradient Line**: Viền ngoài nút Play xoay vòng tròn màu sắc sặc sỡ biểu thị trạng thái đang xử lý/hoạt động.
- **Hover Transitions**: Mọi nút bấm đều có hiệu ứng thay đổi màu nền, độ mờ (opacity) và tỷ lệ thu phóng (scale) cực kỳ phản hồi.
- **Glassmorphism**: Bảng tải dữ liệu `LoadingOverlay` làm mờ hậu cảnh bằng bộ lọc backdrop-filter, kết hợp vòng xoay tròn cổ điển mang đến cảm giác mượt mà khi chờ đợi.

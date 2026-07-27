# TÀI LIỆU CẤP PHÁT & TÀI LIỆU API (API.md)

Tài liệu này mô tả chi tiết tất cả các điểm cuối API (Endpoints) được tích hợp trong ứng dụng **Stories Reader**, bao gồm các tham số yêu cầu (Request), cấu trúc phản hồi (Response) và cơ chế vận hành.

---

## 1. Cơ Chế Kết Nối & Cấu Hình Domain

Ứng dụng kết nối tới các API thông qua hàm trung gian `fetchWithRetry` định nghĩa tại [src/lib/api.ts](file:///Users/vula/Workspace/VuLA/stories-reader/src/lib/api.ts).

### 1.1. Cấu Hình Domain API
Hệ thống cho phép cấu hình linh hoạt nhiều địa chỉ API khác nhau (ví dụ: máy chủ thử nghiệm local, máy chủ production, ngrok tunnel).
- Danh sách máy chủ được lưu tại LocalStorage dưới khóa `API_DOMAINS_CONFIG` dưới dạng mảng JSON các đối tượng:
  ```typescript
  interface ApiDomain {
    id: string;
    name: string;
    url: string;
  }
  ```
- Máy chủ hiện tại đang được chọn (Active) được định danh bởi khóa `ACTIVE_API_DOMAIN_ID`.

### 1.2. Cơ Chế Bỏ Qua Cảnh Báo Ngrok
Mọi yêu cầu gửi lên API đều được tự động gắn thêm tiêu đề (header):
- `'ngrok-skip-browser-warning': 'true'` để bỏ qua trang trung gian cảnh báo của ngrok khi chạy thử nghiệm.
- `'Content-Type': 'application/json'`.

---

## 2. Danh Sách Chi Tiết Các API Endpoints

### 2.1. Kiểm Tra Kết Nối Máy Chủ (Test Connection)
- **Endpoint**: `GET /` hoặc `GET /system/ping`
- **Mô tả**: Dùng để kiểm tra máy chủ có đang hoạt động hay không và phản hồi có đúng định dạng quy định.
- **Phản hồi mẫu**:
  ```json
  {
    "succeeded": true,
    "message": "System is running"
  }
  ```

---

### 2.2. Nhóm API Quản Lý Truyện (Books)

#### A. Lấy danh sách truyện (`getBooks`)
- **Endpoint**: `GET /api/books`
- **Tham số truy vấn (Query Params)**:
  - `page` (number, mặc định `1`): Trang hiện tại.
  - `limit` (number, mặc định `20`): Số phần tử mỗi trang.
  - `search` (string, tùy chọn): Từ khóa tìm kiếm theo tên truyện.
  - `tab` (string, tùy chọn): Lọc theo nhóm như `HISTORY` (lịch sử đọc) hoặc `AI` (tiến độ dịch).
- **Phản hồi mẫu**:
  ```json
  {
    "data": [
      {
        "bookId": "65e89d1234abcd5678ef",
        "bookName": "Vũ Luyện Điên Phong",
        "chapterCount": 5000,
        "totalTranslated": 1200,
        "totalPending": 3800,
        "author": "Mạc Mặc",
        "coverUrl": "https://example.com/covers/vuluyen.jpg",
        "createdAt": "2026-05-18T10:00:00Z",
        "updatedAt": "2026-05-21T04:00:00Z",
        "lastReadChapter": {
          "chapterId": "chap_102",
          "chapterNumber": "102",
          "title": "Chương 102: Khởi đầu mới"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 250,
      "total": 5000
    }
  }
  ```

#### B. Tải xuống dữ liệu ngoại tuyến (`downloadBooksStream`)
- **Endpoint**: `POST /api/books/download`
- **Mô tả**: Gửi yêu cầu tải gói dữ liệu nén của nhiều bộ truyện để đọc Offline.
- **Thân yêu cầu (Request Body)**:
  ```json
  {
    "bookIds": ["65e89d1234abcd5678ef"]
  }
  ```
- **Phản hồi**: Luồng dữ liệu nhị phân (Stream Response) chứa dữ liệu truyện và các chương truyện để ghi vào IndexedDB.

---

### 2.3. Nhóm API Quản Lý Chương (Chapters)

#### A. Lấy danh sách chương của truyện (`getChapters`)
- **Endpoint**: `GET /api/books/:bookId/chapters`
- **Tham số truy vấn (Query Params)**:
  - `page` (number, mặc định `1`)
  - `limit` (number, mặc định `50`)
  - `sortBy` (string, mặc định `chapterNumber` | `updatedAt`)
  - `sortOrder` (string, `ASC` | `DESC`)
  - `state` (string, tùy chọn): Lọc theo trạng thái dịch `SUCCEEDED` (Đã dịch), `PENDING` (Chưa dịch), `FAILED` (Dịch lỗi).
  - `search` (string, tùy chọn): Tìm kiếm chương theo số chương hoặc tiêu đề.
- **Phản hồi mẫu**:
  ```json
  {
    "chapters": [
      {
        "chapterId": "chap_101",
        "chapterNumber": 101,
        "title": "Chương 101: Gió lộng",
        "state": "SUCCEEDED",
        "updatedAt": "2026-05-20T08:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 20,
      "total": 1000
    }
  }
  ```

#### B. Lấy nội dung chi tiết chương (`getChapterContent`)
- **Endpoint**: `GET /api/chapters/:chapterId`
- **Tham số truy vấn (Query Params)**:
  - `groupLines` (number, mặc định `1`): Gộp số dòng của đoạn văn bản khi trả về.
  - `isEnabledReplace` (boolean, mặc định `true`): Cho phép áp dụng từ điển thay thế tự động từ máy chủ.
  - `rootTab` (string, tùy chọn): Tab nguồn gốc điều hướng.
- **Phản hồi mẫu**:
  ```json
  {
    "chapter": {
      "chapterId": "chap_101",
      "chapterNumber": 101,
      "title": "Chương 101: Gió lộng",
      "bookName": "Vũ Luyện Điên Phong",
      "state": "SUCCEEDED",
      "totalTokens": 1420,
      "content": [
        "Nội dung dòng thứ nhất của truyện...",
        "Nội dung dòng thứ hai sau khi đã gộp và xử lý từ điển..."
      ],
      "rootTab": "all"
    },
    "navigation": {
      "prev": { "chapterId": "chap_100" },
      "next": {
        "chapterId": "chap_102",
        "chapterNumber": 102,
        "title": "Chương 102: Khởi đầu mới"
      }
    }
  }
  ```

---

### 2.4. Nhóm API Dịch Thuật AI (Translation)

#### A. Yêu cầu dịch thuật (`translate`)
- **Endpoint**: `POST /stories/gemini-ai/translate`
- **Thời gian chờ (Timeout)**: Đặc biệt lên tới 10 phút đối với chế độ dịch chương hiện tại (`mode: 'current'`).
- **Thân yêu cầu (Request Body)**:
  ```json
  {
    "mode": "current", // Hỗ trợ: "current" | "batch_chapter" | "story"
    "model": "gemini-2.5-flash-lite", // Tên model AI được chọn
    "platform": "VERTEX_API", // Nền tảng: "VERTEX_API" | "AI_STUDIO"
    "minWords": 100, // Số từ tối thiểu mỗi trang
    "maxWords": 500, // Số từ tối đa mỗi trang
    "temperature": 0.7, // Độ sáng tạo (0.0 đến 1.0)
    "retryTranslate": false, // Bắt buộc dịch lại kể cả chương đã thành công
    "batchingGroup": false, // Gộp ngữ cảnh các chương liền kề để dịch mượt hơn
    "bookId": "65e89d1234abcd5678ef", // ID của bộ truyện (dạng chuỗi hoặc mảng chuỗi)
    "chapterId": ["chap_101"], // Danh sách ID chương cần dịch
    "currentChapterId": "chap_101" // ID chương hiện tại đang xem (tùy chọn)
  }
  ```
- **Phản hồi mẫu** (Đối với chế độ dịch `current`):
  ```json
  {
    "chap_101": {
      "chapter": {
        "state": "SUCCEEDED",
        "totalTokens": 1250,
        "content": [
          "Văn bản đã dịch sang tiếng Việt..."
        ]
      }
    }
  }
  ```

#### B. Lấy trạng thái giới hạn hạn ngạch RPD (`getPoolStatus`)
- **Endpoint**: `GET /api/ai-token/pool-status`
- **Tham số truy vấn (Query Params)**:
  - `model` (string): Tên model AI cần kiểm tra.
  - `platform` (string): `VERTEX_API` hoặc `AI_STUDIO`.
- **Phản hồi mẫu**:
  ```json
  {
    "model": "gemini-2.5-flash-lite",
    "platform": "VERTEX_API",
    "total": 1500,
    "remain": 1240
  }
  ```

---

### 2.5. Nhóm API Quản Lý Từ Điển Thay Thế (Replacements)

#### A. Lấy danh sách từ thay thế (`getReplacements`)
- **Endpoint**: `GET /api/replacements`
- **Tham số truy vấn (Query Params)**:
  - `bookId` (string, tùy chọn): Lọc theo truyện.
  - `chapterId` (string, tùy chọn): Lọc theo chương.
- **Phản hồi mẫu**:
  ```json
  [
    {
      "id": "rep_001",
      "original": "tiểu tử", // Hoặc trường "match" trong giao diện
      "replacement": "nhóc con",
      "scope": "global", // Phạm vi: "chapter" | "book" | "global"
      "bookId": null,
      "chapterId": null
    }
  ]
  ```

#### B. Lưu từ thay thế mới hoặc chỉnh sửa (`saveReplacement`)
- **Endpoint**: `POST /api/replacements` (Thêm mới) hoặc `PUT /api/replacements/:id` (Cập nhật)
- **Thân yêu cầu (Request Body)**:
  ```json
  {
    "id": "rep_001", // Bắt buộc khi cập nhật
    "original": "tiểu tử",
    "replacement": "nhóc con",
    "scope": "book",
    "bookId": "65e89d1234abcd5678ef",
    "chapterId": null
  }
  ```
- **Phản hồi mẫu**: Đối tượng `Replacement` đã được lưu thành công trên cơ sở dữ liệu.

#### C. Xóa từ thay thế (`deleteReplacement`)
- **Endpoint**: `DELETE /api/replacements/:id`
- **Phản hồi**: Không có nội dung (`204 No Content`) hoặc trạng thái thành công.

---

### 2.6. Nhóm API Quản Lý AI Quota (Hạn ngạch AI)

#### A. Lấy cấu hình hạn ngạch hiện tại (`getQuota`)
- **Endpoint**: `GET /api/quota`
- **Phản hồi mẫu**:
  ```json
  {
    "currentConfig": {
      "model": "gemini-2.5-flash-lite",
      "platform": "VERTEX_API",
      "minWords": 100,
      "maxWords": 500,
      "temperature": 0.7,
      "forceRetranslate": false
    },
    "availableModels": [
      {
        "_id": "quota_001",
        "model": "gemini-2.5-flash-lite",
        "platform": "VERTEX_API",
        "rpmLimit": 15,
        "tpmLimit": 1000000,
        "rpdLimit": 1500,
        "isActive": true
      }
    ]
  }
  ```

#### B. Tạo mới / Cập nhật / Xóa hạn ngạch Model AI
- **Tạo mới**: `POST /api/quota` với body chứa cấu hình `AIQuota`.
- **Cập nhật**: `PUT /api/quota/:id` với body chứa cấu hình cần đổi.
- **Xóa**: `DELETE /api/quota/:id`.

---

### 2.7. Nhóm API Quản Lý Token / Key AI (Tokens Manager)

#### A. Lấy danh sách Token của hệ thống (`getTokens`)
- **Endpoint**: `GET /api/ai-token`
- **Tham số truy vấn (Query Params)**:
  - `platform` (string, tùy chọn): `VERTEX_API` hoặc `AI_STUDIO`.
  - `status` (string, tùy chọn): `active`, `paused` hoặc `banned`.
- **Phản hồi mẫu**:
  ```json
  {
    "total": 1,
    "tokens": [
      {
        "_id": "token_001",
        "name": "Vertex Key Dự phòng",
        "email": "backup-vertex@company.com",
        "platform": "VERTEX_API",
        "model": "*",
        "status": "active",
        "priority": 1,
        "modelList": [
          {
            "model": "gemini-2.5-flash-lite",
            "rpmLimit": 10,
            "tpmLimit": 500000,
            "rpdLimit": 1000,
            "usageToday": {
              "rpd": 150,
              "rpm": 2,
              "tpm": 12000,
              "rpdPercent": 15
            }
          }
        ]
      }
    ]
  }
  ```

#### B. Tạo mới / Cập nhật / Xóa Token
- **Tạo mới**: `POST /api/ai-token`
  - Thân yêu cầu:
    ```json
    {
      "name": "API Key 1",
      "email": "user@gmail.com",
      "platform": "AI_STUDIO",
      "model": "*",
      "status": "active",
      "priority": 0,
      "configAI": {
        "apiKey": "AIzaSy..."
      }
    }
    ```
- **Cập nhật**: `PUT /api/ai-token/:id`
- **Xóa**: `DELETE /api/ai-token/:id`

---

### 2.8. Nhóm API Cài Đặt Chung Của Hệ Thống (Settings)

#### A. Lấy cấu hình theo khóa (`getSettings`)
- **Endpoint**: `GET /api/stories/setting/:key`
- **Phản hồi mẫu**:
  ```json
  {
    "key": "stories.ui.domain",
    "value": [
      {
        "id": "1",
        "name": "Server Chính",
        "url": "https://api-prod.example.com"
      }
    ]
  }
  ```

#### B. Cập nhật cấu hình hệ thống (`updateSettings`)
- **Endpoint**: `POST /api/stories/setting`
- **Thân yêu cầu (Request Body)**:
  ```json
  {
    "key": "stories.ui.translate",
    "value": "{\"model\":\"gemini-2.5-flash-lite\",\"platform\":\"VERTEX_API\",\"minWords\":100,\"maxWords\":500,\"temperature\":0.7}"
  }
  ```
- **Phản hồi mẫu**: Cấu hình vừa được lưu thành công.

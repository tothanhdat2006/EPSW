# EPSW — Hệ thống Xử lý Hồ sơ Điện tử

**Electronic Public Service Workflow** — Một nền tảng hiện đại cho quy trình dịch vụ công, tích hợp phân tích AI, hệ thống xếp hàng văn bản tự động và giao diện quản lý nội bộ cho cán bộ.

---

## 🗂 Tổng quan

EPSW là ứng dụng SvelteKit chạy trên **Cloudflare Workers** (runtime), với dữ liệu được lưu trữ trong **Cloudflare D1** (SQLite) và tệp tải lên qua **Cloudflare R2**. Hệ thống AI sử dụng model **Qwen (DashScope)** để thực hiện OCR, phân tích nội dung và tổng hợp tờ trình.

### Luồng xử lý hồ sơ

```
Công dân nộp hồ sơ
        ↓
   [Tiếp nhận] — Bộ phận Một cửa kiểm tra và phân công
        ↓
   [Kiểm duyệt] — Chuyên viên xử lý, AI phân tích OCR
        ↓
   [Phê duyệt] — Lãnh đạo ra quyết định (Đồng ý / Từ chối / Yêu cầu bổ sung)
        ↓
   [Tra cứu] — Công dân theo dõi trạng thái theo mã theo dõi
```

---

## 🧱 Tech Stack

| Lớp | Công nghệ |
|-----|-----------|
| Framework | SvelteKit 2 + Svelte 5 |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| ORM | Drizzle ORM |
| Auth | Better Auth |
| AI | Qwen VL Plus (OCR) + Qwen Max (tổng hợp) |
| Email | Resend |
| UI | Tailwind CSS v4 + shadcn-svelte + Lucide |

---

## ⚙️ Cài đặt & Chạy cục bộ

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd EPSW
pnpm install
```

### 2. Cấu hình biến môi trường

Sao chép file mẫu và điền thông tin:

```bash
cp .env.example .env
```

Các biến cần thiết trong `.env`:

```env
# Better Auth — bí mật xác thực (đổi khi deploy production)
BETTER_AUTH_SECRET="your-secret-here"

# Qwen / Alibaba DashScope AI
LLM_PROVIDER="alibaba"
LLM_API_KEY="sk-..."
LLM_BASE_URL="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
LLM_MODEL="qwen-max"

# Resend (gửi email thông báo)
RESEND_API_KEY="re_..."

# Origin (cho Better Auth)
ORIGIN="http://localhost:5173"
```

> **Ghi chú:** Khi chạy local bằng `pnpm dev`, file upload sẽ được lưu tại `static/uploads/`. R2 chỉ dùng khi deploy lên Cloudflare.

### 3. Khởi tạo cơ sở dữ liệu local

Chạy lệnh dev lần đầu để setup D1 local tự động:

```bash
pnpm dev
```

Script `scripts/setup-local-db.mjs` sẽ tự khởi tạo schema SQLite trong `.wrangler/state/`.

---

## 🌱 Seed Dữ liệu

### Tạo tài khoản admin & nhân sự

Tạo các tài khoản cần thiết để đăng nhập vào portal cán bộ:

```bash
pnpm seed:admin
# hoặc tương đương:
pnpm seed
```

> ⚠️ **Yêu cầu:** `pnpm dev` phải đang chạy trước vì script gọi API sign-up của server.

Lệnh này sẽ tạo các tài khoản sau:

| Email | Mật khẩu | Vai trò | Phòng ban |
|-------|----------|---------|-----------|
| `admin@dvc.gov.vn` | `Admin@DVC2025!` | `admin` | — |
| `motcua@dvc.gov.vn` | `Admin@DVC2025!` | `mot_cua` | — |
| `cv.tnmt@dvc.gov.vn` | `Admin@DVC2025!` | `chuyen_vien` | SO_TAI_NGUYEN_MOI_TRUONG |
| `cv.khdt@dvc.gov.vn` | `Admin@DVC2025!` | `chuyen_vien` | SO_KE_HOACH_DAU_TU |
| `cv.ubnd@dvc.gov.vn` | `Admin@DVC2025!` | `chuyen_vien` | UBND_TINH |
| `ld.tnmt@dvc.gov.vn` | `Admin@DVC2025!` | `lanh_dao` | SO_TAI_NGUYEN_MOI_TRUONG |
| `ld.khdt@dvc.gov.vn` | `Admin@DVC2025!` | `lanh_dao` | SO_KE_HOACH_DAU_TU |
| `ld.ubnd@dvc.gov.vn` | `Admin@DVC2025!` | `lanh_dao` | UBND_TINH |

> ⚠️ Đổi mật khẩu trước khi deploy lên production!

### Tạo dữ liệu test SLA (Cảnh báo deadline)

Để kiểm tra hệ thống cảnh báo SLA trên dashboard, chạy:

```bash
pnpm seed:sla
```

Lệnh này sẽ chèn **7 hồ sơ test** với các mức SLA khác nhau:

| Trạng thái | Mô tả |
|------------|-------|
| 🔴 Quá hạn 3 giờ | RECEIVED — hiện đầu danh sách |
| 🔴 Quá hạn 10 giờ | ASSIGNED |
| 🔴 Quá hạn 24 giờ | PROCESSING |
| 🟡 Còn 1 giờ | RECEIVED — sắp hết hạn |
| 🟡 Còn 4 giờ | ASSIGNED |
| 🟢 Còn 24 giờ | RECEIVED — bình thường |
| ✅ APPROVED | Không hiển thị cảnh báo dù SLA đã qua |

> **Yêu cầu:** Cần chạy `pnpm dev` ít nhất một lần trước để khởi tạo local DB.

---

## 📜 Danh sách lệnh

```bash
# Phát triển
pnpm dev              # Khởi động server dev (localhost:5173)
pnpm build            # Build cho production (Cloudflare Workers)
pnpm preview          # Preview bản build với wrangler

# Kiểm tra
pnpm check            # Type check toàn bộ project
pnpm lint             # Lint + format check
pnpm format           # Auto-format code

# Database
pnpm db:push          # Đẩy schema Drizzle lên D1
pnpm db:generate      # Tạo migration files
pnpm db:migrate       # Chạy migrations
pnpm db:studio        # Mở Drizzle Studio (GUI DB)

# Seed
pnpm seed             # Tạo tài khoản admin (= seed:admin)
pnpm seed:admin       # Tạo tài khoản admin & nhân sự
pnpm seed:sla         # Tạo dữ liệu test cảnh báo SLA

# Wrangler / Cloudflare
pnpm gen              # Tạo lại Cloudflare Worker types
```

---

## 🗺 Cấu trúc dự án

```
src/
├── routes/
│   ├── +page.svelte              # Trang nộp hồ sơ (công dân)
│   ├── track/                    # Tra cứu hồ sơ theo mã theo dõi
│   ├── api/
│   │   └── documents/            # REST API cho hồ sơ
│   │       └── [id]/
│   │           ├── ai-suggest    # Gợi ý AI phân công
│   │           ├── ai-summary    # Tổng hợp AI (tờ trình liên ngành)
│   │           ├── ai-report     # Báo cáo thẩm định
│   │           ├── assign        # Phân công + OCR
│   │           ├── approve       # Phê duyệt / Từ chối
│   │           └── reject        # Từ chối hồ sơ
│   └── portal/                   # Cổng nội bộ cán bộ (yêu cầu đăng nhập)
│       ├── +page.svelte          # Dashboard (Mission Control)
│       ├── reception/            # Tiếp nhận & phân công hồ sơ
│       ├── inspector/[id]/       # Kiểm duyệt hồ sơ + AI phân tích
│       ├── review/[id]/          # Xem xét hồ sơ (chuyên viên)
│       ├── approval/[id]/        # Phê duyệt lãnh đạo
│       ├── login/                # Đăng nhập cán bộ
│       └── users/                # Quản lý nhân sự (admin)
├── lib/
│   ├── api/
│   │   ├── client.ts             # API client wrapper
│   │   └── types.ts              # TypeScript types & enums
│   ├── server/
│   │   ├── auth.ts               # Cấu hình Better Auth
│   │   └── db/                   # Schema Drizzle
│   └── components/               # UI components dùng chung
scripts/
├── setup-local-db.mjs            # Khởi tạo SQLite local (auto khi dev)
├── seed-admin.ts                 # Tạo tài khoản seed
└── seed-sla-test.ts              # Tạo dữ liệu test SLA
```

---

## 🚀 Deploy lên Cloudflare

### 1. Tạo D1 database

```bash
npx wrangler d1 create epsw-db
# Copy database_id vào wrangler.jsonc
```

### 2. Tạo R2 bucket

```bash
npx wrangler r2 bucket create epsw-qwenday
```

### 3. Cấu hình secrets

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put LLM_API_KEY
npx wrangler secret put RESEND_API_KEY
```

### 4. Chạy migration DB production

```bash
npx wrangler d1 execute epsw-db --remote --file=<migration-file.sql>
```

### 5. Deploy

```bash
pnpm build
npx wrangler deploy
```

---

## 🔐 Phân quyền người dùng

| Role | Mô tả | Trang truy cập |
|------|-------|----------------|
| `admin` | Quản trị viên hệ thống | Tất cả + Quản lý nhân sự |
| `mot_cua` | Bộ phận Một cửa — tiếp nhận & phân công | Reception, Dashboard |
| `chuyen_vien` | Chuyên viên xử lý — xem & kiểm duyệt theo phòng ban | Inspector, Review, Dashboard |
| `lanh_dao` | Lãnh đạo phê duyệt — phê duyệt theo phòng ban | Approval, Dashboard |

---

## 🧠 Tính năng AI

- **OCR đa trang**: Dùng `qwen-vl-plus` để đọc nội dung từ PDF và ảnh (hỗ trợ nhiều tệp)
- **Gợi ý phân công**: AI phân tích hồ sơ và đề xuất đơn vị thụ lý
- **Tờ trình Liên ngành**: Tự động tổng hợp nội dung thẩm định đa phòng ban
- **Báo cáo AI**: Tạo báo cáo thẩm định chuyên sâu từ nội dung hồ sơ

---

## ⏱ SLA & Cảnh báo Deadline

- Mỗi hồ sơ có **deadline 48 giờ** kể từ khi nộp
- Hồ sơ quá hạn tự động **nổi lên đầu danh sách** trong Dashboard và Reception
- Hàng đỏ với icon ⚠️ hiển thị rõ ràng trên giao diện cán bộ
- Hồ sơ đã `APPROVED`, `REJECTED`, `INVALID` **không** bị tính là vi phạm SLA

---

## 📄 License

Internal use only — EPSW System.

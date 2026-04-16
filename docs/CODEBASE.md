## Workflow

Biểu đồ của bạn đã phân chia ranh giới trách nhiệm rất rõ ràng. Dưới đây là góc nhìn kỹ thuật về các bước:

* **Bước 1 (Tiếp nhận):** Việc đưa tác vụ nặng vào hàng đợi BullMQ ngay sau API Gateway là một nước đi chuẩn xác để "giảm xóc" (shock absorption). Nó giúp hệ thống không bị sập khi có đợt đẩy dữ liệu (Batch Data) khổng lồ từ quá trình số hóa hồ sơ tồn đọng.
* **Bước 2 (Tiền xử lý & Bảo mật):** Tách bạch giữa Native PDF và Scan PDF giúp tối ưu tài nguyên (OCR tốn kém hơn nhiều so với đọc text trực tiếp). Điểm sáng nhất ở đây là luồng **Redaction (Làm mờ text) + Keycloak ABAC**. Việc che giấu PII (Thông tin định danh cá nhân) hoặc thông tin mật trước khi đưa vào luồng xử lý sâu hơn đảm bảo tuân thủ bảo mật dữ liệu khắt khe.
* **Bước 3 (AI Agent & Ràng buộc):** Đặt ngưỡng `Confidence Score > 70` là một phương pháp phòng thủ xuất sắc. Nó đảm bảo AI không bị "ảo giác" (hallucinate) làm hỏng dữ liệu hệ thống, đồng thời tận dụng chuyên viên cho các ca khó (Edge cases).
* **Bước 4 & 5 (SLA & Điều phối):** Dynamic SLA chia theo mức độ "Khẩn/Hỏa tốc" giúp luồng công việc không bị tắc nghẽn. Tính năng "AI Auto-gen Email" để bắt lỗi logic sẽ tiết kiệm hàng ngàn giờ làm việc của chuyên viên.
* **Bước 6 (Phê duyệt):** Luồng LLM diễn dịch lý do từ chối của Lãnh đạo cho Thư ký là một tính năng rất sáng tạo, giải quyết được "nút thắt cổ chai" trong giao tiếp hành chính.

**Điểm cần lưu ý (Candid feedback):** Luồng này sử dụng LLM ở khá nhiều chặng (Phân loại, Trích xuất LangChain, Auto-gen Email, Tóm tắt, Định tuyến). Nếu sử dụng API thương mại (như OpenAI, Gemini), chi phí sẽ rất cao và bị ảnh hưởng bởi độ trễ (latency). Bạn nên cân nhắc host các mô hình LLM mã nguồn mở (như Llama 3) nội bộ cho các tác vụ đơn giản.

---

## Thiết kế Hệ thống (System Design)

Với workflow này, kiến trúc **modular monolith + queue-driven async processing** là phù hợp. Hệ thống có nhiều tác vụ chạy bất đồng bộ (long-running background jobs) như OCR và gọi LLM.

### 1. Kiến trúc Core
* **API Gateway:** NGINX (như bạn đề xuất) hoặc Kong/APISIX để quản lý Rate Limiting và Authentication.
* **Queue/Job Engine:** BullMQ chạy trên Redis để xử lý retry, delayed jobs (SLA), và workload nền.
* **Workflow Orchestrator:** Luồng trạng thái nghiệp vụ được quản lý trực tiếp trong `core-api` theo các domain module (documents, hitl, workflow, notifications).
* **Identity & Access Management (IAM):** Keycloak để quản lý Role và ABAC.

### 2. Thành phần dữ liệu (Database)
* **Relational DB (PostgreSQL):** Lưu trữ metadata hồ sơ, trạng thái (status), thông tin người dùng, và SLA tracking.
* **Document DB (MongoDB / Elasticsearch):** Lưu trữ các file JSON linh hoạt từ kết quả OCR và LangChain. Elasticsearch giúp tìm kiếm full-text cực nhanh.
* **Object Storage (MinIO / AWS S3):** Lưu trữ file PDF gốc, file Scan và file đã được làm mờ (Redacted files).

### 3. Công nghệ Xử lý (Processing Stack)
* **OCR Engine:** Tesseract (Open-source) hoặc Google Document AI / AWS Textract (thương mại).
* **AI/LLM Core:** Python (FastAPI) kết hợp **LangChain/LlamaIndex**. Giao tiếp với LLM qua API chuẩn.

---

## Cấu trúc Codebase (Monorepo)

Sau refactor, runtime hiện tại đã được gom về kiến trúc unified service (`core-api`) thay vì tách nhiều microservice.

```text
/dvc-workflow-system
├── apps/
│   ├── api-gateway/                 # Cấu hình NGINX/Kong, routing
│   ├── web-portal/                  # Frontend cho Cán bộ / Lãnh đạo (React/Vue)
│   ├── public-dvc-web/              # Frontend cho Người dân nộp hồ sơ
│
├── services/
│   ├── core-api/                    # (Node/TypeScript) API + workflow + HITL + notification
│
├── packages/
│   ├── database/                    # Prisma / TypeORM schema chung (Postgres)
│   ├── shared-types/                # Định nghĩa Typescript Interfaces / Protobuf
│   ├── logger/                      # Cấu hình logging chuẩn (Winston / Pino)
│
├── infra/
│   ├── docker-compose.yml           # Chạy local (Postgres, Redis, Keycloak, MinIO, core-api)
│   ├── kubernetes/                  # Manifest/charts còn dùng cho runtime hiện tại
```

Các service legacy đa tiến trình đã được loại bỏ khỏi repo để giảm chi phí vận hành local và đơn giản hóa luồng phát triển.
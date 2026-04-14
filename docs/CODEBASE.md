## Workflow

Biểu đồ của bạn đã phân chia ranh giới trách nhiệm rất rõ ràng. Dưới đây là góc nhìn kỹ thuật về các bước:

* **Bước 1 (Tiếp nhận):** Việc sử dụng Kafka ngay sau API Gateway là một nước đi chuẩn xác để "giảm xóc" (shock absorption). Nó giúp hệ thống không bị sập khi có đợt đẩy dữ liệu (Batch Data) khổng lồ từ quá trình số hóa hồ sơ tồn đọng.
* **Bước 2 (Tiền xử lý & Bảo mật):** Tách bạch giữa Native PDF và Scan PDF giúp tối ưu tài nguyên (OCR tốn kém hơn nhiều so với đọc text trực tiếp). Điểm sáng nhất ở đây là luồng **Redaction (Làm mờ text) + Keycloak ABAC**. Việc che giấu PII (Thông tin định danh cá nhân) hoặc thông tin mật trước khi đưa vào luồng xử lý sâu hơn đảm bảo tuân thủ bảo mật dữ liệu khắt khe.
* **Bước 3 (AI Agent & Ràng buộc):** Đặt ngưỡng `Confidence Score > 70` là một phương pháp phòng thủ xuất sắc. Nó đảm bảo AI không bị "ảo giác" (hallucinate) làm hỏng dữ liệu hệ thống, đồng thời tận dụng chuyên viên cho các ca khó (Edge cases).
* **Bước 4 & 5 (SLA & Điều phối):** Dynamic SLA chia theo mức độ "Khẩn/Hỏa tốc" giúp luồng công việc không bị tắc nghẽn. Tính năng "AI Auto-gen Email" để bắt lỗi logic sẽ tiết kiệm hàng ngàn giờ làm việc của chuyên viên.
* **Bước 6 (Phê duyệt):** Luồng LLM diễn dịch lý do từ chối của Lãnh đạo cho Thư ký là một tính năng rất sáng tạo, giải quyết được "nút thắt cổ chai" trong giao tiếp hành chính.

**Điểm cần lưu ý (Candid feedback):** Luồng này sử dụng LLM ở khá nhiều chặng (Phân loại, Trích xuất LangChain, Auto-gen Email, Tóm tắt, Định tuyến). Nếu sử dụng API thương mại (như OpenAI, Gemini), chi phí sẽ rất cao và bị ảnh hưởng bởi độ trễ (latency). Bạn nên cân nhắc host các mô hình LLM mã nguồn mở (như Llama 3) nội bộ cho các tác vụ đơn giản.

---

## Thiết kế Hệ thống (System Design)

Với workflow này, kiến trúc **Event-Driven Microservices** là bắt buộc. Hệ thống có nhiều tác vụ chạy bất đồng bộ (long-running background jobs) như OCR và gọi LLM.

### 1. Kiến trúc Core
* **API Gateway:** NGINX (như bạn đề xuất) hoặc Kong/APISIX để quản lý Rate Limiting và Authentication.
* **Message Broker:** Apache Kafka (cho high-throughput) hoặc RabbitMQ (nếu cần routing phức tạp).
* **Workflow Orchestrator (Quan trọng):** Đừng tự code luồng quản lý trạng thái. Hãy dùng **Temporal.io** hoặc **Camunda**. Chúng hỗ trợ tuyệt vời cho việc retry, timeout (SLA), và luồng có sự chờ đợi con người (HITL).
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

Để dễ quản lý các microservices có chung logic hoặc model, mô hình Monorepo (sử dụng Nx, Turborepo hoặc Bazel) là lựa chọn tối ưu.

```text
/dvc-workflow-system
├── apps/
│   ├── api-gateway/                 # Cấu hình NGINX/Kong, routing
│   ├── web-portal/                  # Frontend cho Cán bộ / Lãnh đạo (React/Vue)
│   ├── public-dvc-web/              # Frontend cho Người dân nộp hồ sơ
│
├── services/
│   ├── ingestion-service/           # (Node/Go) Nhận API, lưu S3, đẩy event vào Kafka
│   ├── document-parser-service/     # (Python) Xử lý PDF gốc, chạy OCR
│   ├── ai-agent-service/            # (Python/LangChain) Phân loại, Trích xuất, Redaction
│   ├── workflow-engine/             # (Go/Java) Worker của Temporal/Camunda quản lý SLA
│   ├── hitl-manager/                # (Node/Go) Quản lý task thủ công, giao tiếp Keycloak
│   ├── notification-service/        # (Node/Go) Gửi SMS/Zalo/Email báo cáo
│
├── packages/
│   ├── database/                    # Prisma / TypeORM schema chung (Postgres)
│   ├── shared-types/                # Định nghĩa Typescript Interfaces / Protobuf
│   ├── logger/                      # Cấu hình logging chuẩn (Winston / Pino)
│
├── infra/
│   ├── docker-compose.yml           # Chạy local (Kafka, Postgres, Keycloak, MinIO)
│   ├── kubernetes/                  # Helm charts cho deployment thực tế
```

Kiến trúc này đảm bảo tính độc lập: Team AI có thể viết bằng Python ở `ai-agent-service`, trong khi team Core Backend có thể dùng Golang/Node.js để tối ưu tốc độ và I/O ở `ingestion-service`.
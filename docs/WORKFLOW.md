flowchart TD
    %% Định nghĩa các Style
    classDef user fill:#f9f,stroke:#333,stroke-width:2px;
    classDef notify fill:#fcfbdf,stroke:#f0a868,stroke-width:1px,stroke-dasharray: 5 5;
    classDef db fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef hitl fill:#ffe0b2,stroke:#f57c00,stroke-width:2px,color:#d84315; %% Màu cam cho Human-in-the-loop

    User((Doanh nghiệp / => Cá nhân)):::user

    %% ---------------- BƯỚC 1 ----------------
    subgraph B1 [Bước 1: Tiếp nhận và Luân chuyển]
        DVC[Cổng Dịch vụ công - Online]
        Offline[Phòng ban tiếp nhận - Offline]
        API[API Gateway - NGINX]
        Queue[BullMQ Queue - Redis]
    end

    User -->|Nộp hồ sơ| DVC
    User -->|Nộp hồ sơ| Offline
    DVC --> API
    Offline --> API
    API -.->|Thông báo: Đang xử lí hồ sơ| User:::notify
    API --> Queue

    %% ---------------- BƯỚC 2 ----------------
    subgraph B2 [Bước 2: Xử lý định dạng và Phân quyền]
        Split{Định dạng file?}
        NativePDF[File PDF gốc]
        Scan[Ảnh Scan / PDF Scan]
        PDF[PDF Reader]
        OCR[Nhận dạng ký tự - OCR]
        
        CheckData{Dữ liệu đọc được?}
        HITL_VanThu[HITL: Cán bộ Văn thư => Nhập tay hoặc Trả hồ sơ]:::hitl
        
        JSON1[(Dữ liệu JSON)]:::db
        Task1[LLM: Classify 4 mức độ bảo mật]
        Task2[LLM: Xác định thông tin mật]
        Task3[Ghi thông tin ngày tháng tiếp nhận]
        
        Redact[Redaction Engine: => Làm mờ/Che thông tin mật => Tầng Ứng dụng / Sinh bản sao]
        Keycloak[Phân quyền - Keycloak ABAC => Khóa file: Unclassified -> Secret]
    end

    Queue --> Split
    Split -->|PDF Text| NativePDF
    Split -->|Hình ảnh / PDF Scan| Scan
    
    NativePDF --> PDF
    Scan --> OCR
    
    PDF --> CheckData
    OCR --> CheckData
    
    CheckData -->|Pass| JSON1
    CheckData -->|Lỗi Font/Ảnh mờ/Mã hóa| HITL_VanThu
    HITL_VanThu -->|Cứu được dữ liệu| JSON1
    HITL_VanThu -.->|Không cứu được => Trả hồ sơ| User:::notify
    
    JSON1 --> Task1
    JSON1 --> Task2
    JSON1 --> Task3
    
    Task1 --> Redact
    Task2 --> Redact
    
    Task3 --> Keycloak
    Redact --> Keycloak
    
    Keycloak -.->|Thông báo: Đang định danh => mức độ bảo mật| User:::notify

    %% ---------------- BƯỚC 3 ----------------
    subgraph B3 [Bước 3: Phân tích và Trích xuất]
        LangChain[Orchestration AI Agent - LangChain]
        
        CheckAI{AI Agent chạy OK?}
        HITL_ChuyenVien[HITL: Chuyên viên => Đọc & Trích xuất thủ công]:::hitl
        
        PhanTich[Phân tích theo quy định phòng ban]
        TrichXuat[Trích xuất thông tin chuẩn]
        JSON2[(File JSON mới tổng hợp)]:::db
    end

    Keycloak --> LangChain
    LangChain --> CheckAI
    CheckAI -->|Lỗi Timeout/Lặp vô hạn| HITL_ChuyenVien
    
    CheckAI -->|Bình thường| PhanTich
    CheckAI -->|Bình thường| TrichXuat
    
    PhanTich -.->|Thông báo: Đang phân tích => theo quy chuẩn| User:::notify
    PhanTich --> JSON2
    TrichXuat --> JSON2
    HITL_ChuyenVien --> JSON2

    %% ---------------- BƯỚC 4 & 5 ----------------
    subgraph B45 [Bước 4 & 5: Đối chiếu và Tương tác nội bộ]
        Check{Hợp lệ không?}
        Reject[Cảnh báo không hợp lệ & Nêu lý do]
        DB[(CSDL Chung - PostgreSQL)]:::db
        
        Portal[Portal Tương tác nội bộ]
        PB[Phòng ban chủ trì & Sở/Ngành phối hợp]
        SLA[Hệ thống theo dõi SLA - Đếm ngược 48h]
        
        CheckSLA{Quá hạn SLA 48h?}
        HITL_QuanLy[HITL: Cấp quản lý can thiệp => Điều phối & Ép tiến độ]:::hitl
        
        Log[Hệ thống Logging - Theo dõi trạng thái]
    end

    JSON2 --> Check
    Check -->|Không hợp lệ| Reject
    Reject -.->|Trả ngược quy trình| User
    
    Check -->|Hợp lệ| DB
    DB -.->|Thông báo: Đã phân công => cho từng phòng ban| User:::notify
    DB --> Portal
    
    Portal --- PB
    Portal --- SLA
    Portal --- Log
    
    SLA --> CheckSLA
    CheckSLA -->|Vượt quá hạn| HITL_QuanLy

    %% ---------------- BƯỚC 6 ----------------
    subgraph B6 [Bước 6: Tóm tắt, Phê duyệt và Phát hành]
        Done[Thao tác Hoàn thành trên Portal]
        LLMSum[LLM Tóm tắt & Ra lệnh máy in giấy phép]
        
        CheckPrint{Máy in hoạt động?}
        HITL_PhatHanh[HITL: Văn thư => In ấn & Trình ký tay]:::hitl
        
        Boss{Lãnh đạo phê duyệt?}
        LLMRoute[LLM phân tích lý do & Định tuyến]
        
        CheckRoute{LLM hiểu lý do?}
        HITL_ThuKy[HITL: Thư ký Lãnh đạo => Diễn dịch & Phân bổ lại]:::hitl
        
        Publish[Phát hành hồ sơ]
        Noti[Gửi SMS/VNeID hoặc => Đẩy file PDF về Cổng DVC]
    end

    PB -->|Xử lý xong| Done
    HITL_QuanLy -->|Ép hoàn thành| Done
    
    Done --> LLMSum
    LLMSum --> CheckPrint
    CheckPrint -->|Kẹt giấy/Mất mạng| HITL_PhatHanh
    CheckPrint -->|In OK| Boss
    HITL_PhatHanh --> Boss
    
    Boss -->|Từ chối| LLMRoute
    LLMRoute --> CheckRoute
    CheckRoute -->|Không rõ lý do/Không biết gửi ai| HITL_ThuKy
    CheckRoute -->|Hiểu rõ| Portal
    HITL_ThuKy --> Portal
    
    Boss -->|Phê duyệt| Publish
    Publish --> Noti
    Noti -.->|Có kết quả| User:::notify
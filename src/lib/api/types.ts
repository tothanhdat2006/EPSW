// ─── Shared API types ────────────────────────────────────────────────────────

// ─── Document pipeline enums ─────────────────────────────────────────────────

export type DocumentStatus =
	| 'RECEIVED'           // Mới nhận — chờ Một cửa phân công
	| 'ASSIGNED'           // Đã phân công cho Sở/Ngành
	| 'PROCESSING'         // Hệ thống đang xử lý
	| 'INVALID'            // Thiếu sót / không hợp lệ
	| 'VALIDATED'          // Hợp lệ — lưu CSDL Tập trung
	| 'PENDING_APPROVAL'   // Chờ Lãnh đạo phê duyệt
	| 'REVISION_REQUESTED' // Lãnh đạo yêu cầu sửa
	| 'APPROVED'           // Đã phê duyệt
	| 'REJECTED';          // Từ chối

export const VALID_STATUSES: DocumentStatus[] = [
	'RECEIVED', 'ASSIGNED', 'PROCESSING', 'INVALID',
	'VALIDATED', 'PENDING_APPROVAL', 'REVISION_REQUESTED',
	'APPROVED', 'REJECTED'
];

export const STATUS_LABELS: Record<DocumentStatus, string> = {
	RECEIVED:           'Mới nhận',
	ASSIGNED:           'Đã phân công',
	PROCESSING:         'Đang xử lý',
	INVALID:            'Không hợp lệ',
	VALIDATED:          'Hợp lệ',
	PENDING_APPROVAL:   'Chờ phê duyệt',
	REVISION_REQUESTED: 'Yêu cầu sửa',
	APPROVED:           'Đã phê duyệt',
	REJECTED:           'Từ chối',
};

export type SecurityLevel = 'UNCLASSIFIED' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET';

export type DocumentType = 'CA_NHAN' | 'HO_KINH_DOANH' | 'DOANH_NGHIEP';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
	CA_NHAN:       'Cá nhân',
	HO_KINH_DOANH: 'Hộ kinh doanh',
	DOANH_NGHIEP:  'Doanh nghiệp'
};

export const VALID_DOCUMENT_TYPES: DocumentType[] = ['CA_NHAN', 'HO_KINH_DOANH', 'DOANH_NGHIEP'];

// ─── Staff roles & departments ────────────────────────────────────────────────

export type StaffRole = 'admin' | 'mot_cua' | 'chuyen_vien' | 'lanh_dao';

export const ROLE_LABELS: Record<StaffRole, string> = {
	admin:       'Quản trị viên',
	mot_cua:     'Bộ phận Một cửa',
	chuyen_vien: 'Chuyên viên Sở',
	lanh_dao:    'Lãnh đạo',
};

export const VALID_ROLES: StaffRole[] = ['admin', 'mot_cua', 'chuyen_vien', 'lanh_dao'];

export type Department =
	| 'SO_TAI_NGUYEN_MOI_TRUONG'
	| 'SO_KE_HOACH_DAU_TU'
	| 'UBND_TINH'
	| 'UBND_XA';

export const DEPARTMENT_LABELS: Record<Department, string> = {
	SO_TAI_NGUYEN_MOI_TRUONG: 'Sở Tài nguyên và Môi trường',
	SO_KE_HOACH_DAU_TU:       'Sở Kế hoạch và Đầu tư',
	UBND_TINH:                'UBND Tỉnh',
	UBND_XA:                  'UBND Xã',
};

export const VALID_DEPARTMENTS: Department[] = [
	'SO_TAI_NGUYEN_MOI_TRUONG',
	'SO_KE_HOACH_DAU_TU',
	'UBND_TINH',
	'UBND_XA',
];

/** Roles that require a department to be assigned */
export const ROLES_WITH_DEPARTMENT: StaffRole[] = ['chuyen_vien', 'lanh_dao'];

// ─── Document interfaces ──────────────────────────────────────────────────────

export interface DocumentSummary {
	id: string;
	trackingCode: string;
	status: DocumentStatus;
	documentType: DocumentType;
	priority?: 'NORMAL' | 'URGENT' | 'FLASH';
	securityLevel: SecurityLevel;
	aiConfidence?: number;
	slaDeadline?: string;
	rawFileUrls?: string[];
	redactedFileUrl?: string;
	assignedDept?: Department;
	assignedBy?: string;
	assignmentNote?: string;
	citizenEmail?: string;
	createdAt: string;
	updatedAt: string;
	extractedData?: Record<string, unknown>;
}

// ─── Staff user interface ─────────────────────────────────────────────────────

export interface StaffUser {
	id: string;
	name: string;
	email: string;
	role: StaffRole;
	department?: Department;
	createdAt: string;
}

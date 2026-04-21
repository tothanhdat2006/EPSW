export type SeedTestAccount = {
	email: string;
	name: string;
	password: string;
	role: 'admin' | 'mot_cua' | 'chuyen_vien' | 'lanh_dao';
	department: 'SO_TAI_NGUYEN_MOI_TRUONG' | 'SO_KE_HOACH_DAU_TU' | 'UBND_TINH' | null;
};

export const SEED_TEST_ACCOUNTS: SeedTestAccount[] = [
	{
		email: 'admin@dvc.gov.vn',
		name: 'Quản trị viên DVC',
		password: 'Admin@DVC2025!',
		role: 'admin',
		department: null
	},
	{
		email: 'motcua@dvc.gov.vn',
		name: 'Bộ phận Một cửa',
		password: 'Admin@DVC2025!',
		role: 'mot_cua',
		department: null
	},
	{
		email: 'cv.tnmt@dvc.gov.vn',
		name: 'Chuyên viên Sở TN&MT',
		password: 'Admin@DVC2025!',
		role: 'chuyen_vien',
		department: 'SO_TAI_NGUYEN_MOI_TRUONG'
	},
	{
		email: 'cv.khdt@dvc.gov.vn',
		name: 'Chuyên viên Sở KH&ĐT',
		password: 'Admin@DVC2025!',
		role: 'chuyen_vien',
		department: 'SO_KE_HOACH_DAU_TU'
	},
	{
		email: 'cv.ubnd@dvc.gov.vn',
		name: 'Chuyên viên UBND Tỉnh',
		password: 'Admin@DVC2025!',
		role: 'chuyen_vien',
		department: 'UBND_TINH'
	},
	{
		email: 'ld.tnmt@dvc.gov.vn',
		name: 'Lãnh đạo Sở TN&MT',
		password: 'Admin@DVC2025!',
		role: 'lanh_dao',
		department: 'SO_TAI_NGUYEN_MOI_TRUONG'
	},
	{
		email: 'ld.khdt@dvc.gov.vn',
		name: 'Lãnh đạo Sở KH&ĐT',
		password: 'Admin@DVC2025!',
		role: 'lanh_dao',
		department: 'SO_KE_HOACH_DAU_TU'
	},
	{
		email: 'ld.ubnd@dvc.gov.vn',
		name: 'Lãnh đạo UBND Tỉnh',
		password: 'Admin@DVC2025!',
		role: 'lanh_dao',
		department: 'UBND_TINH'
	}
];

export const ROLE_LABELS: Record<SeedTestAccount['role'], string> = {
	admin: 'Quản trị viên',
	mot_cua: 'Bộ phận Một cửa',
	chuyen_vien: 'Chuyên viên',
	lanh_dao: 'Lãnh đạo'
};

export const DEPARTMENT_LABELS: Record<Exclude<SeedTestAccount['department'], null>, string> = {
	SO_TAI_NGUYEN_MOI_TRUONG: 'Sở TN&MT',
	SO_KE_HOACH_DAU_TU: 'Sở KH&ĐT',
	UBND_TINH: 'UBND Tỉnh'
};

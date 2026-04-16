/**
 * User-facing error translations for Indonesian localization.
 */

const ERROR_MAP: Record<string, string> = {
  // Auth Errors
  "Invalid login credentials": "Email atau password salah. Silakan periksa kembali.",
  "Email not confirmed": "Email Anda belum dikonfirmasi. Silakan cek inbox.",
  "User not found": "Akun tidak ditemukan.",
  "Inactive account": "Akun Anda dinonaktifkan. Hubungi admin sekolah.",
  "STUDENT_NOT_ACTIVE": "Akun siswa Anda belum aktif atau sedang dinonaktifkan.",
  "ACCOUNT_INACTIVE": "Akun sedang tidak aktif.",
  
  // Container & Transaction Errors
  "CONTAINER_NOT_FOUND": "Kontainer tidak ditemukan atau ID tidak valid.",
  "CONTAINER_INACTIVE": "Kontainer ini sedang tidak aktif.",
  "STUDENT_NOT_FOUND": "Data siswa tidak ditemukan.",
  "PENALTY_ACTIVE": "Anda sedang dalam masa hukuman pelepasan HP.",
  "OUT_OF_WINDOW": "Tidak sesuai dengan jadwal operasional sekolah.",
  "UNAUTHORIZED_ACTION": "Anda tidak memiliki izin untuk melakukan aksi ini.",
  "RATE_LIMIT_EXCEEDED": "Terlalu banyak permintaan. Silakan tunggu sebentar.",
  
  // Generic
  "INTERNAL_ERROR": "Terjadi kesalahan internal pada sistem. Silakan lapor admin.",
  "NETWORK_ERROR": "Gagal menghubungkan ke server. Periksa koneksi internet Anda.",
  "UNKNOWN_ERROR": "Terjadi kesalahan yang tidak diketahui."
};

export function translateError(message: string | null): string | null {
  if (!message) return null;
  
  // Try exact match first
  if (ERROR_MAP[message]) return ERROR_MAP[message];
  
  // Try substring matches for common error patterns
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (message.includes(key)) return value;
  }
  
  // Default fallback if no mapping found
  return "Terjadi kendala pada sistem. Silakan coba lagi.";
}

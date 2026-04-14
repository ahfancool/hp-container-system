import type { AuthorizedRequestContext } from "../middleware/auth";
import { validateScanPayload } from "../services/scan";
import { verifyStudentFingerprint } from "../services/students";
import type { AppEnv } from "../services/env";
import { failure, success } from "../services/json";
import { readJsonBody, readRequiredTextField } from "../services/request";

export async function postScan(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  if (!context.auth?.student) {
    return failure("STUDENT_PROFILE_NOT_FOUND", 403, origin, {
      message: "Akun student harus terhubung ke tabel students sebelum scan dipakai."
    });
  }

  try {
    const payload = await readJsonBody(request);
    const studentId = readRequiredTextField(payload, "student_id");
    const containerId = readRequiredTextField(payload, "container_id");
    const timestamp = readRequiredTextField(payload, "timestamp");
    const qrToken = payload.qr_token as string | undefined;
    const fingerprint = payload.fingerprint as string | undefined;

    if (fingerprint) {
      const { isValid } = await verifyStudentFingerprint(env, context.auth.student.id, fingerprint);
      if (!isValid) {
        return failure("FINGERPRINT_MISMATCH", 403, origin, {
          message: "Perangkat tidak dikenali. Kamu hanya bisa melakukan scan dari perangkat utama yang terdaftar. Jika baru saja ganti HP, silakan login ulang."
        });
      }
    }

    const preview = await validateScanPayload(env, context.auth, {
      containerId,
      studentId,
      timestamp,
      qrToken
    });

    return success(
      {
        authenticatedStudent: {
          id: context.auth.student.id,
          name: context.auth.student.name,
          nis: context.auth.student.nis
        },
        message:
          preview.activeApproval
            ? "Scan valid. Izin guru aktif ditemukan. Tinjau ringkasan lalu konfirmasi untuk menyimpan transaksi keluar."
            : "Scan valid. Tinjau ringkasan lalu konfirmasi untuk menyimpan transaksi.",
        transactionRecorded: false,
        validation: preview
      },
      200,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message === "INVALID_CONTENT_TYPE" ||
      message === "INVALID_JSON_BODY" ||
      message.startsWith("INVALID_FIELD_")
    ) {
      return failure(message, 400, origin, {
        message:
          "Body request harus JSON dengan field `student_id`, `container_id`, dan `timestamp`."
      });
    }

    if (
      message === "INVALID_TIMESTAMP" ||
      message === "INVALID_CONTAINER" ||
      message === "UNAUTHORIZED_STUDENT_SCAN" ||
      message === "PENDING_APPROVAL_CONTAINER_MISMATCH" ||
      message === "QR_EXPIRED"
    ) {
      return failure(message, 400, origin, {
        message:
          message === "PENDING_APPROVAL_CONTAINER_MISMATCH"
            ? "Siswa ini sudah memiliki approval guru aktif for container lain. Scan container yang disetujui guru atau minta guru memperbarui approval."
            : message === "QR_EXPIRED"
              ? "QR yang dipindai sudah kedaluwarsa atau tidak valid lagi. Silakan scan QR fisik terbaru di container."
              : "Payload scan tidak valid, container tidak ditemukan, atau student_id tidak cocok dengan sesi login."
      });
    }

    if (message === "STUDENT_PROFILE_NOT_FOUND") {
      return failure(message, 403, origin, {
        message: "Profil student belum terhubung ke akun login."
      });
    }

    if (message.startsWith("SCAN_PREVIEW_FAILED:")) {
      return failure("SCAN_PREVIEW_FAILED", 500, origin, {
        message: message.replace("SCAN_PREVIEW_FAILED:", "")
      });
    }

    if (message.startsWith("CONTAINER_FETCH_FAILED:")) {
      return failure("CONTAINER_FETCH_FAILED", 500, origin, {
        message: message.replace("CONTAINER_FETCH_FAILED:", "")
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}

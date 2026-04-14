import type { AuthorizedRequestContext } from "../middleware/auth";
import { safeRecordAuditEvent } from "../services/audit";
import {
  createPhoneTransaction,
  normalizeRequestId,
  normalizeTransactionType
} from "../services/transactions";
import { verifyStudentFingerprint } from "../services/students";
import type { AppEnv } from "../services/env";
import { getRegularInWindow, getRegularOutWindow } from "../services/schedule";
import { failure, success } from "../services/json";
import {
  readJsonBody,
  readOptionalTextField,
  readRequiredTextField
} from "../services/request";

export async function postTransaction(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  if (!context.auth) {
    return failure("UNAUTHORIZED_ACTION", 401, origin);
  }

  let requestedTimestamp = new Date().toISOString();

  try {
    const payload = await readJsonBody(request);
    const studentId = readRequiredTextField(payload, "student_id");
    const containerId = readRequiredTextField(payload, "container_id");
    const timestamp = readRequiredTextField(payload, "timestamp");
    const qrToken = payload.qr_token as string | undefined;
    const fingerprint = payload.fingerprint as string | undefined;

    if (context.auth.student && fingerprint) {
      const { isValid } = await verifyStudentFingerprint(env, context.auth.student.id, fingerprint);
      if (!isValid) {
        return failure("FINGERPRINT_MISMATCH", 403, origin, {
          message: "Perangkat tidak dikenali. Kamu hanya bisa melakukan transaksi dari perangkat utama yang terdaftar. Jika baru saja ganti HP, silakan login ulang."
        });
      }
    }

    requestedTimestamp = timestamp;
    const type = normalizeTransactionType(
      typeof payload.type === "string" ? payload.type : undefined
    );
    const requestId = normalizeRequestId(readOptionalTextField(payload, "request_id"));

    const result = await createPhoneTransaction(env, context.auth, {
      containerId,
      requestId,
      studentId,
      timestamp,
      type,
      qrToken
    });
    const statusCode = result.idempotency.replayed ? 200 : 201;

    await safeRecordAuditEvent(env, {
      auth: context.auth,
      containerId: result.transaction.containerId,
      details: {
        action: result.transaction.action,
        replayed: result.idempotency.replayed,
        studentName: result.student.name,
        transactionType: result.transaction.type
      },
      eventType: result.idempotency.replayed
        ? "transaction.replayed"
        : "transaction.created",
      requestId: result.idempotency.requestId,
      requestMeta: context.requestMeta,
      severity: "INFO",
      statusCode,
      studentId: result.student.id,
      transactionId: result.transaction.id
    });

    if (result.consumedApproval) {
      await safeRecordAuditEvent(env, {
        auth: context.auth,
        containerId: result.transaction.containerId,
        details: {
          approvalId: result.consumedApproval.id,
          approvalType: result.consumedApproval.type,
          approvedByName: result.consumedApproval.approvedBy.name,
          studentName: result.student.name,
          transactionId: result.transaction.id
        },
        eventType: "teacher_approval.used",
        requestId: result.idempotency.requestId,
        requestMeta: context.requestMeta,
        severity: "INFO",
        statusCode,
        studentId: result.student.id,
        transactionId: result.transaction.id
      });
    }

    return success(
      {
        consumedApproval: result.consumedApproval
          ? {
              approvedAt: result.consumedApproval.approvedAt,
              approvedBy: result.consumedApproval.approvedBy,
              container: result.consumedApproval.container,
              id: result.consumedApproval.id,
              requestId: result.consumedApproval.requestId,
              type: result.consumedApproval.type
            }
          : null,
        idempotency: result.idempotency,
        message: result.idempotency.replayed
          ? "Permintaan yang sama sudah pernah diproses. Sistem mengembalikan transaksi sebelumnya tanpa menulis ulang."
          : result.consumedApproval
            ? "Transaksi HP berhasil dicatat menggunakan approval guru yang aktif."
          : "Transaksi HP berhasil dicatat.",
        rules: result.rules,
        student: {
          id: result.student.id,
          name: result.student.name,
          nis: result.student.nis
        },
        transaction: result.transaction,
        validation: result.preview
      },
      statusCode,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message === "INVALID_CONTENT_TYPE" ||
      message === "INVALID_JSON_BODY" ||
      message.startsWith("INVALID_FIELD_") ||
      message === "INVALID_TRANSACTION_TYPE" ||
      message === "INVALID_REQUEST_ID"
    ) {
      return failure(message, 400, origin, {
        message:
          "Body request harus JSON dengan field `student_id`, `container_id`, `timestamp`, optional `type`, dan optional `request_id`."
      });
    }

    if (
      message === "UNAUTHORIZED_STUDENT_SCAN" ||
      message === "UNAUTHORIZED_STUDENT_TRANSACTION" ||
      message === "UNAUTHORIZED_ACTION"
    ) {
      return failure(message, 403, origin, {
        message:
          "Sesi login tidak diizinkan membuat transaksi untuk student atau tipe transaksi tersebut."
      });
    }

    if (
      message === "INVALID_TIMESTAMP" ||
      message === "INVALID_CONTAINER" ||
      message === "STUDENT_NOT_FOUND" ||
      message === "INVALID_TRANSACTION_TYPE_FOR_ACTION" ||
      message === "STAFF_REGULAR_TRANSACTION_NOT_ALLOWED" ||
      message === "PENDING_APPROVAL_CONTAINER_MISMATCH" ||
      message === "QR_EXPIRED"
    ) {
      return failure(message, 400, origin, {
        message:
          message === "PENDING_APPROVAL_CONTAINER_MISMATCH"
            ? "Siswa ini memiliki approval guru aktif untuk container lain. Gunakan container yang disetujui guru atau minta guru memperbarui approval."
            : message === "QR_EXPIRED"
              ? "QR yang dipindai sudah kedaluwarsa atau tidak valid lagi. Silakan scan QR fisik terbaru di container."
              : "Payload transaksi tidak valid, student tidak ditemukan, atau tipe transaksi tidak cocok dengan aksi saat ini."
      });
    }

    if (message === "REQUEST_ID_CONFLICT") {
      return failure(message, 409, origin, {
        message:
          "request_id yang sama sudah terpakai untuk transaksi lain. Gunakan request_id baru untuk percobaan baru."
      });
    }

    if (message === "REGULAR_OUT_NOT_ALLOWED_YET") {
      return failure(message, 409, origin, {
        message:
          "HP belum boleh keluar secara reguler. Gunakan jalur override guru pada milestone berikutnya bila diperlukan.",
        rules: getRegularOutWindow(env, requestedTimestamp)
      });
    }

    if (message === "REGULAR_IN_NOT_ALLOWED_NOW") {
      return failure(message, 409, origin, {
        message:
          "Saat ini belum masuk jam wajib simpan HP reguler. Scan masuk hanya boleh dilakukan pada window waktu yang sudah ditentukan sekolah.",
        rules: getRegularInWindow(env, requestedTimestamp)
      });
    }

    if (message.startsWith("TRANSACTION_CREATE_FAILED:")) {
      const databaseMessage = message.replace("TRANSACTION_CREATE_FAILED:", "");

      if (databaseMessage.includes("INVALID_STATE_TRANSITION")) {
        return failure("INVALID_STATE_TRANSITION", 409, origin, {
          message:
            "Transaksi ditolak karena state terbaru siswa tidak cocok untuk aksi berikutnya."
        });
      }

      if (databaseMessage.includes("INVALID_TRANSACTION_TIMESTAMP")) {
        return failure("INVALID_TRANSACTION_TIMESTAMP", 400, origin, {
          message: "Timestamp transaksi lebih lama daripada transaksi terakhir siswa."
        });
      }

      if (databaseMessage.includes("UNAUTHORIZED_ACTION")) {
        return failure("UNAUTHORIZED_ACTION", 403, origin, {
          message:
            "Transaksi override membutuhkan operator guru, wali kelas, atau admin yang valid."
        });
      }

      return failure("TRANSACTION_CREATE_FAILED", 500, origin, {
        message: databaseMessage
      });
    }

    if (
      message.startsWith("SCAN_PREVIEW_FAILED:") ||
      message.startsWith("CONTAINER_FETCH_FAILED:") ||
      message.startsWith("STUDENT_FETCH_FAILED:") ||
      message.startsWith("TRANSACTION_LOOKUP_FAILED:") ||
      message.startsWith("TRANSACTION_HISTORY_LOOKUP_FAILED:")
    ) {
      return failure("TRANSACTION_CREATE_FAILED", 500, origin, {
        message: message.replace(
          /^(SCAN_PREVIEW_FAILED:|CONTAINER_FETCH_FAILED:|STUDENT_FETCH_FAILED:|TRANSACTION_LOOKUP_FAILED:|TRANSACTION_HISTORY_LOOKUP_FAILED:)/,
          ""
        )
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}

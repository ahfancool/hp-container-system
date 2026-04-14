import type { AuthorizedRequestContext } from "../middleware/auth";
import {
  safeRecordAuditEvent,
  safeRecordAuditEvents,
  type RecordAuditEventInput
} from "../services/audit";
import type { AppEnv } from "../services/env";
import { failure, success } from "../services/json";
import {
  normalizeRequestId,
  type TransactionType
} from "../services/transactions";
import {
  createBulkTeacherApprovals,
  createOrReplaceTeacherApproval,
  type ApprovalType,
  type BulkTeacherApprovalItem
} from "../services/teacherApprovals";
import {
  readJsonBody,
  readRequiredTextArrayField,
  readOptionalTextField,
  readRequiredTextField
} from "../services/request";

function normalizeApprovalType(value: string): ApprovalType {
  const type = value.trim().toUpperCase() as TransactionType;

  if (type !== "PEMBELAJARAN" && type !== "DARURAT") {
    throw new Error("INVALID_APPROVAL_TYPE");
  }

  return type;
}

function hasStudentIdsField(payload: Record<string, unknown>): boolean {
  return Array.isArray(payload.student_ids);
}

function buildBulkApprovalMessage(summary: {
  processedCount: number;
  requestedCount: number;
  skippedCount: number;
}): string {
  if (summary.processedCount === 0) {
    return `Tidak ada approval yang diaktifkan. ${summary.skippedCount} siswa dilewati karena state sudah berubah atau data tidak valid.`;
  }

  if (summary.skippedCount > 0) {
    return `Approval diproses untuk ${summary.processedCount} dari ${summary.requestedCount} siswa. ${summary.skippedCount} siswa dilewati karena state sudah berubah atau data tidak valid.`;
  }

  return `Approval aktif untuk ${summary.processedCount} siswa. Minta mereka scan container yang dipilih untuk menyelesaikan transaksi keluar.`;
}

function resolveBulkStatusCode(summary: {
  createdCount: number;
  replayedCount: number;
  skippedCount: number;
  updatedCount: number;
}): number {
  if (summary.skippedCount > 0) {
    return 207;
  }

  if (summary.updatedCount > 0 || summary.replayedCount > 0) {
    return 200;
  }

  if (summary.createdCount > 0) {
    return 201;
  }

  return 200;
}

function resolveBulkAuditEventType(item: BulkTeacherApprovalItem): string {
  if (item.result === "created") {
    return "teacher_approval.created";
  }

  if (item.result === "updated") {
    return "teacher_approval.updated";
  }

  if (item.result === "replayed") {
    return "teacher_approval.replayed";
  }

  return "teacher_approval.skipped";
}

export async function postTeacherApprove(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  if (!context.auth) {
    return failure("UNAUTHORIZED_ACTION", 401, origin);
  }

  try {
    const payload = await readJsonBody(request);
    const containerId = readRequiredTextField(payload, "container_id");
    const type = normalizeApprovalType(readRequiredTextField(payload, "type"));
    const timestamp =
      readOptionalTextField(payload, "timestamp") ?? new Date().toISOString();
    const requestId = normalizeRequestId(readOptionalTextField(payload, "request_id"));

    if (hasStudentIdsField(payload)) {
      const studentIds = readRequiredTextArrayField(payload, "student_ids");
      const result = await createBulkTeacherApprovals(env, context.auth, {
        containerId,
        requestId,
        studentIds,
        timestamp,
        type
      });
      const message = buildBulkApprovalMessage(result.summary);
      const statusCode = resolveBulkStatusCode(result.summary);
      const auditEvents: RecordAuditEventInput[] = [
        {
          auth: context.auth,
          containerId: result.container.id,
          details: {
            approvalType: type,
            bulkRequestedCount: result.summary.requestedCount,
            createdCount: result.summary.createdCount,
            processedCount: result.summary.processedCount,
            replayedCount: result.summary.replayedCount,
            skippedCount: result.summary.skippedCount,
            updatedCount: result.summary.updatedCount
          },
          eventType: "teacher_approval.bulk_processed",
          requestMeta: context.requestMeta,
          severity: result.summary.skippedCount > 0 ? "WARN" : "INFO",
          statusCode,
          transactionId: null
        },
        ...result.items.map(
          (item): RecordAuditEventInput => ({
            auth: context.auth,
            containerId: result.container.id,
            details: {
              approvalId: item.approval?.id ?? null,
              approvalRequestId: item.approval?.requestId ?? null,
              approvalType: type,
              bulkRequestedCount: result.summary.requestedCount,
              itemMessage: item.message,
              result: item.result,
              studentClassName: item.student.className,
              studentName: item.student.name,
              studentNis: item.student.nis
            },
            eventType: resolveBulkAuditEventType(item),
            requestMeta: context.requestMeta,
            severity:
              item.result === "created" ||
              item.result === "updated" ||
              item.result === "replayed"
                ? "INFO"
                : "WARN",
            statusCode,
            studentId: item.student.id,
            transactionId: null
          })
        )
      ];

      await safeRecordAuditEvents(env, auditEvents);

      return success(
        {
          approvedBy: {
            id: context.auth.appUser.id,
            name: context.auth.appUser.name,
            role: context.auth.appUser.role
          },
          bulk: {
            ...result.summary,
            requestId: result.idempotency.requestId
          },
          container: result.container,
          items: result.items,
          message,
          type
        },
        statusCode,
        origin
      );
    }

    const studentId = readRequiredTextField(payload, "student_id");

    const result = await createOrReplaceTeacherApproval(env, context.auth, {
      containerId,
      requestId,
      studentId,
      timestamp,
      type
    });
    const statusCode = result.idempotency.replayed ? 200 : 201;
    const eventType =
      result.status === "replayed"
        ? "teacher_approval.replayed"
        : result.status === "updated"
          ? "teacher_approval.updated"
          : "teacher_approval.created";

    await safeRecordAuditEvent(env, {
      auth: context.auth,
      containerId: result.approval.container.id,
      details: {
        approvalType: result.approval.type,
        approvedStudentName: result.student.name,
        replacedExisting: result.replacedExisting,
        replayed: result.idempotency.replayed
      },
      eventType,
      requestId: result.idempotency.requestId,
      requestMeta: context.requestMeta,
      severity: "INFO",
      statusCode,
      studentId: result.student.id,
      transactionId: null
    });

    return success(
      {
        approval: {
          approvedAt: result.approval.approvedAt,
          container: result.approval.container,
          id: result.approval.id,
          requestId: result.approval.requestId,
          type: result.approval.type,
          updatedAt: result.approval.updatedAt
        },
        approvedBy: {
          id: context.auth.appUser.id,
          name: context.auth.appUser.name,
          role: context.auth.appUser.role
        },
        idempotency: result.idempotency,
        message: result.idempotency.replayed
          ? "Approval yang sama sudah pernah diproses. Izin aktif sebelumnya dikembalikan tanpa mengubah data."
          : result.replacedExisting
            ? "Approval guru diperbarui. Minta siswa scan container yang terbaru untuk menyelesaikan transaksi keluar."
            : "Approval guru aktif. Minta siswa scan container untuk menyelesaikan transaksi keluar.",
        replacedExisting: result.replacedExisting,
        student: {
          className: result.student.className,
          id: result.student.id,
          name: result.student.name,
          nis: result.student.nis
        }
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
      message === "INVALID_STUDENT_IDS" ||
      message === "INVALID_TRANSACTION_TYPE" ||
      message === "INVALID_APPROVAL_TYPE" ||
      message === "INVALID_REQUEST_ID"
    ) {
      return failure(message, 400, origin, {
        message:
          "Body request harus JSON dengan field `container_id`, `type`, optional `timestamp`, optional `request_id`, dan salah satu dari `student_id` atau `student_ids[]`. Tipe approval hanya `PEMBELAJARAN` atau `DARURAT`."
      });
    }

    if (message === "UNAUTHORIZED_ACTION") {
      return failure(message, 403, origin, {
        message:
          "Role saat ini tidak diizinkan memberi approval override untuk transaksi HP."
      });
    }

    if (
      message === "INVALID_TIMESTAMP" ||
      message === "INVALID_CONTAINER" ||
      message === "STUDENT_NOT_FOUND"
    ) {
      return failure(message, 400, origin, {
        message:
          "Data student, container, atau timestamp tidak valid untuk approval guru."
      });
    }

    if (message === "INVALID_APPROVAL_STATE") {
      return failure(message, 409, origin, {
        message:
          "Approval hanya bisa diberikan saat HP siswa masih berada di dalam container dan belum memiliki approval aktif yang dipakai."
      });
    }

    if (message === "REQUEST_ID_CONFLICT") {
      return failure(message, 409, origin, {
        message:
          "request_id yang sama sudah terpakai untuk approval lain. Gunakan request_id baru untuk approval baru."
      });
    }

    if (message === "TEACHER_APPROVALS_SCHEMA_MISSING") {
      return failure(message, 503, origin, {
        message:
          "Fitur approval guru belum aktif penuh karena schema database live belum diperbarui. Jalankan migrasi tabel `teacher_approvals` di Supabase lebih dulu."
      });
    }

    if (
      message.startsWith("CONTAINER_FETCH_FAILED:") ||
      message.startsWith("STUDENT_FETCH_FAILED:") ||
      message.startsWith("TEACHER_APPROVAL_LOOKUP_FAILED:") ||
      message.startsWith("TEACHER_APPROVAL_STATE_LOOKUP_FAILED:") ||
      message.startsWith("TEACHER_APPROVAL_SAVE_FAILED:") ||
      message.startsWith("TEACHER_APPROVAL_USERS_FETCH_FAILED:") ||
      message.startsWith("TEACHER_APPROVAL_BULK_FAILED:")
    ) {
      return failure("TEACHER_APPROVAL_FAILED", 500, origin, {
        message: message.replace(
          /^(CONTAINER_FETCH_FAILED:|STUDENT_FETCH_FAILED:|TEACHER_APPROVAL_LOOKUP_FAILED:|TEACHER_APPROVAL_STATE_LOOKUP_FAILED:|TEACHER_APPROVAL_SAVE_FAILED:|TEACHER_APPROVAL_USERS_FETCH_FAILED:|TEACHER_APPROVAL_BULK_FAILED:)/,
          ""
        )
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}

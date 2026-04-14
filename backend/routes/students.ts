import type { AuthorizedRequestContext } from "../middleware/auth";
import type { AppEnv } from "../services/env";
import { failure, success } from "../services/json";
import { listStudents, listMinimalStudents, updateStudentFingerprint } from "../services/students";

function parseIncludeInactive(request: Request, role: string | null): boolean {
  const url = new URL(request.url);
  return role === "admin" && url.searchParams.get("includeInactive") === "true";
}

function parseSearch(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("search")?.trim() ?? "";
}

export async function getStudents(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  const role = context.auth?.appUser.role ?? null;
  const includeInactive = parseIncludeInactive(request, role);
  const search = parseSearch(request);

  try {
    const items = await listStudents(env, {
      includeInactive,
      search
    });

    return success(
      {
        items,
        meta: {
          authorizedRole: role,
          includeInactive,
          search,
          total: items.length
        }
      },
      200,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message.startsWith("STUDENTS_FETCH_FAILED:") ||
      message.startsWith("STUDENT_LATEST_TRANSACTIONS_FETCH_FAILED:")
    ) {
      return failure("STUDENTS_FETCH_FAILED", 500, origin, {
        message: message.replace(
          /^(STUDENTS_FETCH_FAILED:|STUDENT_LATEST_TRANSACTIONS_FETCH_FAILED:)/,
          ""
        )
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}

export async function getMinimalStudents(
  _request: Request,
  env: AppEnv,
  origin: string,
  _context: AuthorizedRequestContext
): Promise<Response> {
  try {
    const items = await listMinimalStudents(env);

    return success(
      {
        items,
        total: items.length
      },
      200,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return failure("STUDENTS_MINIMAL_FETCH_FAILED", 500, origin, {
      message
    });
  }
}

export async function postStudentFingerprint(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  const studentId = context.auth?.student?.id;

  if (!studentId) {
    return failure("UNAUTHORIZED", 401, origin, {
      message: "Hanya akun siswa yang bisa mendaftarkan fingerprint perangkat."
    });
  }

  try {
    const { fingerprint } = (await request.json()) as { fingerprint: string };

    if (!fingerprint) {
      return failure("INVALID_INPUT", 400, origin, {
        message: "Fingerprint tidak boleh kosong."
      });
    }

    await updateStudentFingerprint(env, studentId, fingerprint);

    return success({ message: "Fingerprint perangkat berhasil diperbarui." }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return failure("FINGERPRINT_UPDATE_FAILED", 500, origin, {
      message
    });
  }
}

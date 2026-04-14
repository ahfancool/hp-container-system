import { failure } from "../services/json";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export async function withErrorBoundary(
  handler: () => Promise<Response>,
  origin: string
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return failure("INTERNAL_ERROR", 500, origin, {
      message: getErrorMessage(error)
    });
  }
}


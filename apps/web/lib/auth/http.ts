import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError("Cross-origin request rejected", 403, "invalid_origin");
  }
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    throw new ApiError(
      result.error.issues[0]?.message ?? "Invalid request",
      400,
      "invalid_request",
    );
  }
  return result.data;
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Request could not be completed",
      },
    },
    { status: 500 },
  );
}

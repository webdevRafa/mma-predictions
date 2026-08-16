import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    paths: z
      .array(
        z
          .string()
          .min(1)
          .max(240)
          .startsWith("/")
          .refine((path) => !path.includes("..") && !path.includes("://")),
      )
      .min(1)
      .max(80),
  })
  .strict();

function secretsMatch(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (
    !secretsMatch(
      request.headers.get("x-revalidation-secret"),
      process.env.REVALIDATION_SECRET,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const input = bodySchema.safeParse(body);
  if (!input.success)
    return NextResponse.json(
      { error: "Invalid revalidation request" },
      { status: 400 },
    );
  const paths = [...new Set(input.data.paths)];
  paths.forEach((path) => revalidatePath(path));
  return NextResponse.json({
    revalidated: paths,
    at: new Date().toISOString(),
  });
}

import { prisma } from "./prisma";
import { NextRequest, NextResponse } from "next/server";

type HandlerFn = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;

/**
 * Wraps a POST handler with idempotency support.
 * If the request has an Idempotency-Key header, we check the DB:
 * - If found → return the cached response.
 * - If not → run the handler, store the result, return it.
 */
export function withIdempotency(handler: HandlerFn): HandlerFn {
  return async (req: NextRequest, ...args: unknown[]) => {
    const key = req.headers.get("idempotency-key");

    if (!key) {
      // No key — just run normally
      return handler(req, ...args);
    }

    // Check if we've seen this key before
    const existing = await prisma.idempotencyRequest.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(existing.body, { status: existing.statusCode });
    }

    // Run the actual handler
    const response = await handler(req, ...args);
    const body = await response.json();
    const statusCode = response.status;

    // Store for future retries (fire and forget – don't block on failure)
    prisma.idempotencyRequest
      .create({ data: { key, statusCode, body } })
      .catch(() => {});

    return NextResponse.json(body, { status: statusCode });
  };
}

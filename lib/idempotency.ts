import { prisma } from "./prisma";
import { NextRequest, NextResponse } from "next/server";

type HandlerFn = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;


export function withIdempotency(handler: HandlerFn): HandlerFn {
  return async (req: NextRequest, ...args: unknown[]) => {
    const key = req.headers.get("idempotency-key");

    if (!key) {
      
      return handler(req, ...args);
    }

    
    const existing = await prisma.idempotencyRequest.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(existing.body, { status: existing.statusCode });
    }

    
    const response = await handler(req, ...args);
    const body = await response.json();
    const statusCode = response.status;

    
    prisma.idempotencyRequest
      .create({ data: { key, statusCode, body } })
      .catch(() => {});

    return NextResponse.json(body, { status: statusCode });
  };
}

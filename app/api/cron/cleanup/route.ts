export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/cleanup";

export async function GET() {
  const count = await releaseExpiredReservations();
  return NextResponse.json({ released: count });
}

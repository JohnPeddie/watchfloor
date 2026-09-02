import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    fetchImages?: boolean;
    maxPerFeed?: number;
  };
  const result = await runIngest({
    fetchImages: body.fetchImages ?? true,
    maxPerFeed: body.maxPerFeed ?? 10,
  });
  return NextResponse.json(result);
}

export async function GET() {
  const result = await runIngest({ fetchImages: true, maxPerFeed: 8 });
  return NextResponse.json(result);
}

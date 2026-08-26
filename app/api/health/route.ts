import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";
import { hasKey, MODEL } from "@/lib/groq";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: hasKey() ? "groq" : "local",
    model: hasKey() ? MODEL : "rule-based local engine",
    catalogSize: CATALOG.length,
    features: ["profile", "path", "chat", "explain", "adapt"],
  });
}

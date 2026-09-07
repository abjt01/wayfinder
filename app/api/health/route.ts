import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";
import { hasKey, keyStatus, MODEL } from "@/lib/groq";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = keyStatus();
  return NextResponse.json({
    ok: true,
    engine: hasKey() ? "groq" : "local",
    model: hasKey() ? MODEL : "rule-based local engine",
    // Counts only — never any key material. `available` drops as keys are
    // rate limited and climbs back as their cooldowns expire.
    keys,
    catalogSize: CATALOG.length,
    features: ["profile", "path", "chat", "explain", "adapt"],
  });
}

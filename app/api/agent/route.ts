// app/api/agent/route.ts
//
// A simple endpoint that triggers the agent manually.
// Later, the cron job will call this automatically each morning.
// Having it as an API route means we can also trigger it by
// visiting the URL, which is handy for testing.

import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export async function GET() {
  try {
    console.log("Agent triggered...");
    const result = await runAgent();
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}

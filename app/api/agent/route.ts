import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { getServerUser } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const result = await runAgent(user.id);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}

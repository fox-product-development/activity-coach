// app/api/email/me/route.ts
// Triggers the agent and email for a specific hardcoded user — for testing only

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { sendSuggestionEmail } from "@/lib/email";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const testSecret = process.env.TEST_SECRET;

  if (!testSecret || key !== testSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabaseClient();

    // Get your specific user by email
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers();
    const me = users.find((u) => u.email === process.env.RESEND_TO_EMAIL);

    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await runAgent(me.id);
    await sendSuggestionEmail(result, me.email!);

    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("agent_suggestions")
      .update({ email_sent: true })
      .eq("user_id", me.id)
      .eq("suggestion_date", today);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Email me error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

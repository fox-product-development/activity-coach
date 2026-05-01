// app/api/email/route.ts
//
// UPDATED: Added cron secret verification
// Vercel automatically sends an Authorization header when it triggers a cron job.
// We check that header matches our CRON_SECRET before doing anything.
// If the secret doesn't match, we return a 401 (Unauthorized) and stop.

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { sendSuggestionEmail } from "@/lib/email";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  // -------------------------------------------------------------------------
  // SECURITY CHECK
  // -------------------------------------------------------------------------
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow the request if:
  // 1. The authorization header matches our secret (Vercel cron job)
  // 2. We're in local development (no secret set yet)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Unauthorized cron attempt blocked");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // -------------------------------------------------------------------------
  // AGENT + EMAIL
  // -------------------------------------------------------------------------
  try {
    console.log("Running agent...");
    const result = await runAgent();

    console.log("Sending email...");
    await sendSuggestionEmail(result);

    const supabase = createServerSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    await supabase
      .from("agent_suggestions")
      .update({ email_sent: true })
      .eq("suggestion_date", today);

    console.log("Done!");
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Email route error:", err);
    return NextResponse.json(
      { error: "Failed to run agent or send email" },
      { status: 500 },
    );
  }
}

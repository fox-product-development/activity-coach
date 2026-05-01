// app/api/email/route.ts
//
// This endpoint runs the agent AND sends the email in one go.
// The cron job will call this every morning.
// We can also trigger it manually by visiting the URL for testing.

import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { sendSuggestionEmail } from "@/lib/email";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    // Step 1: Run the agent to get today's suggestion
    console.log("Running agent...");
    const result = await runAgent();

    // Step 2: Send the email
    console.log("Sending email...");
    await sendSuggestionEmail(result);

    // Step 3: Mark the suggestion as emailed in Supabase
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

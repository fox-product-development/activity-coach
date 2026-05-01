// app/api/weekly/route.ts
//
// Endpoint that triggers the weekly summary agent and sends the email.
// Called by the Sunday 8pm cron job.

import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAgent } from "@/lib/weekly-agent";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: NextRequest) {
  // Security check — same pattern as /api/email
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Running weekly agent...");
    const { summary_text, subject_line } = await runWeeklyAgent();

    // Convert paragraph breaks to HTML
    const htmlBody = summary_text
      .split("\n\n")
      .map(
        (p: string) =>
          `<p style="margin: 0 0 16px; line-height: 1.6; color: #444;">${p}</p>`,
      )
      .join("");

    console.log("Sending weekly email...");
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.RESEND_TO_EMAIL!,
      subject: subject_line,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #92660A; margin: 0 0 24px;">☀️ Your Weekly Summary</h2>
          ${htmlBody}
          <p style="font-size: 13px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            Your Activity Coach · Powered by Claude · Weekly Summary
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, subject_line });
  } catch (err) {
    console.error("Weekly agent error:", err);
    return NextResponse.json({ error: "Weekly agent failed" }, { status: 500 });
  }
}

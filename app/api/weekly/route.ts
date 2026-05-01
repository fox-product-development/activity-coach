// app/api/weekly/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAgent } from "@/lib/weekly-agent";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Converts **bold text** markers to <strong> HTML tags
function formatBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Running weekly agent...");
    const { summary_text, subject_line, stats } = await runWeeklyAgent();

    // Convert paragraphs to HTML with bold formatting
    const htmlBody = summary_text
      .split("\n\n")
      .map(
        (p: string) =>
          `<p style="margin: 0 0 16px; line-height: 1.7; color: #444; font-size: 15px;">${formatBold(p)}</p>`,
      )
      .join(
        '<hr style="border: none; border-top: 1px solid #F0D878; margin: 20px 0;" />',
      );

    // Stats callout box values
    const statsLine = [
      stats.total_sessions ? `${stats.total_sessions} sessions` : null,
      stats.total_minutes ? `${stats.total_minutes} mins` : null,
      stats.total_km ? `${stats.total_km.toFixed(1)}km` : null,
      stats.avg_mood ? `avg mood ${stats.avg_mood}/5` : null,
      stats.weight_start && stats.weight_end
        ? `weight ${stats.weight_start}kg → ${stats.weight_end}kg`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const weightChangeText =
      stats.weight_change != null
        ? stats.weight_change < 0
          ? `<span style="color: #16a34a; font-weight: 700;">▼ ${Math.abs(stats.weight_change)}kg</span>`
          : `<span style="color: #dc2626; font-weight: 700;">▲ ${stats.weight_change}kg</span>`
        : "";

    console.log("Sending weekly email...");
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.RESEND_TO_EMAIL!,
      subject: subject_line,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #FFFDF0;">

          <!-- HEADER -->
          <h2 style="color: #92660A; margin: 0 0 4px; font-size: 22px;">☀️ Your Weekly Summary</h2>
          <p style="color: #888; font-size: 13px; margin: 0 0 24px;">Your Activity Coach · Powered by Claude</p>

          <!-- STATS CALLOUT BOX -->
          <div style="background: #FEF9C3; border: 1px solid #F5C842; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
            <p style="margin: 0 0 6px; font-weight: 700; color: #92660A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">📊 Week at a glance</p>
            <p style="margin: 0; color: #444; font-size: 14px;">${statsLine}</p>
            ${weightChangeText ? `<p style="margin: 6px 0 0; font-size: 13px; color: #666;">Weight change: ${weightChangeText}</p>` : ""}
          </div>

          <!-- EMAIL BODY -->
          ${htmlBody}

          <!-- FOCUS BOX -->
          <div style="background: #FEF9C3; border: 2px solid #F5C842; border-radius: 10px; padding: 16px 20px; margin-top: 28px;">
            <p style="margin: 0 0 4px; font-weight: 700; color: #92660A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">🎯 This week's focus</p>
            <p style="margin: 0; color: #444; font-size: 14px; line-height: 1.6;">Protein consistency — aim for 140g daily. One high-protein anchor meal per day is all it takes.</p>
          </div>

          <!-- FOOTER -->
          <p style="font-size: 12px; color: #bbb; margin-top: 32px; text-align: center;">
            Activity Coach · Weekly Summary · Powered by Claude
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

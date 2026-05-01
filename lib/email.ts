// lib/email.ts
//
// WHY THIS FILE EXISTS:
// Same pattern as lib/weather.ts and lib/agent.ts — the email sending
// logic lives here as a reusable utility. The cron job and the API route
// both import from here rather than duplicating the code.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSuggestionEmail(suggestion: {
  suggested_activity: string;
  suggestion_text: string;
  reasoning: string;
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const toEmail = process.env.RESEND_TO_EMAIL;

  if (!fromEmail || !toEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL or RESEND_TO_EMAIL not set in .env.local",
    );
  }

  // Activity labels for the email subject line
  const activityLabels: Record<string, string> = {
    running: "🏃 Running",
    cycling_indoor: "🚴 Cycling (Indoor)",
    cycling_outdoor: "🚴 Cycling (Outdoor)",
    fishing: "🎣 Fishing",
    kung_fu: "🥋 Kung Fu",
  };

  const activityLabel =
    activityLabels[suggestion.suggested_activity] ||
    suggestion.suggested_activity;
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Your activity suggestion for ${today} — ${activityLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Good morning! 👋</h2>
        <p style="font-size: 16px; color: #333;">
          Here's your activity suggestion for <strong>${today}</strong>:
        </p>

        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px; color: #111;">${activityLabel}</h3>
          <p style="margin: 0; color: #444; line-height: 1.6;">${suggestion.suggestion_text}</p>
        </div>

        <p style="font-size: 13px; color: #999; margin-top: 32px;">
          Your Activity Coach · Powered by Claude
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

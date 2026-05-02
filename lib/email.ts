// lib/email.ts

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Converts **bold text** markers to <strong> HTML tags
function formatBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export async function sendSuggestionEmail(suggestion: {
  suggested_activity: string;
  suggestion_text: string;
  reasoning: string;
  kung_fu_element: string;
  kung_fu_suggestion: string;
  yesterday_recap: string;
  stats: {
    yesterday_sessions: number;
    yesterday_minutes: number;
    yesterday_mood: number | null;
    yesterday_energy: number | null;
  };
}) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const toEmail = process.env.RESEND_TO_EMAIL;

  if (!fromEmail || !toEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL or RESEND_TO_EMAIL not set in .env.local",
    );
  }

  const activityLabels: Record<string, string> = {
    running: "🏃 Running",
    cycling_indoor: "🚴 Cycling (Indoor)",
    cycling_outdoor: "🚴 Cycling (Outdoor)",
    fishing: "🎣 Fishing",
    kung_fu: "🥋 Kung Fu",
    gym: "🏋️ Gym",
    other: "✏️ Other",
  };

  const activityLabel =
    activityLabels[suggestion.suggested_activity] ||
    suggestion.suggested_activity;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const moodEmoji = suggestion.stats.yesterday_mood
    ? ["", "😔", "😕", "😐", "🙂", "😄"][suggestion.stats.yesterday_mood]
    : null;

  const energyEmoji = suggestion.stats.yesterday_energy
    ? ["", "🪫", "😴", "⚡", "⚡⚡", "⚡⚡⚡"][
        suggestion.stats.yesterday_energy
      ]
    : null;

  // Build stats line
  const statsItems = [
    suggestion.stats.yesterday_sessions > 0
      ? `${suggestion.stats.yesterday_sessions} session${suggestion.stats.yesterday_sessions > 1 ? "s" : ""}`
      : "Rest day",
    suggestion.stats.yesterday_minutes > 0
      ? `${suggestion.stats.yesterday_minutes} mins`
      : null,
    suggestion.stats.yesterday_mood
      ? `Mood ${moodEmoji} ${suggestion.stats.yesterday_mood}/5`
      : null,
    suggestion.stats.yesterday_energy
      ? `Energy ${energyEmoji} ${suggestion.stats.yesterday_energy}/5`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `Your activity suggestion for ${today} — ${activityLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #FFFDF0;">

        <!-- HEADER -->
        <h2 style="color: #92660A; margin: 0 0 4px; font-size: 22px;">☀️ Good morning!</h2>
        <p style="color: #888; font-size: 13px; margin: 0 0 24px;">Your Activity Coach · ${today}</p>

        <!-- STATS CALLOUT BOX -->
        <div style="background: #FEF9C3; border: 1px solid #F5C842; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px; font-weight: 700; color: #92660A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">📊 Yesterday at a glance</p>
          <p style="margin: 0; color: #444; font-size: 14px;">${statsItems}</p>
        </div>

        <!-- YESTERDAY RECAP -->
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #F0D878;">
          <p style="margin: 0; line-height: 1.7; color: #444; font-size: 15px;">${formatBold(suggestion.yesterday_recap)}</p>
        </div>

        <!-- TODAY'S SUGGESTION -->
        <div style="margin-bottom: 24px;">
          <p style="margin: 0; line-height: 1.7; color: #444; font-size: 15px;">${formatBold(suggestion.suggestion_text)}</p>
        </div>

        <!-- SUGGESTION FOCUS BOX -->
        <div style="background: #FEF9C3; border: 2px solid #F5C842; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #92660A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Today's activity</p>
          <p style="margin: 0; color: #444; font-size: 16px; font-weight: 700;">${activityLabel}</p>
        </div>

        <!-- KUNG FU RECOMMENDATION -->
<div style="background: #1a1a2e; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
  <p style="margin: 0 0 8px; font-weight: 700; color: #F5C842; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">🥋 Today's Kung Fu</p>
  <p style="margin: 0 0 8px; color: #F5C842; font-size: 15px; font-weight: 700;">${suggestion.kung_fu_element}</p>
  <p style="margin: 0; color: #ccc; font-size: 14px; line-height: 1.6;">${suggestion.kung_fu_suggestion}</p>
</div>

        <!-- FOOTER -->
        <p style="font-size: 12px; color: #bbb; margin-top: 24px; text-align: center;">
          Activity Coach · Daily Suggestion · Powered by Claude
        </p>

      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

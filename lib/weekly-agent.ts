// lib/weekly-agent.ts
//
// Generates a weekly summary by pulling the last 7 days of data
// and asking Claude to reflect on patterns, trends and set a focus
// for the coming week.

import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runWeeklyAgent(): Promise<{
  summary_text: string;
  subject_line: string;
  stats: {
    total_sessions: number;
    total_minutes: number;
    total_km: number;
    avg_mood: number;
    weight_start: number | null;
    weight_end: number | null;
    weight_change: number | null;
  };
}> {
  const supabase = createServerSupabaseClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  // -------------------------------------------------------------------------
  // GATHER DATA
  // -------------------------------------------------------------------------
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .gte("date", sevenDaysAgoStr)
    .order("date", { ascending: true });

  const { data: moodLogs } = await supabase
    .from("mood_logs")
    .select("*")
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: true });

  const { data: dietLogs } = await supabase
    .from("diet_logs")
    .select("*")
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: true });

  const { data: suggestions } = await supabase
    .from("agent_suggestions")
    .select("*")
    .gte("suggestion_date", sevenDaysAgoStr)
    .order("suggestion_date", { ascending: true });

  // -------------------------------------------------------------------------
  // CALCULATE STATS
  // -------------------------------------------------------------------------

  // Activity stats
  const totalSessions = activities?.length || 0;
  const totalMinutes =
    activities?.reduce((sum, a) => sum + a.duration_minutes, 0) || 0;
  const totalDistance =
    activities?.reduce((sum, a) => sum + (a.distance_km || 0), 0) || 0;
  const activityBreakdown =
    activities?.reduce(
      (acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ) || {};

  // Weight trend
  const weightLogs = dietLogs?.filter((d) => d.weight_kg != null) || [];
  const firstWeight = weightLogs[0]?.weight_kg || null;
  const lastWeight = weightLogs[weightLogs.length - 1]?.weight_kg || null;
  const weightChange =
    firstWeight && lastWeight ? (lastWeight - firstWeight).toFixed(1) : null;

  // Diet stats
  const dietWithKcal = dietLogs?.filter((d) => d.kcal != null) || [];
  const avgKcal =
    dietWithKcal.length > 0
      ? Math.round(
          dietWithKcal.reduce((sum, d) => sum + d.kcal!, 0) /
            dietWithKcal.length,
        )
      : null;
  const avgProtein =
    dietWithKcal.length > 0
      ? (
          dietWithKcal.reduce((sum, d) => sum + (d.protein_g || 0), 0) /
          dietWithKcal.length
        ).toFixed(1)
      : null;
  const highestKcalDay =
    dietWithKcal.reduce(
      (max, d) => (d.kcal! > (max?.kcal || 0) ? d : max),
      dietWithKcal[0],
    ) || null;

  // Mood stats
  const avgMood =
    moodLogs && moodLogs.length > 0
      ? (
          moodLogs.reduce((sum, m) => sum + m.mood_score, 0) / moodLogs.length
        ).toFixed(1)
      : null;
  const avgEnergy =
    moodLogs && moodLogs.length > 0
      ? (
          moodLogs.reduce((sum, m) => sum + m.energy_score, 0) / moodLogs.length
        ).toFixed(1)
      : null;
  const lowestMoodDay =
    moodLogs?.reduce(
      (min, m) => (m.mood_score < (min?.mood_score || 6) ? m : min),
      moodLogs[0],
    ) || null;

  // -------------------------------------------------------------------------
  // BUILD PROMPT
  // -------------------------------------------------------------------------
  const prompt = `You are a personal activity coach writing a friendly weekly summary email.

## Week Period
${sevenDaysAgoStr} to ${todayStr}

## Activity Summary
Total sessions: ${totalSessions}
Total time: ${totalMinutes} minutes
Total distance: ${totalDistance.toFixed(1)}km
Breakdown: ${JSON.stringify(activityBreakdown)}
Full activity log:
${
  activities && activities.length > 0
    ? activities
        .map(
          (a) =>
            `- ${a.date.split("T")[0]}: ${a.type} for ${a.duration_minutes} mins${a.distance_km ? ` (${a.distance_km}km)` : ""}${a.notes ? ` — "${a.notes}"` : ""}`,
        )
        .join("\n")
    : "No activities logged this week."
}

## Weight Trend
${
  firstWeight && lastWeight
    ? `Started at ${firstWeight}kg, ended at ${lastWeight}kg. Change: ${Number(weightChange) > 0 ? "+" : ""}${weightChange}kg`
    : "No weight data available."
}

## Diet Summary
${
  avgKcal
    ? `Average daily calories: ${avgKcal} kcal
Average protein: ${avgProtein}g
Highest calorie day: ${highestKcalDay?.log_date} at ${highestKcalDay?.kcal} kcal`
    : "No diet data available."
}

## Mood & Energy
${
  avgMood
    ? `Average mood: ${avgMood}/5
Average energy: ${avgEnergy}/5
Lowest mood day: ${lowestMoodDay?.log_date} (mood: ${lowestMoodDay?.mood_score}, energy: ${lowestMoodDay?.energy_score})${lowestMoodDay?.notes ? ` — "${lowestMoodDay.notes}"` : ""}`
    : "No mood data available."
}

## Daily Suggestions Made This Week
${
  suggestions && suggestions.length > 0
    ? suggestions
        .map(
          (s) =>
            `- ${s.suggestion_date}: ${s.suggested_activity} — "${s.suggestion_text}"`,
        )
        .join("\n")
    : "No suggestions logged."
}

## Your Task
Write a warm, encouraging weekly summary email. Structure it as follows:

1. A brief opening (1 sentence only) — positive and energising
2. Activity recap — what was achieved, highlights, rest days
3. Weight & diet insight — trends, any notable days, protein/calorie observations
4. Mood & energy reflection — note any correlations with diet or activity
5. One clear focus for the coming week — specific and actionable
6. A warm closing line (1 sentence only)

FORMATTING RULES — follow these exactly:
- Every section must start with a single bold headline sentence summarising that section, followed by the detail. Use **double asterisks** to mark bold sentences e.g. **This is the bold opener.**
- Keep each section to 3-4 sentences maximum after the bold opener. Be concise and punchy — cut anything that doesn't add value.
- Total email length should be around 250-300 words maximum. Be ruthless about cutting filler.
- Use plain paragraphs separated by blank lines — no bullet points or headers.

Respond in this exact JSON format with no markdown:
{
  "subject_line": "a punchy, personalised subject line for the email",
  "stats": {
    "total_sessions": number,
    "total_minutes": number,
    "total_km": number,
    "avg_mood": number,
    "weight_start": number or null,
    "weight_end": number or null,
    "weight_change": number or null
  },
  "summary_text": "the full email body as a single string with paragraph breaks using \\n\\n. Bold sentences marked with **text**."
}`;

  // -------------------------------------------------------------------------
  // CALL CLAUDE
  // -------------------------------------------------------------------------
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  const clean = responseText.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  return {
    summary_text: parsed.summary_text,
    subject_line: parsed.subject_line,
    stats: parsed.stats,
  };
}

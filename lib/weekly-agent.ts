// lib/weekly-agent.ts
//
// Generates a weekly summary by pulling the last 7 days of data
// and asking Claude to reflect on patterns, trends and set a focus
// for the coming week. Also reviews activity mood/energy scores
// and updates them based on 28 days of logged data.

import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";
import { fetchGymContext, fetchGymWeight } from "@/lib/gym-bridge";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runWeeklyAgent(userId: string): Promise<{
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

  // 28 days ago for feedback loop
  const twentyEightDaysAgo = new Date();
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  const twentyEightDaysAgoStr = twentyEightDaysAgo.toISOString().split("T")[0];

  // -------------------------------------------------------------------------
  // GATHER DATA
  // -------------------------------------------------------------------------

  // Fetch user's enabled activities with mood and energy scores
  const { data: userActivitiesData } = await supabase
    .from("user_activities")
    .select("activity_type, energy_cost, mood_boost")
    .eq("user_id", userId)
    .eq("enabled", true);

  const userActivityKeys =
    userActivitiesData?.map((a) => a.activity_type) || [];

  const { data: activityTypeDetails } = await supabase
    .from("activity_types")
    .select("*")
    .in("type_key", userActivityKeys.length > 0 ? userActivityKeys : ["none"]);

  // Merge mood/energy scores into activity details
  const userActivities = (activityTypeDetails || []).map((a) => {
    const scores = userActivitiesData?.find(
      (u) => u.activity_type === a.type_key,
    );
    return {
      ...a,
      energy_cost: scores?.energy_cost ?? null,
      mood_boost: scores?.mood_boost ?? null,
    };
  });

  // Fetch Kung Fu settings
  const { data: kungFuEnabledData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "kung_fu_enabled")
    .limit(1);

  const kungFuEnabled = kungFuEnabledData?.[0]?.value === "true";

  // User's name
  const { data: nameData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "name")
    .limit(1);

  const userName = nameData?.[0]?.value || null;

  // Kung Fu sash level
  const { data: sashData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "kung_fu_sash")
    .limit(1);

  const sashLevel = sashData?.[0]?.value || "red";

  // Fetch Kung Fu suggestions from the week
  const { data: kungFuSuggestions } = await supabase
    .from("agent_suggestions")
    .select("suggestion_date, kung_fu_element, kung_fu_suggestion")
    .eq("user_id", userId)
    .gte("suggestion_date", sevenDaysAgoStr)
    .not("kung_fu_element", "is", null)
    .order("suggestion_date", { ascending: true });

  // Last 7 days activities
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .gte("date", sevenDaysAgoStr)
    .order("date", { ascending: true });

  // Last 28 days activities and mood for feedback loop
  const { data: activitiesLast28 } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .gte("date", twentyEightDaysAgoStr)
    .order("date", { ascending: true });

  const { data: moodLogsLast28 } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", twentyEightDaysAgoStr)
    .order("log_date", { ascending: true });

  // Last 7 days mood
  const { data: moodLogs } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: true });

  // Last 7 days diet
  const { data: dietLogs } = await supabase
    .from("diet_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: true });

  // Last 7 days suggestions
  const { data: suggestions } = await supabase
    .from("agent_suggestions")
    .select("*")
    .eq("user_id", userId)
    .gte("suggestion_date", sevenDaysAgoStr)
    .order("suggestion_date", { ascending: true });

  // Gym App data — only for owner user
  let gymContext = null;
  let gymWeightHistory = null;
  if (userId === process.env.OWNER_USER_ID) {
    try {
      gymContext = await fetchGymContext();
    } catch (err) {
      console.error("Gym context fetch failed, continuing without it:", err);
    }
    try {
      gymWeightHistory = await fetchGymWeight();
    } catch (err) {
      console.error("Gym weight fetch failed, continuing without it:", err);
    }
  }

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

  // Weight trend — from Gym App for owner, from diet_logs for non-owner
  const weightLogs = gymWeightHistory
    ? gymWeightHistory.filter(
        (w) => w.date >= sevenDaysAgoStr && w.date <= todayStr,
      )
    : (dietLogs?.filter((d) => d.weight_kg != null) || []).map((d) => ({
        date: d.log_date,
        weight_kg: d.weight_kg,
      }));
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
  const prompt = `You are a personal activity coach writing a friendly weekly summary email. You are also responsible for reviewing and updating the user's personalised activity scores based on their logged data.

## User's Name
${userName ? `The user's name is ${userName}. Address them by name naturally — not in every sentence, but enough to feel personal.` : "No name set — address them as 'you'."}

## User's Activities with Current Scores
${userActivities.map((a) => `- ${a.type_key}: ${a.name}${a.is_outdoor ? " (outdoor)" : " (indoor)"} | energy_cost: ${a.energy_cost != null ? `${a.energy_cost}/5` : "not set"}, mood_boost: ${a.mood_boost != null ? `${a.mood_boost}/5` : "not set"}`).join("\n")}

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

## Gym Training Context This Week
${
  gymContext
    ? `Training phase: ${gymContext.training_phase}
Week: ${gymContext.week_number}
Sessions this week: ${gymContext.sessions_completed} completed of ${gymContext.sessions_planned} planned
${gymContext.overload_flags.length > 0 ? `Progressive overload flags: ${gymContext.overload_flags.join(", ")}` : "No overload flags this week."}
${gymContext.recent_1rm_highlights.length > 0 ? `Recent 1RM highlights: ${gymContext.recent_1rm_highlights.join(", ")}` : "No recent 1RM highlights."}`
    : "Gym training context unavailable — do not reference gym load or training phase."
}

## Kung Fu This Week
${
  kungFuEnabled
    ? `
Current sash level: ${sashLevel}
Kung Fu sessions this week:
${
  kungFuSuggestions && kungFuSuggestions.length > 0
    ? kungFuSuggestions
        .map((s) => `- ${s.suggestion_date}: ${s.kung_fu_element}`)
        .join("\n")
    : "No Kung Fu sessions logged this week."
}
Note: Reference Kung Fu practice in the weekly summary if relevant — mention consistency or suggest refocusing if sessions were missed.
`
    : "Kung Fu is not enabled for this user — do not mention it."
}

## Last 28 Days — Activity & Mood Data (for score feedback loop only)
Use this data to review whether the current energy_cost and mood_boost scores still reflect how this user actually responds to each activity. Look for patterns — does the user's mood or energy consistently change the day after a particular activity? If so, update the score accordingly. Only update if you have enough evidence (3 or more sessions of that activity).

Activities:
${
  activitiesLast28 && activitiesLast28.length > 0
    ? activitiesLast28
        .map(
          (a) =>
            `- ${a.date.split("T")[0]}: ${a.type} for ${a.duration_minutes} mins`,
        )
        .join("\n")
    : "No activity data."
}

Mood & Energy logs:
${
  moodLogsLast28 && moodLogsLast28.length > 0
    ? moodLogsLast28
        .map(
          (m) =>
            `- ${m.log_date}: mood ${m.mood_score}/5, energy ${m.energy_score}/5`,
        )
        .join("\n")
    : "No mood data."
}

## Your Task
1. Write a warm, encouraging weekly summary email structured as follows:
   - A brief opening (1 sentence only) — positive and energising
   - Activity recap — what was achieved, highlights, rest days
   - Weight & diet insight — trends, any notable days, protein/calorie observations
   - Mood & energy reflection — note any correlations with diet or activity
   - One clear focus for the coming week — specific and actionable
   - A warm closing line (1 sentence only)

2. Review the activity scores and return any updates warranted by the 28-day data. If any activity has scores marked as "not set", assign appropriate values based on your knowledge of that activity.

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
  "summary_text": "the full email body as a single string with paragraph breaks using \\n\\n. Bold sentences marked with **text**.",
  "activity_score_updates": [
    {
      "type_key": "the activity type_key",
      "energy_cost": number,
      "mood_boost": number
    }
  ]
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

  // -------------------------------------------------------------------------
  // UPDATE ACTIVITY SCORES
  // -------------------------------------------------------------------------

  // Save any activity score updates returned by the agent
  if (
    parsed.activity_score_updates &&
    parsed.activity_score_updates.length > 0
  ) {
    for (const update of parsed.activity_score_updates) {
      await supabase
        .from("user_activities")
        .update({
          energy_cost: update.energy_cost,
          mood_boost: update.mood_boost,
        })
        .eq("user_id", userId)
        .eq("activity_type", update.type_key);
    }
  }

  return {
    summary_text: parsed.summary_text,
    subject_line: parsed.subject_line,
    stats: parsed.stats,
  };
}

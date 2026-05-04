// lib/agent.ts

import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function runAgent(userId: string): Promise<{
  suggested_activity: string;
  suggestion_text: string;
  reasoning: string;
  yesterday_recap: string;
  yesterday_diet: {
    kcal: number | null;
    protein_g: number | null;
    weight_kg: number | null;
  } | null;
  stats: {
    yesterday_sessions: number;
    yesterday_minutes: number;
    yesterday_mood: number | null;
    yesterday_energy: number | null;
  };
  kung_fu_element: string;
  kung_fu_suggestion: string;
}> {
  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  // Yesterday's activities
  const { data: yesterdayActivities } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .gte("date", yesterdayStr)
    .lt("date", today)
    .order("date", { ascending: false });

  // Last 7 days activities
  const { data: recentActivities } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .gte("date", sevenDaysAgoStr)
    .lt("date", yesterdayStr)
    .order("date", { ascending: false });

  // Last 7 days mood and energy
  const { data: moodLogs } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: false });

  const yesterdayMood = moodLogs?.[0] || null;
  const avgMoodScore =
    moodLogs && moodLogs.length > 0
      ? Math.round(
          moodLogs.reduce((sum, m) => sum + m.mood_score, 0) / moodLogs.length,
        )
      : null;
  const avgEnergyScore =
    moodLogs && moodLogs.length > 0
      ? Math.round(
          moodLogs.reduce((sum, m) => sum + m.energy_score, 0) /
            moodLogs.length,
        )
      : null;

  // Recent suggestions
  const { data: recentSuggestions } = await supabase
    .from("agent_suggestions")
    .select("*")
    .eq("user_id", userId)
    .order("suggestion_date", { ascending: false })
    .limit(7);

  // Weather
  let weather = null;
  try {
    weather = await getWeather();
  } catch (err) {
    console.error("Weather fetch failed, continuing without it:", err);
  }

  // User's goal
  const { data: goalData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "goal")
    .limit(1);

  const userGoal = goalData?.[0]?.value || null;

  // User's name
  const { data: nameData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "name")
    .limit(1);

  const userName = nameData?.[0]?.value || null;

  // Yesterday's diet and weight
  const { data: dietLogs } = await supabase
    .from("diet_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", yesterdayStr)
    .limit(1);

  const dietLog = dietLogs?.[0] || null;

  // User's enabled activities with mood and energy scores
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

  // Kung Fu settings
  const { data: sashData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "kung_fu_sash")
    .limit(1);

  const sashLevel = sashData?.[0]?.value || "red";

  const { data: kungFuEnabledData } = await supabase
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "kung_fu_enabled")
    .limit(1);

  const kungFuEnabled = kungFuEnabledData?.[0]?.value === "true";

  const sashOrder: Record<string, number> = { red: 1, yellow: 2, next: 3 };
  const currentSashOrder = sashOrder[sashLevel] || 1;

  const { data: kungFuElementsData } = await supabase
    .from("kung_fu_elements")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const availableElements = (kungFuElementsData || [])
    .filter((e) => (sashOrder[e.min_sash] || 1) <= currentSashOrder + 1)
    .filter((e) => e.name !== "Qi Gong");

  const { data: recentKungFu } = await supabase
    .from("activities")
    .select("date, notes")
    .eq("user_id", userId)
    .eq("type", "kung_fu")
    .order("date", { ascending: false })
    .limit(10);

  const recentKungFuSummary =
    recentKungFu && recentKungFu.length > 0
      ? recentKungFu
          .map((k) => `- ${k.date.split("T")[0]}: ${k.notes || "no notes"}`)
          .join("\n")
      : "No recent Kung Fu sessions logged.";

  // -------------------------------------------------------------------------
  // STEP 2: Build the prompt
  // -------------------------------------------------------------------------
  const prompt = `You are a personal activity coach. Your job is to suggest ONE activity for today based on the context below.

## User's Name
${userName ? `The user's name is ${userName}. Address them by name naturally — not in every sentence, but enough to feel personal.` : "No name set — address them as 'you'."}

## User's Current Goal
${userGoal ? userGoal : "No goal set — give general balanced suggestions."}

## Today's Date
${today} (${new Date().toLocaleDateString("en-GB", { weekday: "long" })})

## Yesterday's Diet & Weight
${
  dietLog
    ? `
Weight: ${dietLog.weight_kg != null ? `${dietLog.weight_kg}kg` : "not logged"}
Calories: ${dietLog.kcal != null ? `${dietLog.kcal} kcal (${dietLog.kcal_pct}% of daily guide)` : "not logged"}
Protein: ${dietLog.protein_g != null ? `${dietLog.protein_g}g (${dietLog.protein_pct}% of guide)` : "not logged"}
Carbs: ${dietLog.carbs_g != null ? `${dietLog.carbs_g}g` : "not logged"}
Fat: ${dietLog.fat_g != null ? `${dietLog.fat_g}g` : "not logged"}
Fibre: ${dietLog.fibre_g != null ? `${dietLog.fibre_g}g` : "not logged"}
Sugar: ${dietLog.sugar_g != null ? `${dietLog.sugar_g}g` : "not logged"}
`
    : "No diet data logged for yesterday."
}

## Mood & Energy (last 7 days)
${
  moodLogs && moodLogs.length > 0
    ? `7-day average — Mood: ${avgMoodScore}/5, Energy: ${avgEnergyScore}/5
Yesterday — Mood: ${yesterdayMood?.mood_score ?? "not logged"}/5, Energy: ${yesterdayMood?.energy_score ?? "not logged"}/5
Full log:
${moodLogs.map((m) => `- ${m.log_date}: mood ${m.mood_score}/5, energy ${m.energy_score}/5${m.notes ? ` — "${m.notes}"` : ""}`).join("\n")}`
    : "No mood logged in the last 7 days."
}

## Current Weather
${
  weather
    ? `${weather.description}, ${weather.temperature}°C (feels like ${weather.feels_like}°C), Wind: ${weather.wind_speed}km/h, Rain: ${weather.rain_mm}mm. Good for outdoors: ${weather.is_good_for_outdoors ? "Yes" : "No"}`
    : "Weather data unavailable."
}

## Yesterday's Activities
${
  yesterdayActivities && yesterdayActivities.length > 0
    ? yesterdayActivities
        .map(
          (a) =>
            `- ${a.type} for ${a.duration_minutes} mins${a.distance_km ? ` (${a.distance_km}km)` : ""}${a.notes ? ` — "${a.notes}"` : ""}`,
        )
        .join("\n")
    : "No activities logged yesterday — rest day."
}

## Last 7 Days Activity Context (for recovery and pattern awareness only — do not reference activities older than 2 days directly)
${
  recentActivities && recentActivities.length > 0
    ? recentActivities
        .map(
          (a) =>
            `- ${a.date.split("T")[0]}: ${a.type} for ${a.duration_minutes} mins${a.notes ? ` — "${a.notes}"` : ""}`,
        )
        .join("\n")
    : "No activities in the last 7 days."
}

## Recent Suggestions (avoid repeating these)
${
  recentSuggestions && recentSuggestions.length > 0
    ? recentSuggestions
        .map((s) => `- ${s.suggestion_date}: ${s.suggested_activity}`)
        .join("\n")
    : "No recent suggestions."
}

## Availability Constraints
${
  ["Saturday", "Sunday"].includes(
    new Date().toLocaleDateString("en-GB", { weekday: "long" }),
  )
    ? userActivities.some((a) => a.type_key === "gym")
      ? "Today is a weekend — do NOT suggest gym as it is an office gym and not accessible."
      : "No weekend constraints."
    : "All activities available today."
}

## Available Activities
${
  userActivities.length > 0
    ? userActivities
        .map(
          (a) =>
            `- ${a.type_key}: ${a.name}${a.is_outdoor ? " (outdoor — check weather)" : " (indoor)"} | energy_cost: ${a.energy_cost != null ? `${a.energy_cost}/5` : "not set"}, mood_boost: ${a.mood_boost != null ? `${a.mood_boost}/5` : "not set"}`,
        )
        .join("\n")
    : "No activities configured — suggest a gentle walk or rest day."
}

${
  kungFuEnabled
    ? `
## Daily Kung Fu Practice
Current sash level: ${sashLevel}

Available elements for rotation (excluding Qi Gong which is always practiced):
${availableElements.map((e) => `- ${e.name}: ${e.description || ""}${(sashOrder[e.min_sash] || 1) > currentSashOrder ? " ⭐ next belt level" : ""}`).join("\n")}

Elements marked ⭐ are from the next belt level — occasionally suggest these to encourage progression, but don't overdo it.

Recent Kung Fu sessions (use notes to determine which elements were practiced recently and rotate accordingly):
${recentKungFuSummary}

Select ONE element from the available list that hasn't been practiced recently.
Always pair it with Qi Gong (minimum 5 minutes).
If no recent sessions exist, start with Fa Jing.
`
    : "## Daily Kung Fu Practice\nKung Fu is not enabled for this user — do not generate a Kung Fu recommendation."
}

## Your Instructions
1. Use the user's mood and energy scores alongside each activity's energy_cost and mood_boost to guide your suggestion:
   - Low mood + low energy → prefer low energy_cost, high mood_boost activities
   - Good mood + low energy → prefer moderate energy_cost activities, describe them as lighter sessions
   - Low mood + good energy → prefer high mood_boost activities at mild intensity
   - Good mood + good energy → suggest higher energy_cost activities, push for a strong session
   - Recent streak of high energy_cost activities → suggest something restorative regardless of scores
2. Always adjust the prescription (how to do the activity) based on mood and energy — same activity, different intensity and tone.
3. Consider the weather. Don't suggest outdoor activities if conditions are poor.
4. Yesterday's activities are the primary input. Use the last 7 days for recovery and pattern awareness only.
5. If suggesting kung_fu, pick the most appropriate element from the library based on energy level and what hasn't been done recently.
6. Don't repeat a recent suggestion unless it's clearly the best option.
7. Be encouraging and specific. Mention the weather, their energy, or their recent pattern in your message.
8. If diet data is available, factor it in. Low protein yesterday = mention it's a good day for a post-workout meal. Low calories = suggest something less intense. High sugar = note it and suggest balancing activity.
9. If weight is logged, acknowledge it naturally if relevant — don't make it the focus but it adds useful context about the person's health journey.
10. Factor in the user's goal when making suggestions — tailor the activity and messaging to support it.
11. If any activity has energy_cost or mood_boost marked as "not set", assign appropriate scores (1-5) based on your knowledge of that activity and include them in your response.

Respond in this exact JSON format with no markdown:
{
  "suggested_activity": "one of the activity type_keys from the available activities list",
  "suggestion_text": "3-4 sentences addressed directly to the user explaining what you suggest and why. Friendly and motivating. Start with a bold opener sentence marked with **double asterisks**.",
  "reasoning": "1-2 sentences of internal reasoning explaining your logic.",
  "yesterday_recap": "1-2 sentences summarising what the user did yesterday — activities and mood. If nothing was logged say so briefly. Start with a bold opener marked with **double asterisks**.",
  "stats": {
    "yesterday_sessions": number or 0,
    "yesterday_minutes": number or 0,
    "yesterday_mood": number or null,
    "yesterday_energy": number or null
  },
  "kung_fu_element": "the name of the rotating element, or null if kung fu is disabled",
  "kung_fu_suggestion": "1-2 sentences for today's kung fu practice, or null if kung fu is disabled",
  "activity_score_updates": [
    {
      "type_key": "the activity type_key",
      "energy_cost": number,
      "mood_boost": number
    }
  ]
}`;

  // -------------------------------------------------------------------------
  // STEP 3: Call Claude
  // -------------------------------------------------------------------------
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  const clean = responseText.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  // -------------------------------------------------------------------------
  // STEP 4: Save to Supabase
  // -------------------------------------------------------------------------

  // Update any activity scores returned by the agent
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

  await supabase.from("agent_suggestions").upsert(
    {
      user_id: userId,
      suggestion_date: today,
      suggested_activity: parsed.suggested_activity,
      suggestion_text: parsed.suggestion_text,
      reasoning: parsed.reasoning,
      kung_fu_element: parsed.kung_fu_element,
      kung_fu_suggestion: parsed.kung_fu_suggestion,
      email_sent: false,
    },
    { onConflict: "user_id,suggestion_date" },
  );

  return {
    suggested_activity: parsed.suggested_activity,
    suggestion_text: parsed.suggestion_text,
    reasoning: parsed.reasoning,
    yesterday_recap: parsed.yesterday_recap,
    stats: parsed.stats,
    kung_fu_element: parsed.kung_fu_element,
    kung_fu_suggestion: parsed.kung_fu_suggestion,
    yesterday_diet: dietLog
      ? {
          kcal: dietLog.kcal || null,
          protein_g: dietLog.protein_g || null,
          weight_kg: dietLog.weight_kg || null,
        }
      : null,
  };
}

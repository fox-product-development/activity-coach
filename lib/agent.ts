// lib/agent.ts
//
// WHY THIS FILE EXISTS:
// This is the core reasoning engine of the app. It gathers all available
// context (activities, mood, weather) and passes it to Claude to generate
// a personalised daily suggestion.
//
// WHY IT LIVES IN /lib AND NOT /api:
// The agent logic itself is a utility — it can be called from the cron job,
// from an API route, or anywhere else. Keeping it in /lib means we're not
// tied to one specific route.

import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const KUNG_FU_LIBRARY = [
  {
    id: "basics",
    name: "Basic Stances & Footwork",
    description:
      "Horse stance, bow stance, cat stance. Foundation of everything.",
    energy_required: "low",
  },
  {
    id: "forms",
    name: "Form Practice",
    description:
      "Run through your current form sequences with focus on precision.",
    energy_required: "medium",
  },
  {
    id: "striking",
    name: "Striking Combinations",
    description: "Punch and palm strike combinations on the bag or in the air.",
    energy_required: "high",
  },
  {
    id: "kicks",
    name: "Kicking Drills",
    description: "Front kick, side kick, roundhouse — slow then fast.",
    energy_required: "high",
  },
  {
    id: "conditioning",
    name: "Conditioning",
    description: "Press-ups, squats, core work tailored to martial arts.",
    energy_required: "high",
  },
  {
    id: "breathing",
    name: "Breathing & Qi Gong",
    description: "Slow meditative breathing exercises and qi gong flows.",
    energy_required: "low",
  },
  {
    id: "stretching",
    name: "Flexibility & Stretching",
    description: "Deep stretching focused on kicks and hip mobility.",
    energy_required: "low",
  },
  {
    id: "sparring_drills",
    name: "Sparring Drills",
    description: "Reaction drills, block and counter combinations.",
    energy_required: "medium",
  },
  {
    id: "weapons",
    name: "Weapons Work",
    description: "Staff or sword form practice if equipment available.",
    energy_required: "medium",
  },
  {
    id: "meditation",
    name: "Martial Meditation",
    description: "Stillness practice, visualisation, mental focus training.",
    energy_required: "low",
  },
];

export async function runAgent(): Promise<{
  suggested_activity: string;
  suggestion_text: string;
  reasoning: string;
  yesterday_recap: string;
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

  // Yesterday and 7 days ago for date ranges
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  // -------------------------------------------------------------------------
  // STEP 1: Gather all context
  // -------------------------------------------------------------------------

  // Yesterday's activities — primary input
  const { data: yesterdayActivities } = await supabase
    .from("activities")
    .select("*")
    .gte("date", yesterdayStr)
    .lt("date", today)
    .order("date", { ascending: false });

  // Last 7 days activities — recovery and pattern context
  const { data: recentActivities } = await supabase
    .from("activities")
    .select("*")
    .gte("date", sevenDaysAgoStr)
    .lt("date", yesterdayStr)
    .order("date", { ascending: false });

  // Yesterday's mood log
  const { data: moodLogs } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("log_date", yesterdayStr)
    .limit(1);

  const yesterdayMood = moodLogs?.[0] || null;

  // Recent suggestions (so the agent doesn't repeat itself)
  const { data: recentSuggestions } = await supabase
    .from("agent_suggestions")
    .select("*")
    .order("suggestion_date", { ascending: false })
    .limit(7);

  // Weather
  let weather = null;
  try {
    weather = await getWeather();
  } catch (err) {
    console.error("Weather fetch failed, continuing without it:", err);
  }

  // User's current goal
  const { data: goalData } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "goal")
    .limit(1);

  const userGoal = goalData?.[0]?.value || null;

  // Yesterday's diet and weight log
  const { data: dietLogs } = await supabase
    .from("diet_logs")
    .select("*")
    .eq("log_date", yesterdayStr)
    .limit(1);

  const dietLog = dietLogs?.[0] || null;

  // Kung Fu sash level
  const { data: sashData } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "kung_fu_sash")
    .limit(1);

  const sashLevel = sashData?.[0]?.value || "red";

  // Fetch available Kung Fu elements based on sash level
  const sashOrder: Record<string, number> = { red: 1, yellow: 2, next: 3 };
  const currentSashOrder = sashOrder[sashLevel] || 1;

  const { data: kungFuElementsData } = await supabase
    .from("kung_fu_elements")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  // Filter to elements available at current sash level
  // Qi Gong is excluded from rotation as it's always practiced
  const availableElements = (kungFuElementsData || [])
    .filter((e) => (sashOrder[e.min_sash] || 1) <= currentSashOrder)
    .filter((e) => e.name !== "Qi Gong");

  // Recent Kung Fu sessions to determine rotation
  const { data: recentKungFu } = await supabase
    .from("activities")
    .select("date, notes")
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

## Yesterday's Mood & Energy
${
  yesterdayMood
    ? `Mood: ${yesterdayMood.mood_score}/5, Energy: ${yesterdayMood.energy_score}/5${yesterdayMood.notes ? `, Notes: "${yesterdayMood.notes}"` : ""}`
    : "No mood logged yesterday."
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
    ? "Today is a weekend — do NOT suggest gym as it is an office gym and not accessible."
    : "Gym is available today."
}
  
## Available Activities
- running (outdoor — check weather)
- cycling_indoor
- cycling_outdoor (check weather)
- fishing (outdoor — check weather)
- gym
- other

## Daily Kung Fu Practice
Current sash level: ${sashLevel}

Available elements for rotation (excluding Qi Gong which is always practiced):
${availableElements.map((e) => `- ${e.name}: ${e.description || ""}`).join("\n")}

Recent Kung Fu sessions (use notes to determine which elements were practiced recently and rotate accordingly):
${recentKungFuSummary}

Select ONE element from the available list that hasn't been practiced recently.
Always pair it with Qi Gong (minimum 5 minutes).
If no recent sessions exist, start with Fa Jing.

## Kung Fu Content Library (if suggesting kung_fu, pick ONE element)
${KUNG_FU_LIBRARY.map((k) => `- ${k.id}: ${k.name} (energy required: ${k.energy_required}) — ${k.description}`).join("\n")}

## Your Instructions
1. Consider yesterday's mood and energy scores. Low energy = suggest gentler activities.
2. Consider the weather. Don't suggest outdoor activities if conditions are poor.
3. Yesterday's activities are the primary input. Use the last 7 days for recovery and pattern awareness only.
4. If suggesting kung_fu, pick the most appropriate element from the library based on energy level and what hasn't been done recently.
5. Don't repeat a recent suggestion unless it's clearly the best option.
6. Be encouraging and specific. Mention the weather, their energy, or their recent pattern in your message.
7. If diet data is available, factor it in. Low protein yesterday = mention it's a good day for a post-workout meal. Low calories = suggest something less intense. High sugar = note it and suggest balancing activity.
8. If weight is logged, acknowledge it naturally if relevant — don't make it the focus but it adds useful context about the person's health journey.
9. Factor in the user's goal when making suggestions — tailor the activity and messaging to support it.

Respond in this exact JSON format with no markdown:
{
  "suggested_activity": "one of: running, cycling_indoor, cycling_outdoor, fishing, gym, other",
  "suggestion_text": "3-4 sentences addressed directly to the user explaining what you suggest and why. Friendly and motivating. Start with a bold opener sentence marked with **double asterisks**.",
  "reasoning": "1-2 sentences of internal reasoning explaining your logic.",
  "yesterday_recap": "1-2 sentences summarising what the user did yesterday — activities and mood. If nothing was logged say so briefly. Start with a bold opener marked with **double asterisks**.",
  "stats": {
    "yesterday_sessions": number or 0,
    "yesterday_minutes": number or 0,
    "yesterday_mood": number or null,
    "yesterday_energy": number or null
  },
  "kung_fu_element": "the name of the rotating element selected from the available list",
  "kung_fu_suggestion": "1-2 sentences explaining today's Kung Fu practice. Always starts with Qi Gong (min 5 mins) then the chosen element. Mention why this element was chosen based on recency."
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
  // STEP 4: Save the suggestion to Supabase
  // -------------------------------------------------------------------------
  const suggestionText = parsed.kung_fu_element
    ? `${parsed.suggestion_text} (Focus: ${KUNG_FU_LIBRARY.find((k) => k.id === parsed.kung_fu_element)?.name})`
    : parsed.suggestion_text;

  await supabase.from("agent_suggestions").upsert(
    {
      suggestion_date: today,
      suggested_activity: parsed.suggested_activity,
      suggestion_text: suggestionText,
      reasoning: parsed.reasoning,
      kung_fu_element: parsed.kung_fu_element,
      kung_fu_suggestion: parsed.kung_fu_suggestion,
      email_sent: false,
    },
    { onConflict: "suggestion_date" },
  );

  return {
    suggested_activity: parsed.suggested_activity,
    suggestion_text: suggestionText,
    reasoning: parsed.reasoning,
    yesterday_recap: parsed.yesterday_recap,
    stats: parsed.stats,
    kung_fu_element: parsed.kung_fu_element,
    kung_fu_suggestion: parsed.kung_fu_suggestion,
  };
}

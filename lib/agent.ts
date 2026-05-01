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

// The Kung Fu content library — 10 practice elements the agent rotates
// intelligently based on energy level and recency
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
}> {
  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  // -------------------------------------------------------------------------
  // STEP 1: Gather all context
  // -------------------------------------------------------------------------

  // Recent activities (last 14 days)
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .order("date", { ascending: false })
    .limit(14);

  // Today's mood log
  const { data: moodLogs } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("log_date", today)
    .limit(1);

  const todayMood = moodLogs?.[0] || null;

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

  // Yesterday's diet and weight log
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: dietLogs } = await supabase
    .from("diet_logs")
    .select("*")
    .eq("log_date", yesterdayStr)
    .limit(1);

  const dietLog = dietLogs?.[0] || null;

  // -------------------------------------------------------------------------
  // STEP 2: Build the prompt
  // -------------------------------------------------------------------------
  // We give Claude a structured summary of everything it needs to know.
  // The more specific and organised the context, the better the suggestion.

  const prompt = `You are a personal activity coach. Your job is to suggest ONE activity for today based on the context below.

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

## Today's Mood & Energy Check-in
${
  todayMood
    ? `Mood: ${todayMood.mood_score}/5, Energy: ${todayMood.energy_score}/5${todayMood.notes ? `, Notes: "${todayMood.notes}"` : ""}`
    : "No check-in logged yet today."
}

## Current Weather
${
  weather
    ? `${weather.description}, ${weather.temperature}°C (feels like ${weather.feels_like}°C), Wind: ${weather.wind_speed}km/h, Rain: ${weather.rain_mm}mm. Good for outdoors: ${weather.is_good_for_outdoors ? "Yes" : "No"}`
    : "Weather data unavailable."
}

## Recent Activity History (last 14 days)
${
  activities && activities.length > 0
    ? activities
        .map(
          (a) =>
            `- ${a.date}: ${a.type} for ${a.duration_minutes} mins${a.notes ? ` ("${a.notes}")` : ""}`,
        )
        .join("\n")
    : "No recent activities logged."
}

## Recent Suggestions (avoid repeating these)
${
  recentSuggestions && recentSuggestions.length > 0
    ? recentSuggestions
        .map((s) => `- ${s.suggestion_date}: ${s.suggested_activity}`)
        .join("\n")
    : "No recent suggestions."
}

## Available Activities
- running (outdoor — check weather)
- cycling_indoor
- cycling_outdoor (check weather)
- fishing (outdoor — check weather)
- kung_fu

## Kung Fu Content Library (if suggesting kung_fu, pick ONE element)
${KUNG_FU_LIBRARY.map((k) => `- ${k.id}: ${k.name} (energy required: ${k.energy_required}) — ${k.description}`).join("\n")}

## Your Instructions
1. Consider the mood and energy scores. Low energy = suggest gentler activities.
2. Consider the weather. Don't suggest outdoor activities if conditions are poor.
3. Look at the activity history. Encourage variety and avoid suggesting the same thing too many times in a row.
4. If suggesting kung_fu, pick the most appropriate element from the library based on energy level and what hasn't been done recently.
5. Don't repeat a recent suggestion unless it's clearly the best option.
6. Be encouraging and specific. Mention the weather, their energy, or their recent pattern in your message.
7. If diet data is available, factor it in. Low protein yesterday = mention it's a good day for a post-workout meal. Low calories = suggest something less intense. High sugar = note it and suggest balancing activity.
8. If weight is logged, acknowledge it naturally if relevant — don't make it the focus but it adds useful context about the person's health journey.

Respond in this exact JSON format:
{
  "suggested_activity": "one of: running, cycling_indoor, cycling_outdoor, fishing, kung_fu",
  "kung_fu_element": "the kung_fu library id if applicable, otherwise null",
  "suggestion_text": "2-3 sentences addressed directly to the user explaining what you suggest and why. Friendly and motivating.",
  "reasoning": "1-2 sentences of internal reasoning explaining your logic."
}`;

  // -------------------------------------------------------------------------
  // STEP 3: Call Claude
  // -------------------------------------------------------------------------
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract the text response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse the JSON — strip any markdown fences Claude might add
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
      email_sent: false,
    },
    { onConflict: "suggestion_date" },
  );

  return {
    suggested_activity: parsed.suggested_activity,
    suggestion_text: suggestionText,
    reasoning: parsed.reasoning,
  };
}

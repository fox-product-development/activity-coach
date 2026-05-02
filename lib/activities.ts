// lib/activities.ts
//
// Handles image extraction from Garmin and Strava screenshots.
// Extracts all available metrics including heart rate, pace, speed,
// elevation, calories, power, and AI summaries from Strava.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExtractedActivity = {
  type: string;
  date: string;
  duration_minutes: number;
  distance_km?: number | null;
  avg_heart_rate?: number | null;
  avg_pace?: string | null;
  avg_speed_kmh?: number | null;
  elevation_m?: number | null;
  calories?: number | null;
  avg_power_w?: number | null;
  ai_notes?: string | null;
  source: "garmin" | "strava" | "unknown";
};

export async function extractActivityFromImage(
  imageBase64: string,
  mediaType: string,
): Promise<ExtractedActivity> {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as
                | "image/png"
                | "image/jpeg"
                | "image/webp"
                | "image/gif",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `This is a fitness activity screenshot from either Garmin or Strava.
Today's date is ${today}.

Please extract the following and respond ONLY in JSON format with no markdown:
{
  "source": "garmin" or "strava" or "unknown",
  "activity_type": "the type of activity e.g. running, cycling, swimming, gym, hiking — use lowercase",
  "date": "YYYY-MM-DD format. IMPORTANT date rules:
    - If the screenshot shows 'Today' or 'Today at HH:MM' → use ${today}
    - If the screenshot shows 'Yesterday' → use ${yesterdayStr}
    - If a specific date is shown → convert to YYYY-MM-DD format
    - Never guess or infer a date from context",
  "duration_minutes": number (convert HH:MM:SS or MM:SS to total minutes, rounded to nearest minute),
  "distance_km": number or null (convert miles to km if needed),
  "avg_heart_rate": number or null (bpm),
  "avg_pace": "string in MM:SS/km format or null (for running activities)",
  "avg_speed_kmh": number or null (for cycling activities, convert mph if needed),
  "elevation_m": number or null (metres, convert feet if needed),
  "calories": number or null,
  "avg_power_w": number or null (watts, cycling only),
  "ai_notes": "the AI generated summary text if present (e.g. Strava Athlete Intelligence text), otherwise null"
}

For numeric values extract just the number without units.`,
          },
        ],
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  const clean = responseText.replace(/```json|```/g, "").trim();
  const extracted = JSON.parse(clean);

  // Map activity type to our known types
  const typeMap: Record<string, string> = {
    running: "running",
    run: "running",
    cycling: "cycling_outdoor",
    ride: "cycling_outdoor",
    cycling_outdoor: "cycling_outdoor",
    cycling_indoor: "cycling_indoor",
    indoor_cycling: "cycling_indoor",
    virtual_ride: "cycling_indoor",
    fishing: "fishing",
    kung_fu: "kung_fu",
    gym: "gym",
    swimming: "other",
    hiking: "other",
    walking: "other",
  };

  const mappedType = typeMap[extracted.activity_type?.toLowerCase()] || "other";

  return {
    type: mappedType,
    date: extracted.date,
    duration_minutes: Math.round(extracted.duration_minutes),
    distance_km: extracted.distance_km || null,
    avg_heart_rate: extracted.avg_heart_rate || null,
    avg_pace: extracted.avg_pace || null,
    avg_speed_kmh: extracted.avg_speed_kmh || null,
    elevation_m: extracted.elevation_m || null,
    calories: extracted.calories || null,
    avg_power_w: extracted.avg_power_w || null,
    ai_notes: extracted.ai_notes || null,
    source: extracted.source,
  };
}

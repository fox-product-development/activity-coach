// lib/activities.ts
//
// Handles image extraction from Garmin and Strava screenshots.
// Same pattern as lib/weather.ts and lib/email.ts — logic lives here,
// API route imports and uses it.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExtractedActivity = {
  type: string;
  date: string;
  duration_minutes: number;
  distance_km?: number | null;
  notes?: string | null;
  source: "garmin" | "strava" | "unknown";
};

export async function extractActivityFromImage(
  imageBase64: string,
  mediaType: string,
): Promise<ExtractedActivity> {
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

Please extract the following and respond ONLY in JSON format with no markdown:
{
  "source": "garmin" or "strava" or "unknown",
  "activity_type": "the type of activity e.g. running, cycling, swimming, gym, hiking — use lowercase",
  "date": "the date in YYYY-MM-DD format",
  "duration_minutes": number (convert from HH:MM:SS or MM:SS to total minutes, rounded to nearest minute),
  "distance_km": number or null (convert miles to km if needed, null if not shown),
  "avg_heart_rate": number or null,
  "avg_pace_per_km": "string e.g. 5:50 or null",
  "calories": number or null,
  "elevation_m": number or null,
  "notes": "a brief auto-generated note e.g. '5km run, avg HR 154bpm, pace 5:50/km'"
}

For activity_type, map to one of these if possible: running, cycling_outdoor, cycling_indoor, fishing, kung_fu, gym. Otherwise use the activity name as-is.`,
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
    cycling_outdoor: "cycling_outdoor",
    cycling_indoor: "cycling_indoor",
    indoor_cycling: "cycling_indoor",
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
    notes: extracted.notes || null,
    source: extracted.source,
  };
}

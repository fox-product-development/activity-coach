// app/api/diet/route.ts
//
// REVISED BEHAVIOUR:
// Weight — logged for TODAY (morning weigh-in)
// Diet — logged for YESTERDAY (evening Nutra Check upload)
// They live in the same diet_logs table but on different date rows.
//
// GET — returns:
//   - today's weight log (for weight popup check)
//   - yesterday's diet log (for diet popup check)
//   - recent logs for the diet section display
//
// POST — saves today's weight (log_date = today)
// PUT — saves diet from image (log_date = extracted from screenshot)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Check today's weight
    const { data: todayData } = await supabase
      .from("diet_logs")
      .select("*")
      .eq("log_date", today)
      .limit(1);

    // Check yesterday's diet
    const { data: yesterdayData } = await supabase
      .from("diet_logs")
      .select("*")
      .eq("log_date", yesterdayStr)
      .limit(1);

    // Recent logs for display in diet section (last 7 days)
    const { data: recentLogs } = await supabase
      .from("diet_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(7);

    const todayLog = todayData?.[0] || null;
    const yesterdayLog = yesterdayData?.[0] || null;

    const hasWeight = todayLog?.weight_kg != null;
    const hasDiet = todayLog?.kcal != null;

    return NextResponse.json({
      todayLog,
      yesterdayLog,
      recentLogs: recentLogs || [],
      hasWeight,
      hasDiet,
      todayStr: today,
      yesterdayStr,
      isComplete: hasWeight && hasDiet,
    });
  } catch (err) {
    console.error("Diet GET error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weight_kg } = body;

    if (!weight_kg) {
      return NextResponse.json(
        { error: "weight_kg is required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    // Weight always logs for TODAY
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("diet_logs")
      .upsert(
        { log_date: today, weight_kg: Number(weight_kg) },
        { onConflict: "log_date" },
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, log: data[0] });
  } catch (err) {
    console.error("Diet POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mediaType } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Send image to Claude for extraction
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
              text: `This is a Nutra Check nutritional summary screenshot.

Please extract the following and respond ONLY in JSON format with no markdown:
{
  "date_text": "the exact text shown at the top for the date period e.g. Yesterday, Today, or the actual date shown",
  "kcal": number or null,
  "fat_g": number or null,
  "sat_fat_g": number or null,
  "carbs_g": number or null,
  "sugar_g": number or null,
  "fibre_g": number or null,
  "protein_g": number or null,
  "salt_g": number or null,
  "kcal_pct": number or null,
  "protein_pct": number or null
}

For numeric values, extract just the number without units.`,
            },
          ],
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const clean = responseText.replace(/```json|```/g, "").trim();
    const extracted = JSON.parse(clean);

    // Validate nutrition data exists
    const hasAnyNutrition =
      extracted.kcal != null ||
      extracted.protein_g != null ||
      extracted.carbs_g != null ||
      extracted.fat_g != null;

    if (!hasAnyNutrition) {
      return NextResponse.json(
        {
          error:
            "No food entries were found in this image — please log some food in Nutra Check first, or skip if you had nothing to eat yesterday.",
        },
        { status: 400 },
      );
    }

    // Resolve date from image
    const dateText = extracted.date_text?.toLowerCase() || "";
    let log_date: string;

    if (dateText.includes("today")) {
      log_date = todayStr;
    } else if (dateText.includes("yesterday")) {
      log_date = yesterdayStr;
    } else {
      const parsed = new Date(extracted.date_text);

      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          {
            error: "Could not read the date from the image — please try again",
          },
          { status: 400 },
        );
      }

      if (parsed >= today) {
        return NextResponse.json(
          {
            error:
              "Image date is today or in the future — please use a previous day's summary",
          },
          { status: 400 },
        );
      }

      if (parsed < sevenDaysAgo) {
        return NextResponse.json(
          {
            error:
              "Image is more than 7 days old — please check you have the right screenshot",
          },
          { status: 400 },
        );
      }

      log_date = parsed.toISOString().split("T")[0];
    }

    // Save to Supabase
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("diet_logs")
      .upsert(
        {
          log_date,
          kcal: extracted.kcal,
          fat_g: extracted.fat_g,
          sat_fat_g: extracted.sat_fat_g,
          carbs_g: extracted.carbs_g,
          sugar_g: extracted.sugar_g,
          fibre_g: extracted.fibre_g,
          protein_g: extracted.protein_g,
          salt_g: extracted.salt_g,
          kcal_pct: extracted.kcal_pct,
          protein_pct: extracted.protein_pct,
        },
        { onConflict: "log_date" },
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      log_date,
      extracted,
      log: data[0],
    });
  } catch (err) {
    console.error("Diet PUT error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

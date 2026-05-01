// app/api/diet/route.ts
//
// Handles three operations:
// GET — check if yesterday's diet log exists
// POST — save weight only
// PUT — save diet data extracted from image (we use PUT because we're
//        updating an existing row or creating with specific date data)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// -------------------------------------------------------------------------
// GET /api/diet
// Check if yesterday's diet log exists
// -------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("diet_logs")
      .select("*")
      .eq("log_date", yesterdayStr)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const log = data?.[0] || null;
    const hasWeight = log?.weight_kg != null;
    const hasDiet = log?.kcal != null;

    return NextResponse.json({
      log,
      hasWeight,
      hasDiet,
      yesterdayStr,
      // True if both weight and diet are logged
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

// -------------------------------------------------------------------------
// POST /api/diet/weight
// Save weight — creates or updates the row for the given date
// -------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weight_kg, log_date } = body;

    if (!weight_kg || !log_date) {
      return NextResponse.json(
        { error: "weight_kg and log_date are required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("diet_logs")
      .upsert(
        { log_date, weight_kg: Number(weight_kg) },
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

// -------------------------------------------------------------------------
// PUT /api/diet
// Accept a base64 image, send to Claude vision, extract nutrition data,
// validate the date, and save to Supabase
// -------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mediaType } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Yesterday for validation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // 7 days ago for validation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // -----------------------------------------------------------------------
    // STEP 1: Send image to Claude for extraction
    // -----------------------------------------------------------------------
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
                media_type: mediaType || "image/png",
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
  "kcal_pct": number or null (the % of daily guide for kcal),
  "protein_pct": number or null (the % of daily guide for protein)
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

    // Check if the image had any actual food data
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

    // -----------------------------------------------------------------------
    // STEP 2: Validate and resolve the date
    // -----------------------------------------------------------------------
    const dateText = extracted.date_text?.toLowerCase() || "";
    let log_date: string;

    if (dateText.includes("today")) {
      return NextResponse.json(
        {
          error:
            "Image shows today's entries — please use yesterday's summary instead",
        },
        { status: 400 },
      );
    } else if (dateText.includes("yesterday")) {
      log_date = yesterdayStr;
    } else {
      // Try to parse a specific date from the text
      const parsed = new Date(extracted.date_text);

      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          {
            error: "Could not read the date from the image — please try again",
          },
          { status: 400 },
        );
      }

      // Must be in the past
      if (parsed >= today) {
        return NextResponse.json(
          {
            error:
              "Image date is today or in the future — please use a previous day's summary",
          },
          { status: 400 },
        );
      }

      // Must be within 7 days
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

    // -----------------------------------------------------------------------
    // STEP 3: Save to Supabase
    // -----------------------------------------------------------------------
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

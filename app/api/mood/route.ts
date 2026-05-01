// app/api/mood/route.ts
//
// Same pattern as the activities route — POST to save, GET to fetch.
// The key difference is we only want ONE mood log per day, so the GET
// route checks if today's log already exists, and the database has a
// UNIQUE constraint on log_date to enforce this at the DB level too.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// POST /api/mood
// Saves today's mood and energy scores
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mood_score, energy_score, notes } = body;

    // Validate scores are in the 1-5 range
    if (!mood_score || !energy_score) {
      return NextResponse.json(
        { error: "mood_score and energy_score are required" },
        { status: 400 },
      );
    }

    if (
      mood_score < 1 ||
      mood_score > 5 ||
      energy_score < 1 ||
      energy_score > 5
    ) {
      return NextResponse.json(
        { error: "Scores must be between 1 and 5" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();
    const today = new Date().toISOString().split("T")[0]; // e.g. "2025-01-15"

    // "upsert" means: insert if no row exists for today, update if one does.
    // This handles the case where you want to update your mood later in the day.
    // The onConflict tells Supabase which column to check for duplicates.
    const { data, error } = await supabase
      .from("mood_logs")
      .upsert(
        {
          log_date: today,
          mood_score: Number(mood_score),
          energy_score: Number(energy_score),
          notes: notes || null,
        },
        { onConflict: "log_date" },
      )
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, mood_log: data[0] },
      { status: 201 },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

// GET /api/mood
// Fetches today's mood log (if it exists) and the last 7 days for context
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    // Get the last 7 days of mood logs, most recent first
    const { data, error } = await supabase
      .from("mood_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(7);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Separate today's log from the history
    const todayLog = data.find((log) => log.log_date === today) || null;
    const history = data.filter((log) => log.log_date !== today);

    return NextResponse.json({ todayLog, history });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

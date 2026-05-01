// app/api/settings/route.ts
//
// Simple GET and POST for the settings table.
// Currently used for the goal setting but can handle
// any key/value pair we add in future.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/settings?key=goal
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    const supabase = createServerSupabaseClient();

    const query = supabase.from("settings").select("*");
    if (key) query.eq("key", key);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If a specific key was requested return just the value
    if (key) {
      return NextResponse.json({ value: data?.[0]?.value || null });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

// POST /api/settings
// Creates or updates a setting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || !value) {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, setting: data[0] });
  } catch (err) {
    console.error("Settings POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

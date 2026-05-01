// app/api/activities/route.ts
//
// WHY THIS FILE EXISTS:
// This is a server-side API endpoint. When your form submits an activity,
// it sends the data here. This route validates it and saves it to Supabase.
//
// WHY SERVER-SIDE:
// We use the service role Supabase client here (full DB access), which must
// never run in the browser. API routes in Next.js always run on the server,
// so it's safe to use here.
//
// The file is called route.ts because that's what Next.js App Router expects.
// The folder path (app/api/activities/) becomes the URL: /api/activities

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, ActivityType } from "@/lib/supabase";

// POST /api/activities
// Called when you submit the logging form
export async function POST(request: NextRequest) {
  try {
    // Parse the JSON body sent from the form
    const body = await request.json();
    const { type, date, duration_minutes, notes, distance_km } = body;

    // Basic validation — make sure required fields are present
    if (!type || !date || !duration_minutes) {
      return NextResponse.json(
        { error: "type, date, and duration_minutes are required" },
        { status: 400 },
      );
    }

    // Use the server client (service role) to insert into Supabase
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("activities")
      .insert({
        type: type as ActivityType,
        date,
        duration_minutes: Number(duration_minutes),
        notes: notes || null,
        distance_km: distance_km ? Number(distance_km) : null,
      })
      .select(); // Returns the inserted row so we can confirm it worked

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, activity: data[0] },
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

// GET /api/activities
// Called when the page loads to fetch your recent activities
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .order("date", { ascending: false }) // Most recent first
      .limit(20); // Just the last 20 for now

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ activities: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

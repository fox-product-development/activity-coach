import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, ActivityType } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${process.env.BRIDGE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const userId = process.env.OWNER_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "Owner user not configured" },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_id, type, date, duration_minutes, notes } = body;

  // Confirm the Gym App is posting for the correct user
  if (user_id !== userId) {
    return NextResponse.json({ error: "User mismatch" }, { status: 403 });
  }

  if (!type || !date || !duration_minutes) {
    return NextResponse.json(
      { error: "type, date, and duration_minutes are required" },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("activities")
    .insert({
      user_id: userId,
      type: type as ActivityType,
      date,
      duration_minutes: Number(duration_minutes),
      notes: notes || null,
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, activity: data[0] },
    { status: 201 },
  );
}

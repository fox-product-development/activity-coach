// app/api/activity-types/route.ts
//
// GET — returns all activity types available to add (not already in user's list)
// POST — adds an activity to user's list (and activity_types if new)
// DELETE — removes from user's list, cleans up activity_types if no other users have it

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const supabase = createServerSupabaseClient();

    // Get user's current activities
    const { data: userActivities } = await supabase
      .from("user_activities")
      .select("activity_type")
      .eq("user_id", user.id);

    const userActivityKeys = userActivities?.map((a) => a.activity_type) || [];

    // Get all activity types not already in user's list
    const { data: availableTypes, error } = await supabase
      .from("activity_types")
      .select("*")
      .not(
        "type_key",
        "in",
        `(${userActivityKeys.map((k) => `"${k}"`).join(",")})`,
      )
      .order("name", { ascending: true });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    // Also return user's current activities with full details
    const { data: currentTypes } = await supabase
      .from("activity_types")
      .select("*")
      .in("type_key", userActivityKeys.length > 0 ? userActivityKeys : ["none"])
      .order("name", { ascending: true });

    return NextResponse.json({
      available: availableTypes || [],
      current: currentTypes || [],
    });
  } catch (err) {
    console.error("Activity types GET error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await request.json();
    const { type_key, name, is_outdoor, emoji } = body;

    if (!type_key || !name) {
      return NextResponse.json(
        { error: "type_key and name are required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    // If it's a custom activity, add to activity_types first
    const { data: existing } = await supabase
      .from("activity_types")
      .select("id")
      .eq("type_key", type_key)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("activity_types").insert({
        name,
        type_key,
        is_outdoor: is_outdoor || false,
        emoji: emoji || "🏃",
      });
    }

    // Add to user's activities
    const { error } = await supabase
      .from("user_activities")
      .upsert(
        { user_id: user.id, activity_type: type_key, enabled: true },
        { onConflict: "user_id,activity_type" },
      );

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Activity types POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await request.json();
    const { type_key } = body;

    if (!type_key) {
      return NextResponse.json(
        { error: "type_key is required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    // Remove from user's activities
    const { error } = await supabase
      .from("user_activities")
      .delete()
      .eq("user_id", user.id)
      .eq("activity_type", type_key);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    // Check if any other users have this activity
    const { data: otherUsers } = await supabase
      .from("user_activities")
      .select("user_id")
      .eq("activity_type", type_key)
      .limit(1);

    // If no other users have it, remove from activity_types
    if (!otherUsers || otherUsers.length === 0) {
      await supabase.from("activity_types").delete().eq("type_key", type_key);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Activity types DELETE error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  ActivityType,
  getServerUser,
} from "@/lib/supabase";
import { extractActivityFromImage } from "@/lib/activities";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const supabase = createServerSupabaseClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgoStr)
      .order("date", { ascending: false });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const days: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = [];
    }

    for (const activity of data || []) {
      const key = activity.date.split("T")[0];
      if (days[key] !== undefined) {
        days[key].push(activity);
      }
    }

    return NextResponse.json({ days, activities: data });
  } catch (err) {
    console.error("Unexpected error:", err);
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
    const supabase = createServerSupabaseClient();

    if (body.imageBase64) {
      const extracted = await extractActivityFromImage(
        body.imageBase64,
        body.mediaType || "image/png",
      );

      const { data, error } = await supabase
        .from("activities")
        .insert({
          user_id: user.id,
          type: extracted.type as ActivityType,
          date: extracted.date,
          duration_minutes: extracted.duration_minutes,
          distance_km: extracted.distance_km,
          avg_heart_rate: extracted.avg_heart_rate,
          avg_pace: extracted.avg_pace,
          avg_speed_kmh: extracted.avg_speed_kmh,
          elevation_m: extracted.elevation_m,
          calories: extracted.calories,
          avg_power_w: extracted.avg_power_w,
          notes: extracted.ai_notes,
        })
        .select();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(
        { success: true, activity: data[0], extracted },
        { status: 201 },
      );
    }

    const { type, date, duration_minutes, notes, distance_km } = body;

    if (!type || !date || !duration_minutes) {
      return NextResponse.json(
        { error: "type, date, and duration_minutes are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("activities")
      .insert({
        user_id: user.id,
        type: type as ActivityType,
        date,
        duration_minutes: Number(duration_minutes),
        notes: notes || null,
        distance_km: distance_km ? Number(distance_km) : null,
      })
      .select();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
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

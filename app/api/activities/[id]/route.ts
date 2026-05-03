import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  ActivityType,
  getServerUser,
} from "@/lib/supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { type, date, duration_minutes, notes, distance_km } = body;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("activities")
      .update({
        type: type as ActivityType,
        date,
        duration_minutes: Number(duration_minutes),
        notes: notes || null,
        distance_km: distance_km ? Number(distance_km) : null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, activity: data[0] });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

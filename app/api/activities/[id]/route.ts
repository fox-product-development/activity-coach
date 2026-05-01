// app/api/activities/[id]/route.ts
//
// Handles updating and deleting a specific activity by ID.
// The [id] in the folder name is Next.js dynamic routing —
// visiting /api/activities/abc-123 passes "abc-123" as params.id

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, ActivityType } from "@/lib/supabase";

// -------------------------------------------------------------------------
// PUT /api/activities/[id]
// Update an existing activity
// -------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, activity: data[0] });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

// -------------------------------------------------------------------------
// DELETE /api/activities/[id]
// Delete an activity — requires confirmation from UI before calling
// -------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { error } = await supabase.from("activities").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

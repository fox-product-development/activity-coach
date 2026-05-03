import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const supabase = createServerSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("mood_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("log_date", { ascending: false })
      .limit(7);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

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

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await request.json();
    const { mood_score, energy_score, notes } = body;

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
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("mood_logs")
      .upsert(
        {
          user_id: user.id,
          log_date: today,
          mood_score: Number(mood_score),
          energy_score: Number(energy_score),
          notes: notes || null,
        },
        { onConflict: "user_id,log_date" },
      )
      .select();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
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

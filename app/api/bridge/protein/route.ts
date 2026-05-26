import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
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

  const supabase = createServerSupabaseClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("diet_logs")
    .select("log_date, protein_g")
    .eq("user_id", userId)
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ protein: data });
}

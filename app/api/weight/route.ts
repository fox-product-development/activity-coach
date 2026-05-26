import { NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase";

export async function GET() {
  const user = await getServerUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const isOwner = user.id === process.env.OWNER_USER_ID;

  // Owner: fetch from Gym App
  if (isOwner) {
    const gymApiUrl = process.env.GYM_APP_API_URL;
    const bridgeSecret = process.env.BRIDGE_SECRET;

    if (!gymApiUrl || !bridgeSecret) {
      return NextResponse.json({ weights: [], isOwner });
    }

    try {
      const res = await fetch(`${gymApiUrl}/bridge/weight`, {
        headers: { Authorization: `Bearer ${bridgeSecret}` },
        next: { revalidate: 0 },
      });

      if (!res.ok) return NextResponse.json({ weights: [], isOwner });

      const data = await res.json();

      const weights = Array.isArray(data)
        ? data.map((entry: any) => ({
            date: entry.date.split("T")[0],
            weight_kg: parseFloat(entry.weight_kg),
          }))
        : [];

      return NextResponse.json({ weights, isOwner });
    } catch {
      return NextResponse.json({ weights: [], isOwner });
    }
  }

  // Non-owner: read from diet_logs
  const supabase = createServerSupabaseClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const { data } = await supabase
    .from("diet_logs")
    .select("log_date, weight_kg")
    .eq("user_id", user.id)
    .not("weight_kg", "is", null)
    .gte("log_date", sevenDaysAgoStr)
    .order("log_date", { ascending: true });

  const weights = (data || []).map((row: any) => ({
    date: row.log_date,
    weight_kg: row.weight_kg,
  }));

  return NextResponse.json({ weights, isOwner });
}

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase";

export async function GET() {
  const user = await getServerUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const gymApiUrl = process.env.GYM_APP_API_URL;
  const bridgeSecret = process.env.BRIDGE_SECRET;

  if (!gymApiUrl || !bridgeSecret) {
    return NextResponse.json({ weights: [] });
  }

  try {
    const res = await fetch(`${gymApiUrl}/bridge/weight`, {
      headers: { Authorization: `Bearer ${bridgeSecret}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) return NextResponse.json({ weights: [] });

    const data = await res.json();
    return NextResponse.json({ weights: data });
  } catch {
    return NextResponse.json({ weights: [] });
  }
}

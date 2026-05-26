import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase";

export async function GET() {
  const user = await getServerUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const gymApiUrl = process.env.GYM_APP_API_URL;
  const bridgeSecret = process.env.BRIDGE_SECRET;

  if (!gymApiUrl || !bridgeSecret) {
    return NextResponse.json({
      error: "Missing env vars",
      hasGymApiUrl: !!gymApiUrl,
      hasBridgeSecret: !!bridgeSecret,
    });
  }

  try {
    const res = await fetch(`${gymApiUrl}/bridge/weight`, {
      headers: { Authorization: `Bearer ${bridgeSecret}` },
      next: { revalidate: 0 },
    });

    const responseText = await res.text();

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      gymApiUrl,
      responseText,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      gymApiUrl,
    });
  }
}

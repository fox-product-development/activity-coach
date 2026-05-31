import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase";
import { fetchGymContext } from "@/lib/gym-bridge";

export async function GET() {
  const user = await getServerUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const gymContext = await fetchGymContext();
    return NextResponse.json({
      gymContext,
      ownerUserIdSet: !!process.env.OWNER_USER_ID,
      isOwner: user.id === process.env.OWNER_USER_ID,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}

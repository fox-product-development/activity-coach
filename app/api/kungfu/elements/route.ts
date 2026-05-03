// app/api/kungfu/elements/route.ts
//
// Returns all kung fu elements from the database.
// Used by the home page to display the training guide.
// kung_fu_elements is shared across all users so no user_id filter needed.

import { NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("kung_fu_elements")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ elements: data });
  } catch (err) {
    console.error("Kung fu elements error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

// app/api/agent/today/route.ts

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("agent_suggestions")
      .select("suggestion_text, suggested_activity")
      .eq("suggestion_date", today)
      .limit(1);

    if (!data || data.length === 0) {
      return NextResponse.json({ motivation: null });
    }

    // Take the first sentence as the motivation line
    // Strip any **bold markers** and take the first sentence
    const cleanText = data[0].suggestion_text.replace(/\*\*(.*?)\*\*/g, "$1");
    const firstSentence = cleanText.split(".")[0] + ".";

    return NextResponse.json({ motivation: firstSentence });
  } catch (err) {
    console.error("Today route error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

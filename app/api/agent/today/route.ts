import { NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const supabase = createServerSupabaseClient();
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("agent_suggestions")
      .select(
        "suggestion_text, suggested_activity, kung_fu_suggestion, kung_fu_element",
      )
      .eq("user_id", user.id)
      .eq("suggestion_date", today)
      .limit(1);

    if (!data || data.length === 0) {
      return NextResponse.json({
        motivation: null,
        kung_fu_suggestion: null,
        kung_fu_element: null,
      });
    }

    const cleanText = data[0].suggestion_text.replace(/\*\*(.*?)\*\*/g, "$1");
    const firstSentence = cleanText.split(".")[0] + ".";

    return NextResponse.json({
      motivation: firstSentence,
      kung_fu_suggestion: data[0].kung_fu_suggestion || null,
      kung_fu_element: data[0].kung_fu_element || null,
    });
  } catch (err) {
    console.error("Today route error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

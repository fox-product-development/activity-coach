import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { sendSuggestionEmail } from "@/lib/email";
import { createServerSupabaseClient, getServerUser } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabaseClient();

    // Get all users from auth
    const {
      data: { users },
      error: usersError,
    } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    const { data: allowedUsers, error: allowedError } = await supabase
      .from("allowed_users")
      .select("email");

    if (allowedError) {
      console.error("Error fetching allowed users:", allowedError);
      return NextResponse.json(
        { error: "Failed to fetch allowed users" },
        { status: 500 },
      );
    }

    const allowedEmails = new Set(allowedUsers.map((u) => u.email));
    const filteredUsers = users.filter(
      (u) => u.email && allowedEmails.has(u.email),
    );

    const results = [];

    for (const user of users) {
      try {
        console.log("Running agent for user:", user.email);
        const result = await runAgent(user.id);

        await sendSuggestionEmail(result, user.email!);

        const today = new Date().toISOString().split("T")[0];
        await supabase
          .from("agent_suggestions")
          .update({ email_sent: true })
          .eq("user_id", user.id)
          .eq("suggestion_date", today);

        results.push({ user: user.email, success: true });
      } catch (err) {
        console.error("Error processing user:", user.email, err);
        results.push({ user: user.email, success: false });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Email route error:", err);
    return NextResponse.json(
      { error: "Failed to run agent or send email" },
      { status: 500 },
    );
  }
}

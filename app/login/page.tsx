"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const colours = {
  pageBg: "#FFFDF0",
  primary: "#F5C842",
  primaryLight: "#FEF9C3",
  primaryDark: "#92660A",
  border: "#F0D878",
  textMuted: "#888",
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "unauthorised") {
        return "You are not authorised to access this app.";
      }
    }
    return "";
  });

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 400,
        margin: "80px auto",
        padding: "0 20px",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          background: colours.pageBg,
          border: `1px solid ${colours.border}`,
          borderRadius: 16,
          padding: 40,
        }}
      >
        <h1 style={{ color: colours.primaryDark, marginBottom: 8 }}>
          ☀️ Activity Coach
        </h1>
        <p style={{ color: colours.textMuted, marginBottom: 32, fontSize: 14 }}>
          Sign in to access your personal activity coaching
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 24px",
            background: colours.primary,
            color: colours.primaryDark,
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "🔐 Sign in with Google"}
        </button>

        {error && (
          <p style={{ color: "#DC2626", fontSize: 13, marginTop: 16 }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

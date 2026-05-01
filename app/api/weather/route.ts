// app/api/weather/route.ts
//
// A simple GET endpoint that returns today's weather.
// The agent will call this when building its daily suggestion.
// We could call getWeather() directly in the agent, but having
// it as an API route makes it easy to test in the browser too.

import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";

export async function GET() {
  try {
    const weather = await getWeather();
    return NextResponse.json({ weather });
  } catch (err) {
    console.error("Weather fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 },
    );
  }
}

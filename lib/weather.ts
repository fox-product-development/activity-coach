// lib/weather.ts
//
// WHY THIS FILE EXISTS:
// We want weather data in a few places — the agent, possibly the UI later.
// Rather than writing the fetch logic multiple times, we write it once here
// and import it wherever we need it. Same reason supabase.ts lives in /lib.
//
// WHY OPEN-METEO:
// Free, no API key, no rate limit issues for personal use, and it returns
// everything we need — temperature, rain, wind, weather condition codes.

export type WeatherData = {
  temperature: number; // Current temperature in Celsius
  feels_like: number; // Feels like temperature
  rain_mm: number; // Rainfall in last hour (mm)
  wind_speed: number; // Wind speed in km/h
  weather_code: number; // WMO weather code (we'll decode this)
  description: string; // Human readable e.g. "Light rain"
  is_good_for_outdoors: boolean; // Simple flag the agent can use directly
};

// WMO weather codes → human readable descriptions
// Full list: https://open-meteo.com/en/docs#weathervariables
function decodeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Rain showers";
  if (code <= 94) return "Thunderstorm";
  return "Severe weather";
}

// A simple heuristic — is it reasonable to go outside?
// The agent will use this as a starting point, not a hard rule.
function isGoodForOutdoors(
  code: number,
  rain_mm: number,
  wind_speed: number,
): boolean {
  const badWeatherCode = code >= 50; // Anything from drizzle upward
  const heavyRain = rain_mm > 1;
  const tooWindy = wind_speed > 40;
  return !badWeatherCode && !heavyRain && !tooWindy;
}

export async function getWeather(): Promise<WeatherData> {
  const lat = process.env.NEXT_PUBLIC_USER_LATITUDE;
  const lon = process.env.NEXT_PUBLIC_USER_LONGITUDE;

  if (!lat || !lon) {
    throw new Error("User coordinates not set in .env.local");
  }

  // Open-Meteo API — we request exactly the fields we need
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,rain,wind_speed_10m,weather_code&wind_speed_unit=kmh`;

  const res = await fetch(url, {
    // Cache for 30 minutes — weather doesn't change that fast
    // and we don't want to hammer the API on every agent run
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  const json = await res.json();
  const current = json.current;

  const weather_code = current.weather_code;
  const rain_mm = current.rain;
  const wind_speed = current.wind_speed_10m;

  return {
    temperature: Math.round(current.temperature_2m),
    feels_like: Math.round(current.apparent_temperature),
    rain_mm,
    wind_speed,
    weather_code,
    description: decodeWeatherCode(weather_code),
    is_good_for_outdoors: isGoodForOutdoors(weather_code, rain_mm, wind_speed),
  };
}

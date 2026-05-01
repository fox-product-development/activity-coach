"use client";

import { useState, useEffect } from "react";
import { Activity, ActivityType, MoodLog } from "@/lib/supabase";

export default function Home() {
  // ACTIVITY FORM STATE
  const [type, setType] = useState<ActivityType>("running");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [distance, setDistance] = useState("");
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // MOOD FORM STATE
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [moodNotes, setMoodNotes] = useState("");
  const [moodSubmitting, setMoodSubmitting] = useState(false);
  const [moodMessage, setMoodMessage] = useState("");
  const [todayMood, setTodayMood] = useState<MoodLog | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    fetchMood();
  }, []);

  async function fetchActivities() {
    setActivitiesLoading(true);
    const res = await fetch("/api/activities");
    const data = await res.json();
    setActivities(data.activities || []);
    setActivitiesLoading(false);
  }

  async function fetchMood() {
    setMoodLoading(true);
    const res = await fetch("/api/mood");
    const data = await res.json();
    setTodayMood(data.todayLog);
    setMoodLoading(false);
  }

  async function handleActivitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setActivitySubmitting(true);
    setActivityMessage("");

    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        date,
        duration_minutes: duration,
        notes: notes || null,
        distance_km: distance || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setActivityMessage("✅ Activity logged!");
      setDuration("");
      setNotes("");
      setDistance("");
      fetchActivities();
    } else {
      setActivityMessage(`❌ Error: ${data.error}`);
    }

    setActivitySubmitting(false);
  }

  async function handleMoodSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMoodSubmitting(true);
    setMoodMessage("");

    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood_score: moodScore,
        energy_score: energyScore,
        notes: moodNotes || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMoodMessage("✅ Mood logged!");
      setMoodNotes("");
      fetchMood();
    } else {
      setMoodMessage(`❌ Error: ${data.error}`);
    }

    setMoodSubmitting(false);
  }

  const activityLabels: Record<ActivityType, string> = {
    running: "🏃 Running",
    cycling_indoor: "🚴 Cycling (Indoor)",
    cycling_outdoor: "🚴 Cycling (Outdoor)",
    fishing: "🎣 Fishing",
    kung_fu: "🥋 Kung Fu",
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function scoreLabel(score: number) {
    return ["", "😔", "😕", "😐", "🙂", "😄"][score];
  }

  function energyLabel(score: number) {
    return ["", "🪫", "😴", "⚡", "⚡⚡", "⚡⚡⚡"][score];
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "sans-serif",
      }}
    >
      <h1>Activity Coach</h1>

      {/* MOOD CHECK-IN */}
      <section>
        <h2>Today's Check-in</h2>

        {moodLoading ? (
          <p>Loading...</p>
        ) : todayMood ? (
          <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8 }}>
            <p style={{ margin: 0 }}>
              <strong>Mood:</strong> {scoreLabel(todayMood.mood_score)}{" "}
              {todayMood.mood_score}/5 &nbsp;|&nbsp;
              <strong>Energy:</strong> {energyLabel(todayMood.energy_score)}{" "}
              {todayMood.energy_score}/5
            </p>
            {todayMood.notes && (
              <p style={{ margin: "8px 0 0", color: "#555" }}>
                {todayMood.notes}
              </p>
            )}
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>
              You can update this by submitting again — it will overwrite
              today's log.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMoodSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label>
                <strong>Mood</strong> — how are you feeling?{" "}
                {scoreLabel(moodScore)}
                <br />
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={moodScore}
                  onChange={(e) => setMoodScore(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <small
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>😔 Bad</span>
                  <span>😄 Great</span>
                </small>
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>
                <strong>Energy</strong> — physical energy level{" "}
                {energyLabel(energyScore)}
                <br />
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={energyScore}
                  onChange={(e) => setEnergyScore(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <small
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>🪫 Exhausted</span>
                  <span>⚡ Energised</span>
                </small>
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>
                Notes — optional
                <br />
                <textarea
                  value={moodNotes}
                  onChange={(e) => setMoodNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. bad night's sleep, feeling motivated..."
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={moodSubmitting}
              style={{ padding: "10px 24px" }}
            >
              {moodSubmitting ? "Saving..." : "Log Check-in"}
            </button>

            {moodMessage && <p style={{ marginTop: 12 }}>{moodMessage}</p>}
          </form>
        )}
      </section>

      <hr style={{ margin: "32px 0" }} />

      {/* ACTIVITY LOGGING FORM */}
      <section>
        <h2>Log an Activity</h2>
        <form onSubmit={handleActivitySubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>
              Activity
              <br />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                style={{ width: "100%", padding: 8 }}
              >
                {Object.entries(activityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              Date
              <br />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              Duration (minutes)
              <br />
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
                required
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          {(type === "running" || type === "cycling_outdoor") && (
            <div style={{ marginBottom: 12 }}>
              <label>
                Distance (km) — optional
                <br />
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  step="0.1"
                  min={0}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label>
              Notes — optional
              <br />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={activitySubmitting}
            style={{ padding: "10px 24px" }}
          >
            {activitySubmitting ? "Saving..." : "Log Activity"}
          </button>

          {activityMessage && (
            <p style={{ marginTop: 12 }}>{activityMessage}</p>
          )}
        </form>
      </section>

      <hr style={{ margin: "32px 0" }} />

      {/* RECENT ACTIVITIES LIST */}
      <section>
        <h2>Recent Activities</h2>
        {activitiesLoading ? (
          <p>Loading...</p>
        ) : activities.length === 0 ? (
          <p>No activities logged yet. Add your first one above!</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {activities.map((activity) => (
              <li
                key={activity.id}
                style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}
              >
                <strong>{activityLabels[activity.type]}</strong> —{" "}
                {activity.duration_minutes} mins
                <br />
                <small>{formatDate(activity.date)}</small>
                {activity.distance_km && (
                  <span> · {activity.distance_km}km</span>
                )}
                {activity.notes && (
                  <p style={{ margin: "4px 0 0", color: "#555" }}>
                    {activity.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

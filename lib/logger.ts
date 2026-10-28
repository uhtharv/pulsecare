import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface LogEntry {
  id?: string;
  run_id: string;
  incident_id?: string | null;
  ts?: string;
  level: "info" | "warn" | "error";
  step?: string | null;
  event: string;
  status?: string | null;
  latency_ms?: number | null;
  request?: any;
  response?: any;
  error_code?: string | null;
  error_message?: string | null;
  attempt?: number;
}

// In-memory fallback log buffer (for offline tests or resilience)
const inMemoryLogs: LogEntry[] = [];

/**
 * Emits a structured log event to Supabase logs table and console.
 */
export async function logEvent(entry: LogEntry): Promise<LogEntry> {
  const completeEntry: LogEntry = {
    ...entry,
    ts: entry.ts || new Date().toISOString(),
    attempt: entry.attempt ?? 1,
  };

  // Always keep in memory buffer (latest 1000 items)
  inMemoryLogs.unshift(completeEntry);
  if (inMemoryLogs.length > 1000) {
    inMemoryLogs.pop();
  }

  // Console output for easy server debugging
  const tag = `[HealOps:${completeEntry.level.toUpperCase()}] [Step:${completeEntry.step || "system"}]`;
  if (completeEntry.level === "error") {
    console.error(tag, completeEntry.event, completeEntry.error_message || "");
  } else if (completeEntry.level === "warn") {
    console.warn(tag, completeEntry.event);
  } else {
    console.log(tag, completeEntry.event);
  }

  // Write to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabaseAdmin.from("logs").insert({
        run_id: completeEntry.run_id,
        incident_id: completeEntry.incident_id || null,
        level: completeEntry.level,
        step: completeEntry.step || null,
        event: completeEntry.event,
        status: completeEntry.status || null,
        latency_ms: completeEntry.latency_ms ?? null,
        request: completeEntry.request ? JSON.parse(JSON.stringify(completeEntry.request)) : null,
        response: completeEntry.response ? JSON.parse(JSON.stringify(completeEntry.response)) : null,
        error_code: completeEntry.error_code || null,
        error_message: completeEntry.error_message || null,
        attempt: completeEntry.attempt ?? 1,
        ts: completeEntry.ts,
      });

      if (error) {
        console.error("Failed to insert log into Supabase:", error.message);
      }
    } catch (err: any) {
      console.error("Exception writing log to Supabase:", err.message);
    }
  }

  return completeEntry;
}

/**
 * Retrieve recent in-memory logs (for local dev fallback).
 */
export function getInMemoryLogs(runId?: string): LogEntry[] {
  if (!runId) return [...inMemoryLogs];
  return inMemoryLogs.filter((l) => l.run_id === runId);
}


"use client";

import React, { useEffect, useState, useRef } from "react";
import { Terminal, ChevronDown, ChevronRight, Filter, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { LogEntry } from "@/lib/logger";

interface LogStreamProps {
  runId?: string;
  initialLogs?: LogEntry[];
}

export function LogStream({ runId, initialLogs = [] }: LogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [filterLevel, setFilterLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync initialLogs
  useEffect(() => {
    if (initialLogs.length > 0) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  // Supabase Realtime Subscription + Polling Safety Net
  useEffect(() => {
    if (!runId) return;

    // 1. Initial fetch for this runId
    const fetchRunLogs = async () => {
      const { data } = await supabaseBrowser
        .from("logs")
        .select("*")
        .eq("run_id", runId)
        .order("ts", { ascending: true });

      if (data && data.length > 0) {
        setLogs(data);
      }
    };

    fetchRunLogs();

    // 2. Realtime channel
    const channel = supabaseBrowser
      .channel(`logs-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "logs",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const newLog = payload.new as LogEntry;
          setLogs((prev) => {
            if (prev.some((l) => l.id === newLog.id || (l.ts === newLog.ts && l.event === newLog.event))) {
              return prev;
            }
            return [...prev, newLog];
          });
        }
      )
      .subscribe();

    // 3. Polling safety net (every 2.5s)
    const pollInterval = setInterval(fetchRunLogs, 2500);

    return () => {
      supabaseBrowser.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [runId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === "all") return true;
    return log.level === filterLevel;
  });

  return (
    <div className="bg-surface-dark border border-[#2d2b27] rounded-lg overflow-hidden flex flex-col h-full min-h-[420px] shadow-sm font-mono text-xs text-on-dark">
      {/* Header & Filter Controls (Claude Code Window style) */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-dark-elevated border-b border-[#2d2b27]">
        <div className="flex items-center gap-2.5 text-on-dark">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="font-semibold text-xs tracking-wider">Live Pipeline Log Stream</span>
          <span className="px-2 py-0.5 rounded-pill text-[10px] bg-surface-dark border border-[#2d2b27] text-on-dark-soft">
            {filteredLogs.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Level Filter */}
          <div className="flex items-center rounded-md bg-surface-dark border border-[#2d2b27] p-0.5 text-[11px]">
            {(["all", "info", "warn", "error"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-0.5 rounded capitalize transition-all ${
                  filterLevel === lvl
                    ? lvl === "error"
                      ? "bg-semantic-error/25 text-[#f0aaaa] font-semibold"
                      : lvl === "warn"
                      ? "bg-accent-amber/25 text-[#e8a55a] font-semibold"
                      : "bg-primary/25 text-primary font-semibold"
                    : "text-on-dark-soft hover:text-on-dark"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-md text-[10px] border transition-all ${
              autoScroll
                ? "bg-semantic-success/20 text-[#a2e0b5] border-semantic-success/30 font-medium"
                : "bg-surface-dark text-on-dark-soft border-[#2d2b27]"
            }`}
          >
            Auto-scroll {autoScroll ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-1.5 min-h-[300px] max-h-[500px]">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-on-dark-soft">
            No logs captured yet. Execute an action to stream events live.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const logKey = log.id || `${log.ts}-${idx}`;
            const isExpanded = expandedLogId === logKey;
            const hasPayload = Boolean(log.request || log.response || log.error_message);

            return (
              <div
                key={logKey}
                className={`rounded-md border transition-all ${
                  log.level === "error"
                    ? "bg-[#291717] border-[#4d2424] text-[#f2b8b8]"
                    : log.level === "warn"
                    ? "bg-[#292217] border-[#4d3d24] text-[#f2d8b8]"
                    : "bg-surface-dark-soft border-[#2d2b27] text-on-dark hover:border-[#3d3a35]"
                }`}
              >
                <div
                  onClick={() => hasPayload && setExpandedLogId(isExpanded ? null : logKey)}
                  className={`flex items-center gap-2 p-2 ${hasPayload ? "cursor-pointer select-none" : ""}`}
                >
                  {hasPayload && (
                    <span className="text-on-dark-soft">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  )}

                  {/* Level Icon */}
                  {log.level === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-semantic-error flex-shrink-0" />
                  ) : log.level === "warn" ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  )}

                  {/* Timestamp */}
                  <span className="text-[10px] text-on-dark-soft">
                    {log.ts ? new Date(log.ts).toLocaleTimeString() : "--:--:--"}
                  </span>

                  {/* Step Badge */}
                  {log.step && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-dark-elevated text-primary font-semibold border border-[#2d2b27]">
                      {log.step}
                    </span>
                  )}

                  {/* Event Name */}
                  <span className="font-semibold text-on-dark">{log.event}</span>

                  {/* Latency if any */}
                  {log.latency_ms !== null && log.latency_ms !== undefined && (
                    <span className="text-[10px] text-on-dark-soft">({log.latency_ms}ms)</span>
                  )}

                  {/* Error code tag */}
                  {log.error_code && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-pill bg-semantic-error/20 text-semantic-error border border-semantic-error/30 font-semibold">
                      {log.error_code}
                    </span>
                  )}
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && hasPayload && (
                  <div className="p-3 pt-1 border-t border-[#2d2b27] bg-[#141311] text-[11px] space-y-2">
                    {log.error_message && (
                      <div className="text-[#f2b8b8] bg-[#291717] p-2.5 rounded border border-[#4d2424]">
                        {log.error_message}
                      </div>
                    )}
                    {log.request && (
                      <div>
                        <div className="text-on-dark-soft mb-1 text-[10px]">Request Payload:</div>
                        <pre className="p-2.5 rounded bg-surface-dark border border-[#2d2b27] text-on-dark overflow-x-auto max-h-36">
                          {JSON.stringify(log.request, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.response && (
                      <div>
                        <div className="text-on-dark-soft mb-1 text-[10px]">Response Body:</div>
                        <pre className="p-2.5 rounded bg-surface-dark border border-[#2d2b27] text-on-dark overflow-x-auto max-h-36">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

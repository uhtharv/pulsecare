"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, FileText, CheckCircle2, AlertTriangle, ArrowUpRight, ShieldAlert } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { ClaudeSpikeMark } from "@/components/ClaudeSpikeMark";

export default function IncidentsJournalPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIncidents() {
      const { data } = await supabaseBrowser
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setIncidents(data);
      setLoading(false);
    }
    loadIncidents();
  }, []);

  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      (inc.incident_code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.failed_step || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.error_code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.diagnosis?.category || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOutcome = outcomeFilter === "all" || inc.outcome === outcomeFilter;
    return matchesSearch && matchesOutcome;
  });

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-5">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="p-2.5 rounded-md bg-canvas border border-hairline hover:bg-surface-card text-muted hover:text-ink transition-all shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-serif text-2xl font-normal text-ink tracking-tight flex items-center gap-2">
                <ClaudeSpikeMark className="w-4 h-4 text-primary" />
                Root-Cause & Post-Mortem Journal
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Audit trail of all detected pipeline failures, autonomous patches, and post-mortems
              </p>
            </div>
          </div>

          <Link
            href="/metrics"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-canvas border border-hairline text-ink hover:bg-surface-card transition-all shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
          >
            <span>View Metrics Dashboard</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
          </Link>
        </div>

        {/* Filter Controls (Claude category-tab tokens) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-card border border-hairline p-3 rounded-lg shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted-soft absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, step, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-canvas border border-hairline rounded-md pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted">Filter Outcome:</span>
            <div className="flex items-center bg-surface-soft border border-hairline rounded-md p-0.5 text-xs">
              {["all", "healed", "escalated", "failed"].map((out) => (
                <button
                  key={out}
                  onClick={() => setOutcomeFilter(out)}
                  className={`px-3 py-1 rounded-md capitalize transition-all font-medium ${
                    outcomeFilter === out
                      ? "bg-canvas text-ink font-semibold border border-hairline shadow-[0_1px_1px_rgba(20,20,19,0.05)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {out}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Incidents Table */}
        <div className="bg-canvas border border-hairline rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(20,20,19,0.04)]">
          {loading ? (
            <div className="p-16 text-center text-muted-soft text-xs">Loading incident journal...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-muted-soft text-xs">No incidents found matching criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-body font-mono">
                <thead className="bg-surface-soft text-[11px] uppercase tracking-wider text-muted border-b border-hairline font-sans">
                  <tr>
                    <th className="py-3 px-4 font-medium">Incident</th>
                    <th className="py-3 px-4 font-medium">Outcome</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Step</th>
                    <th className="py-3 px-4 font-medium">Risk</th>
                    <th className="py-3 px-4 font-medium">Resolution</th>
                    <th className="py-3 px-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft font-sans">
                  {filtered.map((inc) => {
                    const outcome = inc.outcome || inc.status;
                    return (
                      <tr key={inc.id} className="hover:bg-surface-soft/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-ink font-mono flex items-center gap-2">
                          {inc.incident_code || "INC-xxx"}
                          {inc.used_memory && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-pill bg-accent-teal/15 text-[#2c7769] font-sans font-medium">
                              Memory
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-pill text-[10px] font-semibold uppercase ${
                              outcome === "healed"
                                ? "bg-semantic-success/15 text-[#246736] border border-semantic-success/20"
                                : outcome === "escalated"
                                ? "bg-semantic-error/15 text-semantic-error border border-semantic-error/25"
                                : "bg-accent-amber/20 text-[#854b14] border border-accent-amber/30"
                            }`}
                          >
                            {outcome}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-ink font-medium">
                          {inc.diagnosis?.category || "anomaly"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-primary">{inc.failed_step || "crm_create"}</td>
                        <td className="py-3.5 px-4 font-mono">
                          <span
                            className={
                              (inc.risk?.score || 0) >= 60
                                ? "text-semantic-error font-semibold"
                                : (inc.risk?.score || 0) >= 30
                                ? "text-[#854b14] font-semibold"
                                : "text-semantic-success font-semibold"
                            }
                          >
                            {inc.risk?.score ?? "N/A"}/100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-muted text-[11px]">
                          {inc.resolved_at
                            ? new Date(inc.resolved_at).toLocaleTimeString()
                            : "In progress"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/incidents/${inc.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-canvas hover:bg-surface-card border border-hairline text-ink text-xs transition-all shadow-[0_1px_1px_rgba(20,20,19,0.04)]"
                          >
                            <span>Post-Mortem</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

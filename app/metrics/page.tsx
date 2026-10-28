"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, Clock, ShieldCheck, Zap, TrendingDown, Cpu, BarChart3, AlertOctagon } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { ClaudeSpikeMark } from "@/components/ClaudeSpikeMark";

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/metrics");
      const json = await res.json();
      setMetrics(json);
    } catch (e) {
      console.error("Error fetching metrics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center">
        <Cpu className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const m = metrics || {};

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
                Autonomous Reliability & Metrics
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Real-time MTTR reduction, autonomous resolution rates, and operator safety analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Baseline assumption:</span>
            <span className="px-3 py-1 rounded-pill bg-surface-card border border-hairline text-xs font-mono text-ink">
              {m.manual_baseline_minutes || 20}m manual MTTR
            </span>
          </div>
        </div>

        {/* Primary Metric KPI Cards (Claude feature-card token: surface-card, rounded-lg, generous padding) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-muted mb-2 font-medium">
              <span>Mean Time to Detect</span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="font-serif text-3xl font-normal text-ink">{m.mttd_seconds || 0}s</div>
            <div className="text-[11px] text-accent-teal mt-1 font-medium">Real-time log evaluation</div>
          </div>

          <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-muted mb-2 font-medium">
              <span>Mean Time to Recover</span>
              <TrendingDown className="w-4 h-4 text-semantic-success" />
            </div>
            <div className="font-serif text-3xl font-normal text-semantic-success">{m.mttr_seconds || 0}s</div>
            <div className="text-[11px] text-muted mt-1">vs 20m manual baseline</div>
          </div>

          <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-muted mb-2 font-medium">
              <span>Auto-Heal Rate</span>
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="font-serif text-3xl font-normal text-primary">{m.auto_heal_rate || 0}%</div>
            <div className="text-[11px] text-muted mt-1">
              Assisted: {m.assisted_heal_rate || 0}% · Esc: {m.escalation_rate || 0}%
            </div>
          </div>

          <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
            <div className="flex items-center justify-between text-xs text-muted mb-2 font-medium">
              <span>Time Saved (Est.)</span>
              <Zap className="w-4 h-4 text-accent-amber" />
            </div>
            <div className="font-serif text-3xl font-normal text-[#9a5b1c]">{m.time_saved_hours || 0}h</div>
            <div className="text-[11px] text-muted mt-1">assumed manual baseline</div>
          </div>
        </div>

        {/* Secondary KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface-soft border border-hairline rounded-md p-3 text-center">
            <div className="text-[11px] text-muted font-medium">Total Incidents</div>
            <div className="text-base font-bold text-ink mt-0.5">{m.total_incidents || 0}</div>
          </div>
          <div className="bg-surface-soft border border-hairline rounded-md p-3 text-center">
            <div className="text-[11px] text-muted font-medium">First-Attempt Fix Rate</div>
            <div className="text-base font-bold text-semantic-success mt-0.5">{m.first_attempt_rate || 0}%</div>
          </div>
          <div className="bg-surface-soft border border-hairline rounded-md p-3 text-center">
            <div className="text-[11px] text-muted font-medium">Cluster Memory Hit Rate</div>
            <div className="text-base font-bold text-accent-teal mt-0.5">{m.memory_hit_rate || 0}%</div>
          </div>
          <div className="bg-surface-soft border border-hairline rounded-md p-3 text-center">
            <div className="text-[11px] text-muted font-medium">Avg Risk Score</div>
            <div className="text-base font-bold text-[#9a5b1c] mt-0.5">{m.avg_risk_score || 0}/100</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* MTTR Trend (Memory Effect Demonstration) */}
          <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base text-ink font-normal">MTTR Trend per Incident (Seconds)</h3>
                <p className="text-[11px] text-muted">Visualizes MTTR drop when cluster memory is reused</p>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-pill bg-canvas border border-hairline text-primary font-mono font-medium">
                Memory Effect
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              {m.mttr_trend && m.mttr_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.mttr_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd8" />
                    <XAxis dataKey="incident" stroke="#8e8b82" fontSize={10} />
                    <YAxis stroke="#8e8b82" fontSize={10} unit="s" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#181715",
                        borderColor: "#2d2b27",
                        color: "#faf9f5",
                        borderRadius: "8px",
                        fontSize: 11,
                      }}
                      labelStyle={{ color: "#a09d96" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mttr_seconds"
                      stroke="#cc785c"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#cc785c" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-soft">
                  Execute incident runs to display MTTR trends
                </div>
              )}
            </div>
          </div>

          {/* Incidents by Failure Category */}
          <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)] space-y-4">
            <div>
              <h3 className="font-serif text-base text-ink font-normal">Incidents by Anomaly Category</h3>
              <p className="text-[11px] text-muted">Distribution of diagnosed error classes</p>
            </div>

            <div className="h-64 w-full pt-2">
              {m.category_breakdown && m.category_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.category_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd8" />
                    <XAxis dataKey="category" stroke="#8e8b82" fontSize={10} />
                    <YAxis stroke="#8e8b82" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#181715",
                        borderColor: "#2d2b27",
                        color: "#faf9f5",
                        borderRadius: "8px",
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="count" fill="#5db8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-soft">
                  No categorical anomaly data recorded yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

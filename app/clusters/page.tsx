"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, Zap, CheckCircle2, RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { ClaudeSpikeMark } from "@/components/ClaudeSpikeMark";

export default function ClustersPage() {
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClusters = async () => {
    setLoading(true);
    const { data } = await supabaseBrowser
      .from("clusters")
      .select("*")
      .order("incident_count", { ascending: false });

    if (data) setClusters(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchClusters();
  }, []);

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
                Semantic Error Clusters & Historical Memory
              </h1>
              <p className="text-xs text-muted mt-0.5">
                pgvector 768-dim error embeddings, canonical fix library, and fast-path autonomous reuse
              </p>
            </div>
          </div>

          <button
            onClick={fetchClusters}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-canvas border border-hairline hover:bg-surface-card text-ink transition-all shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Clusters Grid */}
        {loading ? (
          <div className="p-20 text-center text-muted-soft text-xs space-y-2">
            <Cpu className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p>Loading cluster memory from vector database...</p>
          </div>
        ) : clusters.length === 0 ? (
          <div className="bg-surface-card border border-hairline rounded-lg p-16 text-center text-muted text-xs">
            No clusters indexed yet. Runs with similar errors will automatically cluster here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {clusters.map((cluster) => {
              const successRate =
                cluster.incident_count > 0
                  ? Math.round((cluster.heal_success_count / cluster.incident_count) * 100)
                  : 0;

              return (
                <div
                  key={cluster.id}
                  className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.04)] space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">
                          {cluster.cluster_code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-pill text-[10px] bg-canvas border border-hairline text-body font-medium">
                          {cluster.label || "Error Pattern"}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-pill text-xs font-medium bg-semantic-success/15 text-[#246736] border border-semantic-success/20">
                        {successRate}% Heal Success
                      </span>
                    </div>

                    {/* Stats Pill */}
                    <div className="flex items-center gap-4 text-xs text-muted pt-0.5">
                      <div>
                        Seen: <span className="font-semibold text-ink">{cluster.incident_count}x</span>
                      </div>
                      <div>
                        Healed: <span className="font-semibold text-semantic-success">{cluster.heal_success_count}x</span>
                      </div>
                    </div>

                    {/* Signature in Claude Dark Product Surface */}
                    <div className="text-[11px] font-mono text-on-dark bg-surface-dark p-3 rounded-md border border-[#2d2b27] break-all">
                      {cluster.signature || "Normalized error signature"}
                    </div>
                  </div>

                  {/* Canonical Fix Ops (Claude Code Window) */}
                  {cluster.canonical_fix ? (
                    <div className="pt-2.5 border-t border-hairline">
                      <div className="text-[11px] font-medium text-muted mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-semantic-success" />
                        Canonical Patch (Fast-Path Reusable):
                      </div>
                      <pre className="text-[10px] font-mono text-[#e8a55a] bg-surface-dark p-2.5 rounded-md border border-[#2d2b27] overflow-x-auto max-h-32">
                        {JSON.stringify(cluster.canonical_fix, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-soft italic pt-1">
                      No canonical patch stored yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

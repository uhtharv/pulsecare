"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, RotateCcw, FileText, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { ClaudeSpikeMark } from "@/components/ClaudeSpikeMark";

export default function IncidentDetailPage() {
  const params = useParams();
  const incidentId = params?.id as string;

  const [incident, setIncident] = useState<any>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);

  useEffect(() => {
    if (!incidentId) return;

    async function loadData() {
      // 1. Fetch incident record
      const { data: inc } = await supabaseBrowser
        .from("incidents")
        .select("*")
        .eq("id", incidentId)
        .single();

      if (inc) setIncident(inc);

      // 2. Fetch or generate postmortem
      try {
        const res = await fetch(`/api/incidents/${incidentId}/postmortem`);
        const json = await res.json();
        if (json.markdown) {
          setMarkdown(json.markdown);
        }
      } catch (e) {
        console.error("Error loading postmortem:", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [incidentId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/postmortem`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.markdown) {
        setMarkdown(json.markdown);
      }
    } catch (e) {
      console.error("Error regenerating postmortem:", e);
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadMd = () => {
    const filename = `${incident?.incident_code || "INCIDENT"}-postmortem.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-5">
          <div className="flex items-center gap-3.5">
            <Link
              href="/incidents"
              className="p-2.5 rounded-md bg-canvas border border-hairline hover:bg-surface-card text-muted hover:text-ink transition-all shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-primary uppercase tracking-wider">
                  Post-Mortem Report
                </span>
                <span className="text-muted-soft">&bull;</span>
                <span className="font-mono text-xs text-muted">{incident?.incident_code || incidentId}</span>
              </div>
              <h1 className="font-serif text-2xl font-normal text-ink mt-0.5 tracking-tight">
                {incident?.diagnosis?.category
                  ? `Root-Cause Analysis: ${incident.diagnosis.category.toUpperCase()}`
                  : "Incident Remediation Post-Mortem"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-canvas border border-hairline hover:bg-surface-card text-ink transition-all disabled:opacity-50 shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin text-primary" : ""}`} />
              <span>Regenerate</span>
            </button>
            <button
              onClick={handleDownloadMd}
              disabled={!markdown}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-primary hover:bg-primary-active text-on-primary transition-all disabled:bg-primary-disabled disabled:text-muted shadow-[0_1px_2px_rgba(204,120,92,0.3)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>
          </div>
        </div>

        {/* Content Area: Claude code-window-card / dark product surface */}
        {loading ? (
          <div className="bg-surface-card border border-hairline rounded-lg p-16 text-center text-muted-soft text-xs space-y-2">
            <Cpu className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p>Generating autonomous post-mortem report...</p>
          </div>
        ) : (
          <div className="bg-surface-dark border border-[#2d2b27] rounded-lg p-6 md:p-8 shadow-sm">
            {/* Window Chrome Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2d2b27] text-xs text-on-dark-soft">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#cc785c]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e8a55a]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#5db8a6]" />
                <span className="ml-2 font-mono text-[11px] text-on-dark">
                  {incident?.incident_code || "INCIDENT"}.md
                </span>
              </div>
              <span className="text-[11px] font-mono text-on-dark-soft">RFC 6902 Post-Mortem Audit</span>
            </div>

            <pre className="whitespace-pre-wrap font-mono text-xs md:text-sm text-on-dark leading-relaxed overflow-x-auto selection:bg-primary/30">
              {markdown}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

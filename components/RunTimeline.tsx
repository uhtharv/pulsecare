"use client";

import React from "react";
import { CheckCircle2, XCircle, Loader2, Circle, ArrowRight } from "lucide-react";

interface RunTimelineProps {
  runCode?: string;
  status: string;
  completedSteps: string[];
  failedStep?: string | null;
  attempt?: number;
}

const STEPS = [
  { id: "ingest", title: "1. Ingest", desc: "Sanity & Schema Shape" },
  { id: "crm_create", title: "2. CRM Create", desc: "Strict Contract Validation" },
  { id: "send_welcome_email", title: "3. Email Dispatch", desc: "Transactional Send" },
  { id: "slack_notify", title: "4. Slack Notify", desc: "Team Channel Alert" },
];

export function RunTimeline({
  runCode = "RUN-IDLE",
  status = "idle",
  completedSteps = [],
  failedStep = null,
  attempt = 1,
}: RunTimelineProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "succeeded":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-semantic-success/15 text-[#246736] border border-semantic-success/20 uppercase">Succeeded</span>;
      case "recovered":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25 uppercase">Self-Healed</span>;
      case "failed":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-semantic-error/15 text-semantic-error border border-semantic-error/25 uppercase">Failed</span>;
      case "healing":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-accent-amber/20 text-[#854b14] border border-accent-amber/30 uppercase animate-pulse">Healing</span>;
      case "awaiting_approval":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-accent-amber/25 text-[#733e08] border border-accent-amber/35 uppercase">Awaiting Sign-off</span>;
      case "escalated":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-semantic-error/15 text-semantic-error border border-semantic-error/25 uppercase">Escalated</span>;
      case "running":
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25 uppercase animate-pulse">Running</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-semibold bg-surface-card border border-hairline text-muted uppercase">Idle</span>;
    }
  };

  return (
    <div className="bg-surface-card border border-hairline rounded-lg p-4 shadow-[0_1px_2px_rgba(20,20,19,0.03)] space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-ink">{runCode}</span>
          {getStatusBadge()}
        </div>
        <div className="text-xs text-muted">
          Attempt: <span className="font-mono text-primary font-semibold">{attempt}</span>
        </div>
      </div>

      {/* Stepper Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isFailed = failedStep === step.id;
          const isRunning = status === "running" && !isCompleted && !isFailed && (idx === 0 || completedSteps.includes(STEPS[idx - 1].id));

          return (
            <div
              key={step.id}
              className={`p-3 rounded-md border flex flex-col justify-between transition-all ${
                isCompleted
                  ? "bg-canvas border-hairline text-ink"
                  : isFailed
                  ? "bg-[#fdf4f4] border-semantic-error/40 text-semantic-error"
                  : isRunning
                  ? "bg-primary/10 border-primary/30 text-ink"
                  : "bg-surface-soft border-hairline-soft text-muted-soft"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium tracking-normal">{step.title}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-semantic-success" />
                ) : isFailed ? (
                  <XCircle className="w-4 h-4 text-semantic-error" />
                ) : isRunning ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-soft" />
                )}
              </div>
              <div className="text-[10px] text-muted leading-tight">{step.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

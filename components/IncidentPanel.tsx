"use client";

import React from "react";
import { AlertCircle, CheckCircle2, ShieldCheck, Cpu, ArrowRight, Zap, FileText } from "lucide-react";
import { RiskGauge } from "./RiskGauge";
import { PatchDiff } from "./PatchDiff";
import { ValidationChecklist } from "./ValidationChecklist";
import { ApprovalCard } from "./ApprovalCard";
import { DiagnosisResult } from "@/lib/diagnose";
import { PatchProposal } from "@/lib/patch-guard";
import { RiskEvaluation } from "@/lib/risk";
import { ValidationItem } from "@/lib/validate";
import { ClaudeSpikeMark } from "./ClaudeSpikeMark";

interface IncidentPanelProps {
  incident: any;
  currentPayload: Record<string, any>;
  originalPayload: Record<string, any>;
  onDecision: (decision: "approve" | "reject" | "edit", patch?: PatchProposal, note?: string) => Promise<void>;
  onOpenPostmortem?: (incidentId: string) => void;
}

export function IncidentPanel({
  incident,
  currentPayload,
  originalPayload,
  onDecision,
  onOpenPostmortem,
}: IncidentPanelProps) {
  if (!incident) {
    return (
      <div className="bg-surface-card border border-hairline rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[380px] text-muted-soft">
        <ClaudeSpikeMark className="w-8 h-8 mb-3 text-muted" />
        <h4 className="font-serif text-sm font-normal text-ink">Autonomous Incident Cockpit Idle</h4>
        <p className="text-xs text-muted max-w-xs mt-1 leading-relaxed">
          When an anomaly or contract violation is detected, AI diagnosis, risk scoring, patch diffs, and validation
          will stream live here.
        </p>
      </div>
    );
  }

  const diagnosis: DiagnosisResult | undefined = incident.diagnosis;
  const patch: PatchProposal | undefined = incident.patch;
  const risk: RiskEvaluation | undefined = incident.risk;
  const validationChecks: ValidationItem[] = incident.validation || [];
  const status: string = incident.status || "detected";
  const outcome: string = incident.outcome;
  const isAwaitingApproval = status === "awaiting_approval";

  return (
    <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_3px_rgba(20,20,19,0.04)] space-y-4 overflow-y-auto max-h-[85vh]">
      {/* Incident Header */}
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-ink">
              {incident.incident_code || "INC-LIVE"}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-pill text-[10px] font-semibold uppercase ${
                status === "healed" || outcome === "healed"
                  ? "bg-semantic-success/15 text-[#246736] border border-semantic-success/20"
                  : status === "escalated" || outcome === "escalated"
                  ? "bg-semantic-error/15 text-semantic-error border border-semantic-error/25"
                  : status === "awaiting_approval"
                  ? "bg-accent-amber/20 text-[#854b14] border border-accent-amber/30 animate-pulse"
                  : "bg-primary/15 text-primary border border-primary/25"
              }`}
            >
              {status}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Failed Step: <span className="font-mono text-primary font-medium">{incident.failed_step || "crm_create"}</span> · Code:{" "}
            <span className="font-mono text-semantic-error font-medium">{incident.error_code || "ERROR"}</span>
          </p>
        </div>

        {/* Post-Mortem Quick Button */}
        {(status === "healed" || status === "escalated" || outcome) && (
          <button
            onClick={() => onOpenPostmortem && onOpenPostmortem(incident.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas hover:bg-surface-soft text-ink border border-hairline transition-all shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span>Post-Mortem</span>
          </button>
        )}
      </div>

      {/* Memory Fast-Path Badge (F8) */}
      {incident.used_memory && (
        <div className="flex items-center gap-2.5 p-3 bg-accent-teal/10 border border-accent-teal/30 rounded-md text-xs text-[#256f61]">
          <Zap className="w-4 h-4 text-accent-teal flex-shrink-0" />
          <span>
            <strong>Historical Memory Hit:</strong> Canonical fix from error cluster was verified and reused. Fast-path healing engaged!
          </span>
        </div>
      )}

      {/* AI Diagnosis Card (F3) */}
      {diagnosis && (
        <div className="bg-canvas border border-hairline rounded-lg p-4 space-y-2.5 shadow-[0_1px_2px_rgba(20,20,19,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              LLM Root Cause Diagnosis
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted">
                Confidence: {Math.round(diagnosis.confidence * 100)}%
              </span>
              <span className="px-2 py-0.5 rounded-pill text-[10px] font-semibold uppercase bg-surface-card text-ink border border-hairline">
                {diagnosis.category}
              </span>
            </div>
          </div>

          <h4 className="font-serif text-sm font-normal text-ink">{diagnosis.root_cause}</h4>
          <p className="text-xs text-body leading-relaxed">{diagnosis.explanation}</p>

          {/* Evidence Snippets */}
          {diagnosis.evidence && diagnosis.evidence.length > 0 && (
            <div className="p-2.5 bg-surface-soft rounded-md border border-hairline text-[11px] text-body space-y-1">
              <div className="font-medium text-ink">Evidence Cited:</div>
              {diagnosis.evidence.map((ev, i) => (
                <div key={i} className="font-mono text-semantic-error">
                  &bull; {ev}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approval Gate Card (F5) */}
      {isAwaitingApproval && patch && risk && (
        <ApprovalCard
          incidentId={incident.id}
          patch={patch}
          riskScore={risk.score}
          onDecision={onDecision}
        />
      )}

      {/* Risk Gauge & Blast Radius (F7) */}
      {risk && <RiskGauge risk={risk} />}

      {/* RFC 6902 Patch Diff (F4) */}
      {patch && Array.isArray(patch.ops) && patch.ops.length > 0 && (
        <PatchDiff
          originalPayload={originalPayload}
          currentPayload={currentPayload}
          ops={patch.ops}
          rationale={patch.rationale}
          expectedOutcome={patch.expected_outcome}
        />
      )}

      {/* 5-Step Recovery Validation Checklist (F6) */}
      {validationChecks.length > 0 && (
        <ValidationChecklist
          checks={validationChecks}
          allPassed={outcome === "healed"}
        />
      )}
    </div>
  );
}

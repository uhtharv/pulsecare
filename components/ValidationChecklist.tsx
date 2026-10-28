"use client";

import React from "react";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { ValidationItem } from "@/lib/validate";

interface ValidationChecklistProps {
  checks: ValidationItem[];
  allPassed?: boolean;
}

const DEFAULT_CHECKS: { id: string; title: string }[] = [
  { id: "contract_check", title: "CRM Contract Schema Validation" },
  { id: "dry_run", title: "Dry-Run Endpoint Verification (x-dry-run: true)" },
  { id: "real_retry", title: "Resumable Step Retry Execution" },
  { id: "downstream_check", title: "Downstream Steps Completion" },
  { id: "outcome_check", title: "Side-Effect & Idempotency Outcome Verification" },
];

export function ValidationChecklist({ checks = [], allPassed }: ValidationChecklistProps) {
  const mergedChecks = DEFAULT_CHECKS.map((def) => {
    const existing = checks.find((c) => c.id === def.id);
    return (
      existing || {
        id: def.id as any,
        title: def.title,
        passed: false,
        details: "Pending execution...",
      }
    );
  });

  return (
    <div className="bg-canvas border border-hairline rounded-lg p-4 shadow-[0_1px_2px_rgba(20,20,19,0.03)] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h4 className="font-serif text-sm font-normal text-ink">5-Point Recovery Checklist</h4>
        </div>
        {allPassed !== undefined && (
          <span
            className={`px-2.5 py-0.5 rounded-pill text-xs font-medium uppercase border ${
              allPassed
                ? "bg-semantic-success/15 text-[#246736] border-semantic-success/20"
                : "bg-semantic-error/15 text-semantic-error border-semantic-error/25"
            }`}
          >
            {allPassed ? "All Passed (5/5)" : "Checks Failed"}
          </span>
        )}
      </div>

      <div className="space-y-2 pt-1">
        {mergedChecks.map((check, idx) => (
          <div
            key={check.id}
            className={`flex items-start gap-3 p-3 rounded-md border transition-all ${
              check.passed
                ? "bg-surface-card border-hairline text-ink"
                : check.details && check.details !== "Pending execution..."
                ? "bg-[#fdf4f4] border-semantic-error/30 text-ink"
                : "bg-surface-soft border-hairline text-muted-soft"
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {check.passed ? (
                <CheckCircle2 className="w-4 h-4 text-semantic-success" />
              ) : check.details && check.details !== "Pending execution..." ? (
                <XCircle className="w-4 h-4 text-semantic-error" />
              ) : (
                <Clock className="w-4 h-4 text-muted-soft" />
              )}
            </div>

            <div className="flex-1 space-y-0.5">
              <div className="text-xs font-medium text-ink flex items-center justify-between">
                <span>
                  {idx + 1}. {check.title}
                </span>
                <span className="text-[10px] font-mono text-muted uppercase">
                  {check.passed ? "Verified" : check.details !== "Pending execution..." ? "Failed" : "Pending"}
                </span>
              </div>
              <div className="text-[11px] text-muted leading-tight font-mono">
                {check.details}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

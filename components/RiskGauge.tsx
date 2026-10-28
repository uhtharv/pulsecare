"use client";

import React from "react";
import { RiskEvaluation } from "@/lib/risk";

interface RiskGaugeProps {
  risk: RiskEvaluation;
}

export function RiskGauge({ risk }: RiskGaugeProps) {
  const { score, level, breakdown, blast_radius } = risk;

  const colorClass =
    level === "low"
      ? "text-[#246736] border-semantic-success/20 bg-semantic-success/15"
      : level === "medium"
      ? "text-[#854b14] border-accent-amber/30 bg-accent-amber/20"
      : "text-semantic-error border-semantic-error/30 bg-semantic-error/15";

  const barColor =
    level === "low"
      ? "bg-semantic-success"
      : level === "medium"
      ? "bg-accent-amber"
      : "bg-semantic-error";

  return (
    <div className="bg-canvas border border-hairline rounded-lg p-4 shadow-[0_1px_2px_rgba(20,20,19,0.03)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Risk & Blast Radius Assessment
          </span>
          <h4 className="font-serif text-sm font-normal text-ink mt-0.5">Automated Safety Score</h4>
        </div>
        <div className={`px-2.5 py-0.5 rounded-pill text-xs font-semibold uppercase border ${colorClass}`}>
          {level} Risk ({score}/100)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-soft border border-hairline h-2 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
        />
      </div>

      {/* Score Formula Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-2 border-t border-hairline">
        <div className="bg-surface-card p-2 rounded-md border border-hairline">
          <div className="text-[10px] text-muted font-medium">Field Sensitivity</div>
          <div className="font-serif text-sm font-normal text-ink mt-0.5">{breakdown.field_sensitivity}</div>
          <div className="text-[9px] text-muted-soft">Weight: 30%</div>
        </div>
        <div className="bg-surface-card p-2 rounded-md border border-hairline">
          <div className="text-[10px] text-muted font-medium">Change Mag.</div>
          <div className="font-serif text-sm font-normal text-ink mt-0.5">{breakdown.change_magnitude}</div>
          <div className="text-[9px] text-muted-soft">Weight: 25%</div>
        </div>
        <div className="bg-surface-card p-2 rounded-md border border-hairline">
          <div className="text-[10px] text-muted font-medium">Uncertainty</div>
          <div className="font-serif text-sm font-normal text-ink mt-0.5">{breakdown.uncertainty}</div>
          <div className="text-[9px] text-muted-soft">Weight: 20%</div>
        </div>
        <div className="bg-surface-card p-2 rounded-md border border-hairline">
          <div className="text-[10px] text-muted font-medium">Blast Norm</div>
          <div className="font-serif text-sm font-normal text-ink mt-0.5">{breakdown.blast_norm}</div>
          <div className="text-[9px] text-muted-soft">Weight: 15%</div>
        </div>
        <div className="bg-surface-card p-2 rounded-md border border-hairline">
          <div className="text-[10px] text-muted font-medium">Irreversibility</div>
          <div className="font-serif text-sm font-normal text-ink mt-0.5">{breakdown.irreversibility}</div>
          <div className="text-[9px] text-muted-soft">Weight: 10%</div>
        </div>
      </div>

      {/* Blast Radius Assessment */}
      {blast_radius && (
        <div className="mt-3 pt-2.5 border-t border-hairline flex flex-wrap items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-ink">Blast Radius:</span>
            <span>{blast_radius.affected_steps?.length || 0} downstream steps</span>
          </div>
          <div className="flex items-center gap-2">
            {blast_radius.side_effects?.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-pill bg-surface-card border border-hairline text-semantic-error font-medium">
                Side Effects: {blast_radius.side_effects.join(", ")}
              </span>
            )}
            {blast_radius.fields_changed?.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-pill bg-surface-card border border-hairline text-[#9a5b1c] font-medium">
                Fields: {blast_radius.fields_changed.join(", ")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

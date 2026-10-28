"use client";

import React from "react";
import { JSONPatchOp } from "@/lib/patch-guard";

interface PatchDiffProps {
  originalPayload: Record<string, any>;
  currentPayload: Record<string, any>;
  ops: JSONPatchOp[];
  rationale?: string;
  expectedOutcome?: string;
}

export function PatchDiff({
  originalPayload,
  currentPayload,
  ops,
  rationale,
  expectedOutcome,
}: PatchDiffProps) {
  return (
    <div className="bg-canvas border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.03)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            RFC 6902 Remediation Diff
          </span>
          <h4 className="font-serif text-sm font-normal text-ink mt-0.5">Automated Payload Patch</h4>
        </div>
        <div className="px-2.5 py-0.5 rounded-pill text-xs font-mono font-medium bg-surface-card text-ink border border-hairline">
          {ops.length} {ops.length === 1 ? "operation" : "operations"}
        </div>
      </div>

      {/* Rationale & Expected Outcome */}
      {(rationale || expectedOutcome) && (
        <div className="bg-surface-soft border border-hairline rounded-md p-3 text-xs space-y-1">
          {rationale && (
            <div>
              <span className="text-muted font-medium">Rationale: </span>
              <span className="text-ink">{rationale}</span>
            </div>
          )}
          {expectedOutcome && (
            <div>
              <span className="text-muted font-medium">Expected Outcome: </span>
              <span className="text-semantic-success font-medium">{expectedOutcome}</span>
            </div>
          )}
        </div>
      )}

      {/* Proposed Patch Operations */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted">Operations:</div>
        <div className="space-y-1">
          {ops.map((op, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-card rounded-md border border-hairline text-xs font-mono"
            >
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                  op.op === "move"
                    ? "bg-accent-amber/20 text-[#854b14]"
                    : op.op === "replace"
                    ? "bg-primary/20 text-primary"
                    : op.op === "add"
                    ? "bg-semantic-success/20 text-[#246736]"
                    : "bg-semantic-error/20 text-semantic-error"
                }`}
              >
                {op.op}
              </span>
              <span className="text-ink font-semibold">{op.path}</span>
              {op.from && (
                <>
                  <span className="text-muted-soft">&larr;</span>
                  <span className="text-muted">{op.from}</span>
                </>
              )}
              {op.value !== undefined && (
                <>
                  <span className="text-muted-soft">&rarr;</span>
                  <span className="text-[#a46820]">{JSON.stringify(op.value)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-side Payload Preview (Claude Code Windows in dark navy) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-hairline">
        <div>
          <div className="text-xs font-medium text-muted mb-1 flex items-center justify-between">
            <span>Failed Payload:</span>
            <span className="text-[10px] font-mono text-semantic-error">pre-patch</span>
          </div>
          <pre className="bg-surface-dark border border-[#2d2b27] rounded-md p-3 text-[11px] font-mono text-[#f0aaaa] overflow-x-auto max-h-48 leading-relaxed">
            {JSON.stringify(originalPayload, null, 2)}
          </pre>
        </div>
        <div>
          <div className="text-xs font-medium text-muted mb-1 flex items-center justify-between">
            <span>Patched Payload:</span>
            <span className="text-[10px] font-mono text-semantic-success">post-patch</span>
          </div>
          <pre className="bg-surface-dark border border-[#2d2b27] rounded-md p-3 text-[11px] font-mono text-[#a2e0b5] overflow-x-auto max-h-48 leading-relaxed">
            {JSON.stringify(currentPayload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

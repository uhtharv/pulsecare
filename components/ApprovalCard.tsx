"use client";

import React, { useState } from "react";
import { Check, X, Edit3, AlertTriangle, ShieldCheck } from "lucide-react";
import { JSONPatchOp, PatchProposal } from "@/lib/patch-guard";

interface ApprovalCardProps {
  incidentId: string;
  patch: PatchProposal;
  riskScore: number;
  onDecision: (decision: "approve" | "reject" | "edit", patch?: PatchProposal, note?: string) => Promise<void>;
}

export function ApprovalCard({
  incidentId,
  patch,
  riskScore,
  onDecision,
}: ApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOpsJson, setEditedOpsJson] = useState(JSON.stringify(patch.ops, null, 2));
  const [editError, setEditError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onDecision("approve", undefined, note);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onDecision("reject", undefined, note || "Rejected by operator");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    setEditError(null);
    let parsedOps: JSONPatchOp[];
    try {
      parsedOps = JSON.parse(editedOpsJson);
      if (!Array.isArray(parsedOps)) {
        throw new Error("Patch must be a valid JSON array of RFC 6902 operations");
      }
    } catch (e: any) {
      setEditError(`JSON Syntax Error: ${e.message}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onDecision("edit", {
        ops: parsedOps,
        rationale: note || "Customized by human operator",
        expected_outcome: "Manually edited and verified",
      });
      setIsEditing(false);
    } catch (err: any) {
      setEditError(err.message || "Failed to submit edited patch");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#fcf8f2] border-2 border-accent-amber/70 rounded-lg p-5 shadow-[0_1px_3px_rgba(20,20,19,0.06)] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-amber animate-pulse" />
          <h3 className="font-serif text-base font-normal text-ink">
            Approval Required: Risk Score {riskScore}/100
          </h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-pill text-[10px] font-mono font-semibold bg-accent-amber/20 text-[#854b14] border border-accent-amber/35 uppercase">
          Awaiting Operator Gate
        </span>
      </div>

      <p className="text-xs text-body leading-relaxed">
        This proposed patch exceeds the autonomous auto-apply threshold. The workflow has paused downstream
        execution until you review, edit, or reject the proposed modifications.
      </p>

      {/* Interactive Edit Area */}
      {isEditing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Edit RFC 6902 Patch Operations:</span>
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-muted hover:text-ink font-medium"
            >
              Cancel Edit
            </button>
          </div>
          <textarea
            value={editedOpsJson}
            onChange={(e) => setEditedOpsJson(e.target.value)}
            rows={6}
            className="w-full bg-surface-dark border border-[#2d2b27] rounded-md p-3 text-xs font-mono text-[#e8a55a] focus:outline-none focus:border-primary"
          />
          {editError && (
            <div className="text-xs text-semantic-error bg-semantic-error/10 border border-semantic-error/30 p-2 rounded">
              {editError}
            </div>
          )}
        </div>
      ) : null}

      {/* Operator Note */}
      <div>
        <input
          type="text"
          placeholder="Add an optional audit note for the post-mortem..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-xs text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-hairline">
        <button
          onClick={handleReject}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-semantic-error/15 hover:bg-semantic-error/25 text-semantic-error border border-semantic-error/30 transition-all disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reject & Escalate</span>
        </button>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-canvas hover:bg-surface-card text-ink border border-hairline transition-all disabled:opacity-50 shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 text-primary" />
            <span>Edit Patch</span>
          </button>
        ) : (
          <button
            onClick={handleSaveEdit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-primary hover:bg-primary-active text-on-primary transition-all disabled:opacity-50 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Edited Patch</span>
          </button>
        )}

        {!isEditing && (
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-primary hover:bg-primary-active text-on-primary shadow-[0_1px_2px_rgba(204,120,92,0.3)] transition-all disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve & Resume</span>
          </button>
        )}
      </div>
    </div>
  );
}

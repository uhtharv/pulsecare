import { NextRequest, NextResponse } from "next/server";
import { applyPatch } from "fast-json-patch";
import { guardPatchProposal } from "@/lib/patch-guard";
import { evaluateRisk } from "@/lib/risk";
import { runRecoveryValidation } from "@/lib/validate";
import { logEvent } from "@/lib/logger";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { decision, patch: editedPatch, note } = body;

    if (!["approve", "reject", "edit"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be one of: 'approve', 'reject', 'edit'" },
        { status: 400 }
      );
    }

    // 1. Fetch incident and associated workflow_run
    const { data: incident, error: incErr } = await supabaseAdmin
      .from("incidents")
      .select("*")
      .eq("id", incidentId)
      .single();

    if (incErr || !incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const { data: run, error: runErr } = await supabaseAdmin
      .from("workflow_runs")
      .select("*")
      .eq("id", incident.run_id)
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: "Workflow run not found" }, { status: 404 });
    }

    const currentAttempt = (run.attempt || 1) + 1;
    const currentPayload = run.current_payload || {};
    const chaos: string[] = run.chaos || [];
    const serviceFault = chaos.find((f) => ["auth_401", "upstream_500", "rate_limit_429"].includes(f)) || "";

    // 2. CASE: REJECT
    if (decision === "reject") {
      await supabaseAdmin
        .from("incidents")
        .update({
          status: "escalated",
          outcome: "escalated",
          resolved_at: new Date().toISOString(),
          approval: {
            mode: "manual",
            decision: "reject",
            decided_at: new Date().toISOString(),
            note: note || "Rejected by operator",
          },
        })
        .eq("id", incidentId);

      await supabaseAdmin
        .from("workflow_runs")
        .update({ status: "escalated" })
        .eq("id", run.id);

      await logEvent({
        run_id: run.id,
        incident_id: incidentId,
        level: "warn",
        event: "human_rejected_patch",
        error_message: note || "Operator rejected proposal. Escalating.",
        attempt: currentAttempt,
      });

      return NextResponse.json({
        status: "escalated",
        outcome: "escalated",
        message: "Patch proposal rejected by operator. Escalated.",
      });
    }

    // 3. CASE: EDIT or APPROVE
    let activePatch = incident.patch;
    let payloadToValidate = currentPayload;

    if (decision === "edit") {
      if (!editedPatch || !Array.isArray(editedPatch.ops)) {
        return NextResponse.json(
          { error: "Edited patch must include an 'ops' array" },
          { status: 400 }
        );
      }

      // Re-guardrail the human edit
      const guard = guardPatchProposal(editedPatch, currentPayload);
      if (!guard.valid) {
        return NextResponse.json(
          {
            error: `Edited patch failed guardrails: ${guard.errors.join("; ")}`,
            guard_errors: guard.errors,
          },
          { status: 422 }
        );
      }

      activePatch = editedPatch;

      // Re-evaluate risk
      const newRisk = evaluateRisk({
        ops: editedPatch.ops,
        confidence: incident.diagnosis?.confidence || 0.9,
        currentPayload,
        failedStep: incident.failed_step || "crm_create",
        completedSteps: run.completed_steps || [],
      });

      await supabaseAdmin
        .from("incidents")
        .update({
          patch: editedPatch,
          risk: newRisk,
        })
        .eq("id", incidentId);
    }

    // Apply the active patch ops to current payload
    if (activePatch && Array.isArray(activePatch.ops) && activePatch.ops.length > 0) {
      const payloadCopy = JSON.parse(JSON.stringify(currentPayload));
      const patchApp = applyPatch(payloadCopy, activePatch.ops as any, true, false);
      payloadToValidate = patchApp.newDocument;
    }

    // Record approval
    await supabaseAdmin
      .from("incidents")
      .update({
        status: "validating",
        approval: {
          mode: "manual",
          decision: decision === "edit" ? "edited_and_approved" : "approved",
          decided_at: new Date().toISOString(),
          note: note || null,
        },
      })
      .eq("id", incidentId);

    await logEvent({
      run_id: run.id,
      incident_id: incidentId,
      level: "info",
      event: decision === "edit" ? "patch_edited_and_approved" : "patch_approved_by_operator",
      attempt: currentAttempt,
    });

    // 4. Run Recovery Validation Checklist
    const validation = await runRecoveryValidation({
      runId: run.id,
      runCode: run.run_code,
      patchedPayload: payloadToValidate,
      failedStep: incident.failed_step || "crm_create",
      serviceFault,
      attempt: currentAttempt,
    });

    if (validation.allPassed) {
      await supabaseAdmin
        .from("incidents")
        .update({
          status: "healed",
          outcome: "healed",
          validation: validation.checks,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", incidentId);

      await logEvent({
        run_id: run.id,
        incident_id: incidentId,
        level: "info",
        event: "operator_recovery_successful",
        attempt: currentAttempt,
      });

      return NextResponse.json({
        status: "recovered",
        outcome: "healed",
        validation,
        message: "Operator approval applied successfully. Workflow healed and recovered!",
      });
    } else {
      await supabaseAdmin
        .from("incidents")
        .update({
          status: "failed",
          outcome: "failed",
          validation: validation.checks,
        })
        .eq("id", incidentId);

      return NextResponse.json({
        status: "failed",
        outcome: "failed",
        validation,
        message: `Validation failed: ${validation.failureMessage}`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process approval decision" }, { status: 500 });
  }
}

import { runDiagnosis, DiagnosisResult } from "./diagnose";
import { generatePayloadPatch, GeneratedPatchResult } from "./patch";
import { evaluateRisk, RiskEvaluation } from "./risk";
import { runRecoveryValidation, ValidationChecklistResult } from "./validate";
import { matchOrCreateCluster, recordClusterSuccess } from "./cluster";
import { generatePostmortem } from "./postmortem";
import { CRMContractSchema } from "./contract";
import { applyPatch } from "fast-json-patch";
import { logEvent } from "./logger";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface HealResult {
  run_id: string;
  incident_id: string;
  status: "recovered" | "awaiting_approval" | "escalated" | "failed";
  outcome?: "healed" | "escalated" | "failed";
  diagnosis?: DiagnosisResult;
  patch?: any;
  risk?: RiskEvaluation;
  validation?: ValidationChecklistResult;
  message?: string;
}

const AUTO_APPLY_THRESHOLD = parseInt(process.env.AUTO_APPLY_RISK_THRESHOLD || "30", 10);
const MAX_ATTEMPTS = parseInt(process.env.MAX_HEAL_ATTEMPTS || "3", 10);

/**
 * Executes the complete autonomous self-healing state machine.
 */
export async function orchestrateSelfHealing(params: {
  runId: string;
  incidentId: string;
  forceManual?: boolean;
}): Promise<HealResult> {
  const { runId, incidentId, forceManual = false } = params;

  // 1. Fetch current run and incident
  const { data: run, error: rErr } = await supabaseAdmin
    .from("workflow_runs")
    .select("*")
    .eq("id", runId)
    .single();

  const { data: incident, error: iErr } = await supabaseAdmin
    .from("incidents")
    .select("*")
    .eq("id", incidentId)
    .single();

  if (rErr || iErr || !run || !incident) {
    throw new Error(`Failed to load run or incident from Supabase: ${rErr?.message || iErr?.message}`);
  }

  const currentAttempt = (run.attempt || 1);
  const currentPayload = run.current_payload || {};
  const chaos: string[] = run.chaos || [];
  const serviceFault = chaos.find((f) => ["auth_401", "upstream_500", "rate_limit_429"].includes(f)) || "";

  // Check attempt exhaustion
  if (currentAttempt > MAX_ATTEMPTS) {
    await logEvent({
      run_id: runId,
      incident_id: incidentId,
      level: "error",
      event: "max_attempts_exceeded",
      error_message: `Max heal attempts (${MAX_ATTEMPTS}) reached. Escalating.`,
      attempt: currentAttempt,
    });

    await supabaseAdmin.from("incidents").update({ status: "escalated", outcome: "escalated" }).eq("id", incidentId);
    await supabaseAdmin.from("workflow_runs").update({ status: "escalated" }).eq("id", runId);

    return {
      run_id: runId,
      incident_id: incidentId,
      status: "escalated",
      outcome: "escalated",
      message: `Max heal attempts (${MAX_ATTEMPTS}) exceeded.`,
    };
  }

  // 2. DIAGNOSING
  await supabaseAdmin.from("workflow_runs").update({ status: "healing" }).eq("id", runId);
  await supabaseAdmin.from("incidents").update({ status: "diagnosing" }).eq("id", incidentId);

  await logEvent({
    run_id: runId,
    incident_id: incidentId,
    level: "info",
    event: "healing_diagnosing_started",
    attempt: currentAttempt,
  });

  const diagnosis = await runDiagnosis({
    runId,
    incidentId,
    failedStep: incident.failed_step || "crm_create",
    errorCode: incident.error_code || "UNKNOWN",
    errorMessage: incident.error_message || "Unknown error",
    requestPayload: currentPayload,
    responseBody: {},
  });

  // Safe failure: auth_failure or escalate action
  if (diagnosis.recommended_action === "escalate") {
    await logEvent({
      run_id: runId,
      incident_id: incidentId,
      level: "warn",
      event: "incident_escalated_by_policy",
      error_code: diagnosis.category,
      error_message: diagnosis.explanation,
      attempt: currentAttempt,
    });

    await supabaseAdmin
      .from("incidents")
      .update({
        status: "escalated",
        outcome: "escalated",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", incidentId);

    await supabaseAdmin.from("workflow_runs").update({ status: "escalated" }).eq("id", runId);

    return {
      run_id: runId,
      incident_id: incidentId,
      status: "escalated",
      outcome: "escalated",
      diagnosis,
      message: `Escalated: ${diagnosis.explanation}`,
    };
  }

  // 3. RETRY-ONLY ACTIONS (transient 500 or 429)
  if (diagnosis.recommended_action === "retry_with_backoff" || diagnosis.recommended_action === "wait_and_retry") {
    const risk = evaluateRisk({
      ops: [],
      confidence: diagnosis.confidence,
      currentPayload,
      failedStep: incident.failed_step || "crm_create",
      completedSteps: run.completed_steps || [],
      isRetryOnly: true,
    });

    await supabaseAdmin
      .from("incidents")
      .update({
        risk,
        approval: { mode: "auto", decision: "approve", decided_at: new Date().toISOString() },
        status: "validating",
      })
      .eq("id", incidentId);

    let validationResult: any = null;
    let attempt = currentAttempt;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const delay = diagnosis.retry_delay_ms || (attempt * 400);
      await new Promise((r) => setTimeout(r, Math.min(delay, 2500)));

      validationResult = await runRecoveryValidation({
        runId,
        runCode: run.run_code,
        patchedPayload: currentPayload,
        failedStep: incident.failed_step || "crm_create",
        serviceFault,
        attempt,
      });

      if (validationResult.allPassed) {
        break;
      }
    }

    if (validationResult && validationResult.allPassed) {
      await supabaseAdmin
        .from("incidents")
        .update({
          status: "healed",
          outcome: "healed",
          validation: validationResult.checks,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", incidentId);

      return {
        run_id: runId,
        incident_id: incidentId,
        status: "recovered",
        outcome: "healed",
        diagnosis,
        risk,
        validation: validationResult,
      };
    } else {
      await supabaseAdmin.from("incidents").update({ status: "failed", outcome: "failed", validation: validationResult?.checks }).eq("id", incidentId);
      await supabaseAdmin.from("workflow_runs").update({ status: "failed" }).eq("id", runId);
      return {
        run_id: runId,
        incident_id: incidentId,
        status: "failed",
        outcome: "failed",
        diagnosis,
        validation: validationResult,
      };
    }
  }

  // 3.5. SEMANTIC CLUSTERING & MEMORY FAST PATH (F8)
  const clusterMatch = await matchOrCreateCluster({
    incidentId,
    step: incident.failed_step || "crm_create",
    errorCode: incident.error_code || "UNKNOWN",
    errorMessage: incident.error_message || "",
    currentPayload,
  });

  let patchResult: GeneratedPatchResult | null = null;

  // Try fast path if cluster already has a canonical fix
  if (clusterMatch && clusterMatch.canonicalFix && Array.isArray(clusterMatch.canonicalFix.ops)) {
    try {
      const payloadCopy = JSON.parse(JSON.stringify(currentPayload));
      const testPatch = applyPatch(payloadCopy, clusterMatch.canonicalFix.ops as any, true, false);
      const zodCheck = CRMContractSchema.safeParse(testPatch.newDocument);

      if (zodCheck.success) {
        patchResult = {
          proposal: clusterMatch.canonicalFix,
          patchedPayload: testPatch.newDocument,
          guarded: true,
        };

        await supabaseAdmin
          .from("incidents")
          .update({
            used_memory: true,
            patch: clusterMatch.canonicalFix,
          })
          .eq("id", incidentId);

        await logEvent({
          run_id: runId,
          incident_id: incidentId,
          level: "info",
          event: "memory_fast_path_reused",
          response: { cluster: clusterMatch.clusterCode, ops: clusterMatch.canonicalFix.ops },
          attempt: currentAttempt,
        });
      }
    } catch (e: any) {
      console.warn("Fast path patch attempt failed, falling back to LLM patch:", e.message);
    }
  }

  // 4. PATCH_PROPOSED (if fast path wasn't engaged)
  if (!patchResult) {
    await logEvent({
      run_id: runId,
      incident_id: incidentId,
      level: "info",
      event: "healing_patch_proposing",
      attempt: currentAttempt,
    });

    patchResult = await generatePayloadPatch({
      incidentId,
      currentPayload,
      diagnosis,
    });
  }

  // 5. RISK_SCORED
  const risk = evaluateRisk({
    ops: patchResult.proposal.ops,
    confidence: diagnosis.confidence,
    currentPayload,
    failedStep: incident.failed_step || "crm_create",
    completedSteps: run.completed_steps || [],
  });

  await supabaseAdmin
    .from("incidents")
    .update({
      risk,
      status: "risk_scored",
    })
    .eq("id", incidentId);

  await logEvent({
    run_id: runId,
    incident_id: incidentId,
    level: "info",
    event: "risk_scored",
    response: { score: risk.score, level: risk.level },
    attempt: currentAttempt,
  });

  // 6. APPROVAL GATE
  const shouldAutoApprove =
    !forceManual &&
    risk.score < AUTO_APPLY_THRESHOLD &&
    diagnosis.confidence >= 0.85;

  if (!shouldAutoApprove) {
    // Pipeline pauses here, awaiting human decision
    await supabaseAdmin
      .from("workflow_runs")
      .update({ status: "awaiting_approval" })
      .eq("id", runId);

    await supabaseAdmin
      .from("incidents")
      .update({
        status: "awaiting_approval",
        approval: { mode: "manual", decision: "pending" },
      })
      .eq("id", incidentId);

    await logEvent({
      run_id: runId,
      incident_id: incidentId,
      level: "warn",
      event: "approval_gate_paused",
      response: { risk_score: risk.score, reason: forceManual ? "Forced manual toggle" : "Risk exceeded auto-apply threshold" },
      attempt: currentAttempt,
    });

    return {
      run_id: runId,
      incident_id: incidentId,
      status: "awaiting_approval",
      diagnosis,
      patch: patchResult.proposal,
      risk,
      message: "Paused at Approval Gate for operator sign-off.",
    };
  }

  // 7. AUTO-APPROVED: VALIDATING & RETRYING
  await supabaseAdmin
    .from("incidents")
    .update({
      approval: { mode: "auto", decision: "approve", decided_at: new Date().toISOString() },
      status: "validating",
    })
    .eq("id", incidentId);

  await logEvent({
    run_id: runId,
    incident_id: incidentId,
    level: "info",
    event: "patch_auto_approved",
    attempt: currentAttempt,
  });

  const validation = await runRecoveryValidation({
    runId,
    runCode: run.run_code,
    patchedPayload: patchResult.patchedPayload,
    failedStep: incident.failed_step || "crm_create",
    serviceFault,
    attempt: currentAttempt + 1,
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
      run_id: runId,
      incident_id: incidentId,
      level: "info",
      event: "incident_healed_successfully",
      attempt: currentAttempt,
    });

    if (clusterMatch?.clusterId && patchResult?.proposal) {
      recordClusterSuccess(clusterMatch.clusterId, patchResult.proposal);
    }
    generatePostmortem(incidentId).catch((err) => console.warn("Background postmortem error:", err));

    return {
      run_id: runId,
      incident_id: incidentId,
      status: "recovered",
      outcome: "healed",
      diagnosis,
      patch: patchResult.proposal,
      risk,
      validation,
      message: "Pipeline healed and recovered successfully!",
    };
  } else {
    // If validation fails (e.g. combo_fault needing second attempt)
    if (currentAttempt + 1 <= MAX_ATTEMPTS) {
      console.log(`Validation failed on attempt ${currentAttempt}, triggering multi-attempt heal...`);
      await supabaseAdmin
        .from("workflow_runs")
        .update({
          current_payload: patchResult.patchedPayload,
          attempt: currentAttempt + 1,
        })
        .eq("id", runId);

      await supabaseAdmin
        .from("incidents")
        .update({
          error_message: validation.failureMessage || "Validation failed on initial patch",
          attempts: currentAttempt + 1,
        })
        .eq("id", incidentId);

      return orchestrateSelfHealing({ runId, incidentId, forceManual });
    } else {
      await supabaseAdmin.from("incidents").update({ status: "failed", outcome: "failed", validation: validation.checks }).eq("id", incidentId);
      await supabaseAdmin.from("workflow_runs").update({ status: "failed" }).eq("id", runId);

      return {
        run_id: runId,
        incident_id: incidentId,
        status: "failed",
        outcome: "failed",
        diagnosis,
        patch: patchResult.proposal,
        risk,
        validation,
      };
    }
  }
}

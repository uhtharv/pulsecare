import { NextRequest } from "next/server";
import { CRMContractSchema } from "./contract";
import { POST as crmPost, GET as crmGet } from "@/app/api/mock/crm/route";
import { GET as emailGet } from "@/app/api/mock/email/route";
import { GET as slackGet } from "@/app/api/mock/slack/route";
import { executePipeline } from "./pipeline";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface ValidationItem {
  id: "contract_check" | "dry_run" | "real_retry" | "downstream_check" | "outcome_check";
  title: string;
  passed: boolean;
  details?: string;
}

export interface ValidationChecklistResult {
  allPassed: boolean;
  checks: ValidationItem[];
  failedCheckId?: string;
  failureMessage?: string;
}

/**
 * Runs the 5-step Recovery Validation Engine.
 */
export async function runRecoveryValidation(params: {
  runId: string;
  runCode: string;
  patchedPayload: Record<string, any>;
  failedStep: string;
  retryDelayMs?: number | null;
  serviceFault?: string;
  attempt?: number;
}): Promise<ValidationChecklistResult> {
  const {
    runId,
    runCode,
    patchedPayload,
    failedStep,
    retryDelayMs,
    serviceFault = "",
    attempt = 1,
  } = params;

  const checks: ValidationItem[] = [
    { id: "contract_check", title: "CRM Contract Schema Validation", passed: false },
    { id: "dry_run", title: "Dry-Run Endpoint Verification (x-dry-run: true)", passed: false },
    { id: "real_retry", title: "Resumable Step Retry Execution", passed: false },
    { id: "downstream_check", title: "Downstream Steps Completion", passed: false },
    { id: "outcome_check", title: "Side-Effect & Idempotency Outcome Verification", passed: false },
  ];

  // Helper to fail at a check
  function failCheck(checkId: string, message: string): ValidationChecklistResult {
    const item = checks.find((c) => c.id === checkId);
    if (item) {
      item.passed = false;
      item.details = message;
    }
    return {
      allPassed: false,
      checks,
      failedCheckId: checkId,
      failureMessage: message,
    };
  }

  // 1. Check #1: Contract check (Zod)
  const zodCheck = CRMContractSchema.safeParse(patchedPayload);
  if (!zodCheck.success) {
    const issues = zodCheck.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return failCheck("contract_check", `Contract check failed: ${issues}`);
  }
  checks[0].passed = true;
  checks[0].details = "Patched payload conforms strictly to CRM Zod contract.";

  // 2. Check #2: Dry run
  if (failedStep === "crm_create") {
    const dryRunReq = new NextRequest("http://localhost/api/mock/crm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dry-run": "true",
        "x-idempotency-key": runCode,
        "x-fault": serviceFault,
        "x-attempt": String(attempt),
      },
      body: JSON.stringify(patchedPayload),
    });

    const dryRunRes = await crmPost(dryRunReq);
    if (dryRunRes.status !== 200) {
      const body = await dryRunRes.json().catch(() => ({}));
      return failCheck("dry_run", `Dry-run returned HTTP ${dryRunRes.status}: ${body.error_message || "Validation failed"}`);
    }
    checks[1].passed = true;
    checks[1].details = "Dry-run succeeded with HTTP 200 (no mutations recorded).";
  } else {
    checks[1].passed = true;
    checks[1].details = "Step does not require remote dry-run validation.";
  }

  // Handle transient backoff if specified
  if (retryDelayMs && retryDelayMs > 0) {
    await new Promise((res) => setTimeout(res, Math.min(retryDelayMs, 3000)));
  }

  // 3. Check #3 & #4: Update payload in workflow_runs and perform real retry through pipeline
  await supabaseAdmin
    .from("workflow_runs")
    .update({
      current_payload: patchedPayload,
      attempt,
      status: "healing",
    })
    .eq("id", runId);

  const retryResult = await executePipeline(runId);

  if (!retryResult.success) {
    return failCheck(
      "real_retry",
      `Retry failed at step '${retryResult.failed_step}': ${retryResult.error_message}`
    );
  }

  checks[2].passed = true;
  checks[2].details = `Step '${failedStep}' successfully retried and completed.`;

  // 4. Downstream check
  checks[3].passed = true;
  checks[3].details = `All downstream steps completed successfully: [${retryResult.completed_steps.join(", ")}].`;

  // 5. Check #5: Outcome check
  // Check CRM record exists for runCode
  const crmGetReq = new NextRequest(`http://localhost/api/mock/crm?key=${runCode}`);
  const crmGetRes = await crmGet(crmGetReq);
  const crmData = await crmGetRes.json().catch(() => ({}));

  if (!crmData.exists) {
    return failCheck("outcome_check", `Outcome check failed: CRM record was not found for key ${runCode}`);
  }

  // Check Email sends (must be exactly 1)
  const emailGetReq = new NextRequest(`http://localhost/api/mock/email?key=${runCode}`);
  const emailGetRes = await emailGet(emailGetReq);
  const emailData = await emailGetRes.json().catch(() => ({}));

  if (emailData.count !== 1) {
    return failCheck(
      "outcome_check",
      `Outcome check failed: Expected exactly 1 email delivery, got ${emailData.count}`
    );
  }

  // Check Slack notifications (must be exactly 1)
  const slackGetReq = new NextRequest(`http://localhost/api/mock/slack?key=${runCode}`);
  const slackGetRes = await slackGet(slackGetReq);
  const slackData = await slackGetRes.json().catch(() => ({}));

  if (slackData.count !== 1) {
    return failCheck(
      "outcome_check",
      `Outcome check failed: Expected exactly 1 Slack notification, got ${slackData.count}`
    );
  }

  checks[4].passed = true;
  checks[4].details = "Verified: 1 CRM record created, exactly 1 email sent, exactly 1 Slack notification posted (0 duplicates).";

  return {
    allPassed: true,
    checks,
  };
}


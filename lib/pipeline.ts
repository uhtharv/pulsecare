import { NextRequest } from "next/server";
import { POST as crmPost } from "@/app/api/mock/crm/route";
import { POST as emailPost } from "@/app/api/mock/email/route";
import { POST as slackPost } from "@/app/api/mock/slack/route";
import { logEvent } from "./logger";
import { evaluateDetectionRules, createDetectedIncident } from "./monitor";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface PipelineExecutionResult {
  success: boolean;
  run_id: string;
  run_code: string;
  status: string;
  completed_steps: string[];
  failed_step?: string | null;
  incident_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}

export const PIPELINE_STEPS = ["ingest", "crm_create", "send_welcome_email", "slack_notify"] as const;

/**
 * Executes or resumes the 4-step Customer Onboarding Pipeline.
 */
export async function executePipeline(runId: string): Promise<PipelineExecutionResult> {
  // 1. Fetch current run details from Supabase
  let run: any = null;

  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseAdmin
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (error || !data) {
      throw new Error(`Run ${runId} not found in database: ${error?.message}`);
    }
    run = data;
  } else {
    throw new Error("Supabase is not configured.");
  }

  const runCode: string = run.run_code;
  const currentPayload = run.current_payload || {};
  let completedSteps: string[] = run.completed_steps || [];
  const chaos: string[] = run.chaos || [];
  const attempt: number = run.attempt || 1;

  // Determine service fault header from chaos
  const serviceFault = chaos.find((f) => ["auth_401", "upstream_500", "rate_limit_429"].includes(f)) || "";

  // Update status to running
  await supabaseAdmin
    .from("workflow_runs")
    .update({ status: "running" })
    .eq("id", runId);

  await logEvent({
    run_id: runId,
    level: "info",
    event: "pipeline_resumed",
    step: null,
    request: { run_code: runCode, completed_steps: completedSteps, attempt },
    attempt,
  });

  // Step 1: Ingest
  if (!completedSteps.includes("ingest")) {
    const startTs = Date.now();
    await logEvent({
      run_id: runId,
      level: "info",
      step: "ingest",
      event: "step_started",
      request: currentPayload,
      attempt,
    });

    // Lenient sanity check
    if (!currentPayload || typeof currentPayload !== "object" || Object.keys(currentPayload).length === 0) {
      const latency = Date.now() - startTs;
      await logEvent({
        run_id: runId,
        level: "error",
        step: "ingest",
        event: "step_failed",
        latency_ms: latency,
        error_code: "EMPTY_PAYLOAD",
        error_message: "Ingest failed: payload is empty or not an object",
        attempt,
      });

      const incId = await createDetectedIncident({
        runId,
        failedStep: "ingest",
        errorCode: "EMPTY_PAYLOAD",
        errorMessage: "Ingest failed: payload is empty or not an object",
      });

      return {
        success: false,
        run_id: runId,
        run_code: runCode,
        status: "failed",
        completed_steps: completedSteps,
        failed_step: "ingest",
        incident_id: incId,
        error_code: "EMPTY_PAYLOAD",
        error_message: "Payload is empty",
      };
    }

    completedSteps = [...completedSteps, "ingest"];
    await supabaseAdmin
      .from("workflow_runs")
      .update({ completed_steps: completedSteps })
      .eq("id", runId);

    await logEvent({
      run_id: runId,
      level: "info",
      step: "ingest",
      event: "step_completed",
      latency_ms: Date.now() - startTs,
      response: { shape: Object.keys(currentPayload) },
      attempt,
    });
  }

  // Step 2: CRM Create
  if (!completedSteps.includes("crm_create")) {
    const startTs = Date.now();
    await logEvent({
      run_id: runId,
      level: "info",
      step: "crm_create",
      event: "step_started",
      request: currentPayload,
      attempt,
    });

    const crmReq = new NextRequest("http://localhost/api/mock/crm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": runCode,
        "x-fault": serviceFault,
        "x-attempt": String(attempt),
      },
      body: JSON.stringify(currentPayload),
    });

    const crmRes = await crmPost(crmReq);
    const latency = Date.now() - startTs;
    const resBody = await crmRes.json().catch(() => ({}));

    // Evaluate detection rules
    const detection = evaluateDetectionRules("crm_create", crmRes.status, resBody, latency);

    if (detection.hasFailure) {
      await logEvent({
        run_id: runId,
        level: "error",
        step: "crm_create",
        event: "step_failed",
        status: String(crmRes.status),
        latency_ms: latency,
        request: currentPayload,
        response: resBody,
        error_code: detection.errorCode,
        error_message: detection.errorMessage,
        attempt,
      });

      const incId = await createDetectedIncident({
        runId,
        failedStep: "crm_create",
        errorCode: detection.errorCode!,
        errorMessage: detection.errorMessage!,
      });

      return {
        success: false,
        run_id: runId,
        run_code: runCode,
        status: "failed",
        completed_steps: completedSteps,
        failed_step: "crm_create",
        incident_id: incId,
        error_code: detection.errorCode,
        error_message: detection.errorMessage,
      };
    }

    // CRM step succeeded
    completedSteps = [...completedSteps, "crm_create"];
    await supabaseAdmin
      .from("workflow_runs")
      .update({ completed_steps: completedSteps })
      .eq("id", runId);

    await logEvent({
      run_id: runId,
      level: "info",
      step: "crm_create",
      event: "step_completed",
      status: "200",
      latency_ms: latency,
      response: resBody,
      attempt,
    });
  }

  // Step 3: Send Welcome Email
  if (!completedSteps.includes("send_welcome_email")) {
    const startTs = Date.now();
    const emailPayload = {
      email: currentPayload.email,
      full_name: currentPayload.full_name,
    };

    await logEvent({
      run_id: runId,
      level: "info",
      step: "send_welcome_email",
      event: "step_started",
      request: emailPayload,
      attempt,
    });

    const emailReq = new NextRequest("http://localhost/api/mock/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": runCode,
      },
      body: JSON.stringify(emailPayload),
    });

    const emailRes = await emailPost(emailReq);
    const latency = Date.now() - startTs;
    const resBody = await emailRes.json().catch(() => ({}));

    const detection = evaluateDetectionRules("send_welcome_email", emailRes.status, resBody, latency);

    if (detection.hasFailure) {
      await logEvent({
        run_id: runId,
        level: "error",
        step: "send_welcome_email",
        event: "step_failed",
        status: String(emailRes.status),
        latency_ms: latency,
        request: emailPayload,
        response: resBody,
        error_code: detection.errorCode,
        error_message: detection.errorMessage,
        attempt,
      });

      const incId = await createDetectedIncident({
        runId,
        failedStep: "send_welcome_email",
        errorCode: detection.errorCode!,
        errorMessage: detection.errorMessage!,
      });

      return {
        success: false,
        run_id: runId,
        run_code: runCode,
        status: "failed",
        completed_steps: completedSteps,
        failed_step: "send_welcome_email",
        incident_id: incId,
        error_code: detection.errorCode,
        error_message: detection.errorMessage,
      };
    }

    completedSteps = [...completedSteps, "send_welcome_email"];
    await supabaseAdmin
      .from("workflow_runs")
      .update({ completed_steps: completedSteps })
      .eq("id", runId);

    await logEvent({
      run_id: runId,
      level: "info",
      step: "send_welcome_email",
      event: "step_completed",
      status: "200",
      latency_ms: latency,
      response: resBody,
      attempt,
    });
  }

  // Step 4: Slack Notify
  if (!completedSteps.includes("slack_notify")) {
    const startTs = Date.now();
    const slackPayload = {
      full_name: currentPayload.full_name,
      plan: currentPayload.plan,
      company: currentPayload.company,
    };

    await logEvent({
      run_id: runId,
      level: "info",
      step: "slack_notify",
      event: "step_started",
      request: slackPayload,
      attempt,
    });

    const slackReq = new NextRequest("http://localhost/api/mock/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": runCode,
      },
      body: JSON.stringify(slackPayload),
    });

    const slackRes = await slackPost(slackReq);
    const latency = Date.now() - startTs;
    const resBody = await slackRes.json().catch(() => ({}));

    const detection = evaluateDetectionRules("slack_notify", slackRes.status, resBody, latency);

    if (detection.hasFailure) {
      await logEvent({
        run_id: runId,
        level: "error",
        step: "slack_notify",
        event: "step_failed",
        status: String(slackRes.status),
        latency_ms: latency,
        request: slackPayload,
        response: resBody,
        error_code: detection.errorCode,
        error_message: detection.errorMessage,
        attempt,
      });

      const incId = await createDetectedIncident({
        runId,
        failedStep: "slack_notify",
        errorCode: detection.errorCode!,
        errorMessage: detection.errorMessage!,
      });

      return {
        success: false,
        run_id: runId,
        run_code: runCode,
        status: "failed",
        completed_steps: completedSteps,
        failed_step: "slack_notify",
        incident_id: incId,
        error_code: detection.errorCode,
        error_message: detection.errorMessage,
      };
    }

    completedSteps = [...completedSteps, "slack_notify"];
    await supabaseAdmin
      .from("workflow_runs")
      .update({ completed_steps: completedSteps })
      .eq("id", runId);

    await logEvent({
      run_id: runId,
      level: "info",
      step: "slack_notify",
      event: "step_completed",
      status: "200",
      latency_ms: latency,
      response: resBody,
      attempt,
    });
  }

  // All 4 steps successfully finished!
  const finalStatus = run.status === "healing" ? "recovered" : "succeeded";
  const finishedAt = new Date().toISOString();

  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: finalStatus,
      completed_steps: completedSteps,
      finished_at: finishedAt,
    })
    .eq("id", runId);

  await logEvent({
    run_id: runId,
    level: "info",
    event: "pipeline_completed",
    response: { status: finalStatus, completed_steps: completedSteps },
    attempt,
  });

  return {
    success: true,
    run_id: runId,
    run_code: runCode,
    status: finalStatus,
    completed_steps: completedSteps,
  };
}


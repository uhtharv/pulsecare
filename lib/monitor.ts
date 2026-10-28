import { LogEntry } from "./logger";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface DetectionResult {
  hasFailure: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  failedStep: string | null;
}

/**
 * Evaluates detection rules on a step event or response.
 */
export function evaluateDetectionRules(
  step: string,
  responseStatus: number,
  responseBody: any,
  latencyMs: number
): DetectionResult {
  // 1. HTTP status >= 400
  if (responseStatus >= 400) {
    const errCode = responseBody?.error_code || `HTTP_${responseStatus}`;
    const errMsg = responseBody?.error_message || responseBody?.error || `Step ${step} failed with HTTP ${responseStatus}`;
    return {
      hasFailure: true,
      errorCode: String(errCode),
      errorMessage: String(errMsg),
      failedStep: step,
    };
  }

  // 2. High latency violation (> 3000ms)
  if (latencyMs > 3000) {
    return {
      hasFailure: true,
      errorCode: "LATENCY_THRESHOLD_EXCEEDED",
      errorMessage: `Step ${step} exceeded latency threshold: ${latencyMs}ms > 3000ms`,
      failedStep: step,
    };
  }

  // 3. Response contract violation
  if (step === "crm_create" && (!responseBody || !responseBody.record_id)) {
    return {
      hasFailure: true,
      errorCode: "CRM_RESPONSE_CONTRACT_VIOLATION",
      errorMessage: "CRM response missing required 'record_id'",
      failedStep: step,
    };
  }

  if ((step === "send_welcome_email" || step === "slack_notify") && (!responseBody || !responseBody.message_id)) {
    return {
      hasFailure: true,
      errorCode: "DELIVERY_RESPONSE_CONTRACT_VIOLATION",
      errorMessage: `${step} response missing required 'message_id'`,
      failedStep: step,
    };
  }

  return {
    hasFailure: false,
    errorCode: null,
    errorMessage: null,
    failedStep: null,
  };
}

/**
 * Creates or updates an incident row in Supabase when a failure is detected.
 */
export async function createDetectedIncident(params: {
  runId: string;
  failedStep: string;
  errorCode: string;
  errorMessage: string;
  failedAt?: string;
}): Promise<string> {
  const { runId, failedStep, errorCode, errorMessage, failedAt = new Date().toISOString() } = params;
  const detectedAt = new Date().toISOString();

  // Generate a human-readable incident code, e.g. INC-001 or timestamp-based
  const incidentCode = `INC-${Date.now().toString().slice(-4)}`;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseAdmin
        .from("incidents")
        .insert({
          incident_code: incidentCode,
          run_id: runId,
          status: "detected",
          failed_step: failedStep,
          error_code: errorCode,
          error_message: errorMessage,
          attempts: 1,
          failed_at: failedAt,
          detected_at: detectedAt,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creating incident in Supabase:", error.message);
      } else if (data?.id) {
        // Link incident_id to workflow_run
        await supabaseAdmin
          .from("workflow_runs")
          .update({
            incident_id: data.id,
            status: "failed",
            failed_at: failedAt,
          })
          .eq("id", runId);

        return data.id;
      }
    } catch (err: any) {
      console.error("Exception creating incident:", err.message);
    }
  }

  return incidentCode;
}


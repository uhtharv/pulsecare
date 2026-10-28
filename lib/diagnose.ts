import { z } from "zod";
import { callGeminiJSON } from "./gemini";
import { CRM_CONTRACT_TEXT } from "./contract";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export const DiagnosisSchema = z.object({
  root_cause: z.string(),
  category: z.enum([
    "schema_drift",
    "type_mismatch",
    "missing_field",
    "null_value",
    "format_error",
    "invalid_enum",
    "transient_upstream",
    "rate_limited",
    "auth_failure",
    "unknown",
  ]),
  failed_field: z.string().nullable().optional(),
  confidence: z.preprocess((val) => {
    if (typeof val === "string") return parseFloat(val) || 0.9;
    if (typeof val === "number") return val;
    return 0.9;
  }, z.number().min(0).max(1)),
  evidence: z.preprocess((val) => {
    if (typeof val === "string") return [val];
    if (Array.isArray(val)) return val.map(String);
    return [];
  }, z.array(z.string())),
  recommended_action: z.enum([
    "patch_payload",
    "retry_with_backoff",
    "wait_and_retry",
    "escalate",
  ]),
  retry_delay_ms: z.number().nullable().optional(),
  explanation: z.string(),
});

export type DiagnosisResult = z.infer<typeof DiagnosisSchema>;

export async function runDiagnosis(params: {
  runId: string;
  incidentId: string;
  failedStep: string;
  errorCode: string;
  errorMessage: string;
  requestPayload: any;
  responseBody: any;
  similarIncidents?: any[];
}): Promise<DiagnosisResult> {
  const {
    runId,
    incidentId,
    failedStep,
    errorCode,
    errorMessage,
    requestPayload,
    responseBody,
    similarIncidents = [],
  } = params;

  // Fetch last 15 log events
  let recentLogs: any[] = [];
  if (isSupabaseConfigured() && runId) {
    const { data: logs } = await supabaseAdmin
      .from("logs")
      .select("step, level, event, status, error_code, error_message, ts")
      .eq("run_id", runId)
      .order("ts", { ascending: false })
      .limit(15);
    recentLogs = (logs || []).reverse();
  }

  const prompt = `
You are the AI Diagnostics Engine for HealOps, a self-healing pipeline control plane.
Analyze this workflow failure, identify the precise root cause, and return a JSON diagnosis.

FAILED STEP: ${failedStep}
ERROR CODE: ${errorCode}
ERROR MESSAGE: ${errorMessage}

REQUEST PAYLOAD:
${JSON.stringify(requestPayload, null, 2)}

RESPONSE BODY:
${JSON.stringify(responseBody, null, 2)}

CONTRACT SPECIFICATION:
${CRM_CONTRACT_TEXT}

RECENT LOG TRACES:
${JSON.stringify(recentLogs, null, 2)}

DIAGNOSTIC CRITERIA:
- If a contract field is renamed (e.g. 'emailAddress' instead of 'email') -> category: "schema_drift", recommended_action: "patch_payload", failed_field: "email"
- If a field has wrong data type (e.g. phone is number 919876543210) -> category: "type_mismatch", recommended_action: "patch_payload", failed_field: "phone"
- If a required field is missing (e.g. 'plan' absent) -> category: "missing_field", recommended_action: "patch_payload", failed_field: "plan"
- If a field is explicitly null (e.g. company: null) -> category: "null_value", recommended_action: "patch_payload", failed_field: "company"
- If date format is DD/MM/YYYY instead of ISO 8601 -> category: "format_error", recommended_action: "patch_payload", failed_field: "signup_date"
- If enum casing is wrong (e.g. 'PRO' instead of 'pro') -> category: "invalid_enum", recommended_action: "patch_payload", failed_field: "plan"
- If HTTP 500 or upstream crash -> category: "transient_upstream", recommended_action: "retry_with_backoff", retry_delay_ms: 500, failed_field: null
- If HTTP 429 rate limit -> category: "rate_limited", recommended_action: "wait_and_retry", retry_delay_ms: 2000, failed_field: null
- If HTTP 401 or auth failure -> category: "auth_failure", recommended_action: "escalate", failed_field: null

You MUST return a JSON object with EXACTLY this structure:
{
  "root_cause": "Short clear description of the root cause",
  "category": "schema_drift|type_mismatch|missing_field|null_value|format_error|invalid_enum|transient_upstream|rate_limited|auth_failure|unknown",
  "failed_field": "string name of the contract field, or null",
  "confidence": 0.95,
  "evidence": ["exact error quote or log trace"],
  "recommended_action": "patch_payload|retry_with_backoff|wait_and_retry|escalate",
  "retry_delay_ms": null,
  "explanation": "1-2 plain-English sentences for the operator dashboard"
}
`.trim();

  const raw = await callGeminiJSON<DiagnosisResult>({
    prompt,
    systemInstruction: "You are an automated diagnostic engineer. You MUST return ONLY a JSON object with the exact keys: root_cause, category, failed_field, confidence, evidence, recommended_action, retry_delay_ms, explanation.",
  });

  // Validate with Zod
  const validated = DiagnosisSchema.parse(raw);

  // Update incident record in Supabase
  if (isSupabaseConfigured() && incidentId) {
    await supabaseAdmin
      .from("incidents")
      .update({
        diagnosis: validated,
        status: "diagnosed",
      })
      .eq("id", incidentId);
  }

  return validated;
}


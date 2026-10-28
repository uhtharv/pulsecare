import { applyPatch } from "fast-json-patch";
import { callGeminiJSON } from "./gemini";
import { CRM_CONTRACT_TEXT } from "./contract";
import { guardPatchProposal, PatchProposal, JSONPatchOp } from "./patch-guard";
import { DiagnosisResult } from "./diagnose";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface GeneratedPatchResult {
  proposal: PatchProposal;
  patchedPayload: Record<string, any>;
  guarded: boolean;
  guardErrors?: string[];
}

/**
 * Generates an RFC 6902 JSON patch proposal using Gemini, validated against guardrails.
 */
export async function generatePayloadPatch(params: {
  incidentId: string;
  currentPayload: Record<string, any>;
  diagnosis: DiagnosisResult;
}): Promise<GeneratedPatchResult> {
  const { incidentId, currentPayload, diagnosis } = params;

  let currentFeedback = "";
  let attempts = 0;

  while (attempts < 2) {
    attempts++;
    const prompt = `
You are the HealOps Automated Payload Patch Generator.
Generate an RFC 6902 JSON Patch (array of operations) to repair this payload so it satisfies the CRM contract.

FAILED FIELD: ${diagnosis.failed_field || "unknown"}
ROOT CAUSE: ${diagnosis.root_cause}
CATEGORY: ${diagnosis.category}

CURRENT FAILED PAYLOAD:
${JSON.stringify(currentPayload, null, 2)}

CRM CONTRACT SPECIFICATION:
${CRM_CONTRACT_TEXT}

${currentFeedback ? `PREVIOUS ATTEMPT GUARDRAIL ERROR (CORRECT THIS):\n${currentFeedback}\n` : ""}

EXACT OUTPUT FORMAT REQUIRED:
{
  "ops": [
    {
      "op": "move|replace|add|remove",
      "path": "/contract_field_name",
      "from": "/source_field_name_if_move",
      "value": "replacement_value_if_replace_or_add"
    }
  ],
  "rationale": "Technical rationale for this patch",
  "expected_outcome": "Expected validation result"
}

PATCH EXAMPLES BY CATEGORY:
1. schema_drift (e.g. emailAddress):
   {"op": "move", "from": "/emailAddress", "path": "/email"}
2. type_mismatch (e.g. phone: 919876543210):
   {"op": "replace", "path": "/phone", "value": "+919876543210"}
3. missing_field (e.g. plan):
   {"op": "add", "path": "/plan", "value": "free"}
4. null_value (e.g. company: null):
   {"op": "remove", "path": "/company"}
5. format_error (e.g. signup_date: "28/10/2026"):
   {"op": "replace", "path": "/signup_date", "value": "2026-10-28T10:30:00Z"}
6. invalid_enum (e.g. plan: "PRO"):
   {"op": "replace", "path": "/plan", "value": "pro"}

RULES:
- 'ops' MUST be a non-empty array of operations.
- 'path' must always start with '/' and be a valid contract field.
- Do NOT include markdown blocks; return raw JSON.
`.trim();

    const raw = await callGeminiJSON<PatchProposal>({
      prompt,
      systemInstruction: "You are an automated RFC 6902 patch generator. Return ONLY a valid JSON object with the 'ops' array, 'rationale', and 'expected_outcome'.",
    });

    // Guardrail validation
    const guard = guardPatchProposal(raw, currentPayload);

    if (!guard.valid) {
      if (attempts === 1) {
        currentFeedback = guard.errors.join("; ");
        console.warn("Patch proposal violated guardrails, retrying with feedback:", currentFeedback);
        continue;
      } else {
        throw new Error(`Proposed patch violated safety guardrails: ${guard.errors.join(", ")}`);
      }
    }

    // Apply patch to a clone of currentPayload
    const payloadCopy = JSON.parse(JSON.stringify(currentPayload));
    const patchResult = applyPatch(payloadCopy, raw.ops as any, true, false);
    const patchedPayload = patchResult.newDocument;

    // Update incident in Supabase
    if (isSupabaseConfigured() && incidentId) {
      await supabaseAdmin
        .from("incidents")
        .update({
          patch: raw,
          status: "patch_proposed",
        })
        .eq("id", incidentId);
    }

    return {
      proposal: raw,
      patchedPayload,
      guarded: true,
    };
  }

  throw new Error("Failed to generate safe patch proposal within attempt limits");
}


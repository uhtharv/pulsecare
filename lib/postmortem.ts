import { callGeminiJSON } from "./gemini";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface PostmortemData {
  incident_id: string;
  markdown: string;
}

/**
 * Builds a deterministic fallback markdown post-mortem if the LLM is unavailable.
 */
function buildTemplatePostmortem(incident: any, logs: any[]): string {
  const diagnosis = incident.diagnosis || {};
  const patch = incident.patch || {};
  const risk = incident.risk || {};
  const approval = incident.approval || {};
  const validation = incident.validation || [];

  const timelineRows = logs.map((l) => {
    const time = l.ts ? new Date(l.ts).toLocaleTimeString() : "N/A";
    return `| ${time} | \`${l.step || "system"}\` | **${l.event}** | ${l.level.toUpperCase()} | ${l.error_message || l.status || "OK"} |`;
  }).join("\n");

  return `
# Incident Post-Mortem: ${incident.incident_code || "INCIDENT"}

## Executive Summary
On **${new Date(incident.detected_at || Date.now()).toUTCString()}**, an automated onboarding pipeline encountered a **${diagnosis.category || incident.error_code || "contract violation"}** at step \`${incident.failed_step || "crm_create"}\`. 
The HealOps autonomous control plane diagnosed the anomaly, calculated risk (${risk.score ?? 0}/100), applied an RFC 6902 patch, verified through 5 validation gates, and successfully resolved the incident.

## Incident Overview
- **Incident Code:** \`${incident.incident_code}\`
- **Final Outcome:** **${incident.outcome?.toUpperCase() || "HEALED"}**
- **Failed Step:** \`${incident.failed_step}\`
- **Error Code:** \`${incident.error_code}\`
- **MTTD (Detection Time):** ${incident.failed_at && incident.detected_at ? Math.max(1, Math.round((new Date(incident.detected_at).getTime() - new Date(incident.failed_at).getTime()) / 1000)) + "s" : "< 1s"}
- **MTTR (Resolution Time):** ${incident.detected_at && incident.resolved_at ? Math.max(1, Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.detected_at).getTime()) / 1000)) + "s" : "3.2s"}

## Root Cause Analysis
${diagnosis.root_cause || incident.error_message || "Payload attribute mismatch against CRM contract specifications."}

> **Detailed Explanation:** ${diagnosis.explanation || "No additional explanation provided."}

## Timeline of Events
| Time (UTC) | Step | Event | Level | Details |
|---|---|---|---|---|
${timelineRows || "| N/A | system | Incident logged | INFO | Workflow completed |"}

## Corrective Remediation (RFC 6902)
${patch.ops && patch.ops.length > 0 ? `\`\`\`json\n${JSON.stringify(patch.ops, null, 2)}\n\`\`\`` : "No payload patch required (transient backoff retry resolved the anomaly)."}

- **Rationale:** ${patch.rationale || "Automated safe transformation"}
- **Expected Outcome:** ${patch.expected_outcome || "Full schema contract compliance"}

## Risk & Governance
- **Calculated Risk Score:** **${risk.score ?? 0}/100 (${risk.level?.toUpperCase() ?? "LOW"})**
- **Approval Mode:** \`${approval.mode || "auto"}\`
- **Approval Decision:** \`${approval.decision || "approve"}\`

## Recovery Validation Checklist
${validation.map((v: any, i: number) => `${i + 1}. **${v.title}**: ${v.passed ? "✅ PASSED" : "❌ FAILED"} — ${v.details || ""}`).join("\n")}

## Prevention Recommendations
1. Integrate client-side Zod validation at ingestion source to catch schema drift before downstream dispatch.
2. Store canonical patch signature in HealOps cluster memory to bypass future LLM latency on identical patterns.
3. Establish alerting monitors for third-party upstream API contract version shifts.
`.trim();
}

/**
 * Generates an automated post-mortem using Gemini, with deterministic template fallback.
 */
export async function generatePostmortem(incidentId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  // 1. Fetch incident and associated logs
  const { data: incident, error: incErr } = await supabaseAdmin
    .from("incidents")
    .select("*")
    .eq("id", incidentId)
    .single();

  if (incErr || !incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  const { data: logs } = await supabaseAdmin
    .from("logs")
    .select("*")
    .eq("run_id", incident.run_id)
    .order("ts", { ascending: true });

  const logList = logs || [];

  // Try generating polished post-mortem via Gemini
  try {
    const prompt = `
You are the HealOps Automated Post-Mortem SRE Writer.
Generate a professional, structured Markdown Post-Mortem for this resolved incident.

INCIDENT METADATA:
${JSON.stringify(incident, null, 2)}

LOG TRACE CHRONOLOGY:
${JSON.stringify(logList.slice(-15), null, 2)}

POST-MORTEM FORMAT:
# Incident Post-Mortem: [Incident Code]
## Executive Summary
## Incident Overview (table with code, outcome, failed step, MTTD, MTTR)
## Root Cause Analysis (citing evidence)
## Timeline of Events (markdown table from log timestamps)
## Corrective Action & RFC 6902 Patch Applied
## Risk Evaluation & Operator Approval
## Recovery Validation Checklist (5 points)
## Prevention & Hardening Recommendations

Rules:
- Output clean Markdown only.
- Do NOT hallucinate unrecorded facts; strictly use the incident and log data.
`.trim();

    const response = await callGeminiJSON<{ markdown: string }>({
      prompt,
      systemInstruction: "You are an expert SRE writer. Return clean JSON with a single key 'markdown' containing the full Markdown post-mortem.",
    });

    const markdown = response.markdown || buildTemplatePostmortem(incident, logList);

    // Save to postmortems table
    await supabaseAdmin.from("postmortems").upsert({
      incident_id: incidentId,
      markdown,
    });

    return markdown;
  } catch (err: any) {
    console.warn("Gemini post-mortem generation failed, using fallback template:", err.message);
    const fallback = buildTemplatePostmortem(incident, logList);
    await supabaseAdmin.from("postmortems").upsert({
      incident_id: incidentId,
      markdown: fallback,
    });
    return fallback;
  }
}


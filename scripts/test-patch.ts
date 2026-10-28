import { generatePayloadPatch } from "../lib/patch";
import { runDiagnosis } from "../lib/diagnose";
import { GOLDEN_PAYLOAD } from "../lib/contract";
import { injectPayloadChaos } from "../lib/chaos";

async function testPatch() {
  console.log("Testing patch generation on schema_drift...");
  const brokenPayload = injectPayloadChaos(GOLDEN_PAYLOAD, ["schema_drift"]);
  const diag = await runDiagnosis({
    runId: "",
    incidentId: "",
    failedStep: "crm_create",
    errorCode: "CRM_CONTRACT_VALIDATION_ERROR",
    errorMessage: "CRM contract violation: Field 'email': email is required; Field 'root': Unknown fields not allowed in CRM contract",
    requestPayload: brokenPayload,
    responseBody: { status: 422 },
  });

  const patchRes = await generatePayloadPatch({
    incidentId: "",
    currentPayload: brokenPayload,
    diagnosis: diag,
  });

  console.log("Patch Proposal:", JSON.stringify(patchRes.proposal, null, 2));
  console.log("Patched Payload:", JSON.stringify(patchRes.patchedPayload, null, 2));
  console.log("Guarded:", patchRes.guarded);
}

testPatch().catch((err) => {
  console.error("Patch Test Exception:", err?.message || String(err));
});


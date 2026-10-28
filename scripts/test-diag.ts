import { runDiagnosis } from "../lib/diagnose";
import { GOLDEN_PAYLOAD } from "../lib/contract";
import { injectPayloadChaos } from "../lib/chaos";

async function testDiag() {
  console.log("Testing diagnosis on schema_drift...");
  const brokenPayload = injectPayloadChaos(GOLDEN_PAYLOAD, ["schema_drift"]);
  try {
    const res = await runDiagnosis({
      runId: "00000000-0000-0000-0000-000000000000",
      incidentId: "",
      failedStep: "crm_create",
      errorCode: "CRM_CONTRACT_VALIDATION_ERROR",
      errorMessage: "CRM contract violation: Field 'email': email is required; Field 'root': Unknown fields not allowed in CRM contract",
      requestPayload: brokenPayload,
      responseBody: { status: 422 },
    });
    console.log("Diagnosis SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("Diagnosis Exception message:", err?.message);
    if (err?.stack) console.error("Stack:", err.stack);
  }
}

testDiag();


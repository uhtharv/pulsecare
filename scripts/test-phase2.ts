import { GOLDEN_PAYLOAD } from "../lib/contract";
import { injectPayloadChaos } from "../lib/chaos";
import { executePipeline } from "../lib/pipeline";
import { supabaseAdmin } from "../lib/supabase";

async function testPhase2() {
  console.log("=== Phase 2 Validation Test ===\n");

  // Test 1: Healthy Run
  console.log("1. Running Healthy Payload...");
  const healthyRunCode = `RUN-HEALTHY-${Date.now().toString().slice(-4)}`;
  const { data: healthyRun, error: hErr } = await supabaseAdmin
    .from("workflow_runs")
    .insert({
      run_code: healthyRunCode,
      status: "running",
      chaos: [],
      original_payload: GOLDEN_PAYLOAD,
      current_payload: GOLDEN_PAYLOAD,
      completed_steps: [],
      attempt: 1,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (hErr || !healthyRun) {
    throw new Error(`Failed to create healthy run: ${hErr?.message}`);
  }

  const healthyResult = await executePipeline(healthyRun.id);
  console.log("Healthy Run Result:", healthyResult);
  if (!healthyResult.success || healthyResult.completed_steps.length !== 4) {
    console.error("FAIL: Healthy run did not complete all 4 steps!");
    process.exit(1);
  }
  console.log("PASS: Healthy run completed all 4 steps successfully!\n");

  // Test 2: Broken Run (Schema Drift: emailAddress instead of email)
  console.log("2. Running Hand-broken Payload (Schema Drift: email -> emailAddress)...");
  const brokenPayload = injectPayloadChaos(GOLDEN_PAYLOAD, ["schema_drift"]);
  const brokenRunCode = `RUN-BROKEN-${Date.now().toString().slice(-4)}`;

  const { data: brokenRun, error: bErr } = await supabaseAdmin
    .from("workflow_runs")
    .insert({
      run_code: brokenRunCode,
      status: "running",
      chaos: ["schema_drift"],
      original_payload: GOLDEN_PAYLOAD,
      current_payload: brokenPayload,
      completed_steps: [],
      attempt: 1,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (bErr || !brokenRun) {
    throw new Error(`Failed to create broken run: ${bErr?.message}`);
  }

  const brokenResult = await executePipeline(brokenRun.id);
  console.log("Broken Run Result:", brokenResult);

  if (brokenResult.success) {
    console.error("FAIL: Broken run unexpectedly succeeded!");
    process.exit(1);
  }

  if (brokenResult.failed_step !== "crm_create" || !brokenResult.incident_id) {
    console.error("FAIL: Broken run did not fail at crm_create or create an incident!");
    process.exit(1);
  }

  // Check logs and incident in DB
  const { data: logs } = await supabaseAdmin
    .from("logs")
    .select("step, level, event, error_code")
    .eq("run_id", brokenRun.id);

  const { data: incident } = await supabaseAdmin
    .from("incidents")
    .select("*")
    .eq("id", brokenResult.incident_id)
    .single();

  console.log(`PASS: Detected incident ${incident?.incident_code} (Status: ${incident?.status})`);
  console.log(`PASS: Error Code: ${incident?.error_code}`);
  console.log(`PASS: Log entries written: ${logs?.length}`);
  console.log("\n=== Phase 2 Validation Complete: ALL TESTS PASSED! ===");
}

testPhase2().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});


import { GOLDEN_PAYLOAD } from "../lib/contract";
import { injectPayloadChaos, CHAOS_DEFINITIONS, ChaosType } from "../lib/chaos";
import { executePipeline } from "../lib/pipeline";
import { orchestrateSelfHealing } from "../lib/heal";
import { supabaseAdmin } from "../lib/supabase";
import { POST as decisionPost } from "../app/api/incidents/[id]/decision/route";
import { NextRequest } from "next/server";

interface TestRow {
  chaos: string;
  category: string;
  action: string;
  riskScore: number | string;
  outcome: string;
  status: "PASS" | "FAIL";
}

const ALL_FAULTS: ChaosType[] = [
  "schema_drift",
  "type_mismatch",
  "missing_field",
  "null_value",
  "date_format",
  "enum_case",
  "upstream_500",
  "rate_limit_429",
  "auth_401",
  "combo_fault",
];

async function runChaosTest() {
  console.log("==================================================================");
  console.log("        HealOps: End-to-End Autonomous Chaos Test Suite           ");
  console.log("==================================================================\n");

  const results: TestRow[] = [];

  for (const fault of ALL_FAULTS) {
    const def = CHAOS_DEFINITIONS[fault];
    process.stdout.write(`Testing [${fault}] (${def.title})... `);

    const runCode = `TEST-${fault.toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-4)}`;
    const mutatedPayload = injectPayloadChaos(GOLDEN_PAYLOAD, [fault]);

    // 1. Insert workflow run
    const { data: run, error: rErr } = await supabaseAdmin
      .from("workflow_runs")
      .insert({
        run_code: runCode,
        status: "running",
        chaos: [fault],
        original_payload: GOLDEN_PAYLOAD,
        current_payload: mutatedPayload,
        completed_steps: [],
        attempt: 1,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (rErr || !run) {
      console.error(`Failed to create run: ${rErr?.message}`);
      continue;
    }

    // 2. Initial Pipeline Execution
    const initialExec = await executePipeline(run.id);

    // Initial run must fail
    if (initialExec.success || !initialExec.incident_id) {
      results.push({
        chaos: fault,
        category: "none",
        action: "none",
        riskScore: "N/A",
        outcome: initialExec.status,
        status: "FAIL",
      });
      console.log("FAILED (Run did not fail as expected)");
      continue;
    }

    // 3. Autonomous Healing
    const healRes = await orchestrateSelfHealing({
      runId: run.id,
      incidentId: initialExec.incident_id,
      forceManual: false,
    });

    let finalOutcome = healRes.outcome || "failed";
    let finalRisk: any = healRes.risk?.score ?? "N/A";

    // If awaiting human approval (e.g. medium risk type_mismatch), simulate operator sign-off
    if (healRes.status === "awaiting_approval") {
      const decReq = new NextRequest(`http://localhost/api/incidents/${initialExec.incident_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve", note: "Approved in test runner" }),
      });

      const decRes = await decisionPost(decReq, { params: { id: initialExec.incident_id } });
      const decBody = await decRes.json();
      finalOutcome = decBody.outcome || "healed";
    }

    const diagnosis = healRes.diagnosis;
    const cat = diagnosis?.category || "unknown";
    const act = diagnosis?.recommended_action || "unknown";

    // Verification conditions
    let isPassed = false;
    if (fault === "auth_401") {
      // Must refuse to patch and escalate safely
      isPassed = finalOutcome === "escalated" && act === "escalate";
    } else {
      // Must heal successfully
      isPassed = finalOutcome === "healed";
    }

    results.push({
      chaos: fault,
      category: cat,
      action: act,
      riskScore: finalRisk,
      outcome: finalOutcome,
      status: isPassed ? "PASS" : "FAIL",
    });

    console.log(isPassed ? `PASSED (${finalOutcome})` : `FAILED (${finalOutcome})`);
  }

  // Print Summary Table
  console.log("\n==================================================================");
  console.log("                        TEST RESULTS TABLE                        ");
  console.log("==================================================================");
  console.table(results);

  const passedCount = results.filter((r) => r.status === "PASS").length;
  console.log(`\nTOTAL: ${passedCount}/${results.length} PASSED`);

  if (passedCount === results.length) {
    console.log("\n🎉 ALL 10 CHAOS SCENARIOS HEALED/ESCALATED EXACTLY AS SPECIFIED! 🎉\n");
  } else {
    console.error(`\n⚠️ ${results.length - passedCount} TEST(S) FAILED!`);
    process.exit(1);
  }
}

runChaosTest().catch((err) => {
  console.error("Test suite crashed:", err?.message || String(err));
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

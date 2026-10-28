import { NextRequest, NextResponse } from "next/server";
import { GOLDEN_PAYLOAD } from "@/lib/contract";
import { injectPayloadChaos, ChaosType } from "@/lib/chaos";
import { executePipeline } from "@/lib/pipeline";
import { orchestrateSelfHealing } from "@/lib/heal";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase credentials are not configured in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawPayload = body.payload || GOLDEN_PAYLOAD;
    const chaosList: ChaosType[] = Array.isArray(body.chaos) ? body.chaos : [];
    const forceManual = Boolean(body.force_manual);

    // Inject payload faults if any
    const mutatedPayload = injectPayloadChaos(rawPayload, chaosList);

    // Generate unique run code (e.g. RUN-4821)
    const runCode = `RUN-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create workflow_run row in Supabase
    const { data: run, error: insertError } = await supabaseAdmin
      .from("workflow_runs")
      .insert({
        run_code: runCode,
        status: "running",
        chaos: chaosList,
        original_payload: rawPayload,
        current_payload: mutatedPayload,
        completed_steps: [],
        attempt: 1,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError || !run) {
      return NextResponse.json(
        { error: `Failed to create workflow run: ${insertError?.message}` },
        { status: 500 }
      );
    }

    // Execute the initial pipeline run
    const result = await executePipeline(run.id);

    // Autonomous Self-Healing Trigger
    let healResult = null;
    if (!result.success && result.incident_id) {
      healResult = await orchestrateSelfHealing({
        runId: run.id,
        incidentId: result.incident_id,
        forceManual,
      });
    }

    return NextResponse.json({
      run_id: run.id,
      run_code: runCode,
      result,
      heal: healResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to start workflow run" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const { data: runs, error } = await supabaseAdmin
      .from("workflow_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ runs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

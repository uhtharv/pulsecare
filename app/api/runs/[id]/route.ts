import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runId = params.id;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    // 1. Fetch run
    const { data: run, error: runError } = await supabaseAdmin
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // 2. Fetch associated logs
    const { data: logs, error: logsError } = await supabaseAdmin
      .from("logs")
      .select("*")
      .eq("run_id", runId)
      .order("ts", { ascending: true });

    // 3. Fetch incident if exists
    let incident = null;
    if (run.incident_id) {
      const { data: inc } = await supabaseAdmin
        .from("incidents")
        .select("*")
        .eq("id", run.incident_id)
        .maybeSingle();
      incident = inc;
    }

    return NextResponse.json({
      run,
      logs: logs || [],
      incident,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


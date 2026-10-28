import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "reset";

    if (action === "seed") {
      // Pre-populate 5 historical incidents demonstrating MTTR drop and metrics
      const now = Date.now();
      const mockHistorical = [
        {
          incident_code: "INC-8101",
          status: "healed",
          outcome: "healed",
          failed_step: "crm_create",
          error_code: "CRM_CONTRACT_VALIDATION_ERROR",
          error_message: "Field 'email': email is required (schema_drift)",
          diagnosis: { category: "schema_drift", root_cause: "Field renamed", confidence: 0.95 },
          risk: { score: 25, level: "low" },
          approval: { mode: "auto", decision: "approve" },
          used_memory: false,
          failed_at: new Date(now - 1000 * 60 * 45).toISOString(),
          detected_at: new Date(now - 1000 * 60 * 45 + 800).toISOString(),
          resolved_at: new Date(now - 1000 * 60 * 45 + 5200).toISOString(),
        },
        {
          incident_code: "INC-8102",
          status: "healed",
          outcome: "healed",
          failed_step: "crm_create",
          error_code: "CRM_CONTRACT_VALIDATION_ERROR",
          error_message: "Field 'phone': must be string (type_mismatch)",
          diagnosis: { category: "type_mismatch", root_cause: "Phone integer", confidence: 0.92 },
          risk: { score: 45, level: "medium" },
          approval: { mode: "manual", decision: "approve" },
          used_memory: false,
          failed_at: new Date(now - 1000 * 60 * 30).toISOString(),
          detected_at: new Date(now - 1000 * 60 * 30 + 750).toISOString(),
          resolved_at: new Date(now - 1000 * 60 * 30 + 8400).toISOString(),
        },
        {
          incident_code: "INC-8103",
          status: "escalated",
          outcome: "escalated",
          failed_step: "crm_create",
          error_code: "CRM_AUTH_EXPIRED",
          error_message: "HTTP 401 Unauthorized",
          diagnosis: { category: "auth_failure", root_cause: "Expired credentials", confidence: 0.99 },
          risk: { score: 85, level: "high" },
          approval: { mode: "manual", decision: "escalate" },
          used_memory: false,
          failed_at: new Date(now - 1000 * 60 * 20).toISOString(),
          detected_at: new Date(now - 1000 * 60 * 20 + 600).toISOString(),
          resolved_at: new Date(now - 1000 * 60 * 20 + 1200).toISOString(),
        },
        {
          incident_code: "INC-8104",
          status: "healed",
          outcome: "healed",
          failed_step: "crm_create",
          error_code: "CRM_UPSTREAM_500",
          error_message: "HTTP 500 Transient server error",
          diagnosis: { category: "transient_upstream", root_cause: "Upstream glitch", confidence: 0.9 },
          risk: { score: 18, level: "low" },
          approval: { mode: "auto", decision: "approve" },
          used_memory: false,
          failed_at: new Date(now - 1000 * 60 * 10).toISOString(),
          detected_at: new Date(now - 1000 * 60 * 10 + 700).toISOString(),
          resolved_at: new Date(now - 1000 * 60 * 10 + 3800).toISOString(),
        },
        {
          incident_code: "INC-8105",
          status: "healed",
          outcome: "healed",
          failed_step: "crm_create",
          error_code: "CRM_CONTRACT_VALIDATION_ERROR",
          error_message: "Field 'email': email is required (schema_drift repeat)",
          diagnosis: { category: "schema_drift", root_cause: "Field renamed", confidence: 0.98 },
          risk: { score: 25, level: "low" },
          approval: { mode: "auto", decision: "approve" },
          used_memory: true, // Memory fast path demonstrates MTTR reduction!
          failed_at: new Date(now - 1000 * 60 * 2).toISOString(),
          detected_at: new Date(now - 1000 * 60 * 2 + 500).toISOString(),
          resolved_at: new Date(now - 1000 * 60 * 2 + 1200).toISOString(), // 1.2s MTTR!
        },
      ];

      for (const inc of mockHistorical) {
        await supabaseAdmin.from("incidents").upsert(inc, { onConflict: "incident_code" });
      }

      return NextResponse.json({
        status: "seeded",
        message: "Seeded 5 demo incidents with historical MTTR and memory trends.",
      });
    }

    // Default: Reset all tables
    await supabaseAdmin.from("mock_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("postmortems").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("workflow_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("clusters").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({
      status: "reset_successful",
      message: "All runs, incidents, logs, clusters, and mock state wiped for clean demo.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

const MANUAL_MTTR_MIN = parseInt(process.env.MANUAL_MTTR_MIN || "20", 10);

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Fetch all incidents
    const { data: incidents, error } = await supabaseAdmin
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allIncidents = incidents || [];
    const total = allIncidents.length;

    if (total === 0) {
      return NextResponse.json({
        total_incidents: 0,
        mttd_seconds: 0,
        mttr_seconds: 0,
        auto_heal_rate: 0,
        assisted_heal_rate: 0,
        escalation_rate: 0,
        first_attempt_rate: 0,
        patch_success_rate: 0,
        memory_hit_rate: 0,
        avg_risk_score: 0,
        time_saved_hours: 0,
        manual_baseline_minutes: MANUAL_MTTR_MIN,
        category_breakdown: [],
        mttr_trend: [],
        risk_distribution: { low: 0, medium: 0, high: 0 },
      });
    }

    const healed = allIncidents.filter((i) => i.outcome === "healed");
    const escalated = allIncidents.filter((i) => i.outcome === "escalated");
    const autoHealed = healed.filter((i) => i.approval?.mode === "auto");
    const assistedHealed = healed.filter((i) => i.approval?.mode === "manual" && (i.approval?.decision === "approve" || i.approval?.decision === "approved" || i.approval?.decision === "edited_and_approved"));
    const memoryHits = allIncidents.filter((i) => i.used_memory);
    const firstAttemptHealed = healed.filter((i) => (i.attempts || 1) <= 1);
    const patchedIncidents = allIncidents.filter((i) => i.patch && i.patch.ops);

    // MTTD calculation
    const mttdList = allIncidents
      .filter((i) => i.failed_at && i.detected_at)
      .map((i) => Math.max(0.2, (new Date(i.detected_at).getTime() - new Date(i.failed_at).getTime()) / 1000));
    const avgMttd = mttdList.length > 0 ? mttdList.reduce((a, b) => a + b, 0) / mttdList.length : 0.8;

    // MTTR calculation (seconds)
    const mttrList = healed
      .filter((i) => i.detected_at && i.resolved_at)
      .map((i) => Math.max(0.5, (new Date(i.resolved_at).getTime() - new Date(i.detected_at).getTime()) / 1000));
    const avgMttr = mttrList.length > 0 ? mttrList.reduce((a, b) => a + b, 0) / mttrList.length : 3.5;

    // Time saved vs assumed manual baseline
    const avgMttrMin = avgMttr / 60;
    const timeSavedMinutes = Math.max(0, (MANUAL_MTTR_MIN - avgMttrMin) * healed.length);
    const timeSavedHours = Number((timeSavedMinutes / 60).toFixed(1));

    // Risk distribution
    let lowRisk = 0, medRisk = 0, highRisk = 0;
    let totalRisk = 0;
    let riskCount = 0;

    for (const inc of allIncidents) {
      if (inc.risk && typeof inc.risk.score === "number") {
        totalRisk += inc.risk.score;
        riskCount++;
        if (inc.risk.score < 30) lowRisk++;
        else if (inc.risk.score <= 60) medRisk++;
        else highRisk++;
      }
    }

    const avgRiskScore = riskCount > 0 ? Math.round(totalRisk / riskCount) : 0;

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    for (const inc of allIncidents) {
      const cat = inc.diagnosis?.category || inc.error_code || "unknown";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categoryBreakdown = Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count,
    }));

    // MTTR Trend over time
    const mttrTrend = healed
      .filter((i) => i.detected_at && i.resolved_at)
      .map((i, idx) => ({
        incident: i.incident_code || `INC-${idx + 1}`,
        mttr_seconds: Number(
          Math.max(0.5, (new Date(i.resolved_at).getTime() - new Date(i.detected_at).getTime()) / 1000).toFixed(1)
        ),
        used_memory: Boolean(i.used_memory),
      }));

    return NextResponse.json({
      total_incidents: total,
      healed_count: healed.length,
      escalated_count: escalated.length,
      mttd_seconds: Number(avgMttd.toFixed(2)),
      mttr_seconds: Number(avgMttr.toFixed(1)),
      auto_heal_rate: Number(((autoHealed.length / total) * 100).toFixed(1)),
      assisted_heal_rate: Number(((assistedHealed.length / total) * 100).toFixed(1)),
      escalation_rate: Number(((escalated.length / total) * 100).toFixed(1)),
      first_attempt_rate: healed.length > 0 ? Number(((firstAttemptHealed.length / healed.length) * 100).toFixed(1)) : 0,
      patch_success_rate: patchedIncidents.length > 0 ? Number(((healed.length / patchedIncidents.length) * 100).toFixed(1)) : 0,
      memory_hit_rate: Number(((memoryHits.length / total) * 100).toFixed(1)),
      avg_risk_score: avgRiskScore,
      time_saved_hours: timeSavedHours,
      manual_baseline_minutes: MANUAL_MTTR_MIN,
      category_breakdown: categoryBreakdown,
      mttr_trend: mttrTrend,
      risk_distribution: { low: lowRisk, medium: medRisk, high: highRisk },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { generatePostmortem } from "@/lib/postmortem";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Check existing
    const { data: existing } = await supabaseAdmin
      .from("postmortems")
      .select("*")
      .eq("incident_id", incidentId)
      .maybeSingle();

    if (existing && existing.markdown) {
      return NextResponse.json({
        incident_id: incidentId,
        markdown: existing.markdown,
        created_at: existing.created_at,
      });
    }

    // Generate if not cached yet
    const markdown = await generatePostmortem(incidentId);
    return NextResponse.json({
      incident_id: incidentId,
      markdown,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;
    const markdown = await generatePostmortem(incidentId);
    return NextResponse.json({
      incident_id: incidentId,
      markdown,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

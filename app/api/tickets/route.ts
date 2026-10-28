import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ tickets: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ tickets: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from("support_tickets")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ticket: data });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


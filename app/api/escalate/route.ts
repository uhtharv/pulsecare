import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ escalations: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("*, messages(*)")
      .in("status", ["escalated", "operator_taken_over"])
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ escalations: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { conversationId, content, operatorName = "Nurse Sarah (Live Staff)" } = body;

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "Missing conversationId or content" },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // 1. Insert message from human operator
      const { data: msg, error: msgErr } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender: "operator",
          content: `[${operatorName}]: ${content}`,
        })
        .select("*")
        .single();

      if (msgErr) throw msgErr;

      // 2. Update conversation status to operator_taken_over
      await supabaseAdmin
        .from("conversations")
        .update({
          status: "operator_taken_over",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return NextResponse.json({ success: true, message: msg });
    }

    return NextResponse.json({ success: true, simulated: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { saveKnowledgeArticle } from "@/lib/knowledge";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ articles: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("knowledge_base")
      .select("id, title, category, content, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ articles: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, category, content, id } = body;

    if (!title || !category || !content) {
      return NextResponse.json(
        { error: "title, category, and content are required" },
        { status: 400 }
      );
    }

    const saved = await saveKnowledgeArticle(title, category, content, id);
    return NextResponse.json({ article: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (isSupabaseConfigured()) {
      await supabaseAdmin.from("knowledge_base").delete().eq("id", id);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


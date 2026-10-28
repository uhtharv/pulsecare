import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

const inMemorySlackStore = new Map<string, any[]>();

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("x-idempotency-key") || "";
    const isDryRun = req.headers.get("x-dry-run") === "true";
    const body = await req.json().catch(() => ({}));

    if (!body.full_name || !body.plan) {
      return NextResponse.json(
        {
          error_code: "SLACK_PAYLOAD_MISSING_FIELDS",
          error_message: "slack_notify requires 'full_name' and 'plan'",
        },
        { status: 400 }
      );
    }

    if (isDryRun) {
      return NextResponse.json({
        status: "valid",
        dry_run: true,
        message: "Slack notification contract dry-run validation passed",
      });
    }

    // Idempotency: check if notification already posted for this run_code
    if (idempotencyKey) {
      if (isSupabaseConfigured()) {
        const { data: existing } = await supabaseAdmin
          .from("mock_records")
          .select("*")
          .eq("service", "slack")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({
            message_id: existing.payload?.message_id || existing.id,
            status: "already_posted",
            idempotent: true,
            channel: "#customer-onboarding",
          });
        }
      } else if (inMemorySlackStore.has(idempotencyKey)) {
        return NextResponse.json(inMemorySlackStore.get(idempotencyKey)![0]);
      }
    }

    const messageId = `slack_msg_${Math.random().toString(36).substring(2, 10)}`;
    const recordPayload = {
      message_id: messageId,
      channel: "#customer-onboarding",
      full_name: body.full_name,
      plan: body.plan,
      company: body.company || null,
      posted_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabaseAdmin.from("mock_records").insert({
        service: "slack",
        idempotency_key: idempotencyKey || null,
        payload: recordPayload,
      });
    } else if (idempotencyKey) {
      inMemorySlackStore.set(idempotencyKey, [{ message_id: messageId, status: "posted", channel: "#customer-onboarding" }]);
    }

    return NextResponse.json({
      message_id: messageId,
      status: "posted",
      channel: "#customer-onboarding",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error_code: "SLACK_SERVICE_ERROR",
        error_message: err.message || "Failed to post Slack notification",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing 'key' query parameter" }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const { data: records } = await supabaseAdmin
      .from("mock_records")
      .select("*")
      .eq("service", "slack")
      .eq("idempotency_key", key);

    return NextResponse.json({
      count: records?.length || 0,
      deliveries: records || [],
    });
  }

  const deliveries = inMemorySlackStore.get(key) || [];
  return NextResponse.json({
    count: deliveries.length,
    deliveries,
  });
}


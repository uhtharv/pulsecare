import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

const inMemoryEmailStore = new Map<string, any[]>();

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("x-idempotency-key") || "";
    const isDryRun = req.headers.get("x-dry-run") === "true";
    const body = await req.json().catch(() => ({}));

    if (!body.email || !body.full_name) {
      return NextResponse.json(
        {
          error_code: "EMAIL_PAYLOAD_MISSING_FIELDS",
          error_message: "send_welcome_email requires 'email' and 'full_name'",
        },
        { status: 400 }
      );
    }

    if (isDryRun) {
      return NextResponse.json({
        status: "valid",
        dry_run: true,
        message: "Email dispatch contract dry-run validation passed",
      });
    }

    // Idempotency: check if email was already dispatched for this run_code
    if (idempotencyKey) {
      if (isSupabaseConfigured()) {
        const { data: existing } = await supabaseAdmin
          .from("mock_records")
          .select("*")
          .eq("service", "email")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({
            message_id: existing.payload?.message_id || existing.id,
            status: "already_sent",
            idempotent: true,
            recipient: body.email,
          });
        }
      } else if (inMemoryEmailStore.has(idempotencyKey)) {
        return NextResponse.json(inMemoryEmailStore.get(idempotencyKey)![0]);
      }
    }

    const messageId = `email_msg_${Math.random().toString(36).substring(2, 10)}`;
    const recordPayload = {
      message_id: messageId,
      recipient: body.email,
      full_name: body.full_name,
      sent_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabaseAdmin.from("mock_records").insert({
        service: "email",
        idempotency_key: idempotencyKey || null,
        payload: recordPayload,
      });
    } else if (idempotencyKey) {
      inMemoryEmailStore.set(idempotencyKey, [{ message_id: messageId, status: "sent", recipient: body.email }]);
    }

    return NextResponse.json({
      message_id: messageId,
      status: "sent",
      recipient: body.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error_code: "EMAIL_SERVICE_ERROR",
        error_message: err.message || "Failed to dispatch email",
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
      .eq("service", "email")
      .eq("idempotency_key", key);

    return NextResponse.json({
      count: records?.length || 0,
      deliveries: records || [],
    });
  }

  const deliveries = inMemoryEmailStore.get(key) || [];
  return NextResponse.json({
    count: deliveries.length,
    deliveries,
  });
}


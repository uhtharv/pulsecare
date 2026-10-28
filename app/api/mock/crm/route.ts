import { NextRequest, NextResponse } from "next/server";
import { CRMContractSchema } from "@/lib/contract";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

// In-memory fallback for mock records if Supabase is offline
const inMemoryCRMStore = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const fault = req.headers.get("x-fault") || "";
    const attempt = parseInt(req.headers.get("x-attempt") || "1", 10);
    const isDryRun = req.headers.get("x-dry-run") === "true";
    const idempotencyKey = req.headers.get("x-idempotency-key") || "";

    // 1. Fault injection: auth_401 (non-healable, must escalate)
    if (fault === "auth_401") {
      return NextResponse.json(
        {
          error_code: "CRM_AUTH_EXPIRED",
          error_message: "CRM API credential expired or unauthorized (HTTP 401)",
        },
        { status: 401 }
      );
    }

    // 2. Fault injection: upstream_500 (transient, fails first 2 attempts)
    if (fault === "upstream_500" && attempt < 3) {
      return NextResponse.json(
        {
          error_code: "CRM_UPSTREAM_500",
          error_message: `CRM internal server error (HTTP 500) on attempt ${attempt}. Upstream service unavailable.`,
        },
        { status: 500 }
      );
    }

    // 3. Fault injection: rate_limit_429 (transient, fails once with Retry-After: 2)
    if (fault === "rate_limit_429" && attempt === 1) {
      return new NextResponse(
        JSON.stringify({
          error_code: "CRM_RATE_LIMITED",
          error_message: "CRM API rate limit reached. Back off requested.",
          retry_after_seconds: 2,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "2",
          },
        }
      );
    }

    // Parse body
    const body = await req.json().catch(() => ({}));

    // 4. Validate payload against strict CRM Contract
    const parseResult = CRMContractSchema.safeParse(body);
    if (!parseResult.success) {
      const issueDetails = parseResult.error.issues
        .map((issue) => `Field '${issue.path.join(".") || "root"}': ${issue.message}`)
        .join("; ");

      return NextResponse.json(
        {
          error_code: "CRM_CONTRACT_VALIDATION_ERROR",
          error_message: `CRM contract violation: ${issueDetails}`,
          issues: parseResult.error.issues,
        },
        { status: 422 }
      );
    }

    // 5. Dry run check: validate only, do not persist
    if (isDryRun) {
      return NextResponse.json({
        status: "valid",
        dry_run: true,
        message: "CRM payload contract validation passed",
      });
    }

    // 6. Idempotency check: if key already exists, return existing record
    if (idempotencyKey) {
      if (isSupabaseConfigured()) {
        const { data: existing } = await supabaseAdmin
          .from("mock_records")
          .select("*")
          .eq("service", "crm")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({
            record_id: existing.payload?.record_id || existing.id,
            status: "existing",
            idempotent: true,
          });
        }
      } else if (inMemoryCRMStore.has(idempotencyKey)) {
        return NextResponse.json(inMemoryCRMStore.get(idempotencyKey));
      }
    }

    // 7. Success: create new CRM record
    const recordId = `crm_rec_${Math.random().toString(36).substring(2, 10)}`;
    const recordPayload = { ...parseResult.data, record_id: recordId };

    if (isSupabaseConfigured()) {
      await supabaseAdmin.from("mock_records").insert({
        service: "crm",
        idempotency_key: idempotencyKey || null,
        payload: recordPayload,
      });
    } else if (idempotencyKey) {
      inMemoryCRMStore.set(idempotencyKey, { record_id: recordId, status: "created" });
    }

    return NextResponse.json({
      record_id: recordId,
      status: "created",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error_code: "CRM_INTERNAL_ERROR",
        error_message: err.message || "Unexpected CRM service failure",
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
      .eq("service", "crm")
      .eq("idempotency_key", key);

    const exists = Boolean(records && records.length > 0);
    return NextResponse.json({
      exists,
      count: records?.length || 0,
      record: exists ? records![0] : null,
    });
  }

  const exists = inMemoryCRMStore.has(key);
  return NextResponse.json({
    exists,
    count: exists ? 1 : 0,
    record: exists ? inMemoryCRMStore.get(key) : null,
  });
}


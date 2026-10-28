export type ChaosType =
  | "schema_drift"
  | "type_mismatch"
  | "missing_field"
  | "null_value"
  | "date_format"
  | "enum_case"
  | "upstream_500"
  | "rate_limit_429"
  | "auth_401"
  | "combo_fault";

export interface ChaosDefinition {
  id: ChaosType;
  title: string;
  description: string;
  healable: boolean;
  expectedAction: "patch_payload" | "retry_with_backoff" | "wait_and_retry" | "escalate";
  isPayloadFault: boolean;
}

export const CHAOS_DEFINITIONS: Record<ChaosType, ChaosDefinition> = {
  schema_drift: {
    id: "schema_drift",
    title: "Schema Drift",
    description: "Renames key 'email' to 'emailAddress'.",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
  type_mismatch: {
    id: "type_mismatch",
    title: "Type Mismatch",
    description: "Phone number supplied as integer (919876543210).",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
  missing_field: {
    id: "missing_field",
    title: "Missing Field",
    description: "Removes required 'plan' field entirely.",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
  null_value: {
    id: "null_value",
    title: "Forbidden Null",
    description: "Sets 'company: null' (contract forbids explicit nulls).",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
  date_format: {
    id: "date_format",
    title: "Invalid Date Format",
    description: "Formats date as DD/MM/YYYY ('28/10/2026') instead of ISO 8601 UTC.",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
  enum_case: {
    id: "enum_case",
    title: "Enum Case Mismatch",
    description: "Sets plan to uppercase 'PRO' instead of 'pro'.",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
  upstream_500: {
    id: "upstream_500",
    title: "Upstream 500 Server Error",
    description: "CRM mock returns 500 for the first 2 attempts, then succeeds.",
    healable: true,
    expectedAction: "retry_with_backoff",
    isPayloadFault: false,
  },
  rate_limit_429: {
    id: "rate_limit_429",
    title: "Rate Limited (429)",
    description: "CRM returns 429 Too Many Requests with Retry-After: 2 on first attempt.",
    healable: true,
    expectedAction: "wait_and_retry",
    isPayloadFault: false,
  },
  auth_401: {
    id: "auth_401",
    title: "Expired Credentials (401)",
    description: "CRM returns 401 Unauthorized; system must refuse to patch and escalate safely.",
    healable: false,
    expectedAction: "escalate",
    isPayloadFault: false,
  },
  combo_fault: {
    id: "combo_fault",
    title: "Combo Fault (Multi-step)",
    description: "Injects schema_drift + date_format together; resolves across 2 healing attempts.",
    healable: true,
    expectedAction: "patch_payload",
    isPayloadFault: true,
  },
};

/**
 * Applies payload mutations based on selected chaos types.
 */
export function injectPayloadChaos(basePayload: Record<string, any>, chaosTypes: ChaosType[]): Record<string, any> {
  const payload = JSON.parse(JSON.stringify(basePayload));

  for (const fault of chaosTypes) {
    switch (fault) {
      case "schema_drift":
        if ("email" in payload) {
          payload.emailAddress = payload.email;
          delete payload.email;
        }
        break;

      case "type_mismatch":
        // convert string phone to integer
        payload.phone = 919876543210;
        break;

      case "missing_field":
        delete payload.plan;
        break;

      case "null_value":
        payload.company = null;
        break;

      case "date_format":
        payload.signup_date = "28/10/2026";
        break;

      case "enum_case":
        payload.plan = "PRO";
        break;

      case "combo_fault":
        // schema_drift + date_format
        if ("email" in payload) {
          payload.emailAddress = payload.email;
          delete payload.email;
        }
        payload.signup_date = "28/10/2026";
        break;

      default:
        break;
    }
  }

  return payload;
}


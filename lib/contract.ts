import { z } from "zod";

// Phone E.164 regex: + followed by 8 to 15 digits
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

// Strict CRM Zod Schema
export const CRMContractSchema = z.object({
  full_name: z.string({
    required_error: "full_name is required",
    invalid_type_error: "full_name must be a string",
  }).min(2, "full_name must be at least 2 characters"),

  email: z.string({
    required_error: "email is required",
    invalid_type_error: "email must be a string",
  }).email("email must be a valid email address"),

  phone: z.string({
    required_error: "phone is required",
    invalid_type_error: "phone must be a string",
  }).regex(E164_REGEX, "phone must be in E.164 format (+[country][number], e.g. +919876543210)"),

  plan: z.enum(["free", "pro", "enterprise"], {
    required_error: "plan is required",
    invalid_type_error: "plan must be one of: free, pro, enterprise",
  }).default("free"),

  signup_date: z.string({
    required_error: "signup_date is required",
    invalid_type_error: "signup_date must be an ISO 8601 UTC string",
  }).refine((val) => {
    // Must be valid date and ISO 8601 format
    if (typeof val !== "string") return false;
    const parsed = Date.parse(val);
    return !isNaN(parsed) && (val.includes("T") || val.includes("Z"));
  }, "signup_date must be a valid ISO 8601 UTC date string (e.g. 2026-10-28T10:30:00Z)"),

  company: z.string({
    invalid_type_error: "company must be a string if provided (null is strictly forbidden)",
  }).optional(),
}).strict("Unknown fields not allowed in CRM contract");

export type CRMPayload = z.infer<typeof CRMContractSchema>;

// Golden sample healthy payload
export const GOLDEN_PAYLOAD: CRMPayload = {
  full_name: "Aarav Sharma",
  email: "aarav@example.com",
  phone: "+919876543210",
  plan: "pro",
  signup_date: "2026-10-28T10:30:00Z",
  company: "Acme Pvt Ltd",
};

// Contract specification passed to LLM prompts
export const CRM_CONTRACT_TEXT = `
CRM API Contract Specification:
- full_name (string, required): minimum 2 characters.
- email (string, required): valid email format.
- phone (string, required): E.164 phone format matching ^\\+[1-9]\\d{7,14}$ (must start with +).
- plan (enum string, required): allowed values ["free", "pro", "enterprise"]. Default: "free" (ONLY field with a contract default).
- signup_date (string, required): ISO 8601 UTC timestamp format (e.g., "2026-10-28T10:30:00Z").
- company (string, optional): null is strictly forbidden. If null or empty, remove the key or omit it.

Rules for Fixes:
1. "plan" is the ONLY field that can be added if missing, using default value "free".
2. If "company" is null, it should be removed.
3. Phone numbers provided as integers or lacking "+" must be cast to string with leading "+".
4. Date formats like DD/MM/YYYY must be converted to ISO 8601 UTC strings.
5. Case mismatches like "PRO" must be lowercased to valid enum values.
6. Renamed keys (e.g. "emailAddress" -> "email") must be moved to the correct contract key name.
7. External upstream/auth issues cannot be healed with payload patches.
`.trim();

// Field default values defined in contract
export const CONTRACT_DEFAULTS: Record<string, any> = {
  plan: "free",
};

// Known contract fields list
export const ALLOWED_CONTRACT_FIELDS = [
  "full_name",
  "email",
  "phone",
  "plan",
  "signup_date",
  "company",
];


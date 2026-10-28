import { ALLOWED_CONTRACT_FIELDS, CONTRACT_DEFAULTS, CRMContractSchema } from "./contract";

export interface JSONPatchOp {
  op: "add" | "remove" | "replace" | "move" | "copy";
  path: string;
  from?: string;
  value?: any;
}

export interface PatchProposal {
  ops: JSONPatchOp[];
  rationale: string;
  expected_outcome: string;
}

export interface GuardResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates proposed JSON patch operations against strict safety guardrails.
 */
export function guardPatchProposal(
  proposal: PatchProposal,
  currentPayload: Record<string, any>
): GuardResult {
  const errors: string[] = [];

  if (!proposal || !Array.isArray(proposal.ops)) {
    return { valid: false, errors: ["Proposal missing valid ops array"] };
  }

  // 1. Max 5 ops
  if (proposal.ops.length === 0) {
    return { valid: false, errors: ["Patch proposal contains 0 operations"] };
  }
  if (proposal.ops.length > 5) {
    errors.push(`Exceeded maximum allowed operations (max 5, got ${proposal.ops.length})`);
  }

  for (let i = 0; i < proposal.ops.length; i++) {
    const op = proposal.ops[i];
    const prefix = `Op #${i + 1} (${op.op})`;

    // Check op validity
    if (!["add", "remove", "replace", "move", "copy"].includes(op.op)) {
      errors.push(`${prefix}: Invalid operation '${op.op}'`);
      continue;
    }

    // Check path pointer format: e.g. "/email"
    if (!op.path || typeof op.path !== "string" || !op.path.startsWith("/")) {
      errors.push(`${prefix}: Path must start with '/' (e.g. /email)`);
      continue;
    }

    const targetField = op.path.replace(/^\//, "");

    // Path must exist in the contract's field list
    if (!ALLOWED_CONTRACT_FIELDS.includes(targetField)) {
      errors.push(`${prefix}: Target field '${targetField}' is not a permitted CRM contract field`);
    }

    // Never touch anything outside payload
    if (op.path.includes("..") || op.path.startsWith("/headers") || op.path.startsWith("/auth") || op.path.startsWith("/config")) {
      errors.push(`${prefix}: Forbidden access outside payload attributes`);
    }

    // 'move' / 'copy' 'from' checks
    if (op.op === "move" || op.op === "copy") {
      if (!op.from || typeof op.from !== "string" || !op.from.startsWith("/")) {
        errors.push(`${prefix}: 'from' pointer is required and must start with '/'`);
      } else {
        const sourceField = op.from.replace(/^\//, "");
        if (!(sourceField in currentPayload)) {
          errors.push(`${prefix}: Source field '${sourceField}' does not exist in current payload`);
        }
      }
    }

    // 'add' checks: only allowed for fields with a contract default (i.e. 'plan')
    if (op.op === "add") {
      if (!(targetField in CONTRACT_DEFAULTS)) {
        errors.push(`${prefix}: 'add' operation is strictly only permitted for fields with contract defaults (allowed: ${Object.keys(CONTRACT_DEFAULTS).join(", ")})`);
      } else if (op.value !== CONTRACT_DEFAULTS[targetField]) {
        errors.push(`${prefix}: 'add' value for '${targetField}' must match contract default '${CONTRACT_DEFAULTS[targetField]}'`);
      }
    }

    // 'replace' type sanity check
    if (op.op === "replace" && op.value === undefined) {
      errors.push(`${prefix}: 'replace' operation requires a replacement value`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


import { JSONPatchOp } from "./patch-guard";

export interface RiskBreakdown {
  field_sensitivity: number;
  change_magnitude: number;
  uncertainty: number; // (1 - confidence) * 100
  blast_norm: number;
  irreversibility: number;
}

export interface BlastRadius {
  affected_steps: string[];
  similar_runs: number;
  side_effects: string[];
  fields_changed: string[];
}

export interface RiskEvaluation {
  score: number; // 0 - 100
  level: "low" | "medium" | "high";
  breakdown: RiskBreakdown;
  blast_radius: BlastRadius;
}

const FIELD_SENSITIVITY_MAP: Record<string, number> = {
  plan: 80,
  email: 70,
  phone: 70,
  full_name: 40,
  signup_date: 20,
  company: 10,
};

const STEP_IRREVERSIBILITY_MAP: Record<string, number> = {
  send_welcome_email: 100,
  crm_create: 60,
  slack_notify: 40,
};

/**
 * Checks if a replace op is format-only (e.g. stringified number, date reformatted, case folded).
 */
function isFormatOnlyReplace(oldVal: any, newVal: any): boolean {
  if (oldVal === undefined || newVal === undefined) return false;

  // Case folded strings: e.g. "PRO" vs "pro"
  if (typeof oldVal === "string" && typeof newVal === "string") {
    if (oldVal.toLowerCase() === newVal.toLowerCase()) return true;

    // Date normalization check
    const d1 = Date.parse(oldVal);
    const d2 = Date.parse(newVal);
    if (!isNaN(d1) && !isNaN(d2) && d1 === d2) return true;
  }

  // Stringified number: 919876543210 vs "+919876543210" or "919876543210"
  if ((typeof oldVal === "number" || typeof oldVal === "string") && typeof newVal === "string") {
    const sOld = String(oldVal).replace(/^\+/, "");
    const sNew = String(newVal).replace(/^\+/, "");
    if (sOld === sNew) return true;
  }

  return false;
}

/**
 * Evaluates the blast radius and risk score according to Section 6 F7 formula.
 */
export function evaluateRisk(params: {
  ops: JSONPatchOp[];
  confidence: number;
  currentPayload: Record<string, any>;
  failedStep: string;
  completedSteps: string[];
  similarOpenRuns?: number;
  isRetryOnly?: boolean;
}): RiskEvaluation {
  const {
    ops,
    confidence,
    currentPayload,
    failedStep,
    completedSteps,
    similarOpenRuns = 0,
    isRetryOnly = false,
  } = params;

  // All 4 pipeline steps in order
  const ALL_STEPS = ["ingest", "crm_create", "send_welcome_email", "slack_notify"];
  const failedIdx = ALL_STEPS.indexOf(failedStep);
  const remainingSteps = ALL_STEPS.filter(
    (step, idx) => idx >= failedIdx && !completedSteps.includes(step)
  );

  // Irreversibility: max over downstream steps still to run
  let irreversibility = 0;
  const sideEffects: string[] = [];

  for (const step of remainingSteps) {
    if (step === "send_welcome_email") {
      irreversibility = Math.max(irreversibility, 100);
      sideEffects.push("Outbound customer welcome email will be sent");
    } else if (step === "crm_create") {
      irreversibility = Math.max(irreversibility, 60);
      sideEffects.push("Customer record will be created in CRM");
    } else if (step === "slack_notify") {
      irreversibility = Math.max(irreversibility, 40);
      sideEffects.push("Slack channel team notification will be triggered");
    }
  }

  // Blast norm = min(100, 20*similar_open_runs + 15*downstream_steps_affected)
  const downstreamCount = remainingSteps.length;
  const blastNorm = Math.min(100, 20 * similarOpenRuns + 15 * downstreamCount);

  // Confidence uncertainty component = (1 - confidence) * 100
  const uncertainty = Math.round((1 - Math.max(0, Math.min(1, confidence))) * 100);

  // If retry-only action (no patch proposed)
  if (isRetryOnly || ops.length === 0) {
    const rawScore = 0.20 * uncertainty + 0.10 * irreversibility;
    const finalScore = Math.min(29, Math.round(rawScore)); // retry-only is always low per PRD
    return {
      score: finalScore,
      level: "low",
      breakdown: {
        field_sensitivity: 0,
        change_magnitude: 0,
        uncertainty,
        blast_norm: blastNorm,
        irreversibility,
      },
      blast_radius: {
        affected_steps: remainingSteps,
        similar_runs: similarOpenRuns,
        side_effects: sideEffects,
        fields_changed: [],
      },
    };
  }

  // Field sensitivity: max over patched fields
  let fieldSensitivity = 0;
  const fieldsChanged: string[] = [];

  for (const op of ops) {
    const field = op.path.replace(/^\//, "");
    if (!fieldsChanged.includes(field)) fieldsChanged.push(field);
    const sens = FIELD_SENSITIVITY_MAP[field] ?? 10;
    if (sens > fieldSensitivity) {
      fieldSensitivity = sens;
    }
  }

  // Change magnitude per op:
  // move or format-only replace = 15
  // remove = 40
  // add default = 50
  // any other value change = 90
  let changeMagnitude = 0;

  for (const op of ops) {
    let mag = 90;
    const field = op.path.replace(/^\//, "");
    const oldVal = currentPayload[field];

    if (op.op === "move") {
      mag = 15;
    } else if (op.op === "remove") {
      mag = 40;
    } else if (op.op === "add") {
      mag = 50;
    } else if (op.op === "replace") {
      if (isFormatOnlyReplace(oldVal, op.value)) {
        mag = 15;
      } else {
        mag = 90;
      }
    }
    if (mag > changeMagnitude) {
      changeMagnitude = mag;
    }
  }

  // Formula:
  // risk = 0.30*field_sensitivity + 0.25*change_magnitude + 0.20*(1 - confidence)*100
  //      + 0.15*blast_norm + 0.10*irreversibility
  const rawScore =
    0.30 * fieldSensitivity +
    0.25 * changeMagnitude +
    0.20 * uncertainty +
    0.15 * blastNorm +
    0.10 * irreversibility;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let level: "low" | "medium" | "high" = "low";
  if (score >= 60) {
    level = "high";
  } else if (score >= 30) {
    level = "medium";
  }

  return {
    score,
    level,
    breakdown: {
      field_sensitivity: fieldSensitivity,
      change_magnitude: changeMagnitude,
      uncertainty,
      blast_norm: blastNorm,
      irreversibility,
    },
    blast_radius: {
      affected_steps: remainingSteps,
      similar_runs: similarOpenRuns,
      side_effects: sideEffects,
      fields_changed: fieldsChanged,
    },
  };
}


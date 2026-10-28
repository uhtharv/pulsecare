import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  actionData: any;
  message: string;
}

// Gemini Tool Declarations for Function Calling
export const PULSECARE_TOOL_DECLARATIONS = [
  {
    name: "book_appointment",
    description: "Book an in-person or telehealth doctor appointment for a patient.",
    parameters: {
      type: "OBJECT",
      properties: {
        patient_name: { type: "STRING", description: "Full name of the patient" },
        patient_email: { type: "STRING", description: "Email address of the patient" },
        patient_phone: { type: "STRING", description: "Phone number of the patient" },
        doctor_name: { type: "STRING", description: "Name of the doctor (e.g. Dr. Marcus Reynolds, Dr. Elena Vance, Dr. James Chen)" },
        specialty: { type: "STRING", description: "Medical specialty (Cardiology, Dermatology, Family Medicine, Pediatrics)" },
        appointment_date: { type: "STRING", description: "Date of appointment in YYYY-MM-DD format" },
        appointment_time: { type: "STRING", description: "Time of appointment (e.g. 10:00 AM, 02:30 PM)" },
        reason_for_visit: { type: "STRING", description: "Brief symptom or reason for visit" },
      },
      required: ["patient_name", "patient_email", "patient_phone", "doctor_name", "specialty", "appointment_date", "appointment_time"],
    },
  },
  {
    name: "create_support_ticket",
    description: "Create a formal support or service request ticket for prescription refills, billing disputes, or medical records.",
    parameters: {
      type: "OBJECT",
      properties: {
        patient_name: { type: "STRING", description: "Full name of the patient" },
        patient_email: { type: "STRING", description: "Email address of the patient" },
        issue_category: {
          type: "STRING",
          enum: ["prescription_refill", "billing", "medical_records", "general"],
          description: "Category of the support request",
        },
        priority: {
          type: "STRING",
          enum: ["low", "medium", "high", "urgent"],
          description: "Priority of the ticket",
        },
        subject: { type: "STRING", description: "Short summary subject of the issue" },
        description: { type: "STRING", description: "Detailed description of the issue or prescription refill details" },
      },
      required: ["patient_name", "patient_email", "issue_category", "priority", "subject", "description"],
    },
  },
  {
    name: "record_lead",
    description: "Record a prospective new patient registration, insurance inquiry, or corporate wellness lead.",
    parameters: {
      type: "OBJECT",
      properties: {
        contact_name: { type: "STRING", description: "Full name of prospective patient or corporate contact" },
        email: { type: "STRING", description: "Email address" },
        phone: { type: "STRING", description: "Phone number" },
        insurance_provider: { type: "STRING", description: "Insurance provider (e.g. Aetna, BlueCross, Medicare, Uninsured)" },
        interested_services: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of interested services (e.g. Preventive Cardiology, Skin Check, Annual Physical)",
        },
        interest_level: {
          type: "STRING",
          enum: ["hot", "warm", "cold"],
          description: "Lead priority level based on intent",
        },
        notes: { type: "STRING", description: "Additional notes or inquiries" },
      },
      required: ["contact_name", "email", "interest_level"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Immediately escalate an emergency situation, acute symptoms, or unresolved patient request to human clinic medical staff.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: { type: "STRING", description: "Reason for escalation (e.g. Acute chest pain triage, Customer requested human nurse)" },
        summary: { type: "STRING", description: "2-sentence clinical handoff summary for the triage nurse" },
        urgency: {
          type: "STRING",
          enum: ["normal", "high", "emergency"],
          description: "Triage urgency level",
        },
      },
      required: ["reason", "summary", "urgency"],
    },
  },
];

/**
 * Executes an autonomous database action invoked by Gemini.
 */
export async function executePulseCareTool(
  name: string,
  args: any,
  conversationId?: string
): Promise<ToolExecutionResult> {
  if (!isSupabaseConfigured()) {
    return {
      toolName: name,
      success: true,
      actionData: args,
      message: `Action '${name}' simulated (Supabase offline).`,
    };
  }

  try {
    switch (name) {
      case "book_appointment": {
        const { data, error } = await supabaseAdmin
          .from("appointments")
          .insert({
            conversation_id: conversationId || null,
            patient_name: args.patient_name,
            patient_email: args.patient_email,
            patient_phone: args.patient_phone,
            doctor_name: args.doctor_name,
            specialty: args.specialty,
            appointment_date: args.appointment_date,
            appointment_time: args.appointment_time,
            reason_for_visit: args.reason_for_visit || "General Consultation",
            status: "confirmed",
          })
          .select("*")
          .single();

        if (error) throw error;

        return {
          toolName: name,
          success: true,
          actionData: data,
          message: `Appointment confirmed with ${args.doctor_name} on ${args.appointment_date} at ${args.appointment_time}.`,
        };
      }

      case "create_support_ticket": {
        const ticketCode = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data, error } = await supabaseAdmin
          .from("support_tickets")
          .insert({
            ticket_code: ticketCode,
            conversation_id: conversationId || null,
            patient_name: args.patient_name,
            patient_email: args.patient_email,
            issue_category: args.issue_category,
            priority: args.priority || "medium",
            status: "open",
            subject: args.subject,
            description: args.description,
          })
          .select("*")
          .single();

        if (error) throw error;

        return {
          toolName: name,
          success: true,
          actionData: data,
          message: `Support ticket ${ticketCode} created successfully (${args.priority} priority).`,
        };
      }

      case "record_lead": {
        const { data, error } = await supabaseAdmin
          .from("leads")
          .insert({
            conversation_id: conversationId || null,
            contact_name: args.contact_name,
            email: args.email,
            phone: args.phone || null,
            insurance_provider: args.insurance_provider || null,
            interested_services: args.interested_services || [],
            interest_level: args.interest_level || "warm",
            status: "new",
            notes: args.notes || null,
          })
          .select("*")
          .single();

        if (error) throw error;

        return {
          toolName: name,
          success: true,
          actionData: data,
          message: `Prospective patient lead registered in clinic CRM for ${args.contact_name}.`,
        };
      }

      case "escalate_to_human": {
        if (conversationId) {
          await supabaseAdmin
            .from("conversations")
            .update({
              status: "escalated",
              urgency: args.urgency || "high",
              summary: args.summary,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        }

        return {
          toolName: name,
          success: true,
          actionData: {
            reason: args.reason,
            summary: args.summary,
            urgency: args.urgency,
            escalated_at: new Date().toISOString(),
          },
          message: `Urgent escalation initiated (${args.urgency} triage level). Clinic staff notified for live takeover.`,
        };
      }

      default:
        throw new Error(`Unknown tool name: ${name}`);
    }
  } catch (err: any) {
    console.error(`Tool execution error for ${name}:`, err.message);
    return {
      toolName: name,
      success: false,
      actionData: null,
      message: `Failed to execute action ${name}: ${err.message}`,
    };
  }
}


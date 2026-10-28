import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { searchKnowledge } from "@/lib/knowledge";
import { PULSECARE_TOOL_DECLARATIONS, executePulseCareTool } from "@/lib/tools";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

const apiKey = process.env.GEMINI_API_KEY || "";
const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function getAIClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      message,
      conversationId: incomingConvId,
      sessionId = `sess_${Date.now()}`,
      patientInfo = {},
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message string" }, { status: 400 });
    }

    let conversationId = incomingConvId;

    // 1. Ensure conversation exists in Supabase
    if (isSupabaseConfigured()) {
      if (!conversationId) {
        const { data: conv } = await supabaseAdmin
          .from("conversations")
          .insert({
            session_id: sessionId,
            patient_name: patientInfo.name || null,
            patient_email: patientInfo.email || null,
            patient_phone: patientInfo.phone || null,
            status: "active",
            sentiment: "neutral",
          })
          .select("id")
          .single();

        if (conv) conversationId = conv.id;
      }

      // Store incoming patient message
      if (conversationId) {
        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          sender: "patient",
          content: message,
        });
      }
    }

    // 2. Fetch Knowledge Base context via pgvector RAG
    const knowledgeContext = await searchKnowledge(message, 3);

    // 3. Fetch recent conversation history
    let history: any[] = [];
    if (isSupabaseConfigured() && conversationId) {
      const { data: recentMsgs } = await supabaseAdmin
        .from("messages")
        .select("sender, content, action_type, action_data")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (recentMsgs) {
        history = recentMsgs.reverse().map((m) => ({
          role: m.sender === "patient" ? "user" : "model",
          parts: [{ text: m.content }],
        }));
      }
    }

    // 4. Construct Prompt & System Instructions
    const systemInstruction = `
You are PulseCare AI, an empathetic, highly efficient healthcare concierge and clinic operations assistant for PulseCare Health Clinic.

YOUR MISSION:
Instead of just giving generic advice, you TAKE REAL ACTION for patients:
1. Book doctor appointments (Cardiology, Dermatology, Family Medicine, Pediatrics) using the 'book_appointment' tool.
2. File support and prescription refill requests using the 'create_support_ticket' tool.
3. Capture new patient registrations and insurance inquiries using the 'record_lead' tool.
4. IMMEDIATELY escalate emergency medical symptoms (chest pain, shortness of breath, sudden numbness, severe bleeding) or explicit requests for a human provider using the 'escalate_to_human' tool.

CLINICAL TRIAGE SAFETY RULES:
- Never provide a formal medical diagnosis or prescribe medication dosages.
- If the patient describes acute or life-threatening symptoms, immediately invoke 'escalate_to_human' with urgency='emergency', and advise them to call 911 or seek immediate emergency care.
- If asked about clinic hours, insurances, doctors, or fasting test prep, cite from the CLINIC KNOWLEDGE BASE below.

CURRENT CLINIC KNOWLEDGE BASE:
${knowledgeContext}

TONE & BEHAVIOR:
- Warm, professional, reassuring, and concise.
- When calling a tool, extract required fields (name, email, phone, date, time, reason) naturally. If any required details are missing, ask for them politely before invoking the tool.
`.trim();

    const ai = getAIClient();

    // 5. Call Gemini with Tools
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...history.slice(0, -1), // prior history excluding latest
        { role: "user", parts: [{ text: message }] },
      ],
      config: {
        temperature: 0.2,
        systemInstruction,
        tools: [{ functionDeclarations: PULSECARE_TOOL_DECLARATIONS as any }],
      },
    });

    let replyText = "";
    let executedAction: any = null;

    // 6. Check for Function / Tool Calls
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const toolName = call.name;
      const toolArgs = call.args || {};

      if (toolName) {
        // Execute tool against Supabase database
        const executionResult = await executePulseCareTool(toolName, toolArgs, conversationId);

        executedAction = {
          type: toolName,
          data: executionResult.actionData || toolArgs,
          success: executionResult.success,
          summary: executionResult.message,
        };

        // Call Gemini back with tool output to generate natural confirmation
        try {
          const modelTurn = response.candidates?.[0]?.content;
          const followUp = await ai.models.generateContent({
            model: modelName,
            contents: [
              ...history.slice(0, -1),
              { role: "user", parts: [{ text: message }] },
              modelTurn || {
                role: "model",
                parts: [{ functionCall: { name: toolName, args: toolArgs } }],
              },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      id: (call as any).id,
                      name: toolName,
                      response: { result: executionResult.message },
                    },
                  },
                ],
              },
            ],
            config: {
              temperature: 0.2,
              systemInstruction,
            },
          });

          replyText = followUp.text || executionResult.message;
        } catch (followUpErr: any) {
          console.warn("Follow-up generation warning:", followUpErr?.message || followUpErr);
          replyText = executionResult.message;
        }
      }
    } else {
      replyText = response.text || "I understand. How else can I assist with your care today?";
    }

    // 7. Store AI message and executed action in messages table
    if (isSupabaseConfigured() && conversationId) {
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        sender: "ai",
        content: replyText,
        action_type: executedAction ? executedAction.type : null,
        action_data: executedAction ? executedAction.data : null,
      });

      // Update conversation updated_at
      await supabaseAdmin
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    return NextResponse.json({
      reply: replyText,
      action: executedAction,
      conversationId,
    });
  } catch (err: any) {
    console.error("Chat API error:", err?.message || String(err));
    return NextResponse.json(
      {
        reply: "I am experiencing a momentary connection issue with the clinic database. Please try again or call our front desk directly.",
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Calendar,
  Ticket,
  UserCheck,
  AlertTriangle,
  User,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { ClaudeSpikeMark } from "./ClaudeSpikeMark";

interface ActionData {
  type: string;
  data: any;
  summary: string;
}

interface Message {
  id: string;
  sender: "patient" | "ai" | "operator";
  content: string;
  action?: ActionData | null;
  timestamp: string;
}

interface PatientChatProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

export function PatientChat({ conversationId, onConversationCreated }: PatientChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "ai",
      content:
        "Hello, I am PulseCare AI, your clinical healthcare concierge. I can answer questions about our physician team, schedule consultations, file prescription refills, or connect you directly with our triage nurses. How may I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activeConvId, setActiveConvId] = useState(conversationId || "");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Speech Recognition (Web Speech API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    setInput("");
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "patient",
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          conversationId: activeConvId,
        }),
      });

      const data = await res.json();

      if (data.conversationId && !activeConvId) {
        setActiveConvId(data.conversationId);
        if (onConversationCreated) onConversationCreated(data.conversationId);
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        content: data.reply || "Action processed.",
        action: data.action,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakText(data.reply);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          content: "Sorry, I encountered an issue communicating with the clinic service. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col h-full shadow-[0_1px_3px_rgba(20,20,19,0.06)]">
      {/* Chat Top Header */}
      <div className="px-5 py-3.5 bg-surface-soft border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-surface-card border border-hairline flex items-center justify-center text-primary shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
            <ClaudeSpikeMark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">PulseCare Concierge</h3>
              <span className="w-2 h-2 rounded-full bg-accent-teal" title="Active & Ready" />
            </div>
            <p className="text-[11px] text-muted">Action-oriented AI Concierge & Triage</p>
          </div>
        </div>

        {/* Audio Output Toggle (Claude circular icon button) */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
            voiceEnabled
              ? "bg-canvas text-primary border-hairline shadow-sm hover:border-primary/40"
              : "bg-surface-card text-muted-soft border-hairline hover:text-ink"
          }`}
          title={voiceEnabled ? "Voice Output Active" : "Voice Output Muted"}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Suggested Quick Action Chips (Claude pill tokens) */}
      <div className="px-4 py-2.5 bg-surface-soft/60 border-b border-hairline flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-muted-soft flex-shrink-0 flex items-center gap-1 text-[11px] font-medium">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Quick:
        </span>
        <button
          onClick={() => handleSend("Do you accept Aetna insurance and what are your clinic hours?")}
          className="px-3 py-1 rounded-pill bg-canvas hover:bg-surface-card text-body hover:text-ink border border-hairline whitespace-nowrap transition-all shadow-[0_1px_1px_rgba(20,20,19,0.04)]"
        >
          Insurance & Hours
        </button>
        <button
          onClick={() =>
            handleSend(
              "Book cardiology with Dr. Reynolds tomorrow at 2 PM. Name: Maya Patel, Email: maya@example.com, Phone: +15551234567"
            )
          }
          className="px-3 py-1 rounded-pill bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 whitespace-nowrap transition-all font-medium"
        >
          Book Dr. Reynolds
        </button>
        <button
          onClick={() =>
            handleSend(
              "I need a prescription refill for Atorvastatin 20mg sent to CVS. Patient: Maya Patel, Email: maya@example.com"
            )
          }
          className="px-3 py-1 rounded-pill bg-accent-amber/15 hover:bg-accent-amber/25 text-[#9a5b1c] border border-accent-amber/35 whitespace-nowrap transition-all font-medium"
        >
          Request Refill Ticket
        </button>
        <button
          onClick={() =>
            handleSend("I have sudden acute chest pain and shortness of breath radiating to my arm.")
          }
          className="px-3 py-1 rounded-pill bg-semantic-error/10 hover:bg-semantic-error/20 text-semantic-error border border-semantic-error/30 whitespace-nowrap transition-all font-medium"
        >
          Emergency Triage
        </button>
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-4 md:p-5 overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isUser = m.sender === "patient";
          const isOperator = m.sender === "operator";

          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Message Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs shadow-sm ${
                  isUser
                    ? "bg-surface-dark-elevated text-on-dark"
                    : isOperator
                    ? "bg-accent-amber text-white font-bold"
                    : "bg-primary text-white"
                }`}
              >
                {isUser ? (
                  <User className="w-3.5 h-3.5" />
                ) : isOperator ? (
                  "N"
                ) : (
                  <ClaudeSpikeMark className="w-3.5 h-3.5 text-white" />
                )}
              </div>

              {/* Message Bubble & Content */}
              <div className="max-w-[84%] space-y-2">
                {isOperator && (
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber">
                    Live Clinic Staff / Nurse Takeover
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-xl text-xs md:text-sm leading-relaxed ${
                    isUser
                      ? "bg-surface-dark text-on-dark rounded-tr-xs shadow-sm"
                      : isOperator
                      ? "bg-[#fbf5ee] border-2 border-accent-amber/60 text-ink rounded-tl-xs shadow-sm"
                      : "bg-surface-card border border-hairline text-body-strong rounded-tl-xs shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <span
                    className={`block text-[10px] mt-1.5 text-right ${
                      isUser ? "text-on-dark-soft" : "text-muted-soft"
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>

                {/* Inline Action Outcome Cards (Claude feature-card token) */}
                {m.action && (
                  <div className="mt-2 transition-all">
                    {m.action.type === "book_appointment" && (
                      <div className="p-3.5 bg-canvas border border-hairline rounded-lg space-y-2 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
                        <div className="flex items-center justify-between text-xs font-semibold text-semantic-success">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-semantic-success" />
                            Appointment Confirmed
                          </span>
                          <span className="px-2 py-0.5 rounded-pill text-[10px] bg-semantic-success/15 text-[#246736] font-medium">
                            Confirmed
                          </span>
                        </div>
                        <div className="font-serif text-base text-ink font-normal">
                          {m.action.data?.doctor_name}{" "}
                          <span className="text-xs font-sans text-muted font-normal">
                            ({m.action.data?.specialty})
                          </span>
                        </div>
                        <div className="text-xs text-body font-medium">
                          📅 {m.action.data?.appointment_date} at ⏰ {m.action.data?.appointment_time}
                        </div>
                        <div className="text-[11px] text-muted-soft font-mono pt-1 border-t border-hairline-soft">
                          Patient: {m.action.data?.patient_name} · {m.action.data?.patient_email}
                        </div>
                      </div>
                    )}

                    {m.action.type === "create_support_ticket" && (
                      <div className="p-3.5 bg-canvas border border-hairline rounded-lg space-y-2 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#9a5b1c]">
                          <span className="flex items-center gap-1.5">
                            <Ticket className="w-4 h-4 text-accent-amber" /> Support Ticket Generated
                          </span>
                          <span className="px-2 py-0.5 rounded-pill text-[10px] bg-accent-amber/20 text-[#854b14] font-mono font-medium">
                            {m.action.data?.ticket_code || "TCK-NEW"}
                          </span>
                        </div>
                        <div className="font-serif text-sm text-ink">{m.action.data?.subject}</div>
                        <div className="text-xs text-muted">
                          Category: {m.action.data?.issue_category} · Priority:{" "}
                          <span className="font-semibold text-ink uppercase">
                            {m.action.data?.priority}
                          </span>
                        </div>
                      </div>
                    )}

                    {m.action.type === "record_lead" && (
                      <div className="p-3.5 bg-canvas border border-hairline rounded-lg space-y-2 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
                        <div className="flex items-center justify-between text-xs font-semibold text-accent-teal">
                          <span className="flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-accent-teal" /> New Patient Registered in CRM
                          </span>
                          <span className="px-2 py-0.5 rounded-pill text-[10px] bg-accent-teal/15 text-[#2c7769] font-medium uppercase">
                            {m.action.data?.interest_level || "Lead"}
                          </span>
                        </div>
                        <div className="text-xs text-ink font-medium">
                          {m.action.data?.contact_name} ({m.action.data?.insurance_provider || "Self-Pay"})
                        </div>
                      </div>
                    )}

                    {m.action.type === "escalate_to_human" && (
                      <div className="p-3.5 bg-[#fdf4f4] border border-semantic-error/40 rounded-lg space-y-2 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
                        <div className="flex items-center justify-between text-xs font-semibold text-semantic-error">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-semantic-error animate-pulse" />
                            Emergency Triage Escalation
                          </span>
                          <span className="px-2 py-0.5 rounded-pill text-[10px] bg-semantic-error/15 text-semantic-error font-bold uppercase">
                            {m.action.data?.urgency || "URGENT"}
                          </span>
                        </div>
                        <p className="text-xs text-body leading-snug">
                          {m.action.data?.summary || "Clinical team has been alerted for live takeover."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted p-2 bg-surface-soft/50 rounded-md">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span>PulseCare is evaluating clinical records and executing actions...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input Bar with Voice Toggle (Claude prompt bar spec) */}
      <div className="p-3 md:p-4 bg-surface-soft border-t border-hairline flex items-center gap-2.5">
        <button
          onClick={toggleMic}
          className={`w-10 h-10 rounded-md border flex items-center justify-center transition-all ${
            isListening
              ? "bg-semantic-error text-white border-semantic-error animate-pulse shadow-sm"
              : "bg-canvas hover:bg-surface-card text-muted hover:text-ink border-hairline"
          }`}
          title={isListening ? "Listening... click to stop" : "Click to speak with microphone"}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        <input
          type="text"
          placeholder={isListening ? "Listening to your voice..." : "Type your healthcare request or medical question..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-canvas border border-hairline rounded-md px-4 py-2.5 text-xs md:text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
        />

        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="h-10 px-4 rounded-md bg-primary hover:bg-primary-active text-on-primary font-medium text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all shadow-[0_1px_2px_rgba(204,120,92,0.3)] disabled:bg-primary-disabled disabled:text-muted disabled:shadow-none disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
}

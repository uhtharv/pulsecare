"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Ticket,
  UserCheck,
  AlertTriangle,
  BookOpen,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase";
import { ClaudeSpikeMark } from "./ClaudeSpikeMark";

export function ClinicDashboard() {
  const [activeTab, setActiveTab] = useState<
    "appointments" | "tickets" | "leads" | "escalations" | "knowledge"
  >("appointments");

  const [appointments, setAppointments] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Takeover message state
  const [takeoverMsg, setTakeoverMsg] = useState("");
  const [selectedEscalationId, setSelectedEscalationId] = useState<string>("");

  // New Article Form state
  const [showAddKb, setShowAddKb] = useState(false);
  const [kbTitle, setKbTitle] = useState("");
  const [kbCategory, setKbCategory] = useState("services");
  const [kbContent, setKbContent] = useState("");

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Appointments
      const { data: appts } = await supabaseBrowser
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });
      if (appts) setAppointments(appts);

      // 2. Tickets
      const { data: tcks } = await supabaseBrowser
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (tcks) setTickets(tcks);

      // 3. Leads
      const { data: lds } = await supabaseBrowser
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (lds) setLeads(lds);

      // 4. Escalations
      const { data: escs } = await supabaseBrowser
        .from("conversations")
        .select("*, messages(*)")
        .in("status", ["escalated", "operator_taken_over"])
        .order("updated_at", { ascending: false });
      if (escs) {
        setEscalations(escs);
        if (escs.length > 0 && !selectedEscalationId) {
          setSelectedEscalationId(escs[0].id);
        }
      }

      // 5. Knowledge Base
      const { data: kb } = await supabaseBrowser
        .from("knowledge_base")
        .select("id, title, category, content, is_active, created_at")
        .order("created_at", { ascending: false });
      if (kb) setKnowledge(kb);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Supabase Realtime channel for instant operations updates
    const channel = supabaseBrowser
      .channel("clinic-ops-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => fetchAllData())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchAllData())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchAllData())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchAllData())
      .subscribe();

    const interval = setInterval(fetchAllData, 4000);

    return () => {
      supabaseBrowser.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Nurse Live Takeover Send
  const handleSendTakeover = async (convId: string) => {
    if (!takeoverMsg.trim()) return;

    try {
      await fetch("/api/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          content: takeoverMsg,
          operatorName: "Nurse Sarah (Live Staff)",
        }),
      });

      setTakeoverMsg("");
      fetchAllData();
    } catch (e) {
      console.error("Takeover send failed:", e);
    }
  };

  // Add KB Article
  const handleSaveKb = async () => {
    if (!kbTitle.trim() || !kbContent.trim()) return;

    try {
      await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: kbTitle,
          category: kbCategory,
          content: kbContent,
        }),
      });

      setKbTitle("");
      setKbContent("");
      setShowAddKb(false);
      fetchAllData();
    } catch (e) {
      console.error("Save KB failed:", e);
    }
  };

  // Delete KB Article
  const handleDeleteKb = async (id: string) => {
    try {
      await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
      fetchAllData();
    } catch (e) {
      console.error("Delete KB failed:", e);
    }
  };

  return (
    <div className="bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col h-full shadow-[0_1px_3px_rgba(20,20,19,0.06)]">
      {/* Dashboard Top Header & Tabs (Claude editorial top-nav & title spec) */}
      <div className="px-5 py-3.5 bg-surface-soft border-b border-hairline flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-normal text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-teal" />
            Clinic Operations Control Plane & CRM
          </h2>
          <p className="text-[11px] text-muted">Live synchronized patient actions & triage</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            className="w-8 h-8 rounded-full border border-hairline bg-canvas hover:bg-surface-card text-muted hover:text-ink flex items-center justify-center transition-all shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs Bar (Claude category-tab tokens) */}
      <div className="px-4 py-2 bg-surface-soft/60 border-b border-hairline flex items-center gap-1.5 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab("appointments")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "appointments"
              ? "bg-surface-card text-ink font-semibold border border-hairline shadow-[0_1px_2px_rgba(20,20,19,0.08)]"
              : "text-muted hover:text-ink"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>Appointments</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-pill bg-canvas border border-hairline text-[10px] text-body">
            {appointments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "tickets"
              ? "bg-surface-card text-ink font-semibold border border-hairline shadow-[0_1px_2px_rgba(20,20,19,0.08)]"
              : "text-muted hover:text-ink"
          }`}
        >
          <Ticket className="w-3.5 h-3.5 text-accent-amber" />
          <span>Support & Refills</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-pill bg-canvas border border-hairline text-[10px] text-body">
            {tickets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "leads"
              ? "bg-surface-card text-ink font-semibold border border-hairline shadow-[0_1px_2px_rgba(20,20,19,0.08)]"
              : "text-muted hover:text-ink"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-accent-teal" />
          <span>Patient CRM Leads</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-pill bg-canvas border border-hairline text-[10px] text-body">
            {leads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("escalations")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "escalations"
              ? "bg-surface-card text-ink font-semibold border border-hairline shadow-[0_1px_2px_rgba(20,20,19,0.08)]"
              : "text-muted hover:text-ink"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-semantic-error" />
          <span>Live Escalations</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-pill bg-canvas border border-hairline text-[10px] text-body">
            {escalations.length}
          </span>
          {escalations.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-semantic-error animate-ping ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("knowledge")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "knowledge"
              ? "bg-surface-card text-ink font-semibold border border-hairline shadow-[0_1px_2px_rgba(20,20,19,0.08)]"
              : "text-muted hover:text-ink"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-muted" />
          <span>Knowledge Base</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-pill bg-canvas border border-hairline text-[10px] text-body">
            {knowledge.length}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 p-4 md:p-5 overflow-y-auto">
        {/* 1. Appointments Tab */}
        {activeTab === "appointments" && (
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <div className="text-center py-20 text-muted-soft text-xs">
                No appointments booked yet. Ask the AI concierge to schedule an appointment.
              </div>
            ) : (
              appointments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 bg-surface-card border border-hairline rounded-lg flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(20,20,19,0.04)] hover:border-primary/40 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-base text-ink font-normal">{a.doctor_name}</span>
                      <span className="px-2 py-0.5 rounded-pill text-[10px] bg-canvas border border-hairline text-body font-medium">
                        {a.specialty}
                      </span>
                    </div>
                    <div className="text-xs text-semantic-success font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {a.appointment_date} at {a.appointment_time}
                    </div>
                    <div className="text-xs text-muted">
                      Patient: <strong className="text-ink">{a.patient_name}</strong> · {a.patient_phone} ({a.patient_email})
                    </div>
                    {a.reason_for_visit && (
                      <div className="text-[11px] text-muted-soft italic pt-0.5">
                        Reason: {a.reason_for_visit}
                      </div>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-pill text-xs font-medium bg-semantic-success/15 text-[#246736] border border-semantic-success/20">
                    Confirmed
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. Support & Refill Tickets Tab */}
        {activeTab === "tickets" && (
          <div className="space-y-3">
            {tickets.length === 0 ? (
              <div className="text-center py-20 text-muted-soft text-xs">
                No support tickets opened yet. Ask for a prescription refill or billing inquiry.
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 bg-surface-card border border-hairline rounded-lg space-y-2 shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-canvas border border-hairline text-[#9a5b1c]">
                        {t.ticket_code}
                      </span>
                      <span className="font-serif text-sm text-ink">{t.subject}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold uppercase tracking-wider ${
                        t.priority === "urgent" || t.priority === "high"
                          ? "bg-semantic-error/15 text-semantic-error border border-semantic-error/30"
                          : "bg-accent-amber/20 text-[#854b14] border border-accent-amber/30"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  <p className="text-xs text-body leading-relaxed">{t.description}</p>

                  <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-hairline-soft">
                    <span>Patient: {t.patient_name} ({t.patient_email})</span>
                    <span className="capitalize">Category: {t.issue_category?.replace("_", " ")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Patient CRM Leads Tab */}
        {activeTab === "leads" && (
          <div className="space-y-3">
            {leads.length === 0 ? (
              <div className="text-center py-20 text-muted-soft text-xs">
                No prospective patient registrations recorded yet.
              </div>
            ) : (
              leads.map((l) => (
                <div
                  key={l.id}
                  className="p-4 bg-surface-card border border-hairline rounded-lg flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(20,20,19,0.04)]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-sm text-ink font-normal">{l.contact_name}</span>
                      <span className="px-2 py-0.5 rounded-pill text-[10px] bg-canvas border border-hairline text-body font-medium">
                        {l.insurance_provider || "Self-Pay"}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {l.email} · {l.phone || "No phone provided"}
                    </div>
                    {l.notes && <div className="text-[11px] text-muted-soft pt-0.5">{l.notes}</div>}
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-pill text-xs font-semibold uppercase ${
                      l.interest_level === "hot"
                        ? "bg-primary text-white"
                        : "bg-accent-teal/20 text-[#2c7769] border border-accent-teal/30"
                    }`}
                  >
                    {l.interest_level}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. Live Escalations & Nurse Takeover Console Tab */}
        {activeTab === "escalations" && (
          <div className="space-y-4">
            {escalations.length === 0 ? (
              <div className="text-center py-20 text-muted-soft text-xs">
                No active escalations. When acute symptoms or human assistance is requested, active chats appear here.
              </div>
            ) : (
              escalations.map((esc) => {
                const isSelected = selectedEscalationId === esc.id;

                return (
                  <div
                    key={esc.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-canvas border-2 border-primary shadow-md"
                        : "bg-surface-card border-hairline"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-semantic-error animate-pulse" />
                        <span className="text-xs font-semibold text-ink">
                          Session: {esc.session_id}
                        </span>
                        <span className="px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase bg-semantic-error/15 text-semantic-error border border-semantic-error/30">
                          {esc.urgency || "URGENT"}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted capitalize">
                        Status: <strong className="text-primary">{esc.status}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-body mb-3 bg-surface-card p-3 rounded-md border border-hairline">
                      <strong className="text-ink">Clinical Triage Summary: </strong>
                      {esc.summary || "Patient requested human medical assistance."}
                    </p>

                    {/* Live Nurse Takeover Input */}
                    <div className="pt-2 border-t border-hairline flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type reply as Nurse Sarah (Live Takeover)..."
                        value={isSelected ? takeoverMsg : ""}
                        onChange={(e) => {
                          setSelectedEscalationId(esc.id);
                          setTakeoverMsg(e.target.value);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleSendTakeover(esc.id)}
                        className="flex-1 bg-canvas border border-hairline rounded-md px-3 py-2 text-xs text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={() => handleSendTakeover(esc.id)}
                        className="px-4 py-2 rounded-md bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-[0_1px_2px_rgba(204,120,92,0.3)]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Take Over
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 5. Knowledge Base Manager Tab */}
        {activeTab === "knowledge" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">
                Clinic Articles indexed in pgvector ({knowledge.length}):
              </span>
              <button
                onClick={() => setShowAddKb(!showAddKb)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary hover:bg-primary-active text-on-primary shadow-[0_1px_2px_rgba(204,120,92,0.25)] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Article
              </button>
            </div>

            {/* Add Article Form */}
            {showAddKb && (
              <div className="p-4 bg-surface-card border border-hairline rounded-lg space-y-3 shadow-sm">
                <h4 className="font-serif text-sm font-normal text-ink">New Clinic Knowledge Article</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Article Title..."
                    value={kbTitle}
                    onChange={(e) => setKbTitle(e.target.value)}
                    className="bg-canvas border border-hairline rounded-md p-2 text-xs text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary"
                  />
                  <select
                    value={kbCategory}
                    onChange={(e) => setKbCategory(e.target.value)}
                    className="bg-canvas border border-hairline rounded-md p-2 text-xs text-ink focus:outline-none focus:border-primary"
                  >
                    <option value="services">Services & Hours</option>
                    <option value="insurance">Insurance & Billing</option>
                    <option value="doctors">Physicians</option>
                    <option value="policies">Policies</option>
                    <option value="prep">Lab & Test Prep</option>
                  </select>
                </div>
                <textarea
                  placeholder="Article Content (automatically vector embedded via Gemini 768-dim)..."
                  rows={3}
                  value={kbContent}
                  onChange={(e) => setKbContent(e.target.value)}
                  className="w-full bg-canvas border border-hairline rounded-md p-2 text-xs text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddKb(false)}
                    className="px-3 py-1.5 text-xs text-muted hover:text-ink font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveKb}
                    className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold shadow-sm"
                  >
                    Save & Index
                  </button>
                </div>
              </div>
            )}

            {/* Knowledge List */}
            <div className="space-y-2.5">
              {knowledge.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 bg-surface-card border border-hairline rounded-lg space-y-1.5 shadow-[0_1px_2px_rgba(20,20,19,0.03)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-sm font-normal text-ink">{k.title}</span>
                      <span className="px-2 py-0.5 rounded-pill text-[10px] bg-canvas border border-hairline text-body uppercase font-medium">
                        {k.category}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteKb(k.id)}
                      className="text-muted-soft hover:text-semantic-error p-1 transition-colors"
                      title="Delete Article"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-body leading-relaxed">{k.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

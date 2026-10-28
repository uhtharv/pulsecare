"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bot,
  Columns,
  Stethoscope,
  FileText,
  Activity,
  Zap,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { PatientChat } from "@/components/PatientChat";
import { ClinicDashboard } from "@/components/ClinicDashboard";
import { ClaudeSpikeMark } from "@/components/ClaudeSpikeMark";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<"split" | "patient" | "clinic">("split");
  const [conversationId, setConversationId] = useState<string>("");

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Claude Editorial Top Navigation (top-nav spec: 64px, canvas bg, hairline border) */}
      <header className="h-16 border-b border-hairline bg-canvas/95 backdrop-blur-md px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 transition-colors">
        {/* Left: Anthropic Spike Mark + Wordmark */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-md bg-surface-card border border-hairline flex items-center justify-center text-ink shadow-[0_1px_2px_rgba(20,20,19,0.06)]">
            <ClaudeSpikeMark className="w-5 h-5 text-primary" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl tracking-tight text-ink font-normal">
                PulseCare
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-pill bg-surface-card text-muted font-medium border border-hairline">
                AI Concierge
              </span>
            </div>
            <p className="hidden lg:block text-[11px] text-muted-soft tracking-normal -mt-0.5">
              Autonomous Action-Oriented Healthcare & Clinic Operations
            </p>
          </div>
        </div>

        {/* Center: View Switcher (Claude category-tab tokens) */}
        <div className="flex items-center bg-surface-soft border border-hairline rounded-md p-1 text-xs">
          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              viewMode === "split"
                ? "bg-surface-card text-ink font-semibold shadow-[0_1px_2px_rgba(20,20,19,0.08)] border border-hairline"
                : "text-muted hover:text-ink"
            }`}
            title="Side-by-side presentation view"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split Demo</span>
          </button>

          <button
            onClick={() => setViewMode("patient")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              viewMode === "patient"
                ? "bg-surface-card text-ink font-semibold shadow-[0_1px_2px_rgba(20,20,19,0.08)] border border-hairline"
                : "text-muted hover:text-ink"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Patient Voice & Chat</span>
          </button>

          <button
            onClick={() => setViewMode("clinic")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              viewMode === "clinic"
                ? "bg-surface-card text-ink font-semibold shadow-[0_1px_2px_rgba(20,20,19,0.08)] border border-hairline"
                : "text-muted hover:text-ink"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clinic CRM</span>
          </button>
        </div>

        {/* Right: Quick Links + Claude Primary Coral Button */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden xl:flex items-center gap-1 text-xs font-medium text-muted">
            <Link
              href="/incidents"
              className="px-2.5 py-1.5 rounded-md hover:bg-surface-soft hover:text-ink transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-muted" />
              Incidents
            </Link>
            <Link
              href="/metrics"
              className="px-2.5 py-1.5 rounded-md hover:bg-surface-soft hover:text-ink transition-colors flex items-center gap-1"
            >
              <Activity className="w-3.5 h-3.5 text-muted" />
              Metrics
            </Link>
            <Link
              href="/clusters"
              className="px-2.5 py-1.5 rounded-md hover:bg-surface-soft hover:text-ink transition-colors flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-muted" />
              Clusters
            </Link>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-surface-card border border-hairline text-[11px] text-body">
            <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
            <span>Realtime Synchronized</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3 md:p-6 max-w-[1800px] w-full mx-auto">
        {viewMode === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-6rem)]">
            {/* Left: Patient Chat & Voice Assistant (5 Cols) */}
            <div className="lg:col-span-5 h-full">
              <PatientChat
                conversationId={conversationId}
                onConversationCreated={setConversationId}
              />
            </div>

            {/* Right: Clinic Operations Control Plane & CRM (7 Cols) */}
            <div className="lg:col-span-7 h-full">
              <ClinicDashboard />
            </div>
          </div>
        )}

        {viewMode === "patient" && (
          <div className="max-w-2xl mx-auto h-[calc(100vh-6rem)] py-2">
            <PatientChat
              conversationId={conversationId}
              onConversationCreated={setConversationId}
            />
          </div>
        )}

        {viewMode === "clinic" && (
          <div className="max-w-6xl mx-auto h-[calc(100vh-6rem)] py-2">
            <ClinicDashboard />
          </div>
        )}
      </main>
    </div>
  );
}

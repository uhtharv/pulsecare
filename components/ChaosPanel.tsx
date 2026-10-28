"use client";

import React, { useState } from "react";
import { Zap, Play, Edit, RotateCcw, ShieldAlert, CheckCircle, Flame } from "lucide-react";
import { CHAOS_DEFINITIONS, ChaosType } from "@/lib/chaos";
import { GOLDEN_PAYLOAD } from "@/lib/contract";

interface ChaosPanelProps {
  onInject: (chaos: ChaosType[], customPayload?: any, forceManual?: boolean) => Promise<void>;
  isLoading: boolean;
  forceManual: boolean;
  onToggleForceManual: (val: boolean) => void;
}

export function ChaosPanel({
  onInject,
  isLoading,
  forceManual,
  onToggleForceManual,
}: ChaosPanelProps) {
  const [showPayloadEditor, setShowPayloadEditor] = useState(false);
  const [payloadJson, setPayloadJson] = useState(JSON.stringify(GOLDEN_PAYLOAD, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleRunHealthy = () => {
    let parsed = GOLDEN_PAYLOAD;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      // fallback to golden
    }
    onInject([], parsed, forceManual);
  };

  const handleInjectFault = (fault: ChaosType) => {
    let parsed = GOLDEN_PAYLOAD;
    try {
      parsed = JSON.parse(payloadJson);
    } catch (e: any) {
      setJsonError("Invalid JSON in editor. Using golden sample.");
    }
    onInject([fault], parsed, forceManual);
  };

  const handleResetPayload = () => {
    setPayloadJson(JSON.stringify(GOLDEN_PAYLOAD, null, 2));
    setJsonError(null);
  };

  return (
    <div className="bg-surface-card border border-hairline rounded-lg p-5 shadow-[0_1px_2px_rgba(20,20,19,0.03)] flex flex-col h-full space-y-4">
      {/* Top Banner & Primary Actions */}
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <Flame className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-serif text-sm font-normal text-ink">Chaos Injection Engine</h3>
            <p className="text-[11px] text-muted">Inject real-world anomalies into live business automation</p>
          </div>
        </div>

        {/* Global Policy Toggle (Claude category-tab/badge spec) */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Auto-Apply Gate:</span>
          <button
            onClick={() => onToggleForceManual(!forceManual)}
            className={`px-2.5 py-0.5 rounded-pill text-[11px] font-mono font-semibold border transition-all ${
              !forceManual
                ? "bg-semantic-success/15 text-[#246736] border-semantic-success/25"
                : "bg-accent-amber/20 text-[#854b14] border-accent-amber/35"
            }`}
          >
            {!forceManual ? "AUTO (<30 Risk)" : "ALWAYS MANUAL"}
          </button>
        </div>
      </div>

      {/* Action Bar: Run Healthy + Edit Payload */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRunHealthy}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-semantic-success hover:bg-[#4ea662] text-white font-medium text-xs transition-all shadow-[0_1px_2px_rgba(93,184,114,0.3)] disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run Healthy Baseline (All Green)</span>
        </button>

        <button
          onClick={() => setShowPayloadEditor(!showPayloadEditor)}
          className={`px-3.5 py-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm ${
            showPayloadEditor
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-canvas hover:bg-surface-soft text-ink border-hairline"
          }`}
        >
          <Edit className="w-3.5 h-3.5" />
          <span>Payload Editor</span>
        </button>
      </div>

      {/* Expandable JSON Payload Editor in Claude Dark Code Window */}
      {showPayloadEditor && (
        <div className="p-3.5 bg-surface-dark rounded-lg border border-[#2d2b27] space-y-2">
          <div className="flex items-center justify-between text-xs text-on-dark-soft">
            <span className="font-mono text-[11px]">Golden Sample / Custom Payload:</span>
            <button
              onClick={handleResetPayload}
              className="flex items-center gap-1 text-[11px] font-mono text-primary hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Golden
            </button>
          </div>
          <textarea
            value={payloadJson}
            onChange={(e) => {
              setPayloadJson(e.target.value);
              setJsonError(null);
            }}
            rows={5}
            className="w-full bg-[#131211] border border-[#2d2b27] rounded-md p-2.5 text-xs font-mono text-on-dark focus:outline-none focus:border-primary"
          />
          {jsonError && <p className="text-xs text-semantic-error">{jsonError}</p>}
        </div>
      )}

      {/* 10 Fault Cards Grid */}
      <div className="grid grid-cols-1 gap-2.5 overflow-y-auto max-h-[520px] pr-1">
        {(Object.keys(CHAOS_DEFINITIONS) as ChaosType[]).map((type) => {
          const fault = CHAOS_DEFINITIONS[type];
          return (
            <div
              key={type}
              className="p-3.5 bg-canvas border border-hairline rounded-md hover:border-primary/40 transition-all flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(20,20,19,0.02)] group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-serif text-xs font-normal text-ink group-hover:text-primary transition-colors">
                    {fault.title}
                  </span>
                  <span
                    className={`px-2 py-0.2 rounded-pill text-[9px] font-semibold uppercase tracking-wider ${
                      fault.healable
                        ? "bg-semantic-success/15 text-[#246736] border border-semantic-success/20"
                        : "bg-semantic-error/15 text-semantic-error border border-semantic-error/25"
                    }`}
                  >
                    {fault.healable ? "Healable" : "Unhealable"}
                  </span>
                </div>
                <p className="text-[11px] text-muted line-clamp-1">{fault.description}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-soft font-mono">
                  <span>Action: {fault.expectedAction}</span>
                </div>
              </div>

              <button
                onClick={() => handleInjectFault(type)}
                disabled={isLoading}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-semantic-error/15 hover:bg-semantic-error hover:text-white text-semantic-error border border-semantic-error/30 transition-all disabled:opacity-50"
              >
                <Zap className="w-3 h-3 fill-current" />
                <span>Inject</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

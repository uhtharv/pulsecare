import React from "react";

interface ClaudeSpikeMarkProps {
  className?: string;
  size?: number;
}

export function ClaudeSpikeMark({ className = "w-4 h-4 text-ink", size }: ClaudeSpikeMarkProps) {
  const sizeStyle = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={sizeStyle}
      aria-hidden="true"
    >
      {/* Anthropic 8-pointed / radial-spoke asterisk mark */}
      <path d="M13.5 2.5a1.5 1.5 0 0 0-3 0v6.1L6.2 4.3a1.5 1.5 0 0 0-2.1 2.1l4.3 4.3H2.5a1.5 1.5 0 0 0 0 3h6.1l-4.3 4.3a1.5 1.5 0 0 0 2.1 2.1l4.3-4.3v6.1a1.5 1.5 0 0 0 3 0v-6.1l4.3 4.3a1.5 1.5 0 0 0 2.1-2.1l-4.3-4.3h6.1a1.5 1.5 0 0 0 0-3h-6.1l4.3-4.3a1.5 1.5 0 0 0-2.1-2.1L13.5 8.6V2.5z" />
    </svg>
  );
}


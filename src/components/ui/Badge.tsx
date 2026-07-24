import { type ReactNode } from "react";

const tones: Record<string, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--ink)]",
  accent: "bg-[var(--accent)]/15 text-[var(--accent)]",
  success: "bg-[var(--success)]/15 text-[var(--success)]",
  warn: "bg-[var(--warn)]/25 text-[#8a6a12]",
  danger: "bg-red-100 text-red-800",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

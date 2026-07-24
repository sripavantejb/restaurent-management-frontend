import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[6px] border border-[var(--border)] bg-white ${className}`}
    >
      {children}
    </div>
  );
}

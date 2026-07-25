"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ros_theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

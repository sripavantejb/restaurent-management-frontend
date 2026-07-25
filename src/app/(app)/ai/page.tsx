"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Mic,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SUGGESTED_PROMPTS } from "@/modules/ai-copilot/prompts";

type Block = { type: string; title?: string; data: unknown };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: Block[];
};

type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string;
};

type Dash = {
  widgets: {
    sales: { revenueInr?: number; orderCount?: number } | null;
    salesSummary: string | null;
    floor: string | null;
    lowStockSummary: string | null;
    kitchenSummary: string | null;
    pendingSummary: string | null;
    forecastSummary: string | null;
    profitSummary: string | null;
  };
  openaiConfigured: boolean;
  suggestions: string[];
};

function KpiGrid({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((k) => (
        <div
          key={k.label}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        >
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
            {k.label}
          </p>
          <p className="num mt-0.5 text-sm font-semibold">{k.value}</p>
        </div>
      ))}
    </div>
  );
}

function SimpleBars({
  points,
}: {
  points: { x: string; y: number }[];
}) {
  const max = Math.max(...points.map((p) => p.y), 1);
  return (
    <div className="mt-2 flex h-28 items-end gap-1 overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-2">
      {points.slice(0, 24).map((p) => (
        <div key={p.x} className="flex min-w-[18px] flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-[var(--accent)]"
            style={{ height: `${Math.max(4, (p.y / max) * 100)}%` }}
            title={`${p.x}: ${p.y}`}
          />
          <span className="max-w-[40px] truncate text-[8px] text-[var(--muted)]">
            {p.x}
          </span>
        </div>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.type === "kpi" && Array.isArray(block.data)) {
    return (
      <div>
        {block.title ? (
          <p className="text-xs font-medium text-[var(--muted)]">{block.title}</p>
        ) : null}
        <KpiGrid items={block.data as { label: string; value: string }[]} />
      </div>
    );
  }
  if (block.type === "table") {
    const t = block.data as {
      columns: string[];
      rows: Record<string, unknown>[];
    };
    if (!t?.columns) return null;
    return (
      <div className="mt-2 overflow-auto rounded-[6px] border border-[var(--border)]">
        {block.title ? (
          <p className="border-b border-[var(--border)] px-2 py-1 text-xs font-medium">
            {block.title}
          </p>
        ) : null}
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
            <tr>
              {t.columns.map((c) => (
                <th key={c} className="px-2 py-1.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(t.rows ?? []).slice(0, 20).map((row, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                {t.columns.map((c) => (
                  <td key={c} className="px-2 py-1.5">
                    {String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "chart") {
    const d = block.data as {
      kind: string;
      points: { x: string; y: number }[];
    };
    return (
      <div>
        {block.title ? (
          <p className="text-xs font-medium text-[var(--muted)]">{block.title}</p>
        ) : null}
        <SimpleBars points={d.points ?? []} />
      </div>
    );
  }
  if (block.type === "insight" || block.type === "list") {
    const text =
      typeof block.data === "object" &&
      block.data &&
      "text" in (block.data as object)
        ? String((block.data as { text: string }).text)
        : typeof block.data === "object" &&
            block.data &&
            "items" in (block.data as object)
          ? ((block.data as { items: string[] }).items || []).join(" · ")
          : JSON.stringify(block.data);
    return (
      <p className="mt-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
        {text}
      </p>
    );
  }
  return null;
}

function renderMarkdownLite(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="mt-3 text-sm font-semibold">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <li key={i} className="ml-4 list-disc text-sm text-[var(--ink)]">
          {line.slice(2)}
        </li>
      );
    }
    if (!line.trim()) return <br key={i} />;
    return (
      <p key={i} className="text-sm leading-relaxed text-[var(--ink)]">
        {line.replace(/\*\*(.*?)\*\*/g, "$1")}
      </p>
    );
  });
}

export default function AiCopilotPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canUse = hasPermission("ai.use");
  const [dash, setDash] = useState<Dash | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const loadDash = useCallback(async () => {
    if (!activeBranchId || !canUse) return;
    try {
      const data = await apiFetch("/api/ai/dashboard", {
        branchId: activeBranchId,
      });
      setDash(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard failed");
    }
  }, [activeBranchId, canUse]);

  const loadConversations = useCallback(async () => {
    if (!activeBranchId || !canUse) return;
    const q = search ? `?q=${encodeURIComponent(search)}` : "";
    const data = await apiFetch(`/api/ai/conversations${q}`, {
      branchId: activeBranchId,
    });
    setConversations(data.conversations ?? []);
  }, [activeBranchId, canUse, search]);

  useEffect(() => {
    void loadDash();
    void loadConversations();
  }, [loadDash, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function openConversation(id: string) {
    if (!activeBranchId) return;
    setActiveId(id);
    const data = await apiFetch(`/api/ai/conversations/${id}`, {
      branchId: activeBranchId,
    });
    setMessages(
      (data.messages ?? []).map(
        (m: {
          id: string;
          role: "user" | "assistant";
          content: string;
          blocks?: Block[];
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          blocks: m.blocks,
        })
      )
    );
  }

  async function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || !activeBranchId || busy) return;
    setInput("");
    setBusy(true);
    setError("");
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", blocks: [] },
    ]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-branch-id": activeBranchId,
        },
        body: JSON.stringify({
          message,
          conversationId: activeId,
        }),
        credentials: "include",
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let blocks: Block[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            content?: string;
            block?: Block;
            conversationId?: string;
            error?: string;
          };
          if (payload.type === "conversation" && payload.conversationId) {
            setActiveId(payload.conversationId);
          }
          if (payload.type === "delta" && payload.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + payload.content }
                  : m
              )
            );
          }
          if (payload.type === "block" && payload.block) {
            blocks = [...blocks, payload.block];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, blocks: [...blocks] } : m
              )
            );
          }
          if (payload.type === "error") {
            setError(payload.error || "AI error");
          }
        }
      }
      void loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text.slice(0, 600));
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }

  function startVoice() {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SR) {
      setError("Speech recognition not supported in this browser");
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const t = ev.results[0]?.[0]?.transcript;
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.start();
  }

  async function togglePin(id: string, pinned: boolean) {
    await apiFetch(`/api/ai/conversations/${id}`, {
      method: "PATCH",
      branchId: activeBranchId,
      body: JSON.stringify({ pinned: !pinned }),
    });
    void loadConversations();
  }

  async function removeConv(id: string) {
    await apiFetch(`/api/ai/conversations/${id}`, {
      method: "DELETE",
      branchId: activeBranchId,
    });
    if (activeId === id) await newChat();
    void loadConversations();
  }

  const salesKpis = useMemo(() => {
    if (!dash?.widgets.sales) return [];
    const s = dash.widgets.sales;
    return [
      {
        label: "Today sales",
        value: s.revenueInr != null ? `₹${Math.round(s.revenueInr)}` : "—",
      },
      {
        label: "Orders",
        value: s.orderCount != null ? String(s.orderCount) : "—",
      },
    ];
  }, [dash]);

  if (!canUse) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        AI Copilot requires the <code>ai.use</code> permission. Re-login after
        the role update if you just upgraded.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Sidebar chats */}
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <Sparkles size={16} className="text-[var(--accent)]" />
          <span className="text-sm font-semibold">AI Copilot</span>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => void newChat()}
          >
            <Plus size={14} />
          </Button>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute top-1/2 left-2 -translate-y-1/2 text-[var(--muted)]"
            />
            <Input
              className="pl-7"
              placeholder="Search chats"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ul className="max-h-40 flex-1 overflow-auto px-2 pb-2 lg:max-h-none">
          {conversations.map((c) => (
            <li key={c.id}>
              <div
                className={`group flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-sm ${
                  activeId === c.id
                    ? "bg-[var(--ink)] text-white"
                    : "hover:bg-[var(--surface-2)]"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => void openConversation(c.id)}
                >
                  {c.pinned ? "📌 " : ""}
                  {c.title}
                </button>
                <button
                  type="button"
                  className="opacity-60 hover:opacity-100"
                  onClick={() => void togglePin(c.id, c.pinned)}
                  aria-label="Pin"
                >
                  <Pin size={12} />
                </button>
                <button
                  type="button"
                  className="opacity-60 hover:opacity-100"
                  onClick={() => void removeConv(c.id)}
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Widgets */}
        <div className="shrink-0 border-b border-[var(--border)] p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Restaurant AI Operating System
              </h1>
              <p className="text-xs text-[var(--muted)]">
                Tools → business services → MongoDB. LLM never queries the DB.
                {dash && !dash.openaiConfigured
                  ? " · Local tool mode (add OPENAI_API_KEY for full LLM)."
                  : " · OpenAI connected."}
              </p>
            </div>
          </div>
          {salesKpis.length ? <KpiGrid items={salesKpis} /> : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              dash?.widgets.floor,
              dash?.widgets.kitchenSummary,
              dash?.widgets.lowStockSummary,
              dash?.widgets.forecastSummary,
            ]
              .filter(Boolean)
              .map((t, i) => (
                <p
                  key={i}
                  className="rounded-[6px] border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]"
                >
                  {t}
                </p>
              ))}
          </div>
        </div>

        {/* Messages */}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 sm:p-4">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-8 text-center">
              <Bot className="mx-auto text-[var(--accent)]" size={36} />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Ask about sales, tables, kitchen, inventory, forecasts, or run
                actions.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(dash?.suggestions ?? SUGGESTED_PROMPTS).slice(0, 6).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
                    onClick={() => void send(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`mx-auto flex max-w-3xl gap-3 ${
                  m.role === "user" ? "justify-end" : ""
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                    <Bot size={16} />
                  </div>
                ) : null}
                <div
                  className={`min-w-0 rounded-[10px] px-3 py-2 ${
                    m.role === "user"
                      ? "bg-[var(--ink)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      <div>{renderMarkdownLite(m.content || (busy ? "…" : ""))}</div>
                      {(m.blocks ?? []).map((b, i) => (
                        <BlockView key={i} block={b} />
                      ))}
                      {m.content ? (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--muted)]"
                          onClick={() => speak(m.content)}
                        >
                          <Volume2 size={12} /> Speak
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm">{m.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            {error}
          </p>
        ) : null}

        {/* Composer */}
        <div className="shrink-0 border-t border-[var(--border)] p-3">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              onClick={startVoice}
              aria-label="Voice input"
            >
              <Mic size={16} />
            </button>
            <textarea
              className="min-h-[42px] flex-1 resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              rows={1}
              placeholder="Ask anything about your restaurant…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

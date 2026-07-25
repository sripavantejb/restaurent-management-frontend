"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  Mic,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConsolePageSkeleton } from "@/components/ui/Skeleton";
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
  llmProvider?: "nvidia" | "openai" | "none";
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

type KnowledgeDoc = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  chunkCount: number;
  updatedAt?: string | null;
};

export default function AiCopilotPage() {
  const { activeBranchId, hasPermission, user } = useAuth();
  const canUse = hasPermission("ai.use");
  const canManageKnowledge =
    user?.role === "OWNER" || user?.role === "MANAGER";
  const [dash, setDash] = useState<Dash | null>(null);
  const [ready, setReady] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [sopTitle, setSopTitle] = useState("");
  const [sopContent, setSopContent] = useState("");
  const [knowledgeBusy, setKnowledgeBusy] = useState(false);
  const [knowledgeMsg, setKnowledgeMsg] = useState("");
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
    } finally {
      setReady(true);
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

  const loadKnowledge = useCallback(async () => {
    if (!activeBranchId || !canUse) return;
    try {
      const data = await apiFetch("/api/ai/rag/docs?uploadsOnly=1", {
        branchId: activeBranchId,
      });
      setKnowledgeDocs(data.docs ?? []);
    } catch {
      /* panel is best-effort */
    }
  }, [activeBranchId, canUse]);

  useEffect(() => {
    void loadDash();
    void loadConversations();
    void loadKnowledge();
  }, [loadDash, loadConversations, loadKnowledge]);

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

    let gotDelta = false;
    let gotBlock = false;

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

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error ||
            `Chat failed (${res.status})`
        );
      }
      if (!res.body) {
        throw new Error("Chat stream empty — restart the Next.js server");
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
          const line = part
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          let payload: {
            type: string;
            content?: string;
            block?: Block;
            conversationId?: string;
            error?: string;
            tool?: string;
          };
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (payload.type === "conversation" && payload.conversationId) {
            setActiveId(payload.conversationId);
          }
          if (payload.type === "status" && payload.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && !m.content
                  ? { ...m, content: `_${payload.content}_` }
                  : m
              )
            );
          }
          if (payload.type === "tool_start" && payload.tool) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && !gotDelta
                  ? { ...m, content: `_Running ${payload.tool}…_` }
                  : m
              )
            );
          }
          if (payload.type === "delta" && payload.content) {
            gotDelta = true;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const base =
                  m.content.startsWith("_") && m.content.endsWith("_")
                    ? ""
                    : m.content;
                return { ...m, content: base + payload.content };
              })
            );
          }
          if (payload.type === "block" && payload.block) {
            gotBlock = true;
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

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const empty =
            !m.content.trim() ||
            (m.content.startsWith("_") && m.content.endsWith("_"));
          if (empty && !gotBlock) {
            return {
              ...m,
              content:
                "No answer came back. Restart `npm run dev` so OPENAI_API_KEY loads, then try again.",
            };
          }
          if (empty && gotBlock) {
            return {
              ...m,
              content: "Live data loaded below.",
            };
          }
          return m;
        })
      );
      void loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content.trim()
            ? {
                ...m,
                content:
                  "Something went wrong talking to the server. Check you are logged in and the API is running.",
              }
            : m
        )
      );
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

  async function reindexKnowledge() {
    if (!activeBranchId || !canManageKnowledge) return;
    setKnowledgeBusy(true);
    setKnowledgeMsg("");
    try {
      const data = await apiFetch("/api/ai/rag/reindex", {
        method: "POST",
        branchId: activeBranchId,
        body: "{}",
      });
      const r = data.result;
      setKnowledgeMsg(
        `Indexed menu ${r?.menu?.total ?? 0}, recipes ${r?.recipes?.total ?? 0}, inventory ${r?.inventory?.total ?? 0}. Embeddings ${
          r?.embeddingsEnabled ? "on" : "off"
        }.`
      );
      await loadKnowledge();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reindex failed");
    } finally {
      setKnowledgeBusy(false);
    }
  }

  async function uploadSop() {
    if (!activeBranchId || !canManageKnowledge) return;
    if (!sopTitle.trim() || !sopContent.trim()) {
      setKnowledgeMsg("Title and content required");
      return;
    }
    setKnowledgeBusy(true);
    setKnowledgeMsg("");
    try {
      await apiFetch("/api/ai/rag/docs", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          title: sopTitle.trim(),
          content: sopContent.trim(),
        }),
      });
      setSopTitle("");
      setSopContent("");
      setKnowledgeMsg("SOP uploaded and indexed.");
      await loadKnowledge();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setKnowledgeBusy(false);
    }
  }

  async function deleteSop(id: string) {
    if (!activeBranchId || !canManageKnowledge) return;
    setKnowledgeBusy(true);
    try {
      await apiFetch(`/api/ai/rag/docs/${id}`, {
        method: "DELETE",
        branchId: activeBranchId,
      });
      await loadKnowledge();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setKnowledgeBusy(false);
    }
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

  if (!ready) {
    return <ConsolePageSkeleton />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Sidebar chats — compact on mobile */}
      <aside className="flex max-h-[38vh] w-full shrink-0 flex-col border-b border-[var(--border)] lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
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
        <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2">
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
                Live Mongo tools first
                {dash?.openaiConfigured
                  ? ", then OpenAI polish."
                  : " (add OPENAI_API_KEY to polish answers)."}
                {dash?.widgets.floor
                  ? ` · Floor: ${dash.widgets.floor}`
                  : ""}
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
        <div className="shrink-0 border-t border-[var(--border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)] sm:h-10 sm:w-10"
              onClick={startVoice}
              aria-label="Voice input"
            >
              <Mic size={16} />
            </button>
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
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
            <Button type="submit" disabled={busy || !input.trim()} className="h-11 shrink-0 sm:h-10">
              <Send size={16} />
            </Button>
          </form>
        </div>
      </div>

      {/* Knowledge panel */}
      <aside className="flex max-h-[32vh] w-full shrink-0 flex-col border-t border-[var(--border)] lg:max-h-none lg:w-72 lg:border-t-0 lg:border-l">
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <BookOpen size={16} className="text-[var(--accent)]" />
          <span className="text-sm font-semibold">Knowledge</span>
        </div>
        <div className="space-y-3 overflow-auto p-3 text-sm">
          <p className="text-xs text-[var(--muted)]">
            Mongo RAG over menu, recipes, inventory, settings, and uploaded
            SOPs. Ask the copilot allergen/policy questions after reindexing.
          </p>
          {canManageKnowledge ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={knowledgeBusy}
              className="w-full"
              onClick={() => void reindexKnowledge()}
            >
              <RefreshCw size={14} className="mr-1" />
              {knowledgeBusy ? "Working…" : "Reindex from DB"}
            </Button>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Owner/Manager can reindex and upload SOPs.
            </p>
          )}
          {knowledgeMsg ? (
            <p className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--muted)]">
              {knowledgeMsg}
            </p>
          ) : null}

          {canManageKnowledge ? (
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Upload SOP
              </p>
              <Input
                placeholder="Title"
                value={sopTitle}
                onChange={(e) => setSopTitle(e.target.value)}
              />
              <textarea
                className="min-h-[88px] w-full resize-y rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                placeholder="Paste policy / SOP text (markdown ok)"
                value={sopContent}
                onChange={(e) => setSopContent(e.target.value)}
              />
              <Button
                size="sm"
                disabled={knowledgeBusy}
                className="w-full"
                onClick={() => void uploadSop()}
              >
                Save to knowledge
              </Button>
            </div>
          ) : null}

          <div className="border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Uploads
            </p>
            {knowledgeDocs.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No uploads yet.</p>
            ) : (
              <ul className="space-y-2">
                {knowledgeDocs.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-[6px] border border-[var(--border)] px-2 py-1.5"
                  >
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{d.title}</p>
                        <p className="text-[10px] text-[var(--muted)]">
                          {d.status} · {d.chunkCount} chunks
                        </p>
                      </div>
                      {canManageKnowledge ? (
                        <button
                          type="button"
                          className="text-[var(--muted)] hover:text-red-600"
                          aria-label="Delete upload"
                          onClick={() => void deleteSop(d.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

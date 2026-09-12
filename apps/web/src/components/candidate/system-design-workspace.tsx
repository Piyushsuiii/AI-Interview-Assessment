"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Box, Database, FileText, LoaderCircle, Network, Send, Trash2, Zap } from "lucide-react";
import { getSystemDesign, saveSystemDesign, submitCandidateAnswer, type AnswerResult } from "./public-api";

type NodeKind = "service" | "database" | "cache" | "queue" | "api" | "note";
type DesignNode = { id: string; kind: NodeKind; label: string; notes: string; x: number; y: number };
type DesignEdge = { id: string; from: string; to: string };
type Diagram = { version: 1; nodes: DesignNode[]; connections: DesignEdge[] };

const nodeKinds: Array<{ kind: NodeKind; label: string }> = [
  { kind: "service", label: "Service" },
  { kind: "database", label: "Database" },
  { kind: "cache", label: "Cache" },
  { kind: "queue", label: "Queue" },
  { kind: "api", label: "API" },
  { kind: "note", label: "Note" },
];

const icons = { service: Box, database: Database, cache: Zap, queue: ArrowRight, api: Network, note: FileText };

function emptyDiagram(): Diagram {
  return { version: 1, nodes: [], connections: [] };
}

function parseDiagram(value: unknown): Diagram {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return emptyDiagram();
    const candidate = parsed as { nodes?: unknown[]; connections?: unknown[]; edges?: unknown[] };
    if (!Array.isArray(candidate.nodes)) return emptyDiagram();
    const nodes = candidate.nodes.map((raw): DesignNode | null => {
      if (!raw || typeof raw !== "object") return null;
      const node = raw as Record<string, unknown>;
      const data = node.data && typeof node.data === "object" ? node.data as Record<string, unknown> : null;
      const position = node.position && typeof node.position === "object" ? node.position as Record<string, unknown> : null;
      const kind = (node.kind ?? node.type) as NodeKind;
      const label = node.label ?? data?.label;
      const notes = node.notes ?? data?.description;
      const x = node.x ?? position?.x;
      const y = node.y ?? position?.y;
      if (typeof node.id !== "string" || typeof label !== "string" || typeof x !== "number" || typeof y !== "number" || !nodeKinds.some((item) => item.kind === kind)) return null;
      return { id: node.id, kind, label, notes: typeof notes === "string" ? notes : "", x, y };
    }).filter((node): node is DesignNode => node !== null);
    const ids = new Set(nodes.map((node) => node.id));
    const connections = (candidate.connections ?? candidate.edges ?? []).map((raw): DesignEdge | null => {
      if (!raw || typeof raw !== "object") return null;
      const edge = raw as Record<string, unknown>;
      const from = edge.from ?? edge.source;
      const to = edge.to ?? edge.target;
      return typeof edge.id === "string" && typeof from === "string" && typeof to === "string" && ids.has(from) && ids.has(to) ? { id: edge.id, from, to } : null;
    }).filter((edge): edge is DesignEdge => edge !== null);
    return { version: 1, nodes, connections };
  } catch {
    return emptyDiagram();
  }
}

function apiDiagram(diagram: Diagram) {
  return {
    nodes: diagram.nodes.map((node) => ({ id: node.id, type: node.kind, position: { x: node.x, y: node.y }, data: { label: node.label.trim(), ...(node.notes ? { description: node.notes } : {}) } })),
    edges: diagram.connections.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to, type: "directed" })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function draftKey(token: string, questionId: string) {
  return `candidate-design:${token.slice(-12)}:${questionId}`;
}

export function SystemDesignWorkspace({ token, questionId, onSubmitted }: { token: string; questionId: string; onSubmitted: (result: AnswerResult) => Promise<void> }) {
  const [diagram, setDiagram] = useState<Diagram>(emptyDiagram);
  const [explanation, setExplanation] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const drag = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSystemDesign(token, questionId, controller.signal)
      .then((document) => {
        const local = window.localStorage.getItem(draftKey(token, questionId));
        let localDraft: { diagram?: unknown; explanation?: string } | null = null;
        try { localDraft = local ? JSON.parse(local) : null; } catch { /* Ignore an invalid local draft. */ }
        setDiagram(parseDiagram(localDraft?.diagram ?? document.diagram));
        setExplanation(localDraft?.explanation ?? document.explanation ?? "");
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError("The saved design could not be loaded. Check your connection and try again.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [questionId, token]);

  useEffect(() => {
    if (loading) return;
    window.localStorage.setItem(draftKey(token, questionId), JSON.stringify({ diagram, explanation }));
  }, [diagram, explanation, loading, questionId, token]);

  function addNode(kind: NodeKind) {
    const count = diagram.nodes.filter((node) => node.kind === kind).length + 1;
    const id = crypto.randomUUID();
    setDiagram((current) => ({
      ...current,
      nodes: [...current.nodes, { id, kind, label: `${nodeKinds.find((item) => item.kind === kind)?.label} ${count}`, notes: "", x: 36 + (current.nodes.length % 4) * 160, y: 42 + (Math.floor(current.nodes.length / 4) % 4) * 105 }],
    }));
    setSelectedId(id);
  }

  function chooseNode(id: string) {
    setSelectedId(id);
    if (!connectFrom || connectFrom === id) return;
    setDiagram((current) => current.connections.some((edge) => edge.from === connectFrom && edge.to === id) ? current : {
      ...current,
      connections: [...current.connections, { id: crypto.randomUUID(), from: connectFrom, to: id }],
    });
    setConnectFrom(null);
  }

  function moveNode(id: string, x: number, y: number) {
    setDiagram((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, x: Math.max(0, Math.min(650, x)), y: Math.max(0, Math.min(410, y)) } : node) }));
  }

  function removeNode(id: string) {
    setDiagram((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id), connections: current.connections.filter((edge) => edge.from !== id && edge.to !== id) }));
    setSelectedId(null);
    if (connectFrom === id) setConnectFrom(null);
  }

  async function save() {
    setBusy("save");
    setError("");
    try {
      await saveSystemDesign(token, questionId, apiDiagram(diagram), explanation);
      setSavedVersion(JSON.stringify({ diagram, explanation }));
    } catch {
      setError("The design could not be saved. Your work remains in this browser; please try again.");
      throw new Error("save failed");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!diagram.nodes.length || !explanation.trim()) return;
    setBusy("submit");
    setError("");
    try {
      await saveSystemDesign(token, questionId, apiDiagram(diagram), explanation);
      setSavedVersion(JSON.stringify({ diagram, explanation }));
      const result = await submitCandidateAnswer(token, questionId, explanation);
      window.localStorage.removeItem(draftKey(token, questionId));
      await onSubmitted(result);
    } catch {
      setError("The design was not submitted. Your work remains saved in this browser; please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="mt-6 flex items-center gap-2 text-sm text-[#716d65]" role="status"><LoaderCircle className="size-4 animate-spin" /> Loading design workspace</div>;

  const selected = diagram.nodes.find((node) => node.id === selectedId);
  const saved = savedVersion === JSON.stringify({ diagram, explanation });
  const valid = diagram.nodes.length > 0 && diagram.nodes.every((node) => node.label.trim()) && Boolean(explanation.trim());
  return (
    <div className="mt-6 grid gap-5">
      <div className="flex flex-wrap gap-2" aria-label="Add design component">
        {nodeKinds.map(({ kind, label }) => { const Icon = icons[kind]; return <button key={kind} type="button" onClick={() => addNode(kind)} disabled={Boolean(busy)} className="flex items-center gap-2 border border-[#bdb7ad] bg-white px-3 py-2 text-xs font-medium hover:border-[#171713] disabled:opacity-50"><Icon className="size-3.5" /> Add {label}</button>; })}
      </div>

      {connectFrom ? <p role="status" className="border border-[#9ab6aa] bg-[#edf5f1] p-3 text-sm text-[#245441]">Select a destination node to create a directed connection. <button type="button" onClick={() => setConnectFrom(null)} className="font-semibold underline">Cancel</button></p> : null}

      <div className="overflow-x-auto border border-[#bdb7ad] bg-[#f8f6f1]">
        <div className="relative h-[500px] min-w-[720px] bg-[linear-gradient(#ded9d0_1px,transparent_1px),linear-gradient(90deg,#ded9d0_1px,transparent_1px)] bg-[size:24px_24px]" aria-label="System design canvas">
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
            <defs><marker id="design-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#716d65" /></marker></defs>
            {diagram.connections.map((edge) => {
              const from = diagram.nodes.find((node) => node.id === edge.from);
              const to = diagram.nodes.find((node) => node.id === edge.to);
              return from && to ? <line key={edge.id} x1={from.x + 65} y1={from.y + 36} x2={to.x + 65} y2={to.y + 36} stroke="#716d65" strokeWidth="2" markerEnd="url(#design-arrow)" /> : null;
            })}
          </svg>
          {diagram.nodes.map((node) => { const Icon = icons[node.kind]; return (
            <button key={node.id} type="button" onClick={() => chooseNode(node.id)} onKeyDown={(event) => {
              const delta = event.shiftKey ? 10 : 2;
              if (event.key === "ArrowLeft") moveNode(node.id, node.x - delta, node.y);
              else if (event.key === "ArrowRight") moveNode(node.id, node.x + delta, node.y);
              else if (event.key === "ArrowUp") moveNode(node.id, node.x, node.y - delta);
              else if (event.key === "ArrowDown") moveNode(node.id, node.x, node.y + delta);
              else return;
              event.preventDefault();
            }} onPointerDown={(event) => {
              const rect = event.currentTarget.parentElement!.getBoundingClientRect();
              drag.current = { id: node.id, offsetX: event.clientX - rect.left - node.x, offsetY: event.clientY - rect.top - node.y };
              event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerMove={(event) => {
              if (drag.current?.id !== node.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const rect = event.currentTarget.parentElement!.getBoundingClientRect();
              moveNode(node.id, event.clientX - rect.left - drag.current.offsetX, event.clientY - rect.top - drag.current.offsetY);
            }} onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} style={{ left: node.x, top: node.y }} className={`absolute flex h-[72px] w-[130px] touch-none flex-col items-center justify-center border bg-white px-2 text-center shadow-[3px_3px_0_#ded9d0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d94f28] ${selectedId === node.id ? "border-[#d94f28]" : connectFrom === node.id ? "border-[#2f6d55]" : "border-[#716d65]"}`} aria-label={`${node.kind}: ${node.label}. Use arrow keys to move.`}>
              <Icon className="mb-1 size-4" /><span className="max-w-full truncate text-xs font-semibold">{node.label}</span>
            </button>
          ); })}
          {!diagram.nodes.length ? <p className="absolute inset-0 grid place-items-center text-sm text-[#716d65]">Add a component to begin your architecture.</p> : null}
        </div>
      </div>

      {selected ? <section className="grid gap-4 border border-[#d8d2c7] bg-[#f7f5f0] p-4 sm:grid-cols-2" aria-label="Selected component properties">
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide">Label<input value={selected.label} maxLength={80} onChange={(event) => setDiagram((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selected.id ? { ...node, label: event.target.value } : node) }))} className="border border-[#bdb7ad] bg-white p-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#2f6d55]" /></label>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide">Node notes<textarea value={selected.notes} maxLength={2_000} rows={3} onChange={(event) => setDiagram((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selected.id ? { ...node, notes: event.target.value } : node) }))} className="border border-[#bdb7ad] bg-white p-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#2f6d55]" /></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="button" onClick={() => setConnectFrom(selected.id)} className="border border-[#2f6d55] px-3 py-2 text-xs font-semibold text-[#245441]">Connect from this node</button><button type="button" onClick={() => removeNode(selected.id)} className="flex items-center gap-2 border border-[#a13d25] px-3 py-2 text-xs font-semibold text-[#a13d25]"><Trash2 className="size-3.5" /> Remove node</button></div>
      </section> : null}

      {diagram.connections.length ? <section><h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#716d65]">Connections</h3><ul className="mt-2 flex flex-wrap gap-2">{diagram.connections.map((edge) => <li key={edge.id}><button type="button" onClick={() => setDiagram((current) => ({ ...current, connections: current.connections.filter((item) => item.id !== edge.id) }))} className="flex items-center gap-2 border border-[#d8d2c7] px-3 py-2 text-xs">{diagram.nodes.find((node) => node.id === edge.from)?.label} <ArrowRight className="size-3" /> {diagram.nodes.find((node) => node.id === edge.to)?.label} <Trash2 className="size-3 text-[#a13d25]" aria-label="Remove connection" /></button></li>)}</ul></section> : null}

      <label className="grid gap-2 text-sm font-medium">Architecture explanation<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={7} maxLength={20_000} disabled={Boolean(busy)} className="border border-[#bdb7ad] p-4 font-normal leading-6 outline-none focus:border-[#2f6d55] focus:ring-2 focus:ring-[#2f6d55]/20" placeholder="Explain the request flow, scaling strategy, failure handling, and trade-offs." /></label>
      {saved ? <p role="status" className="text-sm text-[#2f6d55]">Design saved to the interview session.</p> : null}
      {error ? <p role="alert" className="text-sm text-[#a13d25]">{error}</p> : null}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void save().catch(() => undefined)} disabled={Boolean(busy) || !valid} className="flex h-11 items-center gap-2 border border-[#171713] px-5 font-mono text-xs font-bold uppercase disabled:opacity-50">{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : null} Save design</button><button type="button" onClick={submit} disabled={Boolean(busy) || !valid} className="flex h-11 items-center gap-2 bg-[#d94f28] px-5 font-mono text-xs font-bold uppercase text-white disabled:bg-[#b9b3aa]">{busy === "submit" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Submit design</button></div>
    </div>
  );
}

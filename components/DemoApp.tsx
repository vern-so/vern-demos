"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readableFg, softTint, type Brand } from "@/lib/branding";
import type { AgentQuestion, DemoMigration, RunReport, SampleCsvFile, Source, Template, ThreadEvent } from "@/lib/types";
import { ApiError, makeClient, type VernClient } from "@/lib/client";
import { normalizePreview, type PreviewSheet } from "@/lib/preview";
import { Shell } from "@/components/Shell";
import { Stepper, type StepKey } from "@/components/Stepper";
import { Dropzone } from "@/components/Dropzone";
import { AgentActivity, type FeedItem } from "@/components/AgentActivity";
import { Questions } from "@/components/Questions";
import { Preview } from "@/components/Preview";
import { Report } from "@/components/Report";
import { Button } from "@/components/Button";
import { AlertIcon, CloseIcon, DownloadIcon, HistoryIcon, ResetIcon, SparkIcon } from "@/components/Icons";

type Resumable = {
  migrationId: string;
  runId: string;
  runKind: "generate" | "update" | "execute";
  slugs: string[];
  after?: number;
  userMessages?: string[];
  status: string;
};

export function DemoApp({ brand, slug }: { brand: Brand; slug: string }) {
  // Apply brand color as CSS variables.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", brand.color);
    root.style.setProperty("--brand-fg", readableFg(brand.color));
    root.style.setProperty("--brand-soft", softTint(brand.color, 0.1));
  }, [brand.color]);

  const client = useMemo(() => makeClient(slug), [slug]);

  // The prospect's objects (templates) populate the dummy app's sidebar.
  const [navItems, setNavItems] = useState<string[]>([]);
  const onTemplates = useCallback((t: Template[]) => setNavItems(t.map((x) => x.name)), []);

  return (
    <Shell brand={brand} navItems={navItems}>
      <Flow brand={brand} client={client} onTemplates={onTemplates} />
    </Shell>
  );
}

function Flow({
  brand,
  client,
  onTemplates,
}: {
  brand: Brand;
  client: VernClient;
  onTemplates: (t: Template[]) => void;
}) {
  const [phase, setPhase] = useState<StepKey>("source");
  const [error, setError] = useState<string | null>(null);

  // Catalog
  const [sources, setSources] = useState<Source[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  // Migration
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sampleGenerated, setSampleGenerated] = useState(false);
  const [sampleGenerating, setSampleGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState<DemoMigration[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [completeCount, setCompleteCount] = useState(0);
  const [completeLimit, setCompleteLimit] = useState(5);

  // Live agent stream — interleaved prose + tool actions in arrival order.
  const [runKind, setRunKind] = useState<"generate" | "execute">("generate");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [agentSettled, setAgentSettled] = useState(false);
  const [agentElapsed, setAgentElapsed] = useState(0);

  const [questions, setQuestions] = useState<AgentQuestion[]>([]);
  const [preview, setPreview] = useState<PreviewSheet[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [report, setReport] = useState<RunReport | undefined>(undefined);

  // Review-screen "Fix" prompt (an `update` run).
  const [fixOpen, setFixOpen] = useState(false);
  const [fixText, setFixText] = useState("");

  // Resume: persisted in-progress run, picked up on the first screen.
  const [resumable, setResumable] = useState<Resumable | null>(null);
  const storageKey = `vern-demo:${client.slug}`;
  const saveProgress = useCallback(
    (d: Omit<Resumable, "status">) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(d));
      } catch {
        /* storage unavailable — resume just won't be offered */
      }
    },
    [storageKey],
  );
  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Refs that survive across the async run without re-render churn.
  const currentRunIdRef = useRef<string | null>(null);
  const cursorRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  // The `?step=` present on first load — captured before the URL-sync effect runs.
  const initialStepRef = useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("step"),
  );

  // Elapsed timer while the agent is actively working.
  useEffect(() => {
    const active = phase === "agent" || importing;
    if (!active || agentSettled || questions.length > 0) return;
    const t = setInterval(() => setAgentElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, importing, agentSettled, questions.length]);

  // Abort any open stream on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Surface a resumable import saved from a previous visit.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;

        const saved = JSON.parse(raw) as Partial<Resumable>;
        const valid =
          typeof saved.migrationId === "string" &&
          typeof saved.runId === "string" &&
          (saved.runKind === "generate" || saved.runKind === "update" || saved.runKind === "execute") &&
          Array.isArray(saved.slugs) &&
          saved.slugs.every((slug) => typeof slug === "string") &&
          (saved.after == null || typeof saved.after === "number") &&
          (saved.userMessages == null ||
            (Array.isArray(saved.userMessages) &&
              saved.userMessages.every((message) => typeof message === "string")));

        if (!valid) {
          clearProgress();
          return;
        }

        const run = await client.getRun(saved.migrationId!, saved.runId!);
        if (cancelled) return;

        if (!isResumableRunStatus(run.status)) {
          clearProgress();
          return;
        }

        setResumable({
          migrationId: saved.migrationId!,
          runId: saved.runId!,
          runKind: saved.runKind!,
          slugs: saved.slugs!,
          after: saved.after,
          userMessages: saved.userMessages,
          status: run.status,
        });
      } catch {
        clearProgress();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, storageKey, clearProgress]);

  // Keep the URL in sync with the current step so a refresh can restore it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (phase === "source") url.searchParams.delete("step");
    else url.searchParams.set("step", phase);
    window.history.replaceState(window.history.state, "", url);
  }, [phase]);

  const selectedTemplates = useMemo(
    () => templates.filter((t) => selectedSlugs.includes(t.slug)),
    [templates, selectedSlugs],
  );
  const capReached = completeCount >= completeLimit;

  const loadHistory = useCallback(async () => {
    try {
      const h = await client.listDemoMigrations();
      setHistory(h.migrations);
      setCompleteCount(h.completedCount);
      setCompleteLimit(h.completeLimit);
      setResumable((current) => {
        if (!current) return current;
        const durable = h.migrations.find((row) => row.migration_id === current.migrationId);
        if (durable && !isResumableDemoStatus(durable.status)) {
          clearProgress();
          return null;
        }
        return current;
      });
    } catch {
      setHistory([]);
    }
  }, [client, clearProgress]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const rememberMigration = useCallback(
    async (mId: string, patch: Parameters<VernClient["updateDemoMigration"]>[1]) => {
      await client.updateDemoMigration(mId, patch).catch(() => null);
      await loadHistory();
    },
    [client, loadHistory],
  );

  // Load sources + templates from the prospect's key.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [src, tpl] = await Promise.all([
          client.listSources().catch(() => []),
          client.listTemplates(),
        ]);
        if (cancelled) return;
        setSources(src);
        setTemplates(tpl);
        setSelectedSlugs(tpl.map((t) => t.slug)); // pre-configured per prospect → use all
        onTemplates(tpl);
      } catch (e) {
        if (!cancelled) setError(messageFor(e));
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, onTemplates]);

  // Preselect source from the prospect config once sources are known.
  useEffect(() => {
    if (!brand.source || sources.length === 0) return;
    const match = sources.find((s) => s.name.toLowerCase() === brand.source!.toLowerCase());
    if (match) setSelectedSource(match.name);
  }, [brand.source, sources]);

  const fail = (e: unknown) => {
    setError(messageFor(e));
    setBusy(false);
  };

  // --- Step actions ---

  const appendUserMessage = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setFeed((prev) => {
      const last = prev[prev.length - 1];
      if (last?.kind === "user" && last.text === clean) return prev;
      return [...prev, { kind: "user", text: clean }];
    });
  }, []);

  // Fold each streamed thread event into the live feed.
  const handleEvent = useCallback((ev: ThreadEvent) => {
    if (typeof ev.sequence === "number" && ev.sequence >= 0) cursorRef.current = ev.sequence;
    const userText = userTextForEvent(ev);
    if (userText) {
      setFeed((prev) => {
        const last = prev[prev.length - 1];
        if (last?.kind === "user" && last.text === userText) return prev;
        return [...prev, { kind: "user", id: ev.sequence, text: userText }];
      });
    } else if (ev.type === "tool_call") {
      const text = (ev.data as { text?: string })?.text;
      if (!text) return;
      setFeed((prev) => {
        // Collapse consecutive identical actions (e.g. repeated "Analyzing…").
        const last = prev[prev.length - 1];
        if (last?.kind === "tool" && last.text === text) return prev;
        return [...prev, { kind: "tool", id: ev.sequence, text }];
      });
    } else if (ev.type === "message") {
      if (typeof ev.data === "string" && ev.data) {
        const token = ev.data;
        setFeed((prev) => {
          // Append tokens to the current prose chunk; a tool action breaks it.
          const last = prev[prev.length - 1];
          if (last?.kind === "text") {
            return [...prev.slice(0, -1), { kind: "text", text: last.text + token }];
          }
          return [...prev, { kind: "text", text: token }];
        });
      }
    } else if (ev.type === "error") {
      const m =
        (ev.data as { message?: string })?.message ||
        (typeof ev.data === "string" ? ev.data : "Something went wrong while processing your data.");
      setError(m);
    }
  }, []);

  // Stream the current run's thread (live), falling back to a poll if SSE fails.
  const streamCurrent = useCallback(
    async (mId: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const last = await client.streamThread(mId, {
          after: cursorRef.current,
          include: "all",
          onEvent: handleEvent,
          signal: ctrl.signal,
        });
        if (typeof last === "number") cursorRef.current = last;
      } catch {
        // No live stream available — fall back to waiting for the run to settle.
        if (currentRunIdRef.current) await client.pollRun(mId, currentRunIdRef.current).catch(() => {});
      }
    },
    [client, handleEvent],
  );

  // Start a run and stream it; resets the visible feed for the new run.
  const runAndStream = useCallback(
    async (mId: string, kind: "generate" | "execute") => {
      const resumeAfter = cursorRef.current;
      setRunKind(kind);
      setFeed([]);
      setQuestions([]);
      setAgentSettled(false);
      setAgentElapsed(0);
      setPreviewReady(false);
      setError(null);
      setPhase("agent");
      const started = await client.startRun(mId, kind);
      currentRunIdRef.current = started.run_id;
      saveProgress({ migrationId: mId, runId: started.run_id, runKind: kind, slugs: selectedSlugs, after: resumeAfter });
      await rememberMigration(mId, {
        current_run_id: started.run_id,
        run_kind: kind,
        status: kind === "execute" ? "importing" : "mapping",
        generate_run_id: kind === "generate" ? started.run_id : undefined,
        execute_run_id: kind === "execute" ? started.run_id : undefined,
        resume_after: resumeAfter ?? null,
      });
      await streamCurrent(mId);
    },
    [client, streamCurrent, saveProgress, selectedSlugs, rememberMigration],
  );

  const goToPreview = useCallback(
    async (mId: string) => {
      const p = await client.getPreview(mId).catch(() => null);
      setPreview(normalizePreview(p));
      setPhase("review");
    },
    [client],
  );

  const upload = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      cursorRef.current = undefined;
      // The migration isn't created until the user commits here.
      const m = await client.createMigration({
        name: `${brand.product} demo`,
        source: selectedSource,
        external_id: `demo-${Date.now()}`,
        templates: selectedSlugs,
      });
      setMigrationId(m.id);
      setPreview([]);
      setPreviewReady(false);

      const urls = await client.requestUploadUrls(
        m.id,
        files.map((f) => ({ name: f.name, content_type: f.type || "text/csv" })),
      );
      await Promise.all(
        urls.map((u) => {
          const file = files.find((f) => f.name === u.name);
          if (!file) return Promise.resolve();
          return client.uploadToSignedUrl(u.signed_url, file);
        }),
      );
      await runAndStream(m.id, "generate");
      setAgentSettled(true);
      const run = await client.getRun(m.id, currentRunIdRef.current!);
      if (run.status === "awaiting_approval") {
        setPreviewReady(true);
        await rememberMigration(m.id, {
          status: "awaiting_review",
          last_thread_sequence: cursorRef.current ?? null,
        });
      } else if (run.status === "blocked") {
        setQuestions(run.questions || []);
        await rememberMigration(m.id, {
          status: "blocked",
          last_thread_sequence: cursorRef.current ?? null,
        });
      } else if (run.status === "failed" || run.status === "canceled") {
        await rememberMigration(m.id, { status: "failed", last_thread_sequence: cursorRef.current ?? null });
        throw new Error("That didn't complete. Please retry.");
      }
    } catch (e) {
      fail(e);
      if (phase !== "agent") setPhase("upload");
    } finally {
      setBusy(false);
    }
  }, [client, brand.product, selectedSource, selectedSlugs, files, runAndStream, rememberMigration, phase]);

  const generateSampleData = useCallback(async () => {
    if (sampleGenerated || selectedTemplates.length === 0) return;
    if (
      files.length > 0 &&
      !window.confirm("Replace the selected files with generated sample CSVs?")
    ) {
      return;
    }

    setError(null);
    setSampleGenerating(true);
    try {
      const result = await client.generateSampleData({
        source: selectedSource,
        templates: selectedTemplates,
      });
      if (result.files.length === 0) throw new Error("No sample CSVs were generated. Please try again.");
      setFiles(result.files.map(sampleCsvToFile));
      setSampleGenerated(true);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setSampleGenerating(false);
    }
  }, [client, files.length, sampleGenerated, selectedSource, selectedTemplates]);

  const submitAnswers = useCallback(
    async (answers: { id: string; value: string }[]) => {
      const runId = currentRunIdRef.current;
      if (!migrationId || !runId) return;
      const resumeAfter = cursorRef.current;
      const userText = formatAnswersForStream(questions, answers);
      setBusy(true);
      try {
        appendUserMessage(userText);
        saveProgress({
          migrationId,
          runId,
          runKind,
          slugs: selectedSlugs,
          after: resumeAfter,
          userMessages: userText ? [userText] : undefined,
        });
        await client.answerQuestions(migrationId, runId, answers);
        setQuestions([]);
        setAgentSettled(false);
        setAgentElapsed(0);
        setPreview([]);
        setPreviewReady(false);
        await streamCurrent(migrationId);
        setAgentSettled(true);
        const run = await client.getRun(migrationId, runId);
        if (run.status === "awaiting_approval") {
          setPreviewReady(true);
          await rememberMigration(migrationId, {
            status: "awaiting_review",
            last_thread_sequence: cursorRef.current ?? null,
          });
        } else if (run.status === "blocked") {
          setQuestions(run.questions || []);
          await rememberMigration(migrationId, {
            status: "blocked",
            last_thread_sequence: cursorRef.current ?? null,
          });
        }
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
    },
    [client, migrationId, questions, runKind, selectedSlugs, appendUserMessage, saveProgress, streamCurrent, rememberMigration],
  );

  const execute = useCallback(async () => {
    if (!migrationId) return;
    const resumeAfter = cursorRef.current;
    setError(null);
    setBusy(true);
    setImporting(true);
    setRunKind("execute");
    setFeed([]);
    setQuestions([]);
    setAgentSettled(false);
    setAgentElapsed(0);
    try {
      const started = await client.startRun(migrationId, "execute");
      currentRunIdRef.current = started.run_id;
      saveProgress({
        migrationId,
        runId: started.run_id,
        runKind: "execute",
        slugs: selectedSlugs,
        after: resumeAfter,
      });
      await rememberMigration(migrationId, {
        current_run_id: started.run_id,
        execute_run_id: started.run_id,
        run_kind: "execute",
        status: "importing",
        resume_after: resumeAfter ?? null,
      });
      await streamCurrent(migrationId);
      setAgentSettled(true);
      const run = await client.getRun(migrationId, currentRunIdRef.current!);
      if (run.status === "completed") {
        setReport(run.report);
        await rememberMigration(migrationId, {
          status: "completed",
          report: run.report ?? null,
          last_thread_sequence: cursorRef.current ?? null,
        });
        setPhase("done");
        clearProgress();
      } else if (run.status === "blocked") {
        setQuestions(run.questions || []);
        await rememberMigration(migrationId, {
          status: "blocked",
          last_thread_sequence: cursorRef.current ?? null,
        });
        setPhase("agent");
      } else {
        await rememberMigration(migrationId, { status: "failed", last_thread_sequence: cursorRef.current ?? null });
        throw new Error("The import did not complete. Please retry.");
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setImporting(false);
    }
  }, [client, migrationId, selectedSlugs, streamCurrent, saveProgress, rememberMigration, clearProgress]);

  // "Fix": send free-text feedback to the agent as an `update` run, then let
  // the user view the refreshed preview when they are ready.
  const applyFix = useCallback(
    async (message: string) => {
      if (!migrationId || !message.trim()) return;
      const resumeAfter = cursorRef.current;
      const userText = message.trim();
      setError(null);
      setBusy(true);
      setRunKind("generate");
      setFeed([]);
      appendUserMessage(userText);
      setQuestions([]);
      setAgentSettled(false);
      setAgentElapsed(0);
      setPreview([]);
      setPreviewReady(false);
      setFixOpen(false);
      setFixText("");
      setPhase("agent");
      try {
        const started = await client.startRun(migrationId, "update", { message });
        currentRunIdRef.current = started.run_id;
        saveProgress({
          migrationId,
          runId: started.run_id,
          runKind: "update",
          slugs: selectedSlugs,
          after: resumeAfter,
          userMessages: [userText],
        });
        await rememberMigration(migrationId, {
          current_run_id: started.run_id,
          update_run_id: started.run_id,
          run_kind: "update",
          status: "mapping",
          resume_after: resumeAfter ?? null,
        });
        await streamCurrent(migrationId);
        setAgentSettled(true);
        const run = await client.getRun(migrationId, started.run_id);
        if (run.status === "awaiting_approval") {
          setPreviewReady(true);
          await rememberMigration(migrationId, {
            status: "awaiting_review",
            last_thread_sequence: cursorRef.current ?? null,
          });
        } else if (run.status === "blocked") {
          setQuestions(run.questions || []);
          await rememberMigration(migrationId, {
            status: "blocked",
            last_thread_sequence: cursorRef.current ?? null,
          });
        } else if (run.status === "failed" || run.status === "canceled") {
          await rememberMigration(migrationId, { status: "failed", last_thread_sequence: cursorRef.current ?? null });
          throw new Error("The update did not complete. Please retry.");
        }
      } catch (e) {
        fail(e);
        setPhase("review");
      } finally {
        setBusy(false);
      }
    },
    [client, migrationId, selectedSlugs, appendUserMessage, streamCurrent, saveProgress, rememberMigration],
  );

  // Resume an in-progress import: rebuild the feed from the durable thread,
  // then re-attach the live stream (or jump straight to the settled state).
  const resumeFrom = useCallback(async (saved: Resumable) => {
    const { migrationId: mId, runId, runKind: kind, slugs, after, userMessages } = saved;
    setResumable(null);
    setError(null);
    setMigrationId(mId);
    setSelectedSlugs(slugs);
    currentRunIdRef.current = runId;
    setRunKind(kind === "execute" ? "execute" : "generate");
    setFeed((userMessages || []).map((text): FeedItem => ({ kind: "user", text })));
    cursorRef.current = after;
    setQuestions([]);
    setAgentSettled(false);
    setAgentElapsed(0);
    setPreviewReady(false);
    setPhase("agent");
    try {
      // Replay the thread so the user sees the history, then continue live.
      const snap = await client.getThreadSnapshot(mId, { include: "all", after }).catch(() => null);
      if (snap?.events?.length) {
        snap.events.forEach(handleEvent);
        const firstTs = snap.events[0]?.created_at ? Date.parse(snap.events[0].created_at) : NaN;
        if (!Number.isNaN(firstTs)) {
          setAgentElapsed(Math.max(0, Math.floor((Date.now() - firstTs) / 1000)));
        }
      }
      if (typeof snap?.last_sequence === "number") cursorRef.current = snap.last_sequence;
      let run = await client.getRun(mId, runId);
      if (run.status === "queued" || run.status === "running") {
        await streamCurrent(mId);
        run = await client.getRun(mId, runId);
      }
      setAgentSettled(true);
      if (run.status === "awaiting_approval") setPreviewReady(true);
      else if (run.status === "blocked") setQuestions(run.questions || []);
      else if (run.status === "completed") {
        setReport(run.report);
        await rememberMigration(mId, {
          status: "completed",
          report: run.report ?? null,
          last_thread_sequence: cursorRef.current ?? null,
        });
        setPhase("done");
        clearProgress();
      } else {
        clearProgress();
        throw new Error("This import is no longer available. Please start a new one.");
      }
    } catch (e) {
      fail(e);
      setPhase("source");
    }
  }, [client, handleEvent, streamCurrent, rememberMigration, clearProgress]);

  const resume = useCallback(async () => {
    if (!resumable) return;
    await resumeFrom(resumable);
  }, [resumable, resumeFrom]);

  const viewPreview = useCallback(async () => {
    if (!migrationId) return;
    setBusy(true);
    setError(null);
    try {
      await goToPreview(migrationId);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [migrationId, goToPreview]);

  const startOver = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    currentRunIdRef.current = null;
    cursorRef.current = undefined;
    clearProgress();
    setResumable(null);
    setMigrationId(null);
    setFiles([]);
    setSampleGenerated(false);
    setSampleGenerating(false);
    setBusy(false);
    setImporting(false);
    setRunKind("generate");
    setFeed([]);
    setAgentSettled(false);
    setAgentElapsed(0);
    setQuestions([]);
    setPreview([]);
    setPreviewReady(false);
    setReport(undefined);
    setFixOpen(false);
    setFixText("");
    setError(null);
    setPhase("source");
  }, [clearProgress]);

  const dismissResume = useCallback(() => {
    clearProgress();
    setResumable(null);
  }, [clearProgress]);

  const showStartOver =
    phase !== "done" &&
    (phase !== "source" ||
      files.length > 0 ||
      migrationId !== null ||
      feed.length > 0 ||
      preview.length > 0 ||
      resumable !== null);
  const hasHistory = history.length > 0 || completeCount > 0;

  const resumeHistory = useCallback(
    async (row: DemoMigration) => {
      setHistoryOpen(false);
      const runId = row.current_run_id || row.execute_run_id || row.update_run_id || row.generate_run_id;
      if (!runId) return;
      await resumeFrom({
        migrationId: row.migration_id,
        runId,
        runKind: row.run_kind || "generate",
        slugs: row.templates,
        after: row.resume_after ?? undefined,
        status: row.status,
      });
    },
    [resumeFrom],
  );

  const openCompleted = useCallback((row: DemoMigration) => {
    setHistoryOpen(false);
    setMigrationId(row.migration_id);
    setSelectedSlugs(row.templates);
    setReport(row.report || undefined);
    setPhase("done");
  }, []);

  const openAwaitingReview = useCallback(
    async (row: DemoMigration) => {
      setHistoryOpen(false);
      setMigrationId(row.migration_id);
      setSelectedSlugs(row.templates);
      setRunKind("generate");
      setFeed([]);
      setAgentSettled(true);
      setPreviewReady(true);
      setBusy(true);
      setError(null);
      try {
        const p = await client.getPreview(row.migration_id).catch(() => null);
        setPreview(normalizePreview(p));
        setPhase("review");
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const runAnother = useCallback(() => {
    setMigrationId(null);
    setFiles([]);
    setSampleGenerated(false);
    setSampleGenerating(false);
    setRunKind("generate");
    setFeed([]);
    setAgentSettled(false);
    setAgentElapsed(0);
    setQuestions([]);
    setPreview([]);
    setPreviewReady(false);
    setReport(undefined);
    setFixOpen(false);
    setFixText("");
    setError(null);
    setPhase("source");
    void loadHistory();
  }, [loadHistory]);

  // --- Render ---

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-zinc-900">Import your data</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Bring your existing records into {brand.product} — mapped and validated for you
              automatically.
            </p>
          </div>
          {hasHistory && (
            <HistoryMenuButton
              open={historyOpen}
              setOpen={setHistoryOpen}
              rows={history}
              templates={templates}
              completeCount={completeCount}
              completeLimit={completeLimit}
              client={client}
              onResume={resumeHistory}
              onOpenComplete={openCompleted}
              onOpenReview={openAwaitingReview}
            />
          )}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="min-w-0 overflow-x-auto pb-1">
            <Stepper current={phase} />
          </div>
          {showStartOver && <StartOverButton onClick={startOver} />}
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {resumable && phase === "source" && (
        <ResumeBanner status={resumable.status} onResume={resume} onDismiss={dismissResume} />
      )}

      {phase === "source" && (
        <SourceStep
          loading={catalogLoading}
          sources={sources}
          selectedSource={selectedSource}
          setSelectedSource={setSelectedSource}
          templates={templates}
          selectedSlugs={selectedSlugs}
          setSelectedSlugs={setSelectedSlugs}
          onContinue={() => setPhase("upload")}
          capReached={capReached}
          completeLimit={completeLimit}
        />
      )}

      {phase === "upload" && (
        <div className="flex flex-col gap-5">
          <Dropzone
            files={files}
            onFiles={setFiles}
            disabled={busy}
            action={
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  void generateSampleData();
                }}
                loading={sampleGenerating}
                disabled={busy || sampleGenerated || sampleGenerating || selectedTemplates.length === 0 || capReached}
              >
                <SparkIcon className="h-4 w-4" />
                {sampleGenerated ? "Sample files generated" : "Generate sample files"}
              </Button>
            }
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setPhase("source")} disabled={busy}>
              Back
            </Button>
            <Button onClick={() => void upload()} disabled={files.length === 0 || capReached} loading={busy}>
              Map &amp; validate my data
            </Button>
          </div>
        </div>
      )}

      {phase === "agent" && (
        <div className="flex flex-col gap-5">
          <AgentActivity
            feed={feed}
            settled={agentSettled}
            awaitingInput={questions.length > 0}
            kind={runKind}
            elapsed={agentElapsed}
          />
          {questions.length > 0 && (
            <Questions questions={questions} onSubmit={submitAnswers} submitting={busy} />
          )}
          {agentSettled && questions.length === 0 && previewReady && (
            <div className="flex justify-end">
              <Button onClick={preview.length > 0 ? () => setPhase("review") : viewPreview} loading={busy}>
                {preview.length > 0 ? "Return to review" : "View preview"}
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === "review" && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Review the proposed import</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Every row has been mapped to your fields and validated. Flagged cells are kept and
              marked, never silently dropped.
            </p>
          </div>
          {runKind === "execute" && importing ? (
            <AgentActivity feed={feed} settled={agentSettled} kind="execute" elapsed={agentElapsed} />
          ) : (
            <Preview sheets={preview} />
          )}

          {fixOpen && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <label className="text-sm font-medium text-zinc-800">
                What would you like to change?
              </label>
              <textarea
                autoFocus
                rows={3}
                value={fixText}
                onChange={(e) => setFixText(e.target.value)}
                placeholder="e.g. Map 'Settled' status to Archived, and use the company domain for missing emails."
                className="mt-2 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setFixOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={() => applyFix(fixText)} disabled={!fixText.trim()} loading={busy}>
                  Update my import
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setFixOpen(false);
                setPhase("agent");
              }}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setFixOpen((o) => !o)} disabled={busy}>
                Fix
              </Button>
              <Button onClick={execute} loading={busy}>
                Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && migrationId && (
        <div className="flex flex-col gap-5">
          <Report report={report} migrationId={migrationId} templates={selectedTemplates} client={client} />
          {!capReached && (
            <div className="flex justify-center">
              <Button variant="ghost" onClick={runAnother}>
                Run another demo
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryMenuButton({
  open,
  setOpen,
  rows,
  templates,
  completeCount,
  completeLimit,
  client,
  onResume,
  onOpenComplete,
  onOpenReview,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  rows: DemoMigration[];
  templates: Template[];
  completeCount: number;
  completeLimit: number;
  client: VernClient;
  onResume: (row: DemoMigration) => void;
  onOpenComplete: (row: DemoMigration) => void;
  onOpenReview: (row: DemoMigration) => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Previous imports"
        title="Previous imports"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
      >
        <HistoryIcon className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close previous imports"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Previous imports"
            className="absolute right-0 top-full z-20 mt-2 max-h-[70vh] w-[min(92vw,36rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
          >
            <MigrationHistory
              rows={rows}
              templates={templates}
              completeCount={completeCount}
              completeLimit={completeLimit}
              client={client}
              onResume={onResume}
              onOpenComplete={onOpenComplete}
              onOpenReview={onOpenReview}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StartOverButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label="Start over"
        title="Start over"
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
      >
        <ResetIcon className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        Start over
      </span>
    </div>
  );
}

function sampleCsvToFile(file: SampleCsvFile): File {
  const name = file.name.toLowerCase().endsWith(".csv") ? file.name : `${file.name}.csv`;
  return new File([file.csv], name, { type: "text/csv" });
}

function MigrationHistory({
  rows,
  templates,
  completeCount,
  completeLimit,
  client,
  onResume,
  onOpenComplete,
  onOpenReview,
}: {
  rows: DemoMigration[];
  templates: Template[];
  completeCount: number;
  completeLimit: number;
  client: VernClient;
  onResume: (row: DemoMigration) => void;
  onOpenComplete: (row: DemoMigration) => void;
  onOpenReview: (row: DemoMigration) => void;
}) {
  if (rows.length === 0 && completeCount === 0) return null;
  const names = new Map(templates.map((t) => [t.slug, t.name]));
  const downloadAll = (row: DemoMigration) => {
    row.templates.forEach((slug, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = client.exportUrl(row.migration_id, slug);
        a.download = `${slug}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350);
    });
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-800">Previous imports</h2>
          <p className="text-xs text-zinc-400">
            {completeCount} of {completeLimit} completed for this link.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const completed = row.status === "completed";
          const reviewReady = row.status === "awaiting_review";
          const resumable = isResumableDemoStatus(row.status) && !reviewReady && !!row.current_run_id;
          const templateLabel =
            row.templates.map((slug) => names.get(slug) || slug).slice(0, 3).join(", ") ||
            "Selected templates";
          return (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800">{labelForHistory(row.status)}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {formatHistoryDate(row.completed_at || row.created_at)} · {templateLabel}
                  {row.templates.length > 3 ? ` +${row.templates.length - 3}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {completed ? (
                  <>
                    <Button variant="outline" onClick={() => downloadAll(row)}>
                      <DownloadIcon className="h-4 w-4" />
                      Download all
                    </Button>
                    <Button variant="ghost" onClick={() => onOpenComplete(row)}>
                      View result
                    </Button>
                  </>
                ) : reviewReady ? (
                  <Button variant="outline" onClick={() => onOpenReview(row)}>
                    View preview
                  </Button>
                ) : resumable ? (
                  <Button variant="outline" onClick={() => onResume(row)}>
                    Resume
                  </Button>
                ) : (
                  <span className="self-center text-xs text-zinc-400">Unavailable</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function labelForHistory(status: string): string {
  if (status === "completed") return "Import complete";
  if (status === "awaiting_review") return "Preview ready";
  if (status === "importing") return "Importing";
  if (status === "blocked") return "Needs input";
  if (status === "failed") return "Import failed";
  return "Mapping in progress";
}

function formatHistoryDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

// Screen 1 — where are you migrating from? (progressive disclosure)
function SourceStep({
  loading,
  sources,
  selectedSource,
  setSelectedSource,
  templates,
  selectedSlugs,
  setSelectedSlugs,
  onContinue,
  capReached,
  completeLimit,
}: {
  loading: boolean;
  sources: Source[];
  selectedSource: string | null;
  setSelectedSource: (s: string | null) => void;
  templates: Template[];
  selectedSlugs: string[];
  setSelectedSlugs: (s: string[]) => void;
  onContinue: () => void;
  capReached: boolean;
  completeLimit: number;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="relative h-9 w-28 overflow-hidden rounded-full bg-zinc-100 shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <section>
        <h2 className="text-sm font-medium text-zinc-800">Where are you migrating from?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <SourceChip
            label="No specific system"
            selected={selectedSource === null}
            onClick={() => setSelectedSource(null)}
          />
          {sources.map((s) => (
            <SourceChip
              key={s.name}
              label={s.name}
              logo={s.logo_url}
              selected={selectedSource === s.name}
              onClick={() => setSelectedSource(s.name)}
            />
          ))}
        </div>
      </section>

      <details className="group border-t border-zinc-100 pt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-zinc-700">
          <span>Choose templates</span>
          <span className="flex items-center gap-2 text-xs font-normal text-zinc-400">
            {selectedSlugs.length} selected
            <span className="transition-transform group-open:rotate-90">▸</span>
          </span>
        </summary>
        <div className="mt-4">
          <TemplatePicker
            templates={templates}
            selectedSlugs={selectedSlugs}
            setSelectedSlugs={setSelectedSlugs}
          />
        </div>
      </details>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={selectedSlugs.length === 0 || capReached}>
          Continue
        </Button>
      </div>
      {capReached && (
        <p className="text-right text-xs text-zinc-400">
          This demo link has reached its {completeLimit}-import limit.
        </p>
      )}
    </div>
  );
}

function TemplatePicker({
  templates,
  selectedSlugs,
  setSelectedSlugs,
}: {
  templates: Template[];
  selectedSlugs: string[];
  setSelectedSlugs: (s: string[]) => void;
}) {
  const toggle = (slug: string) =>
    setSelectedSlugs(
      selectedSlugs.includes(slug)
        ? selectedSlugs.filter((s) => s !== slug)
        : [...selectedSlugs, slug],
    );

  const allSelected = templates.length > 0 && selectedSlugs.length === templates.length;
  const toggleAll = () => setSelectedSlugs(allSelected ? [] : templates.map((t) => t.slug));

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-xs text-zinc-400">
          Optional. The demo uses all configured templates unless you narrow it down.
        </p>
        {templates.length > 0 && (
          <button
            onClick={toggleAll}
            className="shrink-0 text-xs font-medium hover:underline"
            style={{ color: "var(--brand)" }}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((t) => {
          const on = selectedSlugs.includes(t.slug);
          return (
            <button
              key={t.slug}
              onClick={() => toggle(t.slug)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                on ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  on ? "border-transparent" : "border-zinc-300"
                }`}
                style={on ? { background: "var(--brand)", color: "var(--brand-fg)" } : undefined}
              >
                {on && <span className="text-xs">✓</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-800">{t.name}</span>
                {t.description && (
                  <span className="mt-0.5 block line-clamp-1 text-xs text-zinc-500">{t.description}</span>
                )}
                {t.columns && t.columns.length > 0 && (
                  <span className="mt-1.5 block text-xs text-zinc-400">{t.columns.length} fields</span>
                )}
              </span>
            </button>
          );
        })}
        {templates.length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 sm:col-span-2">
            No templates are configured on this key yet.
          </p>
        )}
      </div>
    </section>
  );
}

function SourceChip({
  label,
  logo,
  selected,
  onClick,
}: {
  label: string;
  logo?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${
        selected ? "border-[var(--brand)] bg-[var(--brand-soft)] text-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
      }`}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-4 w-4 rounded object-contain" />
      )}
      {label}
    </button>
  );
}

function ResumeBanner({
  status,
  onResume,
  onDismiss,
}: {
  status: string;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const detail =
    status === "awaiting_approval"
      ? "Your preview is ready to review."
      : status === "blocked"
        ? "It's paused, waiting on your input."
        : "An import is still running.";
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--brand)", background: "var(--brand-soft)" }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--brand)", color: "var(--brand-fg)" }}
      >
        <SparkIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-800">Pick up where you left off</p>
        <p className="text-xs text-zinc-500">{detail}</p>
      </div>
      <Button onClick={onResume}>Resume</Button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return "This demo link's API key is missing or invalid.";
    if (e.status === 404) return "This demo link is unknown or inactive.";
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}

function isResumableRunStatus(status: string): boolean {
  return status === "queued" || status === "running" || status === "awaiting_approval" || status === "blocked";
}

function isResumableDemoStatus(status: string): boolean {
  return status === "mapping" || status === "awaiting_review" || status === "importing" || status === "blocked";
}

function userTextForEvent(ev: ThreadEvent): string | null {
  const d = ev.data;
  if (typeof d === "string") {
    return /user|human|input/i.test(ev.type) ? d.trim() || null : null;
  }
  if (!d || typeof d !== "object") return null;

  const data = d as Record<string, unknown>;
  const role = typeof data.role === "string" ? data.role.toLowerCase() : "";
  const author =
    typeof data.author === "string"
      ? data.author.toLowerCase()
      : typeof data.sender === "string"
        ? data.sender.toLowerCase()
        : "";
  const fromUser =
    role === "user" ||
    role === "human" ||
    author === "user" ||
    author === "human" ||
    /user|human|input/i.test(ev.type);
  if (!fromUser) return null;

  return textFromUnknown(data.text) || textFromUnknown(data.message) || textFromUnknown(data.content);
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const text = value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          return textFromUnknown(p.text) || textFromUnknown(p.content) || "";
        }
        return "";
      })
      .join("");
    return text.trim() || null;
  }
  return null;
}

function formatAnswersForStream(
  questions: AgentQuestion[],
  answers: { id: string; value: string }[],
): string {
  return answers
    .map((answer) => {
      const question = questions.find((q) => q.id === answer.id);
      return question ? `${question.question}\n${answer.value}` : answer.value;
    })
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
}

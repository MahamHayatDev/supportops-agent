"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Target,
} from "lucide-react";

type Run = {
  id: number;
  question: string;
  intent: string;
  confidence: number;
  escalated: boolean;
  latency_ms: number;
  trace: string[];
  created_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRun, setExpandedRun] = useState<number | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/runs`);

      if (!response.ok) {
        throw new Error("Failed to load runs.");
      }

      const data = await response.json();
      setRuns(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    if (runs.length === 0) {
      return {
        total: 0,
        escalationRate: 0,
        avgLatency: 0,
        avgConfidence: 0,
      };
    }

    const escalated = runs.filter((run) => run.escalated).length;

    const totalLatency = runs.reduce(
      (sum, run) => sum + (run.latency_ms || 0),
      0
    );

    const totalConfidence = runs.reduce(
      (sum, run) => sum + (run.confidence || 0),
      0
    );

    return {
      total: runs.length,
      escalationRate: (escalated / runs.length) * 100,
      avgLatency: totalLatency / runs.length,
      avgConfidence: totalConfidence / runs.length,
    };
  }, [runs]);

  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#252326]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#e8e3e1] pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#a46b78]">
              SupportOps
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Agent Runs
            </h1>

            <p className="mt-2 text-sm text-[#716a6e]">
              Monitor agent performance and inspect graph execution traces.
            </p>
          </div>

          <button
            onClick={loadRuns}
            className="flex items-center gap-2 rounded-xl border border-[#e8e3e1] bg-white px-4 py-2.5 text-sm font-medium text-[#514b4f] shadow-sm transition hover:bg-[#faf8f8]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Activity size={20} />}
            label="Total Runs"
            value={stats.total.toString()}
          />

          <StatCard
            icon={<ShieldAlert size={20} />}
            label="Escalation Rate"
            value={`${stats.escalationRate.toFixed(1)}%`}
          />

          <StatCard
            icon={<Clock3 size={20} />}
            label="Average Latency"
            value={`${Math.round(stats.avgLatency)} ms`}
          />

          <StatCard
            icon={<Target size={20} />}
            label="Average Confidence"
            value={stats.avgConfidence.toFixed(2)}
          />
        </section>

        <section>
          {loading && (
            <div className="rounded-2xl border border-[#e8e3e1] bg-white p-8 text-center text-[#716a6e]">
              Loading agent runs...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-white p-6">
              <h2 className="font-semibold">
                Could not load agent runs
              </h2>

              <p className="mt-2 text-sm text-[#716a6e]">
                {error}
              </p>

              <p className="mt-3 text-sm text-[#716a6e]">
                Make sure the FastAPI backend is running on port 8000.
              </p>
            </div>
          )}

          {!loading && !error && runs.length === 0 && (
            <div className="rounded-2xl border border-[#e8e3e1] bg-white p-12 text-center">
              <h2 className="text-lg font-semibold">
                No runs yet
              </h2>

              <p className="mt-2 text-sm text-[#716a6e]">
                Agent runs will appear here after requests are processed.
              </p>
            </div>
          )}

          {!loading && !error && runs.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#e8e3e1] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-[#eee9e7] bg-[#faf8f8] text-left">
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                        Question
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                        Intent
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                        Confidence
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                        Latency
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                        Status
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                        Trace
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {runs.map((run) => {
                      const isExpanded = expandedRun === run.id;

                      return (
                        <RunRow
                          key={run.id}
                          run={run}
                          isExpanded={isExpanded}
                          onToggle={() =>
                            setExpandedRun(
                              isExpanded ? null : run.id
                            )
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e3e1] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e3e7] text-[#a46b78]">
          {icon}
        </div>
      </div>

      <p className="mt-5 text-sm text-[#81797e]">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: Run;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#eee9e7]">
        <td className="max-w-[360px] px-5 py-4">
          <p className="truncate text-sm font-medium text-[#252326]">
            {run.question}
          </p>

          <p className="mt-1 text-xs text-[#91898e]">
            {new Date(run.created_at).toLocaleString()}
          </p>
        </td>

        <td className="px-5 py-4">
          <span className="rounded-full bg-[#f3e3e7] px-3 py-1 text-xs font-medium text-[#925968]">
            {run.intent || "unknown"}
          </span>
        </td>

        <td className="px-5 py-4 text-sm font-medium">
          {(run.confidence || 0).toFixed(2)}
        </td>

        <td className="px-5 py-4 text-sm text-[#514b4f]">
          {run.latency_ms} ms
        </td>

        <td className="px-5 py-4">
          {run.escalated ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Escalated
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Completed
            </span>
          )}
        </td>

        <td className="px-5 py-4">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 rounded-lg border border-[#e1dbdd] px-3 py-2 text-xs font-medium text-[#514b4f] transition hover:bg-[#faf8f8]"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={15} />
                Hide
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                View
              </>
            )}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-[#eee9e7] bg-[#faf8f8]">
          <td colSpan={6} className="px-5 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#a46b78]">
                Graph execution trace
              </p>

              <div className="mt-3 space-y-2">
                {run.trace?.length > 0 ? (
                  run.trace.map((step, index) => (
                    <div
                      key={`${run.id}-${index}`}
                      className="flex gap-3 rounded-lg border border-[#e8e3e1] bg-white px-4 py-3"
                    >
                      <span className="text-xs font-semibold text-[#a46b78]">
                        {index + 1}
                      </span>

                      <span className="text-sm text-[#514b4f]">
                        {step}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#81797e]">
                    No trace data available.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
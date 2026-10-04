"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type EvaluationCase = {
  id: number;
  question: string;
  type: string;
  expected: {
    should_escalate: boolean;
    expected_sources: string[];
    reference: string | null;
  };
  actual: {
    answer: string | null;
    escalated: boolean;
    intent: string;
    confidence: number;
    citations: {
      source_url: string;
      title: string;
    }[];
    cited_urls: string[];
    trace: string[];
  };
  evaluation: {
    correct: boolean | null;
    citation_pass: boolean;
    escalation_pass: boolean;
    latency_ms: number;
    token_cost: number | null;
  };
};

type VersionResult = {
  version: string;
  correctness:
    | number
    | {
        average: number;
        evaluated_cases: number;
      };
  citation_accuracy:
    | number
    | {
        average: number;
        evaluated_cases: number;
      };
  escalation_accuracy:
    | number
    | {
        average: number;
        evaluated_cases: number;
      };
  avg_latency_ms: number;
};

type EvalResponse = {
  version: string;
  total_cases: number;
  correctness: number;
  citation_accuracy: number;
  escalation_accuracy: number;
  avg_latency_ms: number;
  token_cost: number | null;
  results: EvaluationCase[];
  versions: VersionResult[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function metricValue(
  metric:
    | number
    | {
        average: number;
        evaluated_cases: number;
      }
) {
  if (typeof metric === "number") {
    return metric;
  }

  return metric.average;
}

export default function EvalsPage() {
  const [data, setData] = useState<EvalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEvaluations();
  }, []);

  async function loadEvaluations() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/evals`);

      if (!response.ok) {
        throw new Error("Failed to load evaluation results.");
      }

      const result: EvalResponse = await response.json();

      setData(result);
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

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.versions.map((version) => ({
      version: version.version.toUpperCase(),
      correctness:
        metricValue(version.correctness) * 100,
      citation:
        metricValue(version.citation_accuracy) * 100,
      escalation:
        metricValue(version.escalation_accuracy) * 100,
    }));
  }, [data]);

  const failedCases = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.results.filter(
      (item) =>
        item.evaluation.correct === false ||
        item.evaluation.citation_pass === false ||
        item.evaluation.escalation_pass === false
    );
  }, [data]);

  const averageLatency = useMemo(() => {
    if (!data || data.results.length === 0) {
      return 0;
    }

    const total = data.results.reduce(
      (sum, item) => sum + (item.evaluation.latency_ms || 0),
      0
    );

    return total / data.results.length;
  }, [data]);

  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#252326]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#e8e3e1] pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#a46b78]">
              SupportOps
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Evaluations
            </h1>

            <p className="mt-2 text-sm text-[#716a6e]">
              Compare agent evaluation versions and investigate failed cases.
            </p>
          </div>

          <button
            onClick={loadEvaluations}
            className="flex items-center gap-2 rounded-xl border border-[#e8e3e1] bg-white px-4 py-2.5 text-sm font-medium text-[#514b4f] shadow-sm transition hover:bg-[#faf8f8]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="py-8">
          {loading && (
            <div className="rounded-2xl border border-[#e8e3e1] bg-white p-10 text-center text-[#716a6e]">
              Loading evaluation results...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <XCircle
                  size={21}
                  className="mt-0.5 text-red-500"
                />

                <div>
                  <h2 className="font-semibold">
                    Could not load evaluations
                  </h2>

                  <p className="mt-2 text-sm text-[#716a6e]">
                    {error}
                  </p>

                  <p className="mt-3 text-sm text-[#716a6e]">
                    Make sure the FastAPI backend is running on port 8000.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={<BarChart3 size={20} />}
                  label="Correctness"
                  value={`${(data.correctness * 100).toFixed(0)}%`}
                />

                <MetricCard
                  icon={<CheckCircle2 size={20} />}
                  label="Citation Accuracy"
                  value={`${(
                    data.citation_accuracy * 100
                  ).toFixed(0)}%`}
                />

                <MetricCard
                  icon={<ShieldAlert size={20} />}
                  label="Escalation Accuracy"
                  value={`${(
                    data.escalation_accuracy * 100
                  ).toFixed(0)}%`}
                />

                <MetricCard
                  icon={<Clock3 size={20} />}
                  label="Average Latency"
                  value={`${Math.round(averageLatency)} ms`}
                />
              </section>

              <section className="mt-6 rounded-2xl border border-[#e8e3e1] bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Evaluation Score History
                    </h2>

                    <p className="mt-1 text-sm text-[#716a6e]">
                      Comparison of correctness, citation accuracy, and
                      escalation accuracy across evaluation versions.
                    </p>
                  </div>

                  <span className="inline-flex w-fit rounded-full bg-[#f3e3e7] px-3 py-1.5 text-xs font-medium text-[#925968]">
                    Latest: {data.version.toUpperCase()}
                  </span>
                </div>

                <div className="mt-8 h-[330px] w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={chartData}
                      margin={{
                        top: 10,
                        right: 20,
                        left: 0,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#eee9e7"
                      />

                      <XAxis
                        dataKey="version"
                        tick={{
                          fill: "#81797e",
                          fontSize: 12,
                        }}
                        axisLine={{
                          stroke: "#e8e3e1",
                        }}
                        tickLine={false}
                      />

                      <YAxis
                        domain={[0, 100]}
                        tick={{
                          fill: "#81797e",
                          fontSize: 12,
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) =>
                          `${value}%`
                        }
                      />

                      <Tooltip
                        formatter={(value) =>
                          `${Number(value).toFixed(0)}%`
                        }
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e8e3e1",
                          boxShadow:
                            "0 8px 25px rgba(37, 35, 38, 0.08)",
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="correctness"
                        name="Correctness"
                        stroke="#a46b78"
                        strokeWidth={3}
                        dot={{
                          r: 5,
                        }}
                        activeDot={{
                          r: 7,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="citation"
                        name="Citation Accuracy"
                        stroke="#7c6a70"
                        strokeWidth={2}
                        dot={{
                          r: 4,
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="escalation"
                        name="Escalation Accuracy"
                        stroke="#b89478"
                        strokeWidth={2}
                        dot={{
                          r: 4,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-[#e8e3e1] bg-white shadow-sm">
                <div className="border-b border-[#eee9e7] px-6 py-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Failed Evaluation Cases
                      </h2>

                      <p className="mt-1 text-sm text-[#716a6e]">
                        Cases where the latest evaluation did not meet the
                        expected result.
                      </p>
                    </div>

                    <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                      {failedCases.length} failed
                    </span>
                  </div>
                </div>

                {failedCases.length === 0 ? (
                  <div className="p-10 text-center">
                    <CheckCircle2
                      size={28}
                      className="mx-auto text-emerald-500"
                    />

                    <h3 className="mt-3 font-semibold">
                      No failed cases
                    </h3>

                    <p className="mt-1 text-sm text-[#716a6e]">
                      All evaluated cases passed.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px]">
                      <thead>
                        <tr className="border-b border-[#eee9e7] bg-[#faf8f8] text-left">
                          <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                            Case
                          </th>

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
                            Result
                          </th>

                          <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#81797e]">
                            Latency
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {failedCases.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[#eee9e7] last:border-b-0"
                          >
                            <td className="px-5 py-4 text-sm font-medium">
                              #{item.id}
                            </td>

                            <td className="max-w-[380px] px-5 py-4">
                              <p className="text-sm font-medium text-[#252326]">
                                {item.question}
                              </p>

                              <p className="mt-1 text-xs text-[#91898e]">
                                {item.type}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-full bg-[#f3e3e7] px-3 py-1 text-xs font-medium text-[#925968]">
                                {item.actual.intent}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm font-medium">
                              {(
                                item.actual.confidence || 0
                              ).toFixed(2)}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                {item.evaluation.correct ===
                                  false && (
                                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                                    Correctness
                                  </span>
                                )}

                                {!item.evaluation.citation_pass && (
                                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                    Citation
                                  </span>
                                )}

                                {!item.evaluation.escalation_pass && (
                                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                                    Escalation
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-[#514b4f]">
                              {item.evaluation.latency_ms} ms
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="mt-6 rounded-2xl border border-[#e8e3e1] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">
                  Evaluation Versions
                </h2>

                <p className="mt-1 text-sm text-[#716a6e]">
                  Stored evaluation results available to SupportOps.
                </p>

                <div className="mt-5 space-y-3">
                  {data.versions.map((version) => (
                    <div
                      key={version.version}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-[#eee9e7] bg-[#faf8f8] p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-semibold">
                          {version.version.toUpperCase()}
                        </p>

                        <p className="mt-1 text-xs text-[#81797e]">
                          Evaluation version
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-5 text-sm">
                        <div>
                          <span className="text-[#81797e]">
                            Correctness
                          </span>

                          <span className="ml-2 font-semibold">
                            {(
                              metricValue(version.correctness) *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>

                        <div>
                          <span className="text-[#81797e]">
                            Citation
                          </span>

                          <span className="ml-2 font-semibold">
                            {(
                              metricValue(
                                version.citation_accuracy
                              ) * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>

                        <div>
                          <span className="text-[#81797e]">
                            Escalation
                          </span>

                          <span className="ml-2 font-semibold">
                            {(
                              metricValue(
                                version.escalation_accuracy
                              ) * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>

                        <div>
                          <span className="text-[#81797e]">
                            Latency
                          </span>

                          <span className="ml-2 font-semibold">
                            {version.version === data.version
                              ? `${Math.round(
                                  averageLatency
                                )} ms`
                              : version.avg_latency_ms > 0
                              ? `${Math.round(
                                  version.avg_latency_ms
                                )} ms`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
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
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e3e7] text-[#a46b78]">
        {icon}
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
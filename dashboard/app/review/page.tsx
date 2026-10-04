"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Pencil,
  RefreshCw,
  AlertCircle,
  Clock3,
} from "lucide-react";

type ReviewItem = {
  id: number;
  thread_id: string;
  question: string;
  draft_answer: string | null;
  reason: string;
  status: string;
  created_at: string;
};

const API_BASE = "http://127.0.0.1:8000";

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/review`);

      if (!response.ok) {
        throw new Error("Failed to load review queue.");
      }

      const data = await response.json();
      setItems(data);
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

  async function submitReview(
    threadId: string,
    status: string,
    finalAnswer: string
  ) {
    try {
      const response = await fetch(
        `${API_BASE}/review/${threadId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            final_answer: finalAnswer,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to submit review.");
      }

      setItems((current) =>
        current.filter((item) => item.thread_id !== threadId)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit the review."
      );
    }
  }

  async function approveItem(item: ReviewItem) {
    await submitReview(
      item.thread_id,
      "approved",
      item.draft_answer || ""
    );
  }

  async function editItem(item: ReviewItem) {
    const editedAnswer = window.prompt(
      "Edit the final answer:",
      item.draft_answer || ""
    );

    if (editedAnswer === null) {
      return;
    }

    await submitReview(
      item.thread_id,
      "edited",
      editedAnswer
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#252326]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#e8e3e1] pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#a46b78]">
              SupportOps
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Review Queue
            </h1>

            <p className="mt-2 text-sm text-[#716a6e]">
              Review conversations that require human approval.
            </p>
          </div>

          <button
            onClick={loadReviews}
            className="flex items-center gap-2 rounded-xl border border-[#e8e3e1] bg-white px-4 py-2.5 text-sm font-medium text-[#514b4f] shadow-sm transition hover:bg-[#faf8f8]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="py-8">
          {loading && (
            <div className="rounded-2xl border border-[#e8e3e1] bg-white p-8 text-center text-[#716a6e]">
              Loading review queue...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="mt-0.5 text-red-500"
                />

                <div>
                  <h2 className="font-semibold text-[#252326]">
                    Could not load review queue
                  </h2>

                  <p className="mt-1 text-sm text-[#716a6e]">
                    {error}
                  </p>

                  <p className="mt-3 text-sm text-[#716a6e]">
                    Make sure the FastAPI backend is running on
                    port 8000.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-[#e8e3e1] bg-white p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f3e3e7] text-[#a46b78]">
                <Check size={22} />
              </div>

              <h2 className="mt-5 text-lg font-semibold">
                No pending reviews
              </h2>

              <p className="mt-2 text-sm text-[#716a6e]">
                Escalated conversations will appear here.
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-5">
              {items.map((item) => (
                <article
                  key={item.thread_id}
                  className="rounded-2xl border border-[#e8e3e1] bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#f3e3e7] px-3 py-1.5 text-xs font-medium text-[#925968]">
                          <Clock3 size={13} />
                          Pending review
                        </span>

                        <span className="text-xs text-[#91898e]">
                          Thread: {item.thread_id}
                        </span>
                      </div>

                      <span className="text-xs text-[#91898e]">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#a46b78]">
                        User question
                      </p>

                      <p className="mt-2 text-base leading-7 text-[#252326]">
                        {item.question}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#a46b78]">
                        Draft answer
                      </p>

                      <div className="mt-2 rounded-xl bg-[#faf8f8] p-4">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-[#514b4f]">
                          {item.draft_answer ||
                            "No draft answer was generated."}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#a46b78]">
                        Escalation reason
                      </p>

                      <p className="mt-2 text-sm leading-6 text-[#716a6e]">
                        {item.reason}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 border-t border-[#eee9e7] pt-5">
                      <button
                        onClick={() => approveItem(item)}
                        className="flex items-center gap-2 rounded-xl bg-[#a46b78] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#925968]"
                      >
                        <Check size={17} />
                        Approve
                      </button>

                      <button
                        onClick={() => editItem(item)}
                        className="flex items-center gap-2 rounded-xl border border-[#ddd6d8] bg-white px-5 py-2.5 text-sm font-medium text-[#514b4f] transition hover:bg-[#faf8f8]"
                      >
                        <Pencil size={17} />
                        Edit
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
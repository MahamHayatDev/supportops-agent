import Link from "next/link";
import {
  Activity,
  ClipboardCheck,
  BarChart3,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f7f5] text-[#252326]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e8e3e1] pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#a46b78]">
              SupportOps
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Agent Dashboard
            </h1>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-[#e8e3e1] bg-white px-4 py-2 text-sm text-[#686267] sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            System online
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-1 flex-col justify-center py-16">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-[#f3e3e7] px-4 py-2 text-sm font-medium text-[#925968]">
              AI support operations
            </span>

            <h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              Monitor, review, and evaluate your support agent.
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#686267]">
              SupportOps gives you a clear view of human reviews, agent runs,
              retrieval confidence, latency, and evaluation performance.
            </p>
          </div>

          {/* Navigation cards */}
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <DashboardCard
              href="/review"
              icon={<ClipboardCheck size={22} />}
              title="Review Queue"
              description="Review escalated conversations and approve or edit agent responses."
            />

            <DashboardCard
              href="/runs"
              icon={<Activity size={22} />}
              title="Agent Runs"
              description="Inspect recent runs, confidence, latency, and graph execution traces."
            />

            <DashboardCard
              href="/evals"
              icon={<BarChart3 size={22} />}
              title="Evaluations"
              description="Track evaluation scores and investigate failed test cases."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#e8e3e1] pt-6 text-sm text-[#81797e]">
          SupportOps Agent · LangGraph · Supabase · Groq
        </footer>
      </div>
    </main>
  );
}

function DashboardCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#e8e3e1] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f3e3e7] text-[#a46b78]">
          {icon}
        </div>

        <ArrowRight
          size={19}
          className="text-[#aaa2a6] transition group-hover:translate-x-1 group-hover:text-[#a46b78]"
        />
      </div>

      <h3 className="mt-6 text-lg font-semibold">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-[#716a6e]">{description}</p>
    </Link>
  );
}
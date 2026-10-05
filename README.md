# SupportOps Agent

An AI customer-support agent that answers from documentation with citations, sends uncertain questions to a human review queue instead of guessing, and is measured by an automated evaluation suite. Built with LangGraph, FastAPI, Supabase pgvector and Next.js.

**Live demo (free-tier hosting, may be offline):**
[Dashboard](https://supportops-agent.vercel.app) | [API docs](https://supportops-agent-production.up.railway.app/docs)

![Dashboard home](docs/screenshots/home.png)

## What it does

- Answers questions about the n8n documentation using retrieval-augmented generation, with source citations
- Grades its own retrieval confidence and routes low-confidence or off-topic questions to a human review queue
- Handles simple action requests through mock tools (create a ticket, check system status)
- Logs every run with intent, confidence, latency and a step-by-step trace
- Includes a 40-case evaluation harness that scores correctness, citation accuracy and escalation behaviour

## Architecture

```mermaid
flowchart TD
  Q[User question] --> C[classify]
  C -->|docs question| R[retrieve]
  C -->|action request| T[mock tool call]
  C -->|other| E[escalate]
  R --> G[grade confidence]
  G -->|high confidence| A[answer with citations]
  G -->|low confidence| E
  T --> A
  E --> H[human review queue]
  H -->|approve or edit| A2[resumed answer]
```

| Layer | Technology |
|---|---|
| Agent | LangGraph state graph with conditional routing and human-in-the-loop pause/resume |
| LLM | Groq (openai/gpt-oss-20b) through LangChain |
| Retrieval | sentence-transformers (all-MiniLM-L6-v2) embeddings in Supabase pgvector |
| API | FastAPI (endpoints: /chat, /review, /runs, /evals) |
| Dashboard | Next.js, Tailwind CSS, Recharts |
| Hosting | Railway (API), Vercel (dashboard) |
| CI | GitHub Actions: code check on every push, full evals on demand |

## Dashboard

**Agent runs** with confidence, latency and expandable graph traces:

![Agent runs](docs/screenshots/runs.png)

**Review queue** where escalated questions wait for a human to approve or edit:

![Review queue](docs/screenshots/review.png)

**Evaluations** with score history and failed cases:

![Evaluation versions](docs/screenshots/evals-versions.png)

![Failed evaluation cases](docs/screenshots/evals-failed.png)

## Evaluation

The golden set has 40 cases: 25 answerable documentation questions, 8 unanswerable questions, 4 prompt-injection attempts and 3 action requests. Each case is scored for correctness (LLM judge against a reference answer), citation accuracy (does a cited source match the expected page) and escalation accuracy (did the agent escalate when it should have).

| Version | Correctness | Citation accuracy | Escalation accuracy | Avg latency |
|---|---|---|---|---|
| v1 | 100% | 76% | 83% | not recorded |
| v2 | 75% | 80% | 70% | 10.4 s |

v1 and v2 are not directly comparable: v1 judged correctness on fewer cases, so the drop from 100% to 75% should not be read as a regression.

## Failures found

1. **Escalation score of 70%.** In the v2 run, all 12 unanswerable and injection cases were recorded as not escalated, and their traces stop at the classify step. The live agent does escalate these questions today (see the review queue screenshot), so this is probably a timing issue between the eval run and a later change to the review flow. I have not confirmed this by re-running the suite, because the free Groq daily token limit does not allow another full run yet.
2. **Retrieval and grading misses.** The Switch node and credentials questions (cases 14 and 19) received a confidence of 0.00 and no answer, and two more (cases 1 and 16) landed just under the escalation threshold. Next steps would be hybrid keyword and vector search plus a reranker.
3. **LLM judge noise.** Some answers with confidence 1.00 (cases 5 and 11) were marked incorrect. The judge has not been audited by hand.
4. **Free-tier rate limits.** A full evaluation run uses most of the daily Groq token quota, so CI only runs a code check on each push and the full evals are started manually from the Actions tab.

## Known limits

- No authentication on the API or dashboard
- Pending human reviews are held in a local SQLite checkpoint on the server's temporary disk, so a redeploy can lose them
- Action tools are mocks, not a real ticketing system
- Answers are limited to the ingested n8n documentation pages
- Hosted on free and trial tiers, so the live links can go offline

## Run locally

Requirements: Python 3.12, Node.js, a Groq API key and a Supabase project.

1. In Supabase, create the `doc_chunks` table (with a 384-dimension vector column), the `match_chunks` function, and the `review_queue` and `runs` tables.
2. Create `backend/.env`:
```
   GROQ_API_KEY=your_key
   SUPABASE_URL=your_url
   SUPABASE_KEY=your_key
```
3. Start the backend:
```
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   python ingest.py
   uvicorn main:api --port 8000
```
4. Start the dashboard:
```
   cd dashboard
   npm install
   npm run dev
```
   Set `NEXT_PUBLIC_API_URL` to point at a deployed backend; it defaults to http://127.0.0.1:8000.

## Repository layout

```
backend/     FastAPI service, LangGraph agent, ingestion, Dockerfile
dashboard/   Next.js review, runs and evals pages
evals/       golden dataset, eval runner, stored results
docs/        screenshots
.github/     CI workflow
```

## Built by

Maham Shaukat - [github.com/MahamHayatDev](https://github.com/MahamHayatDev)
import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter


# --------------------------------------------------
# 1. Load environment variables
# --------------------------------------------------

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is missing from .env")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY is missing from .env")


# --------------------------------------------------
# 2. Connect to Supabase
# --------------------------------------------------

db = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# --------------------------------------------------
# 3. Load local embedding model
# --------------------------------------------------

print("Loading embedding model...")

model = SentenceTransformer("all-MiniLM-L6-v2")

print("Embedding model loaded.")


# --------------------------------------------------
# 4. Create text splitter
# --------------------------------------------------

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100
)


# --------------------------------------------------
# 5. n8n documentation URLs
# --------------------------------------------------

URLS = [

    # -----------------------------
    # n8n basics
    # -----------------------------

    "https://docs.n8n.io/",
    "https://docs.n8n.io/try-it-out/",
    "https://docs.n8n.io/choose-n8n/",
    "https://docs.n8n.io/quickstart/",

    # -----------------------------
    # Workflows
    # -----------------------------

    "https://docs.n8n.io/workflows/",
    "https://docs.n8n.io/workflows/components/",
    "https://docs.n8n.io/workflows/components/nodes/",
    "https://docs.n8n.io/workflows/components/connections/",
    "https://docs.n8n.io/workflows/executions/",
    "https://docs.n8n.io/workflows/executions/debug/",

    # -----------------------------
    # Data and expressions
    # -----------------------------

    "https://docs.n8n.io/data/",
    "https://docs.n8n.io/data/data-mapping/",
    "https://docs.n8n.io/data/data-mapping/data-mapping-ui/",
    "https://docs.n8n.io/code/",
    "https://docs.n8n.io/code/builtin-methods/",
    "https://docs.n8n.io/code/builtin/jmespath/",

    # -----------------------------
    # HTTP / Webhooks
    # -----------------------------

    "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/",
    "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
    "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/",
    "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if/",
    "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.switch/",

    # -----------------------------
    # AI / LangChain
    # -----------------------------

    "https://docs.n8n.io/advanced-ai/",
    "https://docs.n8n.io/advanced-ai/intro-tutorial/",
    "https://docs.n8n.io/advanced-ai/langchain/",
    "https://docs.n8n.io/advanced-ai/langchain/overview/",
    "https://docs.n8n.io/advanced-ai/rag-in-n8n/",

    # -----------------------------
    # AI Agent
    # -----------------------------

    "https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/",
    "https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm/",
    "https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainretrievalqa/",

    # -----------------------------
    # Vector stores / RAG
    # -----------------------------

    "https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresupabase/",
    "https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.retrievervectorstore/",
    "https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.textsplitterrecursivecharactertextsplitter/",
    "https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.documentdefaultdataloader/",

    # -----------------------------
    # Models / memory
    # -----------------------------

    "https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatgroq/",
    "https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.memorybufferwindow/",

    # -----------------------------
    # Credentials
    # -----------------------------

    "https://docs.n8n.io/credentials/",
    "https://docs.n8n.io/credentials/builtin/",
    "https://docs.n8n.io/integrations/builtin/credentials/supabase/",
    "https://docs.n8n.io/integrations/builtin/credentials/groq/",

    # -----------------------------
    # API / integrations
    # -----------------------------

    "https://docs.n8n.io/api/",
    "https://docs.n8n.io/integrations/",
]


# --------------------------------------------------
# 6. Crawl documentation
# --------------------------------------------------

print()
print("=" * 60)
print("SUPPORTOPS DOCUMENTATION INGESTION")
print("=" * 60)
print(f"Total URLs: {len(URLS)}")
print()


total_chunks = 0


for index, url in enumerate(URLS, start=1):

    print()
    print(f"[{index}/{len(URLS)}] Processing:")
    print(url)

    try:

        # ------------------------------------------
        # Download page
        # ------------------------------------------

        response = requests.get(
            url,
            timeout=20,
            headers={
                "User-Agent": "SupportOps-Agent/1.0"
            }
        )

        response.raise_for_status()


        # ------------------------------------------
        # Parse HTML
        # ------------------------------------------

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )


        # ------------------------------------------
        # Remove unnecessary HTML
        # ------------------------------------------

        for tag in soup([
            "nav",
            "footer",
            "script",
            "style",
            "noscript"
        ]):
            tag.decompose()


        # ------------------------------------------
        # Get title
        # ------------------------------------------

        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        else:
            title = url


        # ------------------------------------------
        # Extract text
        # ------------------------------------------

        text = soup.get_text(
            " ",
            strip=True
        )


        # ------------------------------------------
        # Skip empty pages
        # ------------------------------------------

        if not text:
            print("WARNING: No text found.")
            continue


        # ------------------------------------------
        # Split into chunks
        # ------------------------------------------

        chunks = splitter.split_text(text)

        print(f"Title: {title}")
        print(f"Chunks: {len(chunks)}")


        # ------------------------------------------
        # Create embeddings and insert
        # ------------------------------------------

        page_chunks = 0

        for chunk in chunks:

            embedding = model.encode(
                chunk
            ).tolist()

            db.table("doc_chunks").insert({
                "source_url": url,
                "title": title,
                "content": chunk,
                "embedding": embedding
            }).execute()

            page_chunks += 1
            total_chunks += 1


        print(f"Inserted: {page_chunks} chunks")
        print("DONE")


    except Exception as error:

        print("ERROR processing this URL:")
        print(url)
        print(error)


# --------------------------------------------------
# 7. Final summary
# --------------------------------------------------

print()
print("=" * 60)
print("INGESTION COMPLETE")
print("=" * 60)
print(f"Total chunks inserted: {total_chunks}")
print()
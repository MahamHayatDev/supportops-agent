import os
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer
from langchain_groq import ChatGroq

load_dotenv()
db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("all-MiniLM-L6-v2")
llm = ChatGroq(model="openai/gpt-oss-20b", temperature=0)

def retrieve(question, k=5):
    emb = model.encode(question).tolist()
    res = db.rpc("match_chunks", {"query_embedding": emb, "match_count": k}).execute()
    return res.data

def answer(question):
    chunks = retrieve(question)
    context = "\n\n".join(
        f"[{i+1}] ({c['source_url']})\n{c['content']}" for i, c in enumerate(chunks)
    )
    prompt = f"""Answer ONLY using the context below. Cite sources like [1], [2].
If the context does not contain the answer, say "I don't know."

Context:
{context}

Question: {question}"""
    return llm.invoke(prompt).content, chunks
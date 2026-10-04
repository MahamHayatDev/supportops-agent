from rag import retrieve, answer

questions = [
    "What is an n8n workflow?",
    "What does the HTTP Request node do?",
    "What does the Webhook node do?",
    "What is an AI Agent in n8n?",
    "What is RAG in n8n?"
]

for i, question in enumerate(questions, 1):
    print("\n" + "=" * 70)
    print(f"QUESTION {i}: {question}")
    print("=" * 70)

    chunks = retrieve(question)

    print("\nRETRIEVED SOURCES:")
    for j, chunk in enumerate(chunks, 1):
        print(f"\n[{j}] {chunk['source_url']}")
        print(chunk["content"][:500])

    response, _ = answer(question)

    print("\nANSWER:")
    print(response)
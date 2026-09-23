FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (build-essential for tree-sitter/sentence-transformers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the default local embedding model to avoid runtime lag
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the rest of the application code
COPY . .

EXPOSE 8100

CMD ["uvicorn", "mcp_server:app", "--host", "0.0.0.0", "--port", "8100"]

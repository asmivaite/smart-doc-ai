# Smart-Doc AI 📄⚡

An enterprise-grade, full-stack Retrieval-Augmented Generation (RAG) document analysis workspace. Built with **Vue 3**, **Express/Node.js**, and the **Google Gemini API**, this application enables users to upload PDF documents, automatically index and vectorize their contents, and engage in real-time, context-grounded streaming AI chat with clickable chunk citations.

---

## 🏗 Architecture Overview

```text
[ Vue 3 Frontend ] ──( Multipart PDF Upload )──► [ Express / Node.js Backend ]
        │                                                     │
        │                                             ( pdf2json Parsing )
        │                                                     │
        │                                         ( gemini-embedding-001 )
        │                                                     │
        │                                           [ Cosine Vector Search ]
        │                                                     │
        ◄─────────( SSE Real-Time Stream )─────────── [ gemini-3.8-flash ]
```

### RAG Pipeline Flow
1. **Document Ingestion:** PDFs are parsed into clean raw text chunks using `pdf2json` directly in memory using Node buffers.
2. **Text Sanitization:** Encoded URI components and non-printable control characters are stripped to guarantee stable streaming execution.
3. **Vector Embeddings:** Document chunks are converted into dense vector embeddings via Google's `gemini-embedding-001`.
4. **Context Retrieval:** User queries are vectorized on demand and matched against indexed chunks via Cosine Similarity scoring.
5. **Real-time SSE Streaming:** The top contextual chunks are fed to `gemini-3.8-flash` using Server-Sent Events (SSE) for word-by-word streaming answers with citation tracking.

---

## Key Features

* **Instant PDF Extraction**: In-memory parsing powered by `pdf2json` with automated text sanitization.
* **Vector Embeddings via Gemini**: Vector indexing using Google's `gemini-embedding-001` model.
* **Cosine Similarity Retrieval**: In-memory vector similarity calculations to extract high-relevance chunks.
* **Real-Time Streaming Responses (SSE)**: Fast streaming completions using `gemini-3.8-flash`.
* **Source Citations**: Grounded answers referencing specific document chunks to prevent AI hallucinations.
* **Resilient Streaming Fallback**: Graceful fallback wrappers ensuring high availability even if stream parsing encounters formatting edge cases.

---

## 🛠 Tech Stack

* **Frontend:** Vue 3 (Composition API), Vite, Tailwind CSS
* **Backend:** Node.js, Express.js (ES Modules)
* **AI & Embeddings:** `@google/generative-ai`
  * **Vector Model:** `gemini-embedding-001`
  * **Chat Model:** `gemini-3.8-flash`
* **File Processing:** `pdf2json`, `multer` (memory storage)

---

## 📁 Project Structure

```text
smart-doc-ai/
├── backend/                  # Node.js + Express API server
│   ├── .env                  # Environment keys (GEMINI_API_KEY, PORT)
│   ├── server.js             # Vectorization, RAG logic, and SSE streaming
│   └── package.json          # Backend dependencies
│
├── frontend/                 # Vue 3 + Vite user interface
│   ├── src/
│   │   ├── App.vue           # Main application interface
│   │   └── style.css         # UI styles
│   ├── vite.config.js        # Vite configuration
│   └── package.json          # Frontend dependencies
│
└── .gitignore                # Rules for excluding node_modules and secret env files
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: v18.0.0 or higher
* **Google Gemini API Key**: API key from [Google AI Studio](https://aistudio.google.com/)

### Installation & Local Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/asmivaite/smart-doc-ai.git
cd smart-doc-ai
```

#### 2. Configure Backend
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=5001
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the backend server:
```bash
node server.js
```
*Server runs on `http://localhost:5001`.*

#### 3. Configure Frontend
Open a new terminal tab and run:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## ⚡ API Endpoints

### `POST /api/upload`
Uploads a PDF, parses text, generates embeddings, and indexes chunks in memory.
* **Payload:** `multipart/form-data` (`file`)
* **Response:**
  ```json
  {
    "message": "PDF processed successfully!",
    "totalChunks": 38
  }
  ```

### `POST /api/chat`
Calculates vector similarity between the user prompt and indexed chunks, returning contextually grounded answers via SSE.
* **Payload:**
  ```json
  {
    "query": "What are the main topics discussed in this document?"
  }
  ```
* **Response Stream:** `text/event-stream` sending citation payloads followed by text tokens.

---

## 📜 License

Distributed under the MIT License.
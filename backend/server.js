import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import PDFParser from 'pdf2json';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const upload = multer({ storage: multer.memoryStorage() });

let documentStore = [];

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(errData.parserError);
    });

    pdfParser.on('pdfParser_dataReady', () => {
      let rawText = pdfParser.getRawTextContent();
      // Clean up encoded URI components and raw formatting artifacts
      try {
        rawText = decodeURIComponent(rawText);
      } catch (e) {
        // Fallback if already decoded
      }
      // Strip control/invisible characters that break streaming
      rawText = rawText.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
      resolve(rawText);
    });

    pdfParser.parseBuffer(buffer);
  });
}

// 1. Upload & Vectorize Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log(`Processing file: ${req.file.originalname}`);

    const text = await extractPdfText(req.file.buffer);
    const rawChunks = text.match(/(?:[^\s]+\s+){1,300}/g) || [text];
    
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

    documentStore = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i].trim();
      if (!chunkText) continue;

      const result = await embeddingModel.embedContent(chunkText);
      const embedding = result.embedding.values;

      documentStore.push({
        id: i + 1,
        text: chunkText,
        embedding: embedding,
      });
    }

    console.log(`Successfully chunked into ${documentStore.length} vectors using Gemini.`);
    return res.json({ 
      message: 'PDF processed successfully!', 
      totalChunks: documentStore.length 
    });
  } catch (error) {
    console.error('Upload Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process PDF' });
  }
});

// 2. SSE Streaming Endpoint with Error Safeguards
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });
  if (documentStore.length === 0) {
    return res.status(400).json({ error: 'Please upload a PDF first.' });
  }

  try {
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const queryEmbedResult = await embeddingModel.embedContent(query);
    const queryEmbedding = queryEmbedResult.embedding.values;

    const scoredChunks = documentStore.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, 2);

    // Sanitize context snippet text sent to prompt
    const contextText = topChunks.map(c => `[Chunk ${c.id}]: ${c.text.replace(/\n+/g, ' ')}`).join('\n\n');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ type: 'citations', sources: topChunks.map(c => ({ id: c.id, snippet: c.text.slice(0, 100) + '...' })) })}\n\n`);

    const chatModel = genAI.getGenerativeModel({ 
      model: 'gemini-3.8-flash',
      systemInstruction: 'You are an enterprise AI document assistant. Answer questions strictly using the provided context. Always cite the chunk ID you used.' 
    });

    const prompt = `Context:\n${contextText}\n\nQuestion: ${query}`;

    try {
      const resultStream = await chatModel.generateContentStream(prompt);

      for await (const chunk of resultStream.stream) {
        const token = chunk.text();
        if (token) {
          res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
        }
      }
    } catch (streamError) {
      console.error('Streaming Parse Error (Fallback trigger):', streamError.message);
      // Fallback: If streaming chunk parsing fails on Gemini's end, fallback to single response
      const directResult = await chatModel.generateContent(prompt);
      const text = directResult.response.text();
      res.write(`data: ${JSON.stringify({ type: 'token', token: text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat Endpoint Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
<template>
  <div class="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100">
    <!-- Sidebar: Upload & Status -->
    <aside class="w-80 border-r border-slate-800 bg-slate-950 p-6 flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-3 mb-8">
          <div class="p-2 bg-indigo-600 rounded-lg">
            <FileText class="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-lg leading-tight">Smart-Doc AI</h1>
            <p class="text-xs text-slate-400">Enterprise RAG Viewer</p>
          </div>
        </div>

        <!-- Drag and Drop Upload Area -->
        <div 
          @dragover.prevent 
          @drop.prevent="handleDrop"
          class="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-900/50"
          :class="{ 'border-indigo-500 bg-indigo-950/20': isUploading }"
        >
          <input type="file" ref="fileInput" @change="handleFileSelect" accept=".pdf" class="hidden" />
          <UploadCloud class="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <p class="text-sm font-medium text-slate-200">
            {{ fileName || 'Drop your PDF here' }}
          </p>
          <p class="text-xs text-slate-500 mt-1">Supports PDF up to 10MB</p>
          
          <button 
            @click="$refs.fileInput.click()" 
            class="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg w-full transition-colors"
          >
            Select File
          </button>
        </div>

        <!-- Upload Status Badge -->
        <div v-if="statusMessage" class="mt-4 p-3 rounded-lg text-xs" :class="isError ? 'bg-red-950/50 text-red-400 border border-red-800' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-800'">
          {{ statusMessage }}
        </div>
      </div>

      <div class="text-xs text-slate-500 border-t border-slate-800 pt-4">
        <p>Stack: Vue 3 + Express + RAG</p>
        <p>Status: {{ isConnected ? 'Connected to API' : 'Disconnected' }}</p>
      </div>
    </aside>

    <!-- Main Chat Panel -->
    <main class="flex-1 flex flex-col h-full bg-slate-900">
      <!-- Header -->
      <header class="h-16 border-b border-slate-800 px-8 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-300">Document Chat Workspace</h2>
        <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
          GPT-4o Mini
        </span>
      </header>

      <!-- Messages Stream -->
      <div class="flex-1 overflow-y-auto p-8 space-y-6" ref="chatContainer">
        <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-slate-500">
          <Bot class="w-12 h-12 mb-3 text-slate-600" />
          <p class="text-sm">Upload a PDF and ask a question to begin.</p>
        </div>

        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          class="flex gap-4 max-w-3xl"
          :class="msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''"
        >
          <div 
            class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            :class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-400 border border-slate-700'"
          >
            {{ msg.role === 'user' ? 'YOU' : 'AI' }}
          </div>

          <div class="space-y-3 max-w-2xl">
            <div 
              class="p-4 rounded-2xl text-sm leading-relaxed"
              :class="msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-none'"
            >
              {{ msg.content }}
            </div>

            <!-- Citations Badges -->
            <div v-if="msg.citations && msg.citations.length" class="flex flex-wrap gap-2 pt-1">
              <span class="text-xs text-slate-400 self-center">Sources used:</span>
              <div 
                v-for="cite in msg.citations" 
                :key="cite.id"
                @click="activeCitation = cite"
                class="text-xs px-2 py-1 bg-slate-800 hover:bg-indigo-950 hover:border-indigo-600 text-indigo-300 border border-slate-700 rounded cursor-pointer transition-colors"
              >
                Chunk #{{ cite.id }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Citation Inspection Modal/Toast -->
      <div v-if="activeCitation" class="mx-8 mb-4 p-4 bg-slate-800 border border-indigo-500/50 rounded-xl relative">
        <button @click="activeCitation = null" class="absolute top-2 right-2 text-slate-400 hover:text-white text-xs">✕</button>
        <p class="text-xs font-semibold text-indigo-400 mb-1">Inspecting Source Citation [Chunk #{{ activeCitation.id }}]:</p>
        <p class="text-xs text-slate-300 italic">"{{ activeCitation.snippet }}"</p>
      </div>

      <!-- Prompt Input Bar -->
      <footer class="p-6 border-t border-slate-800 bg-slate-950/50">
        <form @submit.prevent="sendMessage" class="flex gap-3 max-w-4xl mx-auto">
          <input 
            v-model="userQuery" 
            type="text" 
            placeholder="Ask something about your document..." 
            class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            :disabled="isStreaming"
          />
          <button 
            type="submit" 
            :disabled="isStreaming || !userQuery.trim()"
            class="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <span>Send</span>
            <Send class="w-4 h-4" />
          </button>
        </form>
      </footer>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { FileText, UploadCloud, Bot, Send } from '@lucide/vue';

const API_URL = 'http://localhost:5001'; // Adjust if your backend runs on a different port

const fileInput = ref(null);
const fileName = ref('');
const isUploading = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const isConnected = ref(true);

const userQuery = ref('');
const messages = ref([]);
const isStreaming = ref(false);
const activeCitation = ref(null);
const chatContainer = ref(null);

const handleFileSelect = (e) => {
  const file = e.target.files[0];
  if (file) uploadFile(file);
};

const handleDrop = (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') uploadFile(file);
};

const uploadFile = async (file) => {
  fileName.value = file.name;
  isUploading.value = true;
  statusMessage.value = 'Processing and vectorizing PDF...';
  isError.value = false;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    statusMessage.value = `Success! Chunked into ${data.totalChunks} vectors.`;
  } catch (err) {
    isError.value = true;
    statusMessage.value = err.message;
  } finally {
    isUploading.value = false;
  }
};

const sendMessage = async () => {
  if (!userQuery.value.trim() || isStreaming.value) return;

  const query = userQuery.value;
  userQuery.value = '';

  // Add user message
  messages.value.push({ role: 'user', content: query });
  
  // Placeholder for streaming AI response
  const aiMsgIndex = messages.value.push({ role: 'assistant', content: '', citations: [] }) - 1;
  isStreaming.value = true;

  await scrollToBottom();

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to start chat');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep last partial line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.replace('data: ', ''));

          if (data.type === 'citations') {
            messages.value[aiMsgIndex].citations = data.sources;
          } else if (data.type === 'token') {
            messages.value[aiMsgIndex].content += data.token;
            scrollToBottom();
          }
        }
      }
    }
  } catch (err) {
    messages.value[aiMsgIndex].content = `Error: ${err.message}`;
  } finally {
    isStreaming.value = false;
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};
</script>
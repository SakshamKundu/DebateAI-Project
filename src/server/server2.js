// server 2

import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import dotenv from "dotenv";
import path from "path";
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from "fs";
import multer from 'multer';

// --- MONGO DB INTEGRATION ---
import mongoose from 'mongoose';

// --- RAG INTEGRATION START ---
// LangChain Document Loading & Splitting
// REMOVED: DirectoryLoader is no longer needed for in-memory processing.
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// LangChain Embeddings & Vector Store (all local)
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

// RAG Configuration
// REMOVED: Local filesystem paths are no longer used.
// const BASE_DOCUMENTS_FOLDER = "src/server/reference_papers";
// const BASE_VECTOR_STORE_PATH = "src/server/faiss_index";
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

// MODIFIED: In-memory cache for uploaded files per session.
// This map will store files temporarily between the HTTP upload and the WebSocket connection.
// Key: clientId, Value: array of file objects from multer { originalname, buffer, mimetype }
const uploadedFileCache = new Map();


/**
 * MODIFIED: Creates an in-memory FAISS vector store for a specific session from cached files.
 * This function no longer reads from or writes to the local filesystem, making it deployment-ready.
 * @param {string} clientId The unique ID for the current debate session.
 * @returns {Promise<FaissStore|null>} The initialized vector store for the session, or null if no documents.
 */
async function getVectorStore(clientId) {
  console.log(`[RAG for ${clientId}] Initializing session-specific document store from memory...`);
  
  // REMOVED: Logic for loading a pre-existing vector store from disk is removed.
  // The store will be built from scratch in memory for every session.

  const files = uploadedFileCache.get(clientId);

  if (!files || files.length === 0) {
    console.warn(`[RAG for ${clientId}] ⚠️ No documents found in cache. The agents will not have any external context for this session.`);
    return null;
  }

  console.log(`[RAG for ${clientId}] - Loading ${files.length} document(s) from memory cache...`);
  const embeddings = new HuggingFaceTransformersEmbeddings({ modelName: EMBEDDING_MODEL });
  const docs = [];

  for (const file of files) {
    try {
        // Create a Blob from the buffer to be used by LangChain loaders
        const blob = new Blob([file.buffer], { type: file.mimetype });
        const loader = file.mimetype === 'application/pdf' 
            ? new PDFLoader(blob, { splitPages: true }) 
            : new TextLoader(blob);
        
        const loadedDocs = [];
      for await (const doc of loader.lazy_load()) {
        doc.metadata.source = file.originalname; // Add filename to metadata
        loadedDocs.push(doc);
      }
        docs.push(...loadedDocs);
    } catch (error) {
        console.error(`[RAG for ${clientId}] Error loading file ${file.originalname} from buffer:`, error);
    }
  }

  if (docs.length === 0) {
     console.warn(`[RAG for ${clientId}] ⚠️ Could not load any documents. The agents will not have any external context.`);
     return null;
  }

  console.log(`[RAG for ${clientId}] - Splitting documents into chunks...`);
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 100 });
  const chunks = await splitter.splitDocuments(docs);
  console.log(`[RAG for ${clientId}] - Created ${chunks.length} document chunks.`);

  console.log(`[RAG for ${clientId}] - Generating embeddings and creating in-memory FAISS vector store...`);
  const store = await FaissStore.fromDocuments(chunks, embeddings);
  
  // REMOVED: Saving the vector store to disk is no longer needed.
  console.log(`[RAG for ${clientId}] ✅ In-memory vector store created successfully.`);

  return store;
}
// --- RAG INTEGRATION END ---


dotenv.config();

// --- MONGO DB INTEGRATION ---
// Define the Schema and Model for storing debate records
const debateSchema = new mongoose.Schema({
    clientId: { type: String, required: true, unique: true, index: true },
    debateTopic: { type: String, required: true },
    userRole: { type: String, required: true },
    chatHistory: [{
        speaker: String,
        content: String,
        timestamp: Date
    }],
    adjudicationResult: { type: mongoose.Schema.Types.Mixed }, // Store the JSON object
    uploadedFiles: [{
        filename: String,
        data: Buffer, // Store file content as a Buffer
        mimetype: String
    }],
    createdAt: { type: Date, default: Date.now }
});

const Debate = mongoose.model('Debate', debateSchema);


const __filename = fileURLToPath(import.meta.url);

const MASTER_PROMPT_INSTRUCTIONS = `
CRITICAL INSTRUCTIONS:
- Your entire response MUST be only the words you would speak at the podium.
- DO NOT use stage directions like (clears throat) or [pauses].
- DO NOT repeat phrases used by other speakers, such as "I've taken the liberty...". Be original.
- Keep your response concise, powerful, and under 180 words.
- Always be aware of your specific role and the speaker who spoke immediately before you.
`;

// Enhanced sentence/paragraph detection class
class SpeechAnalyzer {
  constructor() {
    this.sentenceEnders = /[.!?]+$/;
    this.strongEnders = /[.!?]{2,}$/;

    this.paragraphIndicators = [
      /\b(first|second|third|fourth|fifth|next|then|finally|lastly|furthermore|moreover|however|additionally|also|besides|in conclusion|to summarize)\b/i,
      /\b(let me tell you|here's the thing|another point|moving on|speaking of|by the way|on the other hand)\b/i,
      /\b(point number|step \d+|item \d+|number \d+)\b/i
    ];

    this.openQuestions = [
      /\b(what|how|when|where|why|who|which|can you|could you|would you|will you|do you|did you|have you|are you|is it|was it)\b/i,
      /\b(tell me about|explain|describe|show me|help me|give me|provide|show us|help us|give us|tell us about)\b/i
    ];

    this.incompletePatterns = [
      /\b(and|but|or|so|because|since|although|though|while|when|if|unless|until|before|after|as|like|such as|for example|including|especially|particularly)\s*$/i,
      /\b(the|a|an|this|that|these|those|my|your|his|her|our|their|some|any|all|every|each|no|none)\s*$/i,
      /\b(i|you|he|she|we|they|it)\s*(am|is|are|was|were|will|would|could|should|might|must|can|have|has|had|do|does|did)\s*$/i,
      /\b(very|quite|really|extremely|completely|totally|absolutely|definitely|probably|maybe|perhaps|certainly)\s*$/i,
      /,\s*$/,
      /:\s*$/
    ];

    this.continuationMarkers = [
      /\b(um|uh|well|so|you know|i mean|like|actually|basically|essentially|obviously|clearly|apparently|fortunately|unfortunately)\s*$/i,
      /\b(let me|i want to|i need to|i have to|i'm going to|i'm trying to|i would like to)\b/i
    ];
  }

  isCompleteSentence(text) {
    if (!text || text.trim().length < 3) return false;

    const trimmed = text.trim();

    for (const pattern of this.incompletePatterns) {
      if (pattern.test(trimmed)) return false;
    }

    for (const marker of this.continuationMarkers) {
      if (marker.test(trimmed)) return false;
    }

    if (this.sentenceEnders.test(trimmed)) return true;

    const words = trimmed.split(/\s+/);
    if (words.length >= 3) {
      const firstWord = words[0].toLowerCase();
      if (['what', 'how', 'when', 'where', 'why', 'who', 'which'].includes(firstWord)) {
        return !this.hasOpenQuestion(trimmed);
      }
    }

    return false;
  }

  hasOpenQuestion(text) {
    return this.openQuestions.some(pattern => pattern.test(text));
  }

  isParagraphBreak(text) {
    return this.paragraphIndicators.some(pattern => pattern.test(text));
  }

  shouldProcessText(text, silenceDuration = 0) {
    if (!text || text.trim().length < 3) return false;

    const trimmed = text.trim();

    if (this.strongEnders.test(trimmed)) return true;
    if (this.isCompleteSentence(trimmed) && silenceDuration > 1000) return true;
    if (this.isParagraphBreak(trimmed)) return true;
    if (silenceDuration > 3000 && trimmed.length > 20) return true;
    if (silenceDuration > 5000 && trimmed.length > 10) return true;

    return false;
  }
}

// AI Provider with automatic fallback
class AIProvider {
  constructor() {
    this.providers = [
      { name: "groq", handler: this.callGroq.bind(this), available: true },
    ];
  }

  async callGroq(prompt, systemPrompt, isJsonMode = false) {
    try {
      const body = {
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048, // Increase max_tokens for potentially large JSON
        stream: false
      };

      if (isJsonMode) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body) // Pass the dynamically built body
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.log(`Groq error: ${error.message}`);
      throw error;
    }
  }

  async generate(prompt, systemPrompt, isJsonMode = false) {
    try {
      const response = await this.providers[0].handler(prompt, systemPrompt, isJsonMode);
      console.log(`Success with Groq`);
      return response;
    } catch (error) {
      console.log(`Groq failed: ${error.message}`);
      return "I'm sorry, I'm having technical difficulties right now. Please try again in a moment.";
    }
  }
}

// Global conversation context - shared across all assistants
class ConversationContext {
  constructor() {
    this.messages = [];
    this.maxLength = 50;
  }

  addMessage(speaker, content, timestamp = new Date().toISOString()) {
    this.messages.push({
      speaker,
      content,
      timestamp
    });

    if (this.messages.length > this.maxLength) {
      this.messages = this.messages.slice(-this.maxLength);
    }
  }

  getHistory() {
    return this.messages.map(msg => `${msg.speaker}: ${msg.content}`).join('\n');
  }

  clear() {
    this.messages = [];
  }
}

class SerpApiSearch {
  constructor() {
    this.apiKey = process.env.SERPAPI_API_KEY;
  }

  async search(query) {
    if (!this.apiKey) {
      console.warn("SerpApi API key is missing. Skipping web search.");
      return {};
    }
    try {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${this.apiKey}&engine=google`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SerpApi error: ${response.status} ${await response.text()}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error during SerpApi search:", error);
      return {};
    }
  }
}

// Unified Agent Class
class VoiceAgent {
  // --- RAG INTEGRATION START ---
  // Modified constructor to accept the vector store
  constructor(name, role, prompt, voiceModel, conversationContext, vectorStore, serpApiSearch = null) {
  // --- RAG INTEGRATION END ---
    this.name = name;
    this.role = role;
    this.prompt = prompt;
    this.voiceModel = voiceModel;
    this.conversationContext = conversationContext;
    this.connectionManager = null;
    this.aiProvider = new AIProvider();
    this.deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
    this.serpApiSearch = serpApiSearch;
    this.interruptedStatement = null;
    // --- RAG INTEGRATION START ---
    this.vectorStore = vectorStore; // Store the vector store instance
    // --- RAG INTEGRATION END ---
  }

  // This MUST be a static property to be shared across all instances
  static audioCache = new Map();

  async getSanitizedLLMResponse(prompt, systemPrompt, isJsonMode = false) {
    for (let i = 0; i < 3; i++) { // Try up to 3 times
      console.log(`LLM attempt ${i + 1} for agent ${this.name}...`);
      const rawResponse = await this.aiProvider.generate(prompt, systemPrompt, isJsonMode);

      if (!rawResponse) continue;

      const sanitized = rawResponse.replace(/[^a-zA-Z0-9\s.,?!'"-]/g, ' ');
      const cleanResponse = sanitized.trim().replace(/\s+/g, ' ');

      const refusalPatterns = [
        /^I cannot/i,
        /^I'm sorry/i,
        /^As an AI/i,
        /^I am unable/i,
        /^My apologies/i,
      ];
      const isRefusal = refusalPatterns.some(pattern => pattern.test(cleanResponse));

      if (cleanResponse.length > 15 && !isRefusal) {
        console.log(`LLM attempt ${i + 1} successful.`);
        return cleanResponse;
      }

      console.warn(`LLM attempt ${i + 1} failed (too short or refusal). Cleaned response: "${cleanResponse}"`);
    }

    console.error(`All 3 LLM attempts failed for agent ${this.name}. Returning fallback.`);
    return "I must yield the floor. My apologies.";
  }

  // --- RAG INTEGRATION START ---
  // The generateResponse method is completely replaced with the RAG-aware version.
  async generateResponse(userInput, isUserInterruption = false, debatePrompt = null, userLevel = 'beginner') {
    const mainInput = debatePrompt && !userInput ? debatePrompt : userInput;
    const conversationHistory = this.conversationContext.getHistory();
    let systemPrompt = `${this.prompt}\n${MASTER_PROMPT_INSTRUCTIONS}`;

    try {
      let retrievedContext = "No specific documents were found to be relevant for this point.";
      let finalResponse;

      // Step 1: Retrieve relevant documents from the vector store if it exists
      if (this.vectorStore && mainInput) {
        console.log(`[RAG] Agent ${this.name} is retrieving documents based on: "${mainInput.substring(0, 100)}..."`);
        const retriever = this.vectorStore.asRetriever(6); // Get top 6 relevant chunks
        const relevantDocs = await retriever.getRelevantDocuments(mainInput);

        if (relevantDocs.length > 0) {
          retrievedContext = relevantDocs.map((doc, i) => `Source ${i+1} (${doc.metadata.source || 'Unknown'}): ${doc.pageContent}`).join("\n\n");
          console.log(`[RAG] Found ${relevantDocs.length} relevant document chunks.`);
        } else {
          console.log(`[RAG] No relevant documents found for the input.`);
        }
      } else if (!this.vectorStore) {
        console.log("[RAG] Vector store not available. Skipping document retrieval.");
      }

      // Step 2: Construct the task prompt, now including the retrieved context
      let taskPrompt = "";
      if (!mainInput) {
        // This is the first speaker, no context needed
        taskPrompt = `You are the first speaker. Please open the debate with your initial statement.`;
      } else {
        // All subsequent speakers get the RAG context
        taskPrompt = `
        **Previous Conversation:**
        ${conversationHistory}

        **The previous speaker said:** "${mainInput}"

        **Retrieved Context from Reference Documents:**
        ---
        ${retrievedContext}
        ---

        **YOUR CRITICAL TASK:**
        You are ${this.name}, the ${this.role}.
        1. **Analyze the retrieved context:** Identify facts, statistics, or arguments from the documents that support your position or refute the opponent.
        2. **Synthesize, Don't Copy:** You MUST integrate the information from the context naturally into your own speech. DO NOT simply copy and paste sentences from the context.
        3. **Formulate Your Response:** Based on your role, the conversation history, and ESPECIALLY the retrieved context, formulate your next statement in the debate.
        4. **Cite Your Source (If Applicable):** If you use a specific fact, you can mention it comes from the provided materials, e.g., "According to the provided policy brief..." or "The statistics in our documents show...".
        5. **Stay in Character:** Deliver this evidence-based response in your assigned role.

        Formulate your concise and powerful response now.
        `;
      }
      
      // Step 3: Generate the response using the augmented prompt
      finalResponse = await this.getSanitizedLLMResponse(taskPrompt, systemPrompt);

      this.interruptedStatement = finalResponse;
      return finalResponse;

    } catch (error) {
      console.error(`Error generating RAG-based response for ${this.name}:`, error);
      return "I'm sorry, I seem to have lost my train of thought.";
    }
  }
  // --- RAG INTEGRATION END ---


  async generatePoiResponse(poiTranscript) {
    if (!this.interruptedStatement) {
      // Fallback if something went wrong
      return `I'm sorry, I lost my train of thought. You said: "${poiTranscript}". Let me try to respond.`;
    }

    console.log(`Generating POI response for ${this.name}`);
    const conversationHistory = this.conversationContext.getHistory();

    const systemPrompt = `You are ${this.name}, the ${this.role}. You are an expert parliamentary debater, skilled at handling interruptions gracefully and firmly. this is the conversation until now: ${conversationHistory}`;

    const prompt = `You were in the middle of making a key point when you were interrupted by a user's Point of Information (POI).
    
    **Your Original Statement (which you MUST complete, though not necessary to start saying the whole sentence from begining, instead try to guess based on user's POI, where he might have interrupted you, respond to that and continue smoothly from there (do not repeat what was said by you before this point)):**
    "${this.interruptedStatement}"
    
    **The User's Interrupting POI:**
    "${poiTranscript}"
    
    **Your Critical Task:**
    You must formulate a single, continuous response that accomplishes the following two things in order:
    1.  **Acknowledge and Answer the POI:** Directly address the user's point. Be concise and firm. Examples: "Regarding your point...", "That's a misconception, the reality is...", "I'll be brief on that point:" etc.
    2.  **Return to Your Original Argument:** After answering the POI, you MUST seamlessly transition back to and complete your original (from where you left, based on POI based guess, as mentioned before), interrupted statement. Use a strong transition. Examples: "...but as I was saying,", "...now, to return to my main argument, etc".
    
    Your entire response should flow as one coherent turn.`;

    const combinedResponse = await this.getSanitizedLLMResponse(prompt, systemPrompt);

    // Add the interaction to the context
    this.conversationContext.addMessage("User (POI)", poiTranscript);
    this.conversationContext.addMessage(this.name, combinedResponse);

    // Clear the interrupted statement after use
    this.interruptedStatement = null;

    return combinedResponse;
  }

  async convertToSpeech(text) {
    try {
      console.log(`Requesting prerecorded TTS for: "${text.substring(0, 30)}..."`);

      const response = await this.deepgramClient.speak.request(
        { text },
        {
          model: this.voiceModel,
          encoding: 'linear16',
          sample_rate: 24000,
          container: "wav"
        }
      );

      const stream = await response.getStream();
      if (!stream) {
        throw new Error("Could not get audio stream from Deepgram.");
      }

      const reader = stream.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const audioBuffer = Buffer.concat(chunks);

      const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      VoiceAgent.audioCache.set(sessionId, audioBuffer);
      console.log(`TTS audio cached for session ${sessionId}. Size: ${audioBuffer.length} bytes.`);

      setTimeout(() => {
        VoiceAgent.audioCache.delete(sessionId);
        console.log(`Cache cleared for session ${sessionId}.`);
      }, 60000); // 60-second expiry

      return sessionId;

    } catch (error) {
      console.error("Fatal Error in convertToSpeech:", error);
      throw error;
    }
  }

  getLastStatement() {
    // Find the last message from this agent in the conversation context
    const messages = this.conversationContext.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].speaker === this.name) {
        return messages[i].content;
      }
    }
    return "I was making a point about this topic.";
  }

  cancelTTS() {
    if (this.currentTTSSession && !this.currentTTSSession.cancelled) {
      console.log(`${this.name} cancelling TTS`);
      this.currentTTSSession.cancelled = true;
      if (this.currentTTSSession.connection) {
        this.currentTTSSession.connection.requestClose();
      }
      this.currentTTSSession = null;
    }
  }
}

class JudgeAgent {
  constructor() {
    this.aiProvider = new AIProvider(); // Uses the same AI provider
  }

  async generateFeedback(conversationHistory, userRole, debateTopic, judgingInstruction, poiCount = 0) {
    const systemPrompt = `You are an expert, impartial, and highly analytical debate judge. Your name is "The Adjudicator." Your task is to provide a detailed, specific, and constructive performance review for one of the speakers based on the full transcript of a parliamentary debate. Your feedback must be structured, mathematical where possible, and actionable. You must:
- Carefully analyze the entire conversation history
- Evaluate what the user has said, including the tone and style of their speech
- Consider the user's assigned role and whether they justified it correctly
- Check if the user provided proper statistical or factual support for their claims
- Detect if the user gave any Points of Information (POIs), what those POIs were, and the quality of those POIs
- Identify where the user needs to improve the most and what is the single biggest flaw in their debate performance
- Be specific, detailed, and honest in your feedback
- Return the result in the exact JSON format requested, with each field filled with detailed, actionable, and role-specific feedback`;

    const userPrompt = `
      **Debate Transcript:**
      ---
      ${conversationHistory}
      ---

      **Your Judging Task:**

      ${judgingInstruction}

      The user made a total of ${poiCount} Points of Information (POIs) during the debate. Detect all POIs made by the user in the transcript and use this number to rate their POI performance. You must always provide a numeric score from 0 to 10 for POI performance. Never write N/A. If the user made no POIs, give a score of 0. Rate the user's POI performance out of 10, and provide specific feedback on the quality, relevance, and strategic use of their POIs. If no POIs were made, explain why and give a score of 0.

      Please provide a comprehensive, highly detailed, and role-specific performance review for the speaker who held the role of **"${userRole}"**. You must:
- Analyze the user's speech for tone, persuasiveness, and rhetorical style
- Judge whether the user fulfilled the duties of their assigned role, with specific examples
- Evaluate the use of statistics, facts, or evidence in the user's arguments
- Identify and assess all POIs made by the user, including their content and quality
- Clearly state where the user needs to improve the most and what is the single biggest flaw in their debate

Return your entire response as a single JSON object, with no text outside the JSON. Use this structure:

{
  "overallSummary": "A brief, one-paragraph summary of the user's performance, including tone and style.",
  "clashAnalysis": [
    {
      "clashPoint": "Describe the core point of disagreement (e.g., 'Impact on Education').",
      "userArguments": "Summarize the user's key arguments on this point, with examples.",
      "oppositionArguments": "Summarize the opposing side's arguments on this point.",
      "outcome": "Describe who won this clash and why.",
      "score": -5 // An integer from -5 (user lost badly) to +5 (user won decisively).
    }
  ],
  "scoring": {
    "matter": {
      "score": 8, // Score from 1-10
      "feedback": "Specific, constructive feedback on the quality and substance of their arguments, including use of evidence/statistics."
    },
    "manner": {
      "score": 7, // Score from 1-10
      "feedback": "Specific, constructive feedback on their delivery, tone, and persuasiveness."
    },
    "method": {
      "score": 9, // Score from 1-10
      "feedback": "Specific, constructive feedback on the structure of their speeches and their strategic decisions."
    }
  },
  "roleFulfillment": {
    "score": 8, // Score from 1-10
    "feedback": "Analysis of how well they fulfilled the specific duties of their role (${userRole}), with examples."
  },
  "poiHandling": {
      "score": 7, // Score from 0-10, must always be a number (never N/A, use 0 if no POIs)
      "feedback": "Specific feedback on how the user handled and made Points of Information (both making them and responding to them), including the content and quality of their POIs. If no POIs occurred, state that and give a score of 0."
  },
  "finalScore": 32, // The sum of the four scores (Matter + Manner + Method + Role Fulfillment)
  "keyImprovementArea": "Identify the single most important thing the user should focus on for next time, and the biggest flaw in their debate."
}
`;
    try {
      const response = await this.aiProvider.generate(userPrompt, systemPrompt, true);
      let feedback = {};
      try {
        feedback = JSON.parse(response);
      } catch (e) {
        feedback = { error: "Could not parse feedback JSON." };
      }
      if (feedback && feedback.poiHandling) {
        let score = feedback.poiHandling.score;
        if (typeof score !== 'number' || isNaN(score)) {
          feedback.poiHandling.score = 0;
        } else {
          feedback.poiHandling.score = Math.max(0, Math.min(10, score));
        }
      }
      return feedback;
    } catch (error) {
      console.error("JudgeAgent: Error generating or parsing feedback.", error);
      return { error: "Could not generate feedback due to a technical issue." };
    }
  }
}

// Turn Management System
class TurnManager {
  constructor(agents, conversationContext) {
    this.agents = agents;
    this.conversationContext = conversationContext;
    this.currentTurnIndex = 0;
    this.isUserInterruption = false;
    this.lastSpeakingAgent = null;
    this.isAutonomousMode = true;
    this.debateTopic = null;
    this.userRole = null;
    this.userLevel = 'beginner';
    this.userTurnIndex = -1; // -1 means user hasn't been assigned a turn yet
    this.speakerResponses = new Map(); // Store responses from each speaker
    this.isDebateConcluded = false;
  }

  setUserDetails(role, level) {
    this.userRole = role;
    this.userLevel = level || 'beginner'; // Set level with a fallback
    this.userTurnIndex = this.agents.findIndex(agent => agent.name === role);
    console.log(`User assigned Role: ${this.userRole}, Level: ${this.userLevel}`);
  }

  getCurrentAgent() {
    return this.agents[this.currentTurnIndex];
  }

  getNextAgent() {
    // Define the proper turn order to alternate between government and opposition
    const turnOrder = [
      0, // Moderator
      1, // Prime Minister (Government)
      2, // Leader of Opposition (Opposition)
      3, // Deputy Prime Minister (Government)
      4, // Deputy Leader of Opposition (Opposition)
      5, // Member for the Government
      6, // Member for the Opposition
      7, // Government Whip (Government)
      8, // Opposition Whip (Opposition)
    ];

    const currentIndex = turnOrder.indexOf(this.currentTurnIndex);
    const nextIndex = (currentIndex + 1) % turnOrder.length;
    return this.agents[turnOrder[nextIndex]];
  }

  getPreviousSpeaker() {
    // Define the proper turn order to alternate between government and opposition
    const turnOrder = [
      0, // Moderator
      1, // Prime Minister (Government)
      2, // Leader of Opposition (Opposition)
      3, // Deputy Prime Minister (Government)
      4, // Deputy Leader of Opposition (Opposition)
      5, // Member for the Government
      6, // Member for the Opposition
      7, // Government Whip (Government)
      8, // Opposition Whip (Opposition)
    ];

    const currentIndex = turnOrder.indexOf(this.currentTurnIndex);
    const previousIndex = (currentIndex - 1 + turnOrder.length) % turnOrder.length;
    return this.agents[turnOrder[previousIndex]];
  }

  storeResponse(speakerName, response) {
    this.speakerResponses.set(speakerName, response);
  }

  getLastResponseFromSpeaker(speakerName) {
    return this.speakerResponses.get(speakerName);
  }

  isUserTurn() {
    return this.currentTurnIndex === this.userTurnIndex;
  }

  handleUserInterruption() {
    this.isUserInterruption = true;
    this.lastSpeakingAgent = this.getCurrentAgent();
    this.isAutonomousMode = false;
    console.log(`User interrupted. Current agent: ${this.lastSpeakingAgent.name}`);
  }

  nextTurn() {
    const turnOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const currentIndex = turnOrder.indexOf(this.currentTurnIndex);
    const nextIndex = (currentIndex + 1) % turnOrder.length;
    this.currentTurnIndex = turnOrder[nextIndex];
    return this.getCurrentAgent();
  }

  // Add method to check if should process next turn:
  shouldProcessNextTurn() {
    return this.isAutonomousMode && !this.isUserInterruption;
  }

  // Generate autonomous debate prompt
  generateDebatePrompt(agent, previousResponse = null) {
    const otherAgent = this.getNextAgent();
    let prompt = `You are participating in a parliamentary debate about: "${this.debateTopic}"

Previous conversation context:
${this.getConversationHistory()}

Your role: ${agent.role}
Your name: ${agent.name}
Your opponent: ${otherAgent.name} (${otherAgent.role})

Instructions:
- Make a compelling argument for your position
- Reference what other participants said if applicable
- Keep your response concise (2-3 sentences)
- Stay in character as ${agent.name}
- Be engaging and passionate about your viewpoint
- Consider the broader context of parliamentary debate`;

    if (previousResponse) {
      prompt += `\n\nYour opponent just said: "${previousResponse}"\n\nRespond to their argument and make your own point.`;
    } else if (agent.name === "Leader of Opposition") {
      // Special case for Leader of Opposition - they should respond to Prime Minister's opening
      const primeMinisterResponse = this.getLastResponseFromSpeaker("Prime Minister");
      if (primeMinisterResponse) {
        prompt += `\n\nThe Prime Minister just made their opening statement: "${primeMinisterResponse}"\n\nAs the Leader of Opposition, respond to the Prime Minister's arguments and present your counter-arguments.`;
      } else {
        prompt += `\n\nAs the Leader of Opposition, make your opening statement in response to the government's position.`;
      }
    } else if (agent.name === "Deputy Prime Minister") {
      // Special case for Deputy Prime Minister - they should respond to Leader of Opposition
      const oppositionResponse = this.getLastResponseFromSpeaker("Leader of Opposition");
      if (oppositionResponse) {
        prompt += `\n\nThe Leader of Opposition just said: "${oppositionResponse}"\n\nAs the Deputy Prime Minister, respond to the opposition's arguments and support the government's position.`;
      } else {
        prompt += `\n\nAs the Deputy Prime Minister, make your statement supporting the government's position.`;
      }
    } else {
      prompt += `\n\nStart the debate by making your opening argument.`;
    }

    return prompt;
  }

  getConversationHistory() {
    // Get recent conversation context from the shared context
    const recentMessages = this.conversationContext.messages.slice(-10);
    if (recentMessages.length === 0) {
      return "This is the beginning of the debate.";
    }
    return recentMessages.map(msg => `${msg.speaker}: ${msg.content}`).join('\n');
  }

  reset() {
    this.currentTurnIndex = 0;
    this.isUserInterruption = false;
    this.lastSpeakingAgent = null;
    this.isAutonomousMode = true;
    this.userRole = null;
    this.userTurnIndex = -1;
    this.speakerResponses.clear();
  }

  // Check if we should continue autonomous debate
  shouldContinueDebate() {
    return this.isAutonomousMode && !this.isUserInterruption;
  }
}

// Unified Deepgram and WebSocket Connection Manager
class UnifiedConnectionManager {
  constructor(ws, clientId, agents, speechAnalyzer, conversationContext) {
    this.ws = ws;
    this.clientId = clientId;
    this.agents = agents;
    this.speechAnalyzer = speechAnalyzer;
    this.agents.forEach(agent => agent.conversationContext = conversationContext);
    this.deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
    this.deepgram = null;
    this.isDeepgramReady = false;
    this.keepAlive = null;
    this.audioBuffer = [];

    // State Management
    this.transcriptBuffer = "";
    this.interimTranscript = ""

    // This manager now HOLDS the context for this session
    this.conversationContext = conversationContext;

    // Pass the session-specific context down to the TurnManager
    this.turnManager = new TurnManager(agents, conversationContext);
    this.pipelineManager = new PipelineManager(this, agents, ws);

    this.isReconnecting = false;
    this.userPoiCount = 0;

    // --- MONGO DB INTEGRATION ---
    // Property to hold the last generated feedback
    this.lastAdjudicationResult = null;

    this.agents.forEach(agent => agent.connectionManager = this);
    this.setupDeepgram();
  }

  setupDeepgram() {
    // Prevent multiple concurrent setup calls
    if (this.isReconnecting) {
      console.log("Reconnection already in progress. Skipping duplicate setup call.");
      return;
    }
    this.isReconnecting = true;
    console.log("Attempting to establish a persistent Deepgram STT connection...");

    if (this.deepgram) {
      this.deepgram.finish();
      this.deepgram.removeAllListeners();
    }

    this.deepgram = this.deepgramClient.listen.live({
      smart_format: true,
      model: "nova-3",
      interim_results: true,
      encoding: "opus", // Explicitly set the encoding
      punctuate: true,
    });


    this.deepgram.addListener(LiveTranscriptionEvents.Open, () => {
      console.log("deepgram: STT connected");
      this.isDeepgramReady = true;
      this.isReconnecting = false;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'stt_ready' }));
      }

      // Flush any buffered audio
      if (this.audioBuffer.length > 0) {
        console.log(`Flushing ${this.audioBuffer.length} buffered audio chunks.`);
        this.audioBuffer.forEach(chunk => this.deepgram.send(chunk));
        this.audioBuffer = [];
      }

      if (this.keepAlive) clearInterval(this.keepAlive);
      this.keepAlive = setInterval(() => {
        console.log("deepgram: keepalive");
        this.deepgram.keepAlive();
      }, 3000);
    });

    this.deepgram.addListener(LiveTranscriptionEvents.SpeechStarted, () => {
      console.log("deepgram: speech started");
      this.isSpeaking = true;

      // Cancel all TTS sessions when user starts speaking
      this.agents.forEach(agent => agent.cancelTTS());

      // Cancel autonomous debate timeout
      if (this.debateTimeout) {
        clearTimeout(this.debateTimeout);
        this.debateTimeout = null;
      }

      // Handle user interruption (only if not user's turn)
      if (!this.isUserTurn) {
        this.turnManager.handleUserInterruption();
      }

      if (this.ws.readyState === WebSocketServer.OPEN) {
        this.ws.send(JSON.stringify({ type: 'user_speaking' }));
      }

      if (this.bufferTimeout) {
        clearTimeout(this.bufferTimeout);
        this.bufferTimeout = null;
      }
    });

    this.deepgram.addListener(LiveTranscriptionEvents.UtteranceEnd, () => {
      console.log("deepgram: utterance ended");
      this.isSpeaking = false;

      const currentTime = Date.now();
      const silenceDuration = currentTime - this.lastTranscriptTime;

      if (this.isUserTurn) {
        // If it's user's turn, don't process automatically - wait for stop recording
        console.log("User's turn - waiting for stop recording before processing");
        if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
        this.bufferTimeout = setTimeout(() => {
          // Just keep the buffer, don't process
          console.log("User's turn - keeping transcript in buffer");
        }, 2000);
      } else {
        // If it's NOT user's turn, treat as interruption - wait for stop recording
        console.log("User interruption - waiting for stop recording before processing");
        if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
        this.bufferTimeout = setTimeout(() => {
          // Just keep the buffer, don't process automatically
          console.log("User interruption - keeping transcript in buffer");
        }, 2000);
      }
    });

    this.deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "transcript", data }));
      }

      const transcriptText = data.channel.alternatives[0].transcript;

      if (transcriptText.trim().length > 0) {
        if (data.is_final) {
          // Once a segment is final, add it to the permanent buffer and clear the interim.
          this.transcriptBuffer += " " + transcriptText;
          this.interimTranscript = "";
        } else {
          // If it's not final, it's our latest best guess at what's being said.
          this.interimTranscript = transcriptText;
        }
      }
    });

    this.deepgram.addListener(LiveTranscriptionEvents.Close, () => {
      console.log("deepgram: STT disconnected");
      this.isDeepgramReady = false;
      this.isReconnecting = false;
      if (this.keepAlive) {
        clearInterval(this.keepAlive);
      }
    });

    this.deepgram.addListener(LiveTranscriptionEvents.Error, (error) => {
      console.log("deepgram: error received");
      console.error(error.message);
      this.isReconnecting = false;
    });

    this.deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
      if (this.ws.readyState === WebSocketServer.OPEN) {
        this.ws.send(JSON.stringify({
          type: "metadata",
          data: data
        }));
      }
    });
  }

  async startAutonomousDebate() {
    if (this.isDebateActive) return;

    this.isDebateActive = true;
    console.log("Starting autonomous debate...");

    // Start with the first agent
    await this.continueAutonomousDebate();
  }

  async continueAutonomousDebate() {
    const currentAgent = this.turnManager.getCurrentAgent();

    if (this.turnManager.isUserTurn()) {
      this.isUserTurn = true;
      if (this.ws.readyState === WebSocketServer.OPEN) {
        this.ws.send(JSON.stringify({
          type: "user_turn",
          data: { role: this.turnManager.userRole }
        }));
      }
      return;
    }

    const previousSpeaker = this.turnManager.getPreviousSpeaker();
    const previousResponse = previousSpeaker ? this.turnManager.getLastResponseFromSpeaker(previousSpeaker.name) : null;
    const debatePrompt = this.turnManager.generateDebatePrompt(currentAgent, previousResponse);
    const agentIndex = this.agents.findIndex(a => a.name === currentAgent.name);
    await this.pipelineManager.addToPipeline(agentIndex, {
      debatePrompt: debatePrompt
    });
  }

  // Handle TTS completion from the agent (backend TTS completion)
  handleTTSCompletion(sessionId, assistantName) {
    if (this.pendingTTSCompletion && this.pendingTTSCompletion.sessionId === sessionId) {
      console.log(`TTS completed for ${assistantName}, waiting for frontend playback completion`);
      // Don't resolve yet - wait for frontend to send tts_playback_complete
    }
  }

  // Handle TTS playback completion from frontend
  handlePlaybackComplete(sessionId, assistantName) {
    console.log(`Playback completed for ${assistantName}.`);
    this.pipelineManager.isAgentSpeaking = false;

    // Check if the debate has already concluded
    if (this.turnManager.isDebateConcluded) {
      console.log("Debate has concluded. No further turns will be taken.");
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'debate_end' }));
      }
      return; // Stop the process
    }

    // Check if the person who just finished was the final speaker
    const lastSpeakerIndex = 8; // Opposition Whip
    if (this.turnManager.currentTurnIndex === lastSpeakerIndex) {
      console.log("Final whip has spoken. Preparing Moderator's conclusion.");
      this.turnManager.isDebateConcluded = true; // Mark the debate as concluding
      this.turnManager.currentTurnIndex = 0; // Set the next turn to the Moderator

      const moderator = this.turnManager.getCurrentAgent();
      const concludingPrompt = `The debate on the topic "${this.turnManager.debateTopic}" has concluded. Please provide a brief, neutral summary of the main clash points and formally close the session.`;

      // Add the concluding prompt to the pipeline
      this.pipelineManager.addToPipeline(0, { debatePrompt: concludingPrompt });
      return;
    }

    // --- This is the original logic for a normal turn ---
    this.turnManager.nextTurn();
    const nextAgent = this.turnManager.getCurrentAgent();
    console.log(`Advancing to next turn. New speaker is: ${nextAgent.name}`);

    if (this.turnManager.isUserTurn()) {
      console.log("This is the user's turn. Sending notification to frontend.");
      this.isUserTurn = true;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "user_turn",
          data: { role: this.turnManager.userRole }
        }));
      }
    } else {
      console.log("This is an AI's turn. Generating their response.");
      const previousSpeaker = this.turnManager.getPreviousSpeaker();
      const previousResponse = this.turnManager.getLastResponseFromSpeaker(previousSpeaker.name);
      const debatePrompt = this.turnManager.generateDebatePrompt(nextAgent, previousResponse);
      const agentIndex = this.agents.findIndex(a => a.name === nextAgent.name);

      this.pipelineManager.addToPipeline(agentIndex, { userInput: previousResponse, debatePrompt: debatePrompt });
    }
  }

  // Handle user role selection
  handleUserRoleSelection(role, topic, level) {
    this.turnManager.debateTopic = topic;
    this.turnManager.setUserDetails(role, level);
    console.log(`User selected role: ${role} for topic: "${topic}" at level: ${level}`);
    console.log("Role selected. Immediately starting the autonomous debate flow.");

    // Start the autonomous debate after role selection
    this.startAutonomousDebate();
  }

  async resumeAutonomousDebate() {
    if (this.debateTimeout) {
      clearTimeout(this.debateTimeout);
      this.debateTimeout = null;
    }

    this.turnManager.isAutonomousMode = true;
    console.log("Resuming autonomous debate...");

    // Continue with the next agent
    this.turnManager.nextTurn();
    await this.continueAutonomousDebate();
  }

  ensureDeepgramConnection() {
    if (this.deepgram && this.deepgram.getReadyState() === 1) {
      console.log("Deepgram STT connection is active.");
      return;
    }

    console.log("Deepgram STT connection is not active. Re-initializing...");
    if (this.deepgram) {
      this.deepgram.finish();
    }
    this.setupDeepgram();
  }

  handleUserStartRecording() {
    console.log("--- USER START RECORDING ---");

    if (this.pipelineManager.isAgentSpeaking) {
      console.log("POI Detected: User is interrupting an agent.");
      this.pipelineManager.cancelAll();
    }

    console.log("Tearing down old STT connection to ensure a fresh start.");
    if (this.deepgram) {
      this.deepgram.finish();
      this.deepgram.removeAllListeners();
      this.deepgram = null;
    }
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
    }
    this.transcriptBuffer = "";
    this.interimTranscript = "";
    this.audioBuffer = [];

    // This now just *starts* the process. The 'stt_ready' signal will trigger the client.
    this.setupDeepgram();

    if (!this.turnManager.isUserTurn()) {
      this.turnManager.handleUserInterruption();
    }
  }


  async handleUserStopRecording() {
    setTimeout(async () => {
      // Combine the finalized transcript with the very last interim transcript.
      const userInput = (this.transcriptBuffer + " " + this.interimTranscript).trim();

      // Clear both buffers for the next user turn.
      this.transcriptBuffer = "";
      this.interimTranscript = "";

      if (userInput.length === 0) {
        console.log("No user input to process.");
        return;
      }

      console.log(`Processing final user input: "${userInput}"`);

      const wasPoi = !this.turnManager.isUserTurn();
      const speakerLabel = wasPoi
        ? `${this.turnManager.userRole} (POI)`
        : this.turnManager.userRole;

      // 1. Send the final transcript with the correct label
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'user_speech_final',
          transcript: userInput,
          speaker: speakerLabel
        }));
      }

      // 2. Add the message to the central conversation context with the correct label
      this.conversationContext.addMessage(speakerLabel, userInput);

      if (this.turnManager.isUserTurn()) {
        // --- FLOW A: USER WAS SPEAKING ON THEIR TURN ---
        console.log("User's scheduled turn has ended.");
        this.isUserTurn = false;
        this.handlePlaybackComplete(null, this.turnManager.userRole);
      } else {
        // --- FLOW B: USER WAS INTERRUPTING (POI) ---
        const agentToRespond = this.pipelineManager.interruptedAgent;
        if (agentToRespond) {
          console.log(`Processing POI for agent: ${agentToRespond.name}`);
          const poiResponse = await agentToRespond.generatePoiResponse(userInput);
          const agentIndex = this.agents.findIndex(a => a.name === agentToRespond.name);
          await this.pipelineManager.addToPipeline(agentIndex, { userInput, preGeneratedResponse: poiResponse });
          this.pipelineManager.clearInterruption();
        } else {
          console.warn("User spoke, but it wasn't their turn and no agent was interrupted. Ignoring input.");
        }
      }
      if (!this.turnManager.isUserTurn()) {
        this.userPoiCount = (this.userPoiCount || 0) + 1;
      }
    }, 1000);
  }


  async processFinalTranscript() {
    this.isWaitingForFinalTranscript = false; // We are now processing.
    if (this.safetyTimeout) clearTimeout(this.safetyTimeout);

    const userInput = this.transcriptBuffer.trim();
    this.transcriptBuffer = ""; // Clear buffer immediately.

    if (userInput.length === 0) {
      console.log("No user input to process.");
      this.pipelineManager.clearInterruption();
      return;
    }

    console.log(`Processing final user input: "${userInput}"`);
    const agentToRespond = this.pipelineManager.interruptedAgent;

    if (agentToRespond) {
      // POI FLOW
      console.log(`Processing POI for agent: ${agentToRespond.name}`);
      const poiResponse = await agentToRespond.generatePoiResponse(userInput);
      const agentIndex = this.agents.findIndex(a => a.name === agentToRespond.name);
      await this.pipelineManager.addToPipeline(agentIndex, { userInput, preGeneratedResponse: poiResponse });
      this.pipelineManager.clearInterruption();
    } else {
      // NORMAL TURN FLOW
      if (this.turnManager.isUserTurn()) {
        this.turnManager.storeResponse(this.turnManager.userRole, userInput);
        this.turnManager.nextTurn();
        const nextAgent = this.turnManager.getCurrentAgent();
        await this.pipelineManager.addToPipeline(this.agents.findIndex(a => a.name === nextAgent.name), { userInput });
      } else {
        const currentAgent = this.turnManager.getCurrentAgent();
        await this.pipelineManager.addToPipeline(this.agents.findIndex(a => a.name === currentAgent.name), { userInput });
      }
    }
  }

  resetDebate() {
    if (this.debateTimeout) {
      clearTimeout(this.debateTimeout);
      this.debateTimeout = null;
    }
    this.turnManager.reset();
    this.lastDebateResponse = null;
    this.isDebateActive = false;
    this.isUserTurn = false;
    this.isUserResponsePending = false;
    this.userPoiCount = 0;
    console.log("Debate reset");
  }

  checkAndReconnect() {
    if (!this.deepgram || this.deepgram.getReadyState() !== 1 && !this.isReconnecting) {
      console.log("Deepgram connection is dead. Re-initializing...");
      this.setupDeepgram();
    }
  }

  sendMessage(message) {
    this.checkAndReconnect();
    if (this.isDeepgramReady) {
      this.deepgram.send(message);
    } else {
      this.audioBuffer.push(message);
    }
  }

  async cleanup() {
    console.log(`Cleaning up connection for client ${this.clientId}`);
    if (this.keepAlive) clearInterval(this.keepAlive);
    if (this.deepgram) {
      this.deepgram.finish();
      this.deepgram.removeAllListeners();
    }
    
    try {
        if (this.conversationContext.messages.length > 1) {
            console.log(`[DB Save for ${this.clientId}] Preparing to save debate record.`);

            // MODIFIED: Get uploaded files from the in-memory cache instead of the filesystem.
            const cachedFiles = uploadedFileCache.get(this.clientId) || [];
            const filesToSave = cachedFiles.map(file => ({
                filename: file.originalname,
                data: file.buffer,
                mimetype: file.mimetype
            }));

            const debateRecord = new Debate({
                clientId: this.clientId,
                debateTopic: this.turnManager.debateTopic,
                userRole: this.turnManager.userRole,
                chatHistory: this.conversationContext.messages,
                adjudicationResult: this.lastAdjudicationResult,
                uploadedFiles: filesToSave
            });

            await debateRecord.save();
            console.log(`[DB Save for ${this.clientId}] ✅ Successfully saved debate record to MongoDB.`);
        } else {
            console.log(`[DB Save for ${this.clientId}] Skipping save, debate was too short.`);
        }
    } catch (error) {
        console.error(`[DB Save for ${this.clientId}] ❌ Error saving debate record to MongoDB:`, error);
    } finally {
        // MODIFIED: Clean up the in-memory cache for the client.
        if (uploadedFileCache.has(this.clientId)) {
            uploadedFileCache.delete(this.clientId);
            console.log(`[Cleanup for ${this.clientId}] ✅ Cleared in-memory file cache.`);
        }

        // REMOVED: Deleting local directories is no longer necessary.
    }
  }
}

class PipelineManager {
  constructor(connectionManager, agents, ws) {
    this.connectionManager = connectionManager;
    this.agents = agents;
    this.ws = ws;
    this.pipeline = [];
    this.isProcessing = false;
    this.currentPlayingSession = null;
    this.interruptedAgent = null;
    this.isAgentSpeaking = false;
  }

  async addToPipeline(agentIndex, { userInput = null, debatePrompt = null, preGeneratedResponse = null }) {
    const agent = this.agents[agentIndex];

    this.pipeline.push({ agent, userInput, debatePrompt, preGeneratedResponse });

    if (!this.isProcessing) {
      this.processNextInPipeline();
    }
  }

  async processNextInPipeline() {
    if (this.isProcessing || this.pipeline.length === 0) return;

    this.isProcessing = true;
    const item = this.pipeline.shift();
    const { agent, userInput, debatePrompt, preGeneratedResponse } = item;

    try {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'agent_thinking', assistant: agent.name }));
      }

      const response = preGeneratedResponse || await agent.generateResponse(userInput, false, debatePrompt, this.connectionManager.turnManager.userLevel);

      console.log(`PIPELINE: Final text for ${agent.name}: "${response.substring(0, 70)}..."`);
      this.connectionManager.conversationContext.addMessage(agent.name, response);
      this.connectionManager.turnManager.storeResponse(agent.name, response);

      try {
        console.log(`Generating speech for ${agent.name}...`);
        const sessionId = await agent.convertToSpeech(response); // This now returns a single ID

        if (this.ws.readyState === WebSocket.OPEN) {
          console.log(`Sending 'start_immediate_playback' for session ${sessionId}`);
          // Note the new message type
          this.ws.send(JSON.stringify({
            type: 'start_immediate_playback',
            sessionId: sessionId,
            assistant: agent.name,
            response: response,
          }));
        }
        this.isAgentSpeaking = true;
        this.currentPlayingSession = { sessionId, agent: agent.name };

      } catch (ttsError) {
        console.error(`!!!!!!!! TTS FAILED FOR AGENT ${agent.name} !!!!!!!!`);
        console.error(`Failing text was: "${response}"`);
        console.error("TTS Error details:", ttsError);
        this.isAgentSpeaking = false;
        this.connectionManager.handlePlaybackComplete(null, agent.name);
      }

    } catch (error) {
      console.error(`General pipeline error for ${agent.name}:`, error);
      this.isAgentSpeaking = false;
      this.connectionManager.handlePlaybackComplete(null, agent.name);
    } finally {
      this.isProcessing = false;
      if (this.pipeline.length > 0 && !this.isAgentSpeaking) {
        this.processNextInPipeline();
      }
    }
  }

  cancelAll() {
    if (this.currentPlayingSession) {
      const agentName = this.currentPlayingSession.agent;
      this.interruptedAgent = this.agents.find(a => a.name === agentName);
    }
    this.isAgentSpeaking = false;
    this.pipeline = [];
    this.isProcessing = false;
    this.currentPlayingSession = null;
  }

  clearInterruption() {
    this.interruptedAgent = null;
  }

  getCurrentSession() {
    return this.currentPlayingSession;
  }
}

// Main Application Class
class VoiceAssistantApp {
  constructor() {
    this.app = express();
    this.app.use(cors());
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.speechAnalyzer = new SpeechAnalyzer();
    this.serpApiSearch = new SerpApiSearch();
    this.connections = new Map();
    this.judgeAgent = new JudgeAgent();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static("public/"));
    
    // MODIFIED: Use multer's memoryStorage to handle file uploads as buffers in memory, not on disk.
    const storage = multer.memoryStorage();
    
    const upload = multer({ 
        storage: storage,
        limits: { fileSize: 20 * 1024 * 1024 }, // 20MB file size limit
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
                cb(null, true);
            } else {
                cb(new Error('Only .pdf and .txt files are allowed!'), false);
            }
        }
    });


    // MODIFIED: File upload endpoint now saves files to the in-memory cache.
    this.app.post('/api/upload-papers', upload.array('papers', 10), (req, res) => {
        const clientId = req.body.clientId;
        if (!clientId) {
            return res.status(400).json({ message: 'Client ID is required for upload' });
        }
        
        // req.files is an array of files, each with a 'buffer' property.
        // We store this array in our global cache, keyed by the clientId.
        uploadedFileCache.set(clientId, req.files);
        console.log(`[File Upload] Cached ${req.files.length} files for clientId: ${clientId}`);

        res.status(200).json({ message: 'Files uploaded and cached successfully!', files: req.files.map(f => f.originalname) });
    }, (error, req, res, next) => {
        res.status(400).json({ message: error.message });
    });

    this.app.get("/api/tts-audio/:sessionId", (req, res) => {
      const sessionId = req.params.sessionId;
      const audioBuffer = VoiceAgent.audioCache.get(sessionId);
      if (audioBuffer) {
        res.setHeader('Content-Type', 'audio/wav');
        res.send(audioBuffer);
      } else {
        res.status(404).send("Audio not found or has expired.");
      }
    });

    // this.app.get("/", (req, res) => {
    //   res.sendFile("/public/index.html");
    // });

    this.app.post("/api/clear-context/:clientId", (req, res) => {
      // This route is likely obsolete with session-based context, but kept for compatibility
      const connection = this.connections.get(req.params.clientId);
      if (connection && connection.conversationContext) {
        connection.conversationContext.clear();
      }
      res.json({ success: true, message: "Context cleared" });
    });

    this.app.get("/api/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        activeConnections: this.wss.clients.size,
      });
    });

    this.app.post("/api/get-feedback", async (req, res) => {
      try {
        const { clientId } = req.body;
        const connectionManager = this.connections.get(clientId);

        if (!connectionManager) {
          return res.status(404).json({ error: "Client session not found." });
        }

        const conversationContext = connectionManager.conversationContext;
        const turnManager = connectionManager.turnManager;

        const history = conversationContext.getHistory();
        const userRole = turnManager.userRole;
        const userLevel = turnManager.userLevel;
        const debateTopic = turnManager.debateTopic;
        const poiCount = connectionManager.userPoiCount || 0;


        let judgingInstruction = '';
        switch (userLevel) {
          case 'expert':
            judgingInstruction = `The user is an EXPERT debater. Be strict, analytical, and critical. Focus on high-level strategic errors and offer sophisticated advice for improvement. Do not hold back on criticism.`;
            break;
          case 'intermediate':
            judgingInstruction = `The user is an INTERMEDIATE debater. Provide a balanced review, highlighting both strengths and key areas for improvement. Your feedback should be constructive and help them move to the next level.`;
            break;
          case 'beginner':
          default:
            judgingInstruction = `The user is a BEGINNER debater. Your tone must be encouraging and motivating. Be lenient with scoring. Focus on fundamental concepts like structure and clarity. Praise their effort and provide simple, actionable tips to build their confidence.`;
            break;
        }


        if (!userRole) {
          return res.status(400).json({ error: "User role not set for this session." });
        }

        if (!history || history.trim() === '') {
          return res.status(400).json({ error: "Cannot generate feedback. The debate history is empty." });
        }

        const feedback = await this.judgeAgent.generateFeedback(history, userRole, debateTopic, judgingInstruction, poiCount);

        // --- MONGO DB INTEGRATION ---
        // Store the generated feedback on the connection manager instance so it can be saved on exit
        connectionManager.lastAdjudicationResult = feedback;

        res.json({ ...feedback, userPoiCount: poiCount });

      } catch (error) {
        console.error("!! FATAL ERROR in /api/get-feedback handler !!", error);
        res.status(500).json({ error: "Failed to generate feedback due to an internal server error." });
      }
    });
  }

  setupWebSocket() {
    this.wss.on("connection", (ws) => {
      let clientId = null;

      ws.on("message", async (message) => {
        console.log(`ws: received message of type: ${typeof message}, isBuffer: ${Buffer.isBuffer(message)}`);

        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'user_role_selected') {
            clientId = data.clientId;
            if (!clientId) {
              console.error("Fatal: user_role_selected message received without a clientId. Closing connection.");
              ws.close();
              return;
            }
            console.log(`ws: Client connected and authenticated with ID: ${clientId}`);
            const debateLevel = data.level || 'beginner';
            const agentDifficultyPrompt = `You are a ${debateLevel}-level debater. Adjust your arguments, vocabulary, and complexity to match this level.`;
            const noStageDirectionsPrompt = `CRITICAL: Your entire response must be only the words you would speak. Do not include any stage directions, descriptions, or text in parentheses, brackets, or asterisks. For example, never write "(clears throat)" or "[pauses for effect]". Just provide the dialogue.`;
            const debateTopic = data.topic || "Is social media beneficial for society?";
            const conversationContext = new ConversationContext();

            // --- RAG INTEGRATION: Create session-specific vector store ---
            const vectorStore = await getVectorStore(clientId);

            const allVoices = [
              'aura-2-amalthea-en', 'aura-2-andromeda-en', 'aura-2-apollo-en', 'aura-2-arcas-en', 'aura-2-aries-en',
              'aura-2-asteria-en', 'aura-2-athena-en', 'aura-2-atlas-en', 'aura-2-aurora-en', 'aura-2-callista-en', 'aura-2-cora-en',
              'aura-2-cordelia-en', 'aura-2-delia-en', 'aura-2-draco-en', 'aura-2-electra-en', 'aura-2-harmonia-en',
              'aura-2-helena-en', 'aura-2-hera-en', 'aura-2-hermes-en', 'aura-2-hyperion-en', 'aura-2-iris-en', 'aura-2-janus-en',
              'aura-2-juno-en', 'aura-2-jupiter-en', 'aura-2-luna-en', 'aura-2-mars-en', 'aura-2-minerva-en', 'aura-2-neptune-en',
              'aura-2-odysseus-en', 'aura-2-ophelia-en', 'aura-2-orion-en', 'aura-2-orpheus-en', 'aura-2-pandora-en', 'aura-2-phoebe-en',
              'aura-2-pluto-en', 'aura-2-saturn-en', 'aura-2-selene-en', 'aura-2-thalia-en', 'aura-2-theia-en', 'aura-2-vesta-en',
              'aura-2-zeus-en'
            ];
            const shuffle = (array) => {
              for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
              }
              return array;
            };

            const shuffledVoices = shuffle([...allVoices]);
            // British Parliamentary: add two extra agents before the whips
            const agents = [
              new VoiceAgent(
                "Moderator", "Parliamentary Debate Moderator",
                `You are a skilled and impartial parliamentary debate moderator. Your role is to guide the discussion, maintain order, and ensure a balanced debate.\n- The motion for today's debate is: "${debateTopic}"\n- You must remain completely neutral, showing no preference for either side.\n- Your tasks include introducing the topic, calling on speakers in the correct order, asking clarifying questions to both sides, and summarizing key arguments.\n- You speak with authority, clarity, and fairness.\n- ${noStageDirectionsPrompt}`, 
                shuffledVoices.pop() || 'aura-2-thalia-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Prime Minister", "Government Leader",
                `You are the Prime Minister and the leader of the Government. You are a powerful, confident, and persuasive speaker.\n- The motion for today's debate is: "${debateTopic}"\n- Your government's position is to STRONGLY SUPPORT this motion. ${agentDifficultyPrompt}\n- You must build a compelling case in favor of the motion, using evidence, logical reasoning, and rhetorical skill. You set the tone for your entire side of the debate. \n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-apollo-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Leader of Opposition", "Opposition Leader",
                `You are the Leader of the Opposition. You are a sharp, critical, and passionate speaker, skilled at finding flaws in arguments.\n- The motion for today's debate is: "${debateTopic}"\n- Your party's position is to STRONGLY OPPOSE this motion. ${agentDifficultyPrompt}\n- You must dismantle the government's case and build a compelling counter-argument against the motion. Your goal is to convince everyone that the motion is misguided.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-arcas-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Deputy Prime Minister", "Government Deputy",
                `You are the Deputy Prime Minister. You are a loyal and articulate supporter of the government's position.\n- The motion for today's debate is: "${debateTopic}"\n- Your role is to reinforce the Prime Minister's arguments, introduce new points that SUPPORT the motion, and rebut the Opposition's claims. ${agentDifficultyPrompt}\n- You speak with conviction and unwavering support for your side.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-asteria-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Deputy Leader of Opposition", "Opposition Deputy",
                `You are the Deputy Leader of the Opposition. You are a determined and detail-oriented debater.\n- The motion for today's debate is: "${debateTopic}"\n- Your role is to support your leader by attacking the government's case, provide new arguments AGAINST the motion, and exposing weaknesses in their logic. ${agentDifficultyPrompt}\n- You speak with concern and firm opposition.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-atlas-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Member for the Government", "Closing Government",
                `You are the Member for the Government. You are a persuasive and strategic debater.\n- The motion for today's debate is: "${debateTopic}"\n- Your role is to introduce new arguments in support of the motion, reinforce your team's case, and rebut the opposition. ${agentDifficultyPrompt}\n- You speak with clarity and conviction.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-cora-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Member for the Opposition", "Closing Opposition",
                `You are the Member for the Opposition. You are a sharp and resourceful debater.\n- The motion for today's debate is: "${debateTopic}"\n- Your role is to introduce new arguments against the motion, reinforce your team's case, and rebut the government. ${agentDifficultyPrompt}\n- You speak with clarity and conviction.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-cordelia-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Government Whip", "Government Whip",
                `You are the Government Whip. Your focus is on summarizing and reinforcing your side's arguments with clarity and discipline.\n- The motion for today's debate is: "${debateTopic}"\n- Your task is to summarize the key points made by your Prime Minister, Deputy, and Member, crystallize your government's position, and show why your side has won the debate. You must strongly SUPPORT the motion. ${agentDifficultyPrompt}\n- You speak with party loyalty and a focus on practical, powerful summaries.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-callista-en', conversationContext, vectorStore, this.serpApiSearch
              ),
              new VoiceAgent(
                "Opposition Whip", "Opposition Whip",
                `You are the Opposition Whip. Your focus is on summarizing and reinforcing your side's arguments to deliver a final, decisive blow.\n- The motion for today's debate is: "${debateTopic}"\n- Your task is to summarize the key arguments from your Leader, Deputy, and Member, highlight the failures of the government's case, and make a final, passionate plea for why the motion must be rejected. ${agentDifficultyPrompt}\n- You speak with party loyalty and protective concern for the principles you are defending.\n- ${noStageDirectionsPrompt}`,
                shuffledVoices.pop() || 'aura-2-delia-en', conversationContext, vectorStore, this.serpApiSearch
              ),
            ];

            const speechAnalyzer = new SpeechAnalyzer();
            const connectionManager = new UnifiedConnectionManager(ws, clientId, agents, speechAnalyzer, conversationContext);
            this.connections.set(clientId, connectionManager);
            connectionManager.handleUserRoleSelection(data.role, data.topic, data.level);

          } else if (this.connections.has(clientId)) {
            const connectionManager = this.connections.get(clientId);
            switch (data.type) {
              case 'tts_playback_complete':
                connectionManager.handlePlaybackComplete(data.sessionId, data.assistant);
                break;
              case 'user_start_recording':
                connectionManager.handleUserStartRecording();
                break;
              case 'user_stop_recording':
                connectionManager.handleUserStopRecording();
                break;
            }
          }

        } catch (error) {
          if (clientId && this.connections.has(clientId)) {
            this.connections.get(clientId).sendMessage(message);
          }
        }
      });

      ws.on("close", async () => {
        console.log(`ws: client ${clientId} disconnected`);
        if (clientId && this.connections.has(clientId)) {
          const connectionMgr = this.connections.get(clientId);
          if (connectionMgr) {
            await connectionMgr.cleanup();
            this.connections.delete(clientId);
          }
        }
      });
    });
  }




  start(port = process.env.PORT || 3002) {
    this.server.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
      console.log('Environment check:');
      console.log('- DEEPGRAM_API_KEY:', process.env.DEEPGRAM_API_KEY ? 'Present' : 'Missing');
      console.log('- GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Present' : 'Missing');
      console.log('- SERPAPI_API_KEY:', process.env.SERPAPI_API_KEY ? 'Present' : 'Missing');
      // --- MONGO DB INTEGRATION ---
            console.log('- MONGO_URI:', process.env.MONGO_URI ? 'Present' : 'Missing');
            
            if (!process.env.MONGO_URI) {
              console.warn("⚠️ MONGO_URI not found in .env file. Debate history will not be saved.");
            } else {
              mongoose.connect(process.env.MONGO_URI)
                  .then(() => console.log("✅ MongoDB connection successful."))
                  .catch(err => console.error("❌ MongoDB connection error:", err));
            }
    });
  }
}

// Initialize and start the application
const app = new VoiceAssistantApp();


/**
 * @route   GET /api/debates
 * @desc    Get all debate sessions (lightweight version for list view)
 * @access  Public
 */

app.start();

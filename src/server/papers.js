import "dotenv/config"; // Must be the first import to load .env variables
import fs from "fs";
import path from "path";

// LangChain Document Loading & Splitting
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// LangChain Embeddings & Vector Store (all local)
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

// LangChain LLM & Prompting (using Mistral)
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

// --- 1. CONFIGURATION ---

const DOCUMENTS_FOLDER = "reference_papers";
const VECTOR_STORE_PATH = "faiss_index";
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"; // Free, local model for embeddings

// API-based LLM configuration (Mistral)
const MISTRAL_MODEL_NAME = "mistral-large-latest"; // Mistral Large model

// Hardcoded chat history and a follow-up question for demonstration
const CHAT_HISTORY = `
Moderator: Let us begin. The motion before the house is: "This house believes that cyber crime rate is increasing in the country at an alarming rate"
Prime Minister: I stand before you today to argue passionately in favor of this motion. Cyber crime may have increased in the country but the governemnt is trying its best to curtail the effect of the same on the youth.
Leader of Opposition: The Prime Minister ignores the dark underbelly. The cyber crime rate is increasing at an alarming rate and the government is not doing enough to curb the same.
`;

const USER_QUESTION = "";

// --- 2. CORE FUNCTIONS ---

/**
 * Creates or loads a FAISS vector store from documents in the DOCUMENTS_FOLDER.
 * This part remains entirely local and free.
 * @returns {Promise<FaissStore>} The initialized vector store.
 */
async function getVectorStore() {
  const embeddings = new HuggingFaceTransformersEmbeddings({ modelName: EMBEDDING_MODEL });

  if (fs.existsSync(VECTOR_STORE_PATH)) {
    console.log("✅ Loading existing vector store from disk...");
    return await FaissStore.load(VECTOR_STORE_PATH, embeddings);
  }

  console.log("⏳ No existing vector store found. Creating a new one...");

  // Ensure document directory exists
  if (!fs.existsSync(DOCUMENTS_FOLDER)) {
    fs.mkdirSync(DOCUMENTS_FOLDER);
    fs.writeFileSync(path.join(DOCUMENTS_FOLDER, "placeholder.txt"), "Add your PDF and TXT files here.");
    console.log(`Created '${DOCUMENTS_FOLDER}' with a placeholder file.`);
  }

  console.log("- Loading documents...");
  const loader = new DirectoryLoader(DOCUMENTS_FOLDER, {
    ".pdf": (path) => new PDFLoader(path, { splitPages: false }),
    ".txt": (path) => new TextLoader(path),
  });
  const docs = await loader.load();

  if (docs.length === 0) {
    throw new Error("No documents found in the `rag_documents` folder. Please add some files.");
  }
  console.log(`- Loaded ${docs.length} document(s).`);

  console.log("- Splitting documents into chunks...");
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
  const chunks = await splitter.splitDocuments(docs);
  console.log(`- Created ${chunks.length} document chunks.`);

  console.log("- Generating embeddings and creating FAISS vector store (this may take a moment)...");
  const vectorStore = await FaissStore.fromDocuments(chunks, embeddings);
  await vectorStore.save(VECTOR_STORE_PATH);
  console.log(`✅ Vector store created and saved to '${VECTOR_STORE_PATH}'.`);

  return vectorStore;
}

/**
 * Creates the full RAG chain that connects the retriever, prompt, and an API-based LLM.
 * @param {FaissStore} vectorStore The vector store to use for retrieval.
 * @returns {Promise<any>} The complete, runnable RAG chain.
 */
async function createRagChain(vectorStore) {
  console.log("🧠 Initializing API-based LLM (Mistral)...");

  // Validate that the API key is available
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not set in the .env file. Please add it.");
  }

  // Use Mistral AI
  const llm = new ChatMistralAI({
    apiKey: process.env.MISTRAL_API_KEY,
    model: MISTRAL_MODEL_NAME,
    temperature: 0.3,
    maxTokens: 1024,
  });

  console.log("🔗 Creating RAG chain...");
  const retriever = vectorStore.asRetriever();

  const prompt = ChatPromptTemplate.fromTemplate(`
You are an expert debate assistant and the deputy leader of the oppostion party. Your task is to reply to the prime minister and support the leader of the opposition on the  based *only* on the provided context and chat history. Be concise, factual, and directly address the question.

**Chat History:**
{chat_history}

**Retrieved Context from Documents:**
<context>
{context}
</context>

**User's Question:**
{input}

**Your Answer:**
`);

  const documentChain = await createStuffDocumentsChain({ llm, prompt });

  return createRetrievalChain({
    retriever,
    combineDocsChain: documentChain,
  });
}

// --- 3. MAIN EXECUTION ---

async function main() {
  try {
    console.log("🚀 Starting the RAG pipeline with API-based LLM...");
    
    // Step 1: Get the vector store (load or create)
    const vectorStore = await getVectorStore();

    // Step 2: Create the RAG chain
    const ragChain = await createRagChain(vectorStore);

    console.log("\n==================================================");
    console.log("❓ Submitting Query to the RAG Chain...");
    console.log("==================================================\n");
    console.log(`CHAT HISTORY:\n---\n${CHAT_HISTORY.trim()}\n---\n`);
    console.log(`USER QUESTION: ${USER_QUESTION}`);

    // Step 3: Invoke the chain with the chat history and user question
    const result = await ragChain.invoke({
      chat_history: CHAT_HISTORY,
      input: USER_QUESTION,
    });
    
    console.log("\n==================================================");
    console.log("✅ RAG Chain Execution Complete!");
    console.log("==================================================\n");

    console.log("📚 Retrieved Context Documents:\n");
    result.context.forEach((doc, i) => {
        console.log(`--- Document ${i+1} (Source: ${path.basename(doc.metadata.source)}) ---`);
        console.log(`${doc.pageContent.substring(0, 200)}...\n`);
    });

         console.log("💡 Final Generated Answer from Mistral API:\n");
    console.log(result.answer);
    console.log("\n🏁 Pipeline finished successfully.");

  } catch (error) {
    console.error("\n❌ An error occurred during the RAG pipeline execution:");
    console.error(error);
  }
}

main();
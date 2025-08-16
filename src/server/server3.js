import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('FATAL ERROR: MONGO_URI is not defined in the .env file.');
  process.exit(1);
}

// MongoDB Atlas Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB Atlas');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Debate Schema - No changes needed here.
const debateSchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true }, // Added index for faster queries on clientId
  debateTopic: { type: String, required: true },
  userRole: { type: String, required: true },
  chatHistory: [{
    speaker: String,
    content: String,
    timestamp: Date
  }],
  adjudicationResult: { type: Object, default: {} },
  uploadedFiles: [{
    filename: String,
    data: Buffer,
    mimetype: String,
  }],
  createdAt: { type: Date, default: Date.now }
});

const Debate = mongoose.model('Debate', debateSchema);

// --- Routes ---

// MODIFICATION: Get all debates from all clients (basic info)
// This new route fetches a summary of all debates.
app.get('/api/debates', async (req, res) => {
  try {
    // Fetches from all documents, but only returns the necessary fields for the list view.
    // We now include 'clientId' so the frontend can display it.
    const debates = await Debate.find(
      {},
      'debateTopic userRole createdAt clientId'
    ).sort({ createdAt: -1 });

    res.json({ success: true, data: debates });
  } catch (error) {
    console.error('Error fetching all debates:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching debates.',
      error: error.message
    });
  }
});

// MODIFICATION: Get complete details of a specific debate by its ID
// This route is now simpler and doesn't require the clientId.
app.get('/api/debates/:debateId', async (req, res) => {
  try {
    const { debateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(debateId)) {
      return res.status(400).json({ success: false, message: 'Invalid debate ID format.' });
    }

    // Find by the unique debate ID (_id)
    const debate = await Debate.findById(debateId);

    if (!debate) {
      return res.status(404).json({ success: false, message: 'Debate not found.' });
    }

    res.json({ success: true, data: debate });
  } catch (error)
  {
    console.error('Error fetching debate details:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching debate details.',
      error: error.message
    });
  }
});


// Create a new debate (for testing)
app.post('/api/debates', async (req, res) => {
  try {
    const newDebate = new Debate(req.body);
    const savedDebate = await newDebate.save();
    res.status(201).json({ success: true, data: savedDebate });
  } catch (error) {
    console.error('Error creating debate:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Validation Error', error: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating the debate.',
      error: error.message
    });
  }
});

const formatDebatesForLLM = (debates) => {
  if (!debates || debates.length === 0) {
    return "No debate history found.";
  }

  return debates.map(debate => {
    const chatHistoryText = debate.chatHistory
      .map(chat => `${chat.speaker}: ${chat.content}`)
      .join('\n');

    const adjudicationText = debate.adjudicationResult && Object.keys(debate.adjudicationResult).length > 0
      ? `Adjudication Result:\n${JSON.stringify(debate.adjudicationResult, null, 2)}`
      : 'No adjudication result available.';

    return `
--- DEBATE START ---
Debate Topic: ${debate.debateTopic}
Your Role: ${debate.userRole}
Client ID: ${debate.clientId}
Date: ${new Date(debate.createdAt).toDateString()}

Chat History:
${chatHistoryText}

${adjudicationText}
--- DEBATE END ---
    `.trim();
  }).join('\n\n');
};


// New RAG Chat Endpoint - Now can query across all clients if needed.
app.post('/api/chat/rag', async (req, res) => {
  const { question, clientId } = req.body; // Can optionally filter by clientId here

  if (!question) {
    return res.status(400).json({ success: false, message: 'Question is required.' });
  }

  try {
    // RETRIEVAL: Fetch debates. If a clientId is provided, filter by it. Otherwise, fetch all.
    const query = clientId ? { clientId } : {};
    const debates = await Debate.find(query).sort({ createdAt: -1 });

    if (debates.length === 0) {
      return res.json({
        success: true,
        reply: "I couldn't find any debate history. Once you complete a debate, you can ask me questions about it."
      });
    }

    // AUGMENTATION & GENERATION
    const context = formatDebatesForLLM(debates);
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama3-8b-8192", // Using a recommended fast model
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are an expert assistant who analyzes a user's debate history. Answer the user's question based ONLY on the context provided below. If the information is not in the context, explicitly state that you cannot answer based on their history. Be concise and helpful.\n\nCONTEXT:\n{context}"],
      ["human", "{question}"],
    ]);

    const chain = prompt.pipe(model);
    const result = await chain.invoke({
      context: context,
      question: question,
    });
    
    res.json({ success: true, reply: result.content });

  } catch (error) {
    console.error('RAG chat error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request.'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
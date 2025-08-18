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

// Debate Schema
const debateSchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true },
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

// Get all debates from all clients (basic info)
app.get('/api/debates', async (req, res) => {
  try {
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

// Get complete details of a specific debate by its ID
app.get('/api/debates/:debateId', async (req, res) => {
  try {
    const { debateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(debateId)) {
      return res.status(400).json({ success: false, message: 'Invalid debate ID format.' });
    }

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

const formatDebateForLLM = (debate) => {
  const limitedChatHistory = debate.chatHistory.slice(-10);
  const chatHistoryText = limitedChatHistory
    .map(chat => `${chat.speaker}: ${chat.content}`)
    .join('\n');

  const adjudicationText = debate.adjudicationResult && Object.keys(debate.adjudicationResult).length > 0
    ? `Adjudication Result:\n${JSON.stringify(debate.adjudicationResult, null, 2)}`
    : 'No adjudication result available.';

  return `
  --- DEBATE START ---
Debate Topic: ${debate.debateTopic}
Your Role: ${debate.userRole}
Date: ${new Date(debate.createdAt).toDateString()}

Chat History:
${chatHistoryText}

${adjudicationText}
--- DEBATE END ---
  `.trim();
};

const formatDebatesForLLM = (debates, questionHistory, currentQuestion) => {
  // Format question history
  const questionHistoryText = questionHistory && questionHistory.length > 0
    ? `Recent Questions (most recent last):\n${questionHistory
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}`
    : 'No previous questions available.';

  // Check if the current question is a follow-up referring to the most recent debate
  let context = '';
  if (currentQuestion.toLowerCase().includes('that particular debate') && questionHistory.length > 0) {
    const lastQuestion = questionHistory[questionHistory.length - 1].toLowerCase();
    if (lastQuestion.includes('last debate') || lastQuestion.includes('most recent debate')) {
      // Assume the first debate is the most recent (sorted by createdAt)
      if (debates.length > 0) {
        context = `**Relevant Debate (from most recent question)**:\n${formatDebateForLLM(debates[0])}`;
      } else {
        context = 'No debate history found for the most recent question.';
      }
    } else {
      // Try to match the last question to a debate topic
      const matchedDebate = debates.find(debate => 
        lastQuestion.includes(debate.debateTopic.toLowerCase())
      );
      if (matchedDebate) {
        context = `**Relevant Debate (from most recent question)**:\n${formatDebateForLLM(matchedDebate)}`;
      } else {
        context = 'Could not identify the specific debate referred to in the most recent question.';
      }
    }
  } else {
    // Include all debates for non-follow-up questions
    if (!debates || debates.length === 0) {
      context = 'No debate history found.';
    } else {
      context = debates.map(debate => `--- DEBATE START ---\n${formatDebateForLLM(debate)}\n--- DEBATE END ---`).join('\n\n');
    }
  }

  return `${questionHistoryText}\n\n${context}`;
};

// RAG Chat Endpoint
app.post('/api/chat/rag', async (req, res) => {
  const { question, clientId, questionHistory = [] } = req.body;

  if (!question) {
    return res.status(400).json({ success: false, message: 'Question is required.' });
  }

  try {
    const query = clientId ? { clientId } : {};
    const debates = await Debate.find(query).sort({ createdAt: -1 }).limit(7);

    if (debates.length === 0 && questionHistory.length === 0) {
      return res.json({
        success: true,
        reply: "I couldn't find any debate history or previous questions. Once you complete a debate or ask more questions, I can provide more context."
      });
    }

    const context = formatDebatesForLLM(debates, questionHistory, question);
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama3-8b-8192",
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are an expert assistant who analyzes a user's debate history and recent questions. Answer the user's question based ONLY on the context provided below. If the question contains phrases like "that particular debate" or refers to a specific debate from the most recent question, focus EXCLUSIVELY on that debate and provide a precise answer (e.g., only the role for that debate). For other questions, use the full context of recent questions and debate history. If the information is not in the context, explicitly state that you cannot answer based on the provided history. Be concise, accurate, and avoid listing unnecessary details.

CONTEXT:
{context}`],
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
      message: 'An error occurred while processing your request.',
      error: error.message
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
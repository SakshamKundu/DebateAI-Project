# AI-Powered Parliamentary Debate Simulator  
**Practice debate anytime, anywhere—with AI opponents and adjudicators.**

---

## 🚀 Features

- **Realistic AI Opponents**: Debate against LLM-powered speakers in **British** or **Asian Parliamentary** formats.  
- **Adjudicator Feedback**: Get scored on **argument quality, structure, and delivery**.  
- **Points of Information (POIs)**: Interrupt opponents mid-speech, just like real debates.  
- **Live Speech-to-Text**: Powered by **Deepgram** for real-time transcription.  
- **Role-Based Turn Management**: Accurate simulation of speaker order for each format.  

---

## ⚙️ Tech Stack

- **Frontend**: React + Vite + WebSockets  
- **Backend**: Node.js (Express)  
- **APIs**:  
  - **Groq**: LLM responses for debaters/judge  
  - **Deepgram**: Speech-to-text and TTS  
  - **SerpAPI (Optional)**: Fact-checking for expert mode  

---

## 🛠️ Setup

### 1. Clone the Repository

```bash
git clone https://github.com/SakshamKundu/DebateAI-Project.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables  
Create a `.env` file in the root directory:

```env
# EmailJS (optional)
VITE_APP_EMAILJS_SERVICE_ID=""
VITE_APP_EMAILJS_TEMPLATE_ID=""
VITE_APP_EMAILJS_PUBLIC_KEY=""

# Required APIs
GROQ_API_KEY="your-groq-key"
DEEPGRAM_API_KEY="your-deepgram-key"
SERPAPI_API_KEY="your-serpapi-key"  # Optional for expert mode
```

### 4. Run the System

**Frontend (Dev Mode):**

```bash
npm run dev
```

**Backend Servers:**

```bash
# Asian Parliamentary
node ./src/server/server.js

# British Parliamentary
node ./src/server/server2.js
```

---

## 📂 Project Structure

```
.
├── src/
│   ├── server/          # Backend logic (server.js = Asian, server2.js = British)
│   ├── components/      # React UI components
│   ├── sections/        # Landing page sections
│   └── ...
├── public/              # Static assets
└── vite.config.js       # Frontend build config
```

---

## 🌟 Future Improvements

- Add more debate formats (e.g., **World Schools**)  
- Implement multiplayer mode with **human opponents**  
- Enhance adjudicator feedback with **visual analytics**  

---

## 🐛 Report Bugs

Feel free to open an issue in the [Issues](https://github.com/SakshamKundu/DebateAI-Project/issues) section.

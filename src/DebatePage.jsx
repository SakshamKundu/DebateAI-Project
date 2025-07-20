import React, { useState, useEffect, useRef } from "react";
import { Mic, MessageSquare, LogOut, Gavel, X } from "lucide-react";
import { FeedbackModal } from "./components/FeedbackModal";

// --- Mock FeedbackModal for standalone functionality ---

// --- Helper Components (Self-contained & Themed) ---

const ParticipantBox = ({ name, role, isSpeaking, statusText, isUser }) => (
  <div
    className={`relative flex flex-col items-center justify-center p-4 rounded-xl bg-gray-900 border border-gray-800/80 shadow-sm shadow-white-50/80 transition-all duration-300 min-h-[160px] ${
      isSpeaking ? "ring-4 ring-white-50" : "ring-1 ring-black-50"
    }`}
  >
    {/* Agent's identity is always visible */}
    <div className="text-center z-10">
      <h3
        className={`text-xl md:text-2xl font-bold ${
          isUser ? "text-green-500" : "text-white"
        }`}
      >
        {name}
      </h3>
      <p className="text-sm text-white-50">{role}</p>
    </div>

    {/* Status overlay that doesn't hide the name */}
    {statusText && (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-black-100/70 backdrop-blur-sm rounded-xl z-20 ${
          statusText === "Your Turn" ? "ring-4 ring-green-500" : ""
        }`}
      >
        <p className="text-lg font-semibold text-white animate-pulse">
          {statusText}
        </p>
      </div>
    )}
  </div>
);

const LeaveConfirmationModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-black-100 border border-black-50 w-full max-w-md p-6 rounded-lg shadow-xl text-white">
      <h2 className="text-2xl font-bold mb-4">Leave Debate?</h2>
      <p className="text-white-50 mb-6">
        Are you sure you want to end the session? Your debate progress will be
        lost.
      </p>
      <div className="flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 rounded-lg bg-black-200 hover:bg-black-50 text-white font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
        >
          Confirm Leave
        </button>
      </div>
    </div>
  </div>
);

const CaptionDisplay = ({ text }) => {
  if (!text) return null;
  return (
    <div className="text-center text-xl md:text-2xl font-semibold text-white bg-black-100/50 border border-black-50 p-3 rounded-md shadow-lg">
      {text}
    </div>
  );
};

// --- MODIFICATION: Define participant lists for both formats ---
const ASIAN_DEBATE_PARTICIPANTS = {
  Moderator: "Parliamentary Debate Moderator",
  "Prime Minister": "Government Leader",
  "Leader of Opposition": "Opposition Leader",
  "Deputy Prime Minister": "Government Deputy",
  "Deputy Leader of Opposition": "Opposition Deputy",
  "Government Whip": "Government Whip",
  "Opposition Whip": "Opposition Whip",
};

const BRITISH_DEBATE_PARTICIPANTS = {
  Moderator: "Parliamentary Debate Moderator",
  "Prime Minister": "Opening Government",
  "Leader of Opposition": "Opening Opposition",
  "Deputy Prime Minister": "Opening Government",
  "Deputy Leader of Opposition": "Opening Opposition",
  "Member for the Government": "Closing Government",
  "Member for the Opposition": "Closing Opposition",
  "Government Whip": "Closing Government",
  "Opposition Whip": "Closing Opposition",
};

// --- SINGLE, UNIFIED DEBATE PAGE COMPONENT ---
const DebatePage = () => {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState("role_selection");
  const [userRole, setUserRole] = useState("");
  const [debateTopic, setDebateTopic] = useState(
    "Is social media beneficial for society?"
  );
  const [debateLevel, setDebateLevel] = useState("beginner");
  // MODIFICATION: Renamed to parliamentType for clarity as requested
  const [parliamentType, setParliamentType] = useState("asian");

  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isMicWarmingUp, setIsMicWarmingUp] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState("");
  const [thinkingAgent, setThinkingAgent] = useState("");
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [caption, setCaption] = useState("");
  const [feedbackData, setFeedbackData] = useState(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [isLeaveModalVisible, setIsLeaveModalVisible] = useState(false);

  // --- REFS ---
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const transcriptRef = useRef("");
  const captionTimerRef = useRef(null);
  const clientIdRef = useRef(
    Date.now().toString() + Math.random().toString(36).substr(2, 9)
  );

  // --- MODIFICATION: Dynamically select participants based on parliamentType ---
  const DEBATE_PARTICIPANTS =
    parliamentType === "british"
      ? BRITISH_DEBATE_PARTICIPANTS
      : ASIAN_DEBATE_PARTICIPANTS;

  // --- CORE FUNCTIONS ---

  const stopCurrentAudio = () => {
    if (captionTimerRef.current) {
      clearInterval(captionTimerRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  const handleLeaveDebate = () => {
    setIsLeaveModalVisible(true);
  };

  const executeLeave = () => {
    stopCurrentAudio();
    if (socketRef.current) {
      socketRef.current.close();
    }
    window.location.href = "/";
  };

  const playAndCaptionAudio = (sessionId, fullText, assistantName) => {
    if (!audioRef.current || !fullText) {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "tts_playback_complete",
            sessionId,
            assistant: assistantName,
          })
        );
      }
      return;
    }

    // MODIFICATION: Use absolute URL to fetch from correct server port
    // This requires the server to have CORS enabled for the frontend's origin.
    const port = parliamentType === "british" ? "3002" : "3001";
    const host = window.location.hostname;
    const audioUrl = `http://${host}:${port}/api/tts-audio/${sessionId}`;

    audioRef.current.src = audioUrl;

    const words = fullText.split(/\s+/);

    audioRef.current.onloadedmetadata = () => {
      const duration = audioRef.current.duration;
      if (!isFinite(duration) || duration === 0 || words.length === 0) {
        setCaption(fullText);
        return;
      }

      const timePerWord = (duration * 1000) / words.length;
      let wordIndex = 0;

      if (captionTimerRef.current) clearInterval(captionTimerRef.current);

      captionTimerRef.current = setInterval(() => {
        if (wordIndex >= words.length) {
          clearInterval(captionTimerRef.current);
          return;
        }
        const phraseSize = 10;
        const start = Math.floor(wordIndex / phraseSize) * phraseSize;
        const end = start + phraseSize;
        setCaption(words.slice(start, end).join(" "));
        wordIndex++;
      }, timePerWord);
    };

    audioRef.current.onended = () => {
      stopCurrentAudio();
      setActiveSpeaker("");
      setCaption("");
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "tts_playback_complete",
            sessionId,
            assistant: assistantName,
          })
        );
      }
    };

    audioRef.current.play().catch((e) => {
      console.error("Audio playback error:", e);
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "tts_playback_complete",
            sessionId,
            assistant: assistantName,
          })
        );
      }
    });
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case "stt_ready":
        if (mediaRecorderRef.current?.state === "inactive") {
          mediaRecorderRef.current.start(250);
          setIsRecording(true);
          setIsMicWarmingUp(false);
          setCaption("Microphone is live. You may begin speaking.");
        }
        break;

      case "agent_thinking":
        setThinkingAgent(data.assistant);
        setActiveSpeaker("");
        setIsUserTurn(false);
        break;

      case "user_turn":
        setThinkingAgent("");
        setActiveSpeaker("");
        setIsUserTurn(true);
        break;

      case "start_immediate_playback":
        stopCurrentAudio();
        setThinkingAgent("");
        setActiveSpeaker(data.assistant);
        setMessages((prev) => [
          ...prev,
          {
            type: "ai",
            content: data.response,
            speaker: data.assistant,
            timestamp: new Date().toISOString(),
          },
        ]);
        playAndCaptionAudio(data.sessionId, data.response, data.assistant);
        break;

      case "transcript":
        const liveText = data.data.channel?.alternatives?.[0]?.transcript || "";
        const isFinal = data.data.is_final;
        setCaption(transcriptRef.current + " " + liveText);
        if (isFinal && liveText.trim()) {
          transcriptRef.current += " " + liveText.trim();
        }
        break;

      case "user_speech_final":
        setMessages((prev) => [
          ...prev,
          {
            type: "user",
            content: data.transcript,
            speaker: data.speaker,
            timestamp: new Date().toISOString(),
          },
        ]);
        setCaption("");
        break;

      case "debate_end":
        setCaption("The debate has concluded. You may now request feedback.");
        setIsUserTurn(false);
        setThinkingAgent("");
        setActiveSpeaker("");
        break;
    }
  };

  const handleGetFeedback = async () => {
    setIsFeedbackLoading(true);
    setFeedbackData(null);
    try {
      // MODIFICATION: Use absolute URL to fetch from correct server port
      const port = parliamentType === "british" ? "3002" : "3001";
      const host = window.location.hostname;
      const apiUrl = `http://${host}:${port}/api/get-feedback`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientIdRef.current }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedbackData(data);
      } else {
        throw new Error(data.error || "Failed to get feedback.");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const startRecording = async () => {
    if (isRecording || isMicWarmingUp) return;

    setIsMicWarmingUp(true);
    setCaption("Connecting microphone, please wait...");
    stopCurrentAudio();
    transcriptRef.current = "";
    setActiveSpeaker(userRole);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          socketRef.current?.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(event.data);
        }
      };
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: "user_start_recording" })
        );
      } else {
        setCaption("Connection error. Please refresh.");
        setIsMicWarmingUp(false);
      }
    } catch (error) {
      setCaption("Could not access microphone. Please check permissions.");
      setActiveSpeaker("");
      setIsMicWarmingUp(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "user_stop_recording" }));
      }
    }
    mediaRecorderRef.current?.stream
      .getTracks()
      .forEach((track) => track.stop());
    setIsRecording(false);
    setIsMicWarmingUp(false);
    setActiveSpeaker("");
    setIsUserTurn(false);
    setCaption("");
  };

  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleRoleSubmit = (e) => {
    e.preventDefault();
    if (!userRole) {
      alert("Please select a role");
      return;
    }
    if (audioRef.current) {
      audioRef.current.muted = true;
      audioRef.current.play().catch(() => {});
      audioRef.current.muted = false;
    }
    setView("debate");
  };

  useEffect(() => {
    if (view === "debate") {
      // MODIFICATION: Logic to connect to the correct WebSocket port
      const port = parliamentType === "british" ? "3002" : "3001";
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.hostname;
      const wsUrl = `${wsProtocol}//${wsHost}:${port}`;

      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "user_role_selected",
            role: userRole,
            topic: debateTopic,
            level: debateLevel,
            clientId: clientIdRef.current,
          })
        );
      };
      ws.onmessage = (event) => {
        try {
          handleWebSocketMessage(JSON.parse(event.data));
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };
      ws.onclose = () =>
        console.log(`WebSocket disconnected from port ${port}.`);
      ws.onerror = (err) =>
        console.error(`WebSocket error on port ${port}:`, err);
      socketRef.current = ws;
    }
    return () => {
      if (socketRef.current) socketRef.current.close();
      stopCurrentAudio();
    };
  }, [view, userRole, parliamentType, debateTopic, debateLevel]); // Added dependencies

  useEffect(() => {
    if (view !== "debate") return;

    const handleKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat && !isRecording && !isMicWarmingUp) {
        e.preventDefault();
        startRecording();
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space" && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, isMicWarmingUp, view]);

  // --- RENDER LOGIC ---

  if (view === "role_selection") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white p-4">
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              🏛️ Parliamentary Debate
            </h1>
            <p className="text-xl text-white-50 font-medium">
              Sharpen your wit, master your argument.
            </p>
          </div>
          <div className="border rounded-xl border-black-50 bg-black-100 p-8 md:p-12">
            <h2 className="text-3xl font-semibold mb-8 text-center">
              Configure Your Debate
            </h2>
            <form onSubmit={handleRoleSubmit} className="space-y-6">
              <div>
                <label className="block text-lg font-medium mb-2 text-white">
                  Parliament Type
                </label>
                <select
                  value={parliamentType}
                  onChange={(e) => {
                    setParliamentType(e.target.value);
                    setUserRole(""); // MODIFICATION: Reset role when type changes
                  }}
                  required
                  className="w-full p-4 rounded-lg bg-black-200 text-white text-lg focus:ring-2 focus:ring-white-50 outline-none"
                >
                  <option value="asian">
                    Asian Parliamentary (7 Speakers)
                  </option>
                  <option value="british">
                    British Parliamentary (9 Speakers)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-lg font-medium mb-2 text-white">
                  The Motion for Debate
                </label>
                <input
                  type="text"
                  value={debateTopic}
                  onChange={(e) => setDebateTopic(e.target.value)}
                  required
                  className="w-full p-4 rounded-lg bg-black-200 text-white text-lg focus:ring-2 focus:ring-white-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-lg font-medium mb-2 text-white">
                  Your Debating Level
                </label>
                <select
                  value={debateLevel}
                  onChange={(e) => setDebateLevel(e.target.value)}
                  required
                  className="w-full p-4 bg-black-200 rounded-lg text-white text-lg focus:ring-2 focus:ring-white-50 outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <div>
                <label className="block text-lg font-medium mb-2 text-white">
                  Parliamentary Position
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  required
                  className="w-full p-4 rounded-lg bg-black-200 text-white text-lg focus:ring-2 focus:ring-white-50 outline-none"
                >
                  <option value="">-- Select Your Role --</option>
                  {/* MODIFICATION: Dynamically generate roles */}
                  {Object.keys(DEBATE_PARTICIPANTS)
                    .filter((name) => name !== "Moderator") // User cannot be the moderator
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-white-50 text-black font-semibold py-4 px-8 rounded-lg text-lg transition-colors hover:cursor-pointer hover:bg-black-200 hover:text-white-50"
              >
                Start Debate Session
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const otherParticipants = Object.entries(DEBATE_PARTICIPANTS).filter(
    ([name]) => name !== userRole
  );

  // Helper: Determine if a participant is the active speaker
  const isAgentSpeaking = (name) => activeSpeaker === name;
  // Helper: Determine if a participant is thinking
  const isAgentThinking = (name) => thinkingAgent === name;

  const getMicButtonTitle = () => {
    if (isMicWarmingUp) return "Connecting mic...";
    if (isRecording) return "Click to mute microphone";
    return "Click to speak (or hold Space)";
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <audio ref={audioRef} autoPlay style={{ display: "none" }} />

      <header className="w-full p-6 text-center">
        <h1 className="text-2xl font-bold">
          {parliamentType === "british" ? "British" : "Asian"} Parliamentary
          Debate
        </h1>
        <p className="text-white-50">Today's Motion: "{debateTopic}"</p>
      </header>

      <main className="flex-grow w-full max-w-screen-2xl mx-auto px-4 md:px-8">
        {/* MODIFICATION: Adjusted grid for up to 9 participants */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          <ParticipantBox
            name={userRole}
            role="You"
            isSpeaking={activeSpeaker === userRole}
            statusText={isUserTurn ? "Your Turn" : null}
            isUser
          />
          {otherParticipants.map(([name, role]) => (
            <ParticipantBox
              key={name}
              name={name}
              role={role}
              isSpeaking={isAgentSpeaking(name)}
              statusText={isAgentThinking(name) ? "Thinking..." : null}
            />
          ))}
        </div>
      </main>

      <div className="fixed bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 flex items-center justify-center pointer-events-none z-30">
        <CaptionDisplay text={caption} />
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
        <p className="text-sm mb-2 text-white-50">
          Hold{" "}
          <kbd className="px-2 py-1.5 text-xs font-semibold text-black bg-white-50 border border-black-50 rounded-lg">
            Space
          </kbd>{" "}
          or Click Mic to Speak
        </p>
        <div className="flex items-center justify-center gap-3 md:gap-4 bg-gray-800 backdrop-blur-md p-3 px-6 rounded-full shadow-sm shadow-white-50/40 border border-black-50">
          <button
            onClick={() => setIsChatVisible(!isChatVisible)}
            className="p-3 rounded-full bg-black-100/40 hover:bg-gray-700 shadow-white-50/50 shadow-xs text-white"
            title={isChatVisible ? "Hide Chat History" : "Show Chat History"}
          >
            <MessageSquare size={24} />
          </button>

          <button
            onClick={handleMicToggle}
            className={`p-5 rounded-full text-white shadow-white-50/50 shadow-xs transition-all duration-300 transform ${
              isRecording
                ? "bg-red-500 scale-110 animate-pulse"
                : isMicWarmingUp
                ? "bg-yellow-500 scale-105"
                : "bg-black-100/40 hover:bg-gray-700"
            }`}
            title={getMicButtonTitle()}
            disabled={!isUserTurn} // It's good practice to disable the mic when it's not the user's turn
          >
            <Mic size={32} />
          </button>

          <button
            onClick={handleGetFeedback}
            disabled={isFeedbackLoading}
            className="p-3 rounded-full bg-black-100/40 hover:bg-gray-700 text-white shadow-white-50/50 shadow-xs disabled:bg-black-50"
            title="Get Adjudication & Feedback"
          >
            <Gavel size={24} />
          </button>

          <button
            onClick={handleLeaveDebate}
            className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white"
            title="End Debate Session"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {isFeedbackLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <p className="text-2xl text-white animate-pulse">
            The Adjudicator is deliberating...
          </p>
        </div>
      )}

      {feedbackData && (
        <FeedbackModal
          feedbackData={feedbackData}
          userRole={userRole}
          onClose={() => setFeedbackData(null)}
        />
      )}

      {isLeaveModalVisible && (
        <LeaveConfirmationModal
          onConfirm={executeLeave}
          onCancel={() => setIsLeaveModalVisible(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-black-100/20 backdrop-blur-lg border-l border-black-50 p-6 transform transition-transform duration-500 ease-in-out z-40 ${
          isChatVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Parliamentary Session
          </h2>
          <button
            onClick={() => setIsChatVisible(false)}
            className="text-white-50 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        <div className="h-full overflow-y-auto pb-40 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                msg.type === "ai" ? "bg-black-200" : "bg-green-900"
              }`}
            >
              <div className="font-semibold mb-1 text-white">{msg.speaker}</div>
              <div className="text-white-50 text-sm leading-relaxed">
                {msg.content}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-white-50 text-center mt-8">
              Chat history will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebatePage;

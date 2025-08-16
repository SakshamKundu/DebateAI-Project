import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Plus,
  Mic,
  MessageSquare,
  LogOut,
  Gavel,
  X,
} from "lucide-react";
import { FeedbackModal } from "./components/FeedbackModal";
import "./placeholderAnimation.css";

// --- Mock FeedbackModal for standalone functionality ---

// --- Helper Components (Self-contained & Themed) ---

// --- NEW HELPER COMPONENT for displaying selected files ---
const FileListDisplay = ({ files, onRemoveFile }) => {
  if (files.length === 0) {
    return (
      <p className="text-center text-sm text-gray-500 py-2 px-4 border-2 border-dashed border-gray-700 rounded-lg">
        Upload optional reference papers (.pdf, .txt) for the AI debaters.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-32 overflow-y-auto p-2 border border-gray-700 rounded-lg">
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between bg-gray-800 p-2 rounded"
        >
          <span className="text-sm text-gray-300 truncate" title={file.name}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => onRemoveFile(index)}
            className="text-red-500 hover:text-red-400 ml-2"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

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

const topics = [
  "Is social media beneficial for society?",
  "Should homework be banned in schools?",
  "Is climate change the greatest threat to humanity?",
  "Should AI be regulated by governments?",
  "Is space exploration worth the cost?",
  "Should college education be free?",
  "Is censorship ever justified?",
  "Should animals be used for scientific research?",
  "Does technology make us more alone?",
  "Is democracy the best form of government?",
  "Should voting be mandatory?",
  "Is online privacy a basic human right?",
];

// --- SINGLE, UNIFIED DEBATE PAGE COMPONENT ---
const DebatePage = () => {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState("role_selection");
  const [userRole, setUserRole] = useState("");
  const [debateTopic, setDebateTopic] = useState("");
  const [debateLevel, setDebateLevel] = useState("beginner");
  const [parliamentType, setParliamentType] = useState("asian");

  // --- NEW STATES FOR FILE UPLOAD ---
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

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
  const [isDragOver, setIsDragOver] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [placeholder, setPlaceholder] = useState(topics[0]);
  const [fadeClass, setFadeClass] = useState("fade-in");
  const [inputValue, setInputValue] = useState("");
  const [topicError, setTopicError] = useState(false);

  // --- REFS ---
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const transcriptRef = useRef("");
  const captionTimerRef = useRef(null);
  const clientIdRef = useRef(
    Date.now().toString() + Math.random().toString(36).substr(2, 9)
  );

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

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    let hasError = false;
    if (!inputValue.trim()) {
      setTopicError(true);
      hasError = true;
    }
    if (!userRole) {
      setRoleError(true);
      hasError = true;
    }

    if(hasError) return;
    setTopicError(false);
    setRoleError(false);

    setIsUploading(true);

    if (files.length > 0) {
      const formData = new FormData();
      formData.append("clientId", clientIdRef.current);
      files.forEach((file) => {
        formData.append("papers", file); // 'papers' must match the field name in multer
      });

      try {
        const port = parliamentType === "british" ? "3002" : "3001";
        const host = window.location.hostname;
        const uploadUrl = `http://${host}:${port}/api/upload-papers`;

        const response = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "File upload failed.");
        }
        console.log("Files uploaded successfully.");
      } catch (error) {
        console.error("Upload error:", error);
        alert(`Error uploading files: ${error.message}`);
        setIsUploading(false);
        return; // Stop if upload fails
      }
    }

    setIsUploading(false);

    // This part runs only after successful (or no) upload
    if (audioRef.current) {
      audioRef.current.muted = true;
      audioRef.current.play().catch(() => {});
      audioRef.current.muted = false;
    }
    setView("debate");
  };

  useEffect(() => {
    if (view === "debate") {
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
  }, [view, userRole, parliamentType, debateTopic, debateLevel]);

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

  useEffect(() => {
    if (inputValue) return; // stop changing placeholder if user typed
    const interval = setInterval(() => {
      setFadeClass("fade-out");
      setTimeout(() => {
        let next;
        do {
          next = topics[Math.floor(Math.random() * topics.length)];
        } while (next === placeholder);

        setPlaceholder(next);
        setFadeClass("fade-in");
      }, 300); // matches fade-out duration
    }, 3200);

    return () => clearInterval(interval);
  }, [placeholder, inputValue]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(
      (file) => file.type === "application/pdf" || file.type === "text/plain"
    );
    setFiles((prev) => [...prev, ...validFiles]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // --- RENDER LOGIC ---

  if (view === "role_selection") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white p-4">
        <div className="w-full max-w-2xl mx-auto">
          {/* Animated Header */}
          <div
            className="text-center mb-12 opacity-0"
            style={{
              animation: "fadeIn 0.8s ease-out forwards",
            }}
          >
            <div className="relative inline-block">
              <h1
                className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white-50 via-fuchsia-100 to-white-50 bg-clip-text text-transparent"
                style={{
                  animation: "pulseSubtle 4s ease-in-out infinite",
                }}
              >
                🏛️ Parliamentary Debate
              </h1>
              {/* Subtle glow effect */}
              <div
                className="absolute inset-0 text-7xl text-white-50 md:text-6xl font-bold opacity-20 blur-sm pointer-events-none"
                style={{
                  animation: "glow 3s ease-in-out infinite",
                }}
              >
                🏛️ Parliamentary Debate
              </div>
            </div>
            <p
              className="text-xl text-white-50 font-medium opacity-0"
              style={{
                animation: "slideUpDelay 0.8s ease-out 0.3s forwards",
              }}
            >
              Sharpen your wit, master your argument.
            </p>
          </div>

          {/* Main Form Container */}
          <div
            className="border rounded-xl border-gray-800/80 bg-gradient-to-b from-white-50/15 to-black p-8 md:p-12 backdrop-blur-sm shadow-2xl transform transition-all duration-300 opacity-0"
            style={{
              animation: "slideUp 0.8s ease-out forwards",
            }}
          >
            <h2 className="text-3xl font-semibold mb-7 text-center bg-gradient-to-r from-white-50 to-blue-300 bg-clip-text text-transparent">
              Configure Your Debate
            </h2>

            <div className="space-y-8">
              {/* Parliament Type */}
              <div
                className="group opacity-0"
                style={{
                  animation: "fadeInStagger 0.6s ease-out 0.1s forwards",
                }}
              >
                <label className="block text-lg font-medium mb-2 text-white group-hover:text-gray-300 transition-colors">
                  Parliament Type
                </label>
                <div className="relative">
                  <select
                    value={parliamentType}
                    onChange={(e) => {
                      setParliamentType(e.target.value);
                      setUserRole("");
                    }}
                    required
                    className="w-full p-3.5 rounded-xl bg-gray-900 border-gray-800/80 shadow-2xs shadow-white-50/80 focus:ring-2 focus:ring-gray-600 outline-none border transition-all duration-200 hover:shadow-xs"
                  >
                    <option value="asian">
                      Asian Parliamentary (7 Speakers)
                    </option>
                    <option value="british">
                      British Parliamentary (9 Speakers)
                    </option>
                  </select>
                </div>
              </div>

              {/* Debate Topic */}
              <div
                className="group opacity-0 relative"
                style={{
                  animation: "fadeInStagger 0.6s ease-out 0.3s forwards",
                }}
              >
                <label className="block text-lg font-medium mb-2 text-white group-hover:text-gray-300 transition-colors">
                  The Motion for Debate
                </label>

                {/* Input box */}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (topicError) setTopicError(false); // remove error as user types
                  }}
                  className={`w-full p-3.5 rounded-xl bg-gray-900 shadow-2xs focus:ring-2 outline-none border transition-all duration-200 hover:shadow-xs text-white ${
                    topicError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-800/80 focus:ring-gray-600 shadow-white-50/80"
                  }`}
                />

                {/* Fake placeholder */}
                {!inputValue && (
                  <span
                    className={`absolute left-4 -translate-y-1/2 text-gray-500 pointer-events-none ${fadeClass} ${ topicError ? "top-[55%]" : "top-[68%]"}`}
                  >
                    {placeholder}
                  </span>
                )}
                {topicError && (
                  <p className="mt-1 text-sm text-red-500">
                    Please enter a debate topic
                  </p>
                )}
              </div>

              {/* Debate Level */}
              <div
                className="group opacity-0"
                style={{
                  animation: "fadeInStagger 0.6s ease-out 0.3s forwards",
                }}
              >
                <label className="block text-lg font-medium mb-2 text-white group-hover:text-gray-300 transition-colors">
                  Your Debating Level
                </label>
                <select
                  value={debateLevel}
                  onChange={(e) => setDebateLevel(e.target.value)}
                  required
                  className="w-full p-3.5 rounded-xl bg-gray-900 border-gray-800/80 shadow-2xs shadow-white-50/80 focus:ring-2 focus:ring-gray-600 outline-none border transition-all duration-200 hover:shadow-xs"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              {/* Parliamentary Position */}
              <div
                className="group opacity-0"
                style={{
                  animation: "fadeInStagger 0.6s ease-out 0.4s forwards",
                }}
              >
                <label className="block text-lg font-medium mb-2 text-white group-hover:text-gray-300 transition-colors">
                  Parliamentary Position
                </label>
                <select
                  value={userRole}
                  onChange={(e) => {
                    setUserRole(e.target.value);
                    setRoleError(false); // Clear error once selected
                  }}
                  required
                  className={`w-full p-3.5 rounded-xl bg-gray-900 shadow-2xs focus:ring-2 outline-none border transition-all duration-200 hover:shadow-xs ${
                    roleError
                      ? "border-red-500 focus:ring-red-500 shadow-red-700/70"
                      : "border-gray-800/80 focus:ring-gray-600 shadow-white-50/80"
                  }`}
                >
                  <option value="">-- Select Your Role --</option>
                  {Object.keys(DEBATE_PARTICIPANTS)
                    .filter((name) => name !== "Moderator")
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
                {roleError && (
                  <p className="mt-1 text-sm text-red-500">
                    Please select your role
                  </p>
                )}
              </div>

              {/* Enhanced File Upload Section */}
              <div
                className="group opacity-0"
                style={{
                  animation: "fadeInStagger 0.6s ease-out 0.5s forwards",
                }}
              >
                <label className="block text-lg font-medium mb-3 text-white group-hover:text-gray-300 transition-colors">
                  Reference Papers (Optional)
                </label>
                <div className="space-y-4">
                  <FileListDisplay
                    files={files}
                    onRemoveFile={handleRemoveFile}
                  />

                  {/* Drag and Drop Zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`relative border-2 border-dashed rounded-lg p-8 transition-all duration-300 cursor-pointer group-hover:border-gray-500 ${
                      isDragOver
                        ? "border-blue-400 bg-blue-400/10"
                        : "border-gray-600 hover:border-gray-500 hover:bg-gray-800/50"
                    }`}
                  >
                    {/* File input takes full space and is clickable */}
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    <div className="text-center pointer-events-none">
                      <div
                        className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-all duration-300 ${
                          isDragOver
                            ? "bg-blue-400/20 text-blue-400"
                            : "bg-gray-700 text-gray-400 group-hover:bg-gray-600"
                        }`}
                      >
                        <Upload className="w-8 h-8" />
                      </div>

                      <div
                        className={`transition-colors duration-300 ${
                          isDragOver ? "text-blue-400" : "text-gray-300"
                        }`}
                      >
                        <p className="text-lg font-semibold mb-2">
                          {isDragOver
                            ? "Drop your files here"
                            : "Upload Reference Papers"}
                        </p>
                        <p className="text-sm text-gray-500">
                          Drag & drop or click to select • PDF, TXT files only
                        </p>
                      </div>
                    </div>

                    {/* Animated border effect */}
                    <div
                      className={`absolute inset-0 rounded-lg transition-all duration-300 pointer-events-none ${
                        isDragOver ? "ring-2 ring-blue-400 ring-opacity-50" : ""
                      }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div
                className="opacity-0"
                style={{
                  animation: "fadeInStagger 0.6s ease-out 0.6s forwards",
                }}
              >
                <button
                  type="button"
                  onClick={handleRoleSubmit}
                  disabled={isUploading}
                  className="w-full bg-gradient-to-r from-white-50 to-blue-300 text-black font-bold py-3.5 px-8 rounded-lg text-lg transition-all duration-300 hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 hover:from-gray-200 hover:to-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-black"
                >
                  <span className="flex items-center justify-center">
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-3"></div>
                        Uploading Papers...
                      </>
                    ) : (
                      "Start Debate Session"
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>
          {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes slideUpDelay {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fadeInStagger {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes pulseSubtle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          
          @keyframes glow {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.4; }
          }
        `}
        </style>
      </div>
    );
  }

  const otherParticipants = Object.entries(DEBATE_PARTICIPANTS).filter(
    ([name]) => name !== userRole
  );

  const isAgentSpeaking = (name) => activeSpeaker === name;
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
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Create rows of participants with max 5 per row */}
          {(() => {
            const allParticipants = [
              {
                name: userRole,
                role: "You",
                isSpeaking: activeSpeaker === userRole,
                statusText: isUserTurn ? "Your Turn" : null,
                isUser: true,
              },
              ...otherParticipants.map(([name, role]) => ({
                name,
                role,
                isSpeaking: isAgentSpeaking(name),
                statusText: isAgentThinking(name) ? "Thinking..." : null,
                isUser: false,
              })),
            ];

            const rows = [];
            for (let i = 0; i < allParticipants.length; i += 5) {
              rows.push(allParticipants.slice(i, i + 5));
            }

            return rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="flex justify-center gap-4 md:gap-6 mx-16"
              >
                {row.map((participant, index) => (
                  <div
                    key={participant.name}
                    className="flex-shrink-0 w-full max-w-[280px] sm:max-w-[240px] md:max-w-[220px] lg:max-w-1/5"
                  >
                    <ParticipantBox
                      name={participant.name}
                      role={participant.role}
                      isSpeaking={participant.isSpeaking}
                      statusText={participant.statusText}
                      isUser={participant.isUser}
                    />
                  </div>
                ))}
              </div>
            ));
          })()}
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
            disabled={!isUserTurn}
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

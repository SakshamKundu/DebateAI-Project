import { React, useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  MessageCircle,
  FileText,
  Award,
  KeyRound,
  X,
  History,
  ChevronRight,
  User,
  ArrowLeft,
  Target,
  BookOpen,
  Star,
  Zap,
  RotateCw,
} from "lucide-react";

// --- API Configuration ---
const API_BASE_URL = "http://localhost:5000/api";

// --- Helper Functions & Components ---

const formatDate = (dateString) =>
  !dateString
    ? "N/A"
    : new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

const formatFullDate = (dateString) =>
  !dateString
    ? "N/A"
    : new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

const LoadingSpinner = ({ text }) => (
  <div className="w-full h-full flex flex-col justify-center items-center text-center p-6 bg-gray-800/80 rounded-xl">
    <div className="relative flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-300 border-t-transparent"></div>
      <div className="absolute h-10 w-10 bg-indigo-300 rounded-full opacity-20"></div>
    </div>
    {text && <p className="text-white mt-4 text-lg font-medium">{text}</p>}
  </div>
);

const ErrorDisplay = ({ message }) => (
  <div className="p-4 mx-4 my-4 bg-red-900/20 border border-red-700/50 rounded-xl shadow-2xs">
    <p className="text-red-400 text-sm">{message}</p>
  </div>
);

// --- Adjudication Card Sub-Components ---

const ScoreCard = ({ title, score, feedback, icon: Icon, maxScore = 10 }) => (
  <div className="bg-black-100/20 backdrop-blur-lg p-4 rounded-xl border border-gray-800/80 shadow-2xs">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <Icon className="text-white w-5 h-5 flex-shrink-0" />
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      <span className="text-xl font-bold text-white">
        {score} / {maxScore}
      </span>
    </div>
    <p className="text-sm text-gray-300 leading-relaxed">{feedback}</p>
  </div>
);

const ClashCard = ({ clash }) => (
  <div className="bg-black-100/20 backdrop-blur-lg p-4 rounded-xl border border-gray-800/80 shadow-2xs">
    <h4 className="text-lg font-semibold text-white mb-3">
      {clash.clashPoint}
    </h4>
    {clash.userArguments && (
      <div className="mb-3">
        <p className="font-semibold text-white text-sm mb-1">Your Arguments:</p>
        <p className="text-sm text-gray-300">{clash.userArguments}</p>
      </div>
    )}
    {clash.oppositionArguments && (
      <div className="mb-3">
        <p className="font-semibold text-white text-sm mb-1">
          Opposition&apos;s Arguments:
        </p>
        <p className="text-sm text-gray-300">{clash.oppositionArguments}</p>
      </div>
    )}
    {clash.outcome && (
      <div className="bg-gray-800/80 p-3 rounded-md mt-3 border border-gray-700/80">
        <p className="font-semibold text-white text-sm mb-1">
          Outcome:
          {clash.score != null && (
            <span className="text-white font-bold ml-2">
              Score: {clash.score > 0 ? `+${clash.score}` : clash.score}
            </span>
          )}
        </p>
        <p className="text-sm text-gray-300">{clash.outcome}</p>
      </div>
    )}
  </div>
);

// --- Debate Detail View ---

const DebateDetailView = ({ debateId, onClose }) => {
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!debateId) return;

    const controller = new AbortController();

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/debates/${debateId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          let errText = "";
          try {
            errText = await response.text();
          } catch (_) {}
          throw new Error(
            `Failed to load debate details. ${response.status} ${response.statusText}${
              errText ? ` - ${errText}` : ""
            }`
          );
        }

        let result;
        try {
          result = await response.json();
        } catch (jsonErr) {
          throw new Error("Server returned an invalid JSON response.");
        }

        if (result?.success) {
          setDebate(result.data);
        } else {
          throw new Error(result?.message || "An unknown error occurred.");
        }
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
    return () => controller.abort();
  }, [debateId]);

  return (
    <div className="fixed inset-0 bg-black z-60 overflow-y-auto animate-fadeIn">
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-black to-gray-900 p-6 border-b border-gray-800/80 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex items-center">
            <button
              onClick={onClose}
              className="mr-4 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Debate Details
              </h1>
              {!loading && debate && (
                <p className="text-gray-300 text-sm">
                  {formatFullDate(debate.createdAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto p-6">
          {loading && <LoadingSpinner text="Loading Debate..." />}
          {error && <ErrorDisplay message={error} />}
          {debate && !loading && (
            <div className="space-y-8">
              {/* Debate Info Card */}
              <div className="bg-black-100/20 backdrop-blur-lg rounded-xl p-6 border border-gray-800/80 shadow-2xs">
                <h2 className="text-xl font-bold text-white mb-4">
                  {debate.debateTopic}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center text-gray-300">
                    <User className="w-5 h-5 mr-3 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Your Role</p>
                      <p className="font-medium">{debate.userRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <Calendar className="w-5 h-5 mr-3 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p className="font-medium">
                        {formatFullDate(debate.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <KeyRound className="w-5 h-5 mr-3 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Client ID</p>
                      <p className="font-mono text-sm bg-gray-800/80 px-2 py-1 rounded">
                        {debate.clientId}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat History Card */}
              {debate.chatHistory && debate.chatHistory.length > 0 && (
                <div className="bg-black-100/20 backdrop-blur-lg rounded-xl p-6 border border-gray-800/80 shadow-2xs">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <MessageCircle className="w-5 h-5 mr-3" />
                    Chat History ({debate.chatHistory.length})
                  </h3>
                  <div className="bg-black/50 rounded-lg p-4 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900">
                    {debate.chatHistory.map((chat, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg ${
                          chat.speaker === debate.userRole ||
                          chat.speaker === debate.userRole + " (POI)"
                            ? "bg-green-900/80 border border-green-800/80"
                            : "bg-gray-800/80 border border-gray-700/80"
                        } shadow-2xs`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-white">
                            {chat.speaker}
                          </span>
                          {chat.timestamp && (
                            <span className="text-xs text-gray-400">
                              {new Date(chat.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {chat.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adjudication Result Card */}
              {debate.adjudicationResult &&
                Object.keys(debate.adjudicationResult).length > 0 && (
                  <div className="bg-black-100/20 backdrop-blur-lg rounded-2xl border border-gray-800/80 p-6 shadow-2xl">
                    <h3 className="text-3xl font-bold text-white mb-6">
                      Debate Adjudication:{" "}
                      <span className="text-indigo-200">{debate.userRole}</span>
                    </h3>
                    <div className="space-y-6">
                      <div className="bg-black-100/20 backdrop-blur-lg p-4 rounded-lg border border-gray-800/80 shadow-2xs">
                        <h3 className="text-xl font-bold text-white mb-2">
                          Final Score:{" "}
                          <span className="text-indigo-400">
                            {debate.adjudicationResult.finalScore} / 40
                          </span>
                        </h3>
                        <p className="text-gray-300">
                          {debate.adjudicationResult.overallSummary}
                        </p>
                      </div>
                      {debate.adjudicationResult.keyImprovementArea && (
                        <ScoreCard
                          title="Key Improvement Area"
                          score={
                            debate.adjudicationResult.scoring?.roleFulfillment
                              ?.score || 0
                          }
                          feedback={
                            debate.adjudicationResult.keyImprovementArea
                          }
                          icon={Target}
                        />
                      )}
                      <div className="grid md:grid-cols-2 gap-4">
                        {debate.adjudicationResult.scoring?.roleFulfillment && (
                          <ScoreCard
                            title="Role Fulfillment"
                            score={
                              debate.adjudicationResult.scoring.roleFulfillment
                                .score
                            }
                            feedback={
                              debate.adjudicationResult.scoring.roleFulfillment
                                .feedback
                            }
                            icon={Star}
                          />
                        )}
                        {debate.adjudicationResult.scoring?.poiHandling && (
                          <ScoreCard
                            title="POI Handling"
                            score={
                              debate.adjudicationResult.scoring.poiHandling
                                .score
                            }
                            feedback={
                              debate.adjudicationResult.scoring.poiHandling
                                .feedback
                            }
                            icon={Zap}
                          />
                        )}
                      </div>
                      {debate.adjudicationResult.clashAnalysis &&
                        debate.adjudicationResult.clashAnalysis.length > 0 && (
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-3">
                              Clash Analysis
                            </h3>
                            <div className="space-y-4">
                              {debate.adjudicationResult.clashAnalysis.map(
                                (clash, index) => (
                                  <ClashCard key={index} clash={clash} />
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

              {/* Uploaded Files Card */}
              {debate.uploadedFiles && debate.uploadedFiles.length > 0 && (
                <div className="bg-black-100/20 backdrop-blur-lg rounded-xl p-6 border border-gray-800/80 shadow-2xs">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-3" />
                    Uploaded Files ({debate.uploadedFiles.length})
                  </h3>
                  <div className="space-y-3">
                    {debate.uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center p-4 bg-gray-800/80 rounded-lg border border-gray-700/80 shadow-2xs"
                      >
                        <FileText className="w-6 h-6 mr-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-white font-medium mb-1">
                            {file.filename}
                          </div>
                          <div className="text-sm text-gray-400">
                            {file.mimetype}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Layout ---

const DebateHistorySystem = ({ children }) => {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDebateId, setSelectedDebateId] = useState(null);

  const hasLoadedOnceRef = useRef(false);

  const fetchDebates = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/debates`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        let errText = "";
        try {
          errText = await response.text();
        } catch (_) {}
        throw new Error(
          `Failed to fetch debates. ${response.status} ${response.statusText}${
            errText ? ` - ${errText}` : ""
          }`
        );
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonErr) {
        throw new Error("Server returned an invalid JSON response.");
      }

      if (result?.success && Array.isArray(result.data)) {
        setDebates(result.data);
        hasLoadedOnceRef.current = true;
      } else {
        throw new Error(result?.message || "Malformed response from server.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, []);

  const openSidebar = useCallback(async () => {
    setSidebarOpen(true);
    if (!hasLoadedOnceRef.current && !loading) {
      await fetchDebates();
    }
  }, [fetchDebates, loading]);

  const handleSelectDebate = useCallback((debateId) => {
    setSelectedDebateId(debateId);
    setSidebarOpen(false);
  }, []);

  const handleCloseDetailView = useCallback(async () => {
    setClosing(true);
    setSelectedDebateId(null);
    setSidebarOpen(true);
    await fetchDebates();
    await new Promise((r) => requestAnimationFrame(() => r()));
    setClosing(false);
  }, [fetchDebates]);

  return (
    <div className="relative min-h-screen bg-black">
      {/* Main Content Area */}
      <div
        className={`transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-80" : "translate-x-0"
        }`}
      >
        {children}
      </div>

      {/* Sidebar Toggle Button */}
      {!isSidebarOpen && !closing && (
        <div className="fixed bottom-36 right-6 z-50">
          <button
            onClick={openSidebar}
            className="group relative bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 text-black p-4 rounded-full shadow-2xl hover:shadow-indigo-200/20 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-200/50"
            style={{
              animation: "float 2s ease-in-out infinite",
            }}
            aria-label="Open debate history"
          >
            <History className="w-6 h-6 group-hover:rotate-12 transition-transform duration-200" />
            {/* Hover tooltip */}
            <div className="absolute bottom-full right-0 mb-3 block">
              <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-xs border-gray-800/80 shadow-2xs whitespace-nowrap border shadow-white-50/80">
                View debate history
                <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-black-100/20 backdrop-blur-lg shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-r border-gray-800/80 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Debate history sidebar"
      >
        <div className="bg-gradient-to-r from-black to-gray-900 p-4 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center">
            <History className="w-6 h-6 text-white mr-3" />
            <div>
              <h2 className="text-lg font-bold text-white">Debate History</h2>
              <p className="text-sm text-gray-400">{debates.length} debates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDebates}
              className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-gray-800/80 transition-colors duration-200"
              title="Refresh"
              aria-label="Refresh debates"
            >
              <RotateCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800/80 transition-colors duration-200"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-full pb-20 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900">
          {loading && (
            <div className="mt-8">
              <LoadingSpinner text="Loading debates..." />
            </div>
          )}

          {error && <ErrorDisplay message={error} />}

          {!loading && !error && (
            <>
              {debates.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="font-medium">No Debates Found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Start your first debate!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/80">
                  {debates.map((debate) => (
                    <div
                      key={debate._id}
                      className="p-4 hover:bg-gray-800/50 transition-colors duration-200 cursor-pointer group"
                      onClick={() => handleSelectDebate(debate._id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white mb-3 line-clamp-3 leading-tight group-hover:text-indigo-200">
                            {debate.debateTopic}
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center text-xs text-gray-400">
                              <Calendar className="w-3 h-3 mr-2" />
                              {formatDate(debate.createdAt)}
                            </div>
                            <div className="flex items-center text-xs text-gray-400">
                              <User className="w-3 h-3 mr-2" />
                              {debate.userRole}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-200 transition-colors flex-shrink-0 ml-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Detail View */}
      {selectedDebateId && !closing && (
        <DebateDetailView
          debateId={selectedDebateId}
          onClose={handleCloseDetailView}
        />
      )}

      {/* Full-page loading while returning home */}
      {closing && (
        <div className="fixed inset-0 bg-black z-60 flex items-center justify-center">
          <LoadingSpinner text="Returning Home..." />
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default DebateHistorySystem;
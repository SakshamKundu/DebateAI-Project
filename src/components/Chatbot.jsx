import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I have access to the entire debate history. Ask me anything, like 'How many debates are there in total?' or 'Summarize the debate about social media.'",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const API_URL = "http://localhost:5000/api";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { sender: "user", text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    const question = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat/rag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
        }),
      });

      const data = await response.json();
      const botMessage = { sender: "bot", text: data.reply };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error fetching RAG response:", error);
      const errorMessage = {
        sender: "bot",
        text: "Sorry, I encountered an error. Please check the server and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (isMinimized) setIsMinimized(false);
  };

  const minimizeChat = () => {
    setIsMinimized(true);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={toggleChat}
            className="group relative bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 text-black p-4 rounded-full shadow-2xl hover:shadow-white/20 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50"
            style={{
              animation: "float 2s ease-in-out infinite",
            }}
          >
            <MessageCircle className="w-6 h-6" />

            {/* Hover tooltip */}
            <div className="absolute bottom-full right-0 mb-3 block">
              <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-xs border-gray-800/80 shadow-2xs whitespace-nowrap border shadow-white-50/80">
                Chat with your debate assistant
                <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`bg-black-100/20 backdrop-blur-lg border border-gray-800 rounded-2xl shadow-2xl transition-all duration-300 ${
              isMinimized ? "w-80 h-16" : "w-96 h-[500px]"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-black" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    Debate Assistant
                  </h3>
                  <p className="text-xs text-gray-400">Online now</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={minimizeChat}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Minimize2 className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
                <button
                  onClick={toggleChat}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 h-80">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          msg.sender === "user"
                            ? "bg-green-900/80 text-white"
                            : "bg-gray-800/80 text-white border border-gray-700"
                        } shadow-lg`}
                      >
                        {msg.text.split("\n").map((line, i) => (
                          <p key={i} className="text-sm leading-relaxed">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-800 border border-gray-700 px-4 py-2 rounded-2xl shadow-lg">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400">
                            Analyzing history...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-800 p-4">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask about debate history..."
                      disabled={isLoading}
                      className="flex w-full p-3 text-sm rounded-xl bg-gray-900 border-gray-800/80 shadow-2xs shadow-white-50/80 focus:ring-2 focus:ring-gray-600 outline-none border transition-all duration-200 hover:shadow-xs"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isLoading || !inputValue.trim()}
                      className="bg-black-100/20 border border-gray-500/80 shadow-2xs shadow-white-50/80 focus:ring-2 focus:ring-gray-600 p-2 rounded-xl hover:opacity-90 disabled:opacity-50 hover:shadow-xs disabled:cursor-not-allowed transition-all duration-200 hover:scale-103"
                    >
                      <Send className="w-4 h-4 text-white stroke-[2]" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        /* Custom Scrollbar for Webkit browsers (Chrome, Safari, Edge) */
        .overflow-y-auto::-webkit-scrollbar {
          width: 8px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: #1a1a1a; /* Dark track to blend with theme */
          border-radius: 8px;
          margin: 4px 0;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: linear-gradient(
            to bottom,
            #4b4b4b,
            #6b6b6b
          ); /* Subtle gradient for modern look */
          border-radius: 8px;
          border: 2px solid #1a1a1a; /* Matches track for seamless look */
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            to bottom,
            #6b6b6b,
            #8b8b8b
          ); /* Lighter gradient on hover */
        }

        /* Custom Scrollbar for Firefox */
        .overflow-y-auto {
          scrollbar-width: thin;
          scrollbar-color: #6b6b6b #1a1a1a; /* Thumb and track colors */
        }
      `}</style>
    </>
  );
};

export default Chatbot;

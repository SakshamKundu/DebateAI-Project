// src/components/FeedbackModal.jsx

import React from "react";
import {
  X,
  Award,
  Target,
  BookOpen,
  BarChart3,
  MessageSquareQuote,
} from "lucide-react";

// Sub-component for displaying a score and feedback, now themed for a light background
const ScoreCard = ({ title, score, feedback, icon }) => (
  // Using light gray background and border
  <div className="bg-black-100 p-4 rounded-lg border border-black-50" style={{ backgroundColor: '#0e0e10', borderColor: '#1c1c21' }}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {/* Icons are now a dark gray color */}
        {React.cloneElement(icon, { className: "text-white" })}
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      {/* Score is now black for high contrast */}
      <span className="text-xl font-bold text-white">{score} / 10</span>
    </div>
    {/* Feedback text is a softer gray */}
    <p className="text-sm leading-relaxed" style={{ color: '#d9ecff' }}>{feedback}</p>
  </div>
);

// Sub-component for displaying a single debate clash, themed for a light background
const ClashCard = ({ clash }) => (
  <div className="bg-black-100 p-4 rounded-lg border border-black-50" style={{ backgroundColor: '#0e0e10', borderColor: '#1c1c21' }}>
    <h4 className="text-lg font-semibold text-white mb-2">
      {clash.clashPoint}
    </h4>
    <div className="mb-3">
      <p className="font-semibold text-white text-sm mb-1">
        Your Arguments:
      </p>
      <p className="text-sm" style={{ color: '#d9ecff' }}>{clash.userArguments}</p>
    </div>
    <div className="mb-3">
      <p className="font-semibold text-white text-sm mb-1">
        Opposition's Arguments:
      </p>
      <p className="text-sm" style={{ color: '#d9ecff' }}>{clash.oppositionArguments}</p>
    </div>
    {/* Outcome box uses a slightly darker gray for emphasis */}
    <div className="bg-black-200 p-2 rounded-md" style={{ backgroundColor: '#282732' }}>
      <p className="font-semibold text-white text-sm mb-1">
        Outcome:{" "}
        <span className="text-white font-bold">
          Score: {clash.score > 0 ? `+${clash.score}` : clash.score}
        </span>
      </p>
      <p className="text-sm" style={{ color: '#d9ecff' }}>{clash.outcome}</p>
    </div>
  </div>
);

export const FeedbackModal = ({ feedbackData, userRole, onClose }) => {
  if (!feedbackData) return null;

  // Handle case where feedback generation failed (Themed for light mode)
  if (feedbackData.error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-black w-full max-w-lg p-6 rounded-lg border border-red-500/50">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Error</h2>
          <p className="text-white mb-6">{feedbackData.error}</p>
          <button
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Main modal container now has a white background and gray border */}
      <div className="bg-black w-full max-w-4xl max-h-[90vh] p-6 rounded-2xl border border-black-50 shadow-2xl flex flex-col" style={{ borderColor: '#1c1c21' }}>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          {/* Header text is black, userRole is a dark gray */}
          <h2 className="text-3xl font-bold text-white">
            Debate Adjudication:{" "}
            <span style={{ color: '#d9ecff' }}>{userRole}</span>
          </h2>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={28} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-6">
          {/* Summary & Final Score */}
          <div className="bg-black-100 p-4 rounded-lg border border-black-50" style={{ backgroundColor: '#0e0e10', borderColor: '#1c1c21' }}>
            <h3 className="text-xl font-bold text-white mb-2">
              Final Score:{" "}
              <span className="text-white">{feedbackData.finalScore} / 40</span>
            </h3>
            <p style={{ color: '#d9ecff' }}>{feedbackData.overallSummary}</p>
          </div>

          {/* Key Improvement Area */}
          <ScoreCard
            title="Key Improvement Area"
            score={feedbackData.roleFulfillment.score}
            feedback={feedbackData.keyImprovementArea}
            icon={<Target />}
          />

          {/* Scoring Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <ScoreCard
              title="Matter"
              score={feedbackData.scoring.matter.score}
              feedback={feedbackData.scoring.matter.feedback}
              icon={<BookOpen />}
            />
            <ScoreCard
              title="Manner"
              score={feedbackData.scoring.manner.score}
              feedback={feedbackData.scoring.manner.feedback}
              icon={<Award />}
            />
            <ScoreCard
              title="Method"
              score={feedbackData.scoring.method.score}
              feedback={feedbackData.scoring.method.feedback}
              icon={<BarChart3 />}
            />
            <ScoreCard
              title="POI Handling"
              score={"N/A"}
              feedback={feedbackData.poiHandling.feedback}
              icon={<MessageSquareQuote />}
            />
          </div>

          {/* Clash Analysis */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-3">
              Clash Analysis
            </h3>
            <div className="space-y-4">
              {feedbackData.clashAnalysis.map((clash, index) => (
                <ClashCard key={index} clash={clash} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
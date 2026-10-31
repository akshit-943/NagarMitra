import React, { useState, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import VoiceControls from './VoiceControls';

const QUICK_PROMPTS = [
  'Citywide resolution stats',
  'Report a road pothole',
  'Track complaint status',
  'Emergency helplines',
];

/**
 * Component: ChatInput
 * Handles text typing, quick prompt chips, and voice-to-text integration
 * 
 * @param {Object} props
 * @param {Function} props.onSendMessage - Callback when user submits a message
 * @param {boolean} [props.isLoading] - Whether the assistant is generating a reply
 */
export default function ChatInput({ onSendMessage, isLoading = false }) {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptClick = (prompt) => {
    if (isLoading) return;
    onSendMessage(prompt);
  };

  const handleVoiceTranscript = (transcript) => {
    if (!transcript) return;
    setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    // Optional autofocus
    inputRef.current?.focus();
  };

  return (
    <div className="p-3 border-t border-[#E6E5DE] bg-white rounded-b-2xl">
      {/* Quick Prompts Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[11px]">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => handlePromptClick(prompt)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-[#F7F7F4] hover:bg-[#EBEAE4] text-[#4B4E54] hover:text-[#191B1D] border border-[#E6E5DE] transition-colors cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLoading
                ? 'CivicPulse Assistant is thinking...'
                : 'Ask anything or describe a civic problem...'
            }
            disabled={isLoading}
            className="w-full pl-3.5 pr-9 py-2 text-xs bg-[#F7F7F4] text-[#191B1D] placeholder-[#A2A6B0] border border-[#E6E5DE] rounded-xl focus:outline-none focus:border-[#191B1D] focus:bg-white transition-all disabled:opacity-60"
          />
        </div>

        {/* Voice Input Mic */}
        <VoiceControls
          onTranscript={handleVoiceTranscript}
          disabled={isLoading}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          aria-label="Send message"
          className="p-2 rounded-xl bg-[#191B1D] hover:bg-[#2C3035] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

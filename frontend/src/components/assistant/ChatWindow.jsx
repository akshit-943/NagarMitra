import React, { useEffect, useRef } from 'react';
import { Bot, X, RefreshCw, Sparkles, ChevronDown, Shield } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

/**
 * Component: ChatWindow
 * Floating conversational window with responsive mobile bottom-sheet and desktop popup card
 */
export default function ChatWindow({
  isOpen,
  onClose,
  messages = [],
  isLoading = false,
  roleContext = 'guest',
  onSendMessage,
  onClearChat,
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const getRoleBadge = () => {
    if (roleContext === 'authority') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          Authority Mode
        </span>
      );
    }
    if (roleContext === 'citizen') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Citizen Mode
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EBEAE4] text-[#4B4E54]">
        Public Visitor
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="CivicPulse Conversational Assistant"
      className="fixed bottom-20 right-4 sm:right-6 w-[92vw] sm:w-[410px] h-[580px] max-h-[80vh] bg-white border border-[#E6E5DE] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#191B1D] text-white flex items-center justify-between border-b border-[#2C3035]">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full bg-[#D2E873] flex items-center justify-center text-[#191B1D] font-bold shadow-xs">
            <Bot className="w-4 h-4 text-[#191B1D]" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#191B1D]" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-xs tracking-tight text-white">
                CivicPulse Assistant
              </h3>
              {getRoleBadge()}
            </div>
            <p className="text-[10px] text-[#A2A6B0] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#D2E873]" />
              <span>Gemini Infrastructure Intelligence</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 text-[#A2A6B0]">
          <button
            type="button"
            onClick={onClearChat}
            title="Reset conversation"
            aria-label="Reset conversation"
            className="p-1.5 rounded-lg hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close assistant"
            aria-label="Close assistant"
            className="p-1.5 rounded-lg hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-[#FAFAF8] space-y-2">
        {messages.map((msg, index) => (
          <ChatMessage key={msg.id || index} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-[#7E828B] text-xs py-2 px-1">
            <div className="w-6 h-6 rounded-full bg-[#D2E873] flex items-center justify-center text-[#191B1D]">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7E828B] animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#7E828B] animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#7E828B] animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
    </div>
  );
}

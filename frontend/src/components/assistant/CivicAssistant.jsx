import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { useCivic } from '../../context/CivicContext';
import { useCivicAssistant } from '../../hooks/useCivicAssistant';
import ChatWindow from './ChatWindow';

/**
 * Component: CivicAssistant
 * Root container for the conversational AI assistant.
 * Floats in the bottom-right corner across municipal panels, citizen dashboards, and maps,
 * while on the Landing page it is accessible via the hero quick-launch button.
 */
export default function CivicAssistant() {
  const { activeTab } = useCivic();
  const {
    isOpen,
    toggleOpen,
    isLoading,
    messages,
    roleContext,
    sendMessage,
    clearChat,
  } = useCivicAssistant();

  // Show floating corner button across all operational portals (Municipal Command, Citizen Portal, Map, etc.)
  // and omit only on the Home landing page where the dedicated hero button is featured.
  const showFloatingTrigger = activeTab !== 'landing';

  return (
    <>
      {/* Floating Assistant Trigger Button for Municipal Command, Citizen Portal, and other views */}
      {showFloatingTrigger && (
        <div className="fixed bottom-5 right-5 sm:right-6 z-40">
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close NagarMitra Assistant' : 'Open NagarMitra Assistant'}
            className={`group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full shadow-lg transition-all duration-300 cursor-pointer ${
              isOpen
                ? 'bg-[#191B1D] text-white ring-2 ring-[#D2E873]'
                : 'bg-[#191B1D] hover:bg-[#2C3035] text-white hover:scale-105 ring-1 ring-white/10'
            }`}
          >
            {/* Avatar icon with pulse */}
            <div className="relative w-7 h-7 rounded-full bg-[#D2E873] flex items-center justify-center text-[#191B1D] font-bold shadow-xs">
              <Bot className="w-4 h-4 text-[#191B1D]" />
              {!isOpen && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D2E873] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
            </div>

            {/* Label */}
            <span className="text-xs font-semibold tracking-tight pr-1 hidden sm:inline-block">
              NagarMitra Assistant
            </span>

            <Sparkles className="w-3.5 h-3.5 text-[#D2E873] hidden sm:inline-block" />
          </button>
        </div>
      )}

      {/* Floating Chat Window Modal */}
      <ChatWindow
        isOpen={isOpen}
        onClose={toggleOpen}
        messages={messages}
        isLoading={isLoading}
        roleContext={roleContext}
        onSendMessage={sendMessage}
        onClearChat={clearChat}
      />
    </>
  );
}

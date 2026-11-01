import React from 'react';
import { useCivicAssistant } from '../../hooks/useCivicAssistant';
import ChatWindow from './ChatWindow';

/**
 * Component: CivicAssistant
 * Root container for the conversational AI assistant.
 * Placed in the global application shell to float across all tabs and dashboards.
 */
export default function CivicAssistant() {
  const {
    isOpen,
    toggleOpen,
    isLoading,
    messages,
    roleContext,
    sendMessage,
    clearChat,
  } = useCivicAssistant();

  return (
    <>
      {/* Floating Chat Window Modal (Launched via designated platform controls) */}
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

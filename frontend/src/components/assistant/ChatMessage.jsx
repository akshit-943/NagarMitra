import React from 'react';
import { Bot, User, Wrench, CheckCircle } from 'lucide-react';
import ComplaintDraftCard from './ComplaintDraftCard';

/**
 * Helper to render basic markdown formatting cleanly without heavy external markdown libraries
 */
const formatMessageContent = (content = '') => {
  if (!content) return null;

  // Split lines
  const lines = content.split('\n');

  return lines.map((line, idx) => {
    // Header 3: ### Header
    if (line.startsWith('### ')) {
      return (
        <h4 key={idx} className="font-bold text-[13px] text-[#191B1D] mt-2 mb-1">
          {line.replace('### ', '')}
        </h4>
      );
    }

    // Bullet point: - Item or * Item
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const cleanLine = line.trim().replace(/^[-*]\s+/, '');
      return (
        <li key={idx} className="ml-4 list-disc text-[12px] leading-relaxed my-0.5">
          {renderInlineFormatting(cleanLine)}
        </li>
      );
    }

    // Empty line
    if (!line.trim()) {
      return <div key={idx} className="h-1.5" />;
    }

    // Standard paragraph line
    return (
      <p key={idx} className="text-[12px] leading-relaxed my-0.5">
        {renderInlineFormatting(line)}
      </p>
    );
  });
};

/**
 * Formats inline bold (**text**) and code (`text`)
 */
const renderInlineFormatting = (text = '') => {
  // Regex to split on bold and code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-[#191B1D]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="font-mono text-[11px] bg-[#EBEAE4] text-[#191B1D] px-1 py-0.5 rounded"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

/**
 * Component: ChatMessage
 * Renders individual conversational bubbles with role styling and interactive cards
 */
export default function ChatMessage({ message, onDraftSubmitted }) {
  const isUser = message.sender === 'user';

  return (
    <div
      className={`flex items-start gap-2.5 my-2.5 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      } animate-fade-in`}
    >
      {/* Avatar Icon */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
          isUser
            ? 'bg-[#191B1D] text-white shadow-sm'
            : 'bg-[#D2E873] text-[#191B1D] font-bold shadow-sm ring-2 ring-[#E6E5DE]'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4 text-[#191B1D]" />}
      </div>

      {/* Bubble Container */}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs ${
          isUser
            ? 'bg-[#191B1D] text-white rounded-tr-none'
            : 'bg-[#F7F7F4] text-[#191B1D] border border-[#E6E5DE] rounded-tl-none'
        }`}
      >
        {/* Tool Call indicator badge if the assistant invoked a live tool */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {message.toolCalls.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[10px] bg-[#EBEAE4] text-[#4B4E54] px-1.5 py-0.5 rounded-md font-mono"
              >
                <Wrench className="w-2.5 h-2.5 text-amber-600" />
                <span>{t.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Text Body */}
        <div className="space-y-0.5">{formatMessageContent(message.text)}</div>

        {/* Inline Complaint Draft Card if assistant generated one */}
        {!isUser && message.draftComplaint && (
          <ComplaintDraftCard
            draft={message.draftComplaint}
            onSubmitted={onDraftSubmitted}
          />
        )}

        {/* Timestamp */}
        <div
          className={`text-[9px] mt-1.5 flex items-center gap-1 ${
            isUser ? 'text-[#A2A6B0] justify-end' : 'text-[#7E828B] justify-start'
          }`}
        >
          <span>
            {new Date(message.timestamp || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

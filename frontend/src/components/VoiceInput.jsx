import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Sparkles,
  Undo2,
  AlertCircle,
  Check,
  Globe,
  Loader2,
  Volume2,
} from 'lucide-react';
import { enhanceDescriptionWithAi } from '../services/complaintService';

/**
 * Supported Speech Recognition Languages
 */
const SUPPORTED_LANGUAGES = [
  { id: 'en-IN', label: 'English (India)', engineLang: 'en-IN', note: 'Standard Indian English' },
  { id: 'hi-IN', label: 'Hindi (हिन्दी)', engineLang: 'hi-IN', note: 'Devanagari script dictation' },
  { id: 'hinglish', label: 'Hinglish (Mixed)', engineLang: 'en-IN', note: 'Natural Hindi-English dictation in Latin alphabet' },
  { id: 'en-US', label: 'English (US)', engineLang: 'en-US', note: 'International English' },
];

/**
 * Detect browser Web Speech API availability
 */
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default function VoiceInput({
  value = '',
  onChange,
  category = '',
  disabled = false,
  isModalOpen = true,
}) {
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'info' | 'error' | 'success', text: string }
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [previousText, setPreviousText] = useState(null); // For AI Enhancement Undo
  const [voiceCommandToast, setVoiceCommandToast] = useState(null);

  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');
  const sessionFinalRef = useRef('');
  const mediaStreamRef = useRef(null);

  // Check speech recognition capability on mount
  useEffect(() => {
    const SpeechAPI = getSpeechRecognition();
    if (!SpeechAPI) {
      setIsSupported(false);
    }
  }, []);

  // Stop recording immediately if parent modal closes or component unmounts
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {
        // Recognition may already be stopped
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setInterimText('');
  }, []);

  useEffect(() => {
    if (!isModalOpen && isRecording) {
      stopRecording();
    }
  }, [isModalOpen, isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  /**
   * Check for voice commands (e.g. "stop recording", "clear description")
   * @param {string} rawTranscript 
   * @returns {boolean} true if a command was matched and handled
   */
  const handleVoiceCommand = (rawTranscript) => {
    const clean = rawTranscript.trim().toLowerCase().replace(/[.,!?:;]/g, '');

    if (clean === 'stop recording' || clean === 'stop dictation' || clean === 'band karo') {
      triggerVoiceCommandFeedback('Command: Stopped Recording');
      stopRecording();
      return true;
    }

    if (
      clean === 'clear description' ||
      clean === 'clear text' ||
      clean === 'clear transcription' ||
      clean === 'saaf karo'
    ) {
      triggerVoiceCommandFeedback('Command: Cleared Description');
      sessionFinalRef.current = '';
      if (onChange) onChange('');
      return true;
    }

    return false;
  };

  const triggerVoiceCommandFeedback = (msg) => {
    setVoiceCommandToast(msg);
    setTimeout(() => {
      setVoiceCommandToast(null);
    }, 3500);
  };

  /**
   * Start Speech Recognition session
   */
  const startRecording = async () => {
    setStatusMessage(null);
    setInterimText('');

    const SpeechAPI = getSpeechRecognition();
    if (!SpeechAPI) {
      setStatusMessage({
        type: 'error',
        text: 'Speech Recognition is not supported in this browser. Please type manually or use Chrome/Edge/Safari.',
      });
      return;
    }

    // Capture starting text baseline
    baseTextRef.current = value || '';
    sessionFinalRef.current = '';

    try {
      // Optional: Proactively request mic stream to verify permissions
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
        } catch (permErr) {
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setStatusMessage({
              type: 'error',
              text: 'Microphone permission was denied. Please allow microphone access in your browser address bar to dictate.',
            });
            return;
          }
        }
      }

      const recognition = new SpeechAPI();
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLang) || SUPPORTED_LANGUAGES[0];
      recognition.lang = langConfig.engineLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setStatusMessage({
          type: 'info',
          text: `Listening in ${langConfig.label}... Speak clearly into your microphone.`,
        });
      };

      recognition.onresult = (event) => {
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';

          if (res.isFinal) {
            // Check if user spoke an explicit interface command
            const isCommand = handleVoiceCommand(transcript);
            if (!isCommand && transcript.trim()) {
              const trimmedTranscript = transcript.trim();

              // Avoid duplicate chunk insertion
              if (!sessionFinalRef.current.endsWith(trimmedTranscript)) {
                if (sessionFinalRef.current) {
                  sessionFinalRef.current += ' ' + trimmedTranscript;
                } else {
                  sessionFinalRef.current = trimmedTranscript;
                }

                // Construct combined output text
                const base = baseTextRef.current.trim();
                let combined = '';
                if (base) {
                  const needsPeriod = !/[.!?।]$/.test(base);
                  combined = `${base}${needsPeriod ? '. ' : ' '}${sessionFinalRef.current}`;
                } else {
                  combined = sessionFinalRef.current;
                }

                if (onChange) {
                  onChange(combined);
                }
              }
            }
          } else {
            currentInterim += transcript;
          }
        }

        setInterimText(currentInterim);
      };

      recognition.onerror = (event) => {
        console.warn('⚠️ [SpeechRecognition] Error event:', event.error);
        if (event.error === 'not-allowed') {
          setStatusMessage({
            type: 'error',
            text: 'Microphone permission denied. Click the lock/tune icon in your address bar to allow microphone access.',
          });
          stopRecording();
        } else if (event.error === 'no-speech') {
          setStatusMessage({
            type: 'info',
            text: 'No speech detected. You can speak again or click Stop when finished.',
          });
        } else if (event.error === 'network') {
          setStatusMessage({
            type: 'error',
            text: 'Speech recognition network error. Please check your internet connection.',
          });
          stopRecording();
        } else if (event.error !== 'aborted') {
          setStatusMessage({
            type: 'error',
            text: `Speech recognition error: ${event.error}. You can still type manually.`,
          });
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
        if (sessionFinalRef.current) {
          setStatusMessage({
            type: 'success',
            text: 'Voice transcription added. You can continue speaking, edit text above, or enhance with AI.',
          });
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('❌ [VoiceInput] Failed to start recognition:', err);
      setStatusMessage({
        type: 'error',
        text: 'Could not access speech recognition service. Please enter text manually.',
      });
      stopRecording();
    }
  };

  /**
   * Handle optional Gemini AI description improvement
   */
  const handleEnhanceWithAi = async () => {
    if (!value || value.trim().length < 10) {
      setStatusMessage({
        type: 'info',
        text: 'Please dictate or type at least 10 characters before requesting AI enhancement.',
      });
      return;
    }

    try {
      setIsEnhancing(true);
      setStatusMessage(null);
      const res = await enhanceDescriptionWithAi(value, category);

      if (res?.success && res.data?.enhancedText) {
        setPreviousText(value);
        if (onChange) {
          onChange(res.data.enhancedText);
        }
        setStatusMessage({
          type: 'success',
          text: 'Description enhanced by NagarMitra AI for clarity and structure. You can revert anytime.',
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'AI enhancement completed with original text preserved.',
        });
      }
    } catch (err) {
      console.warn('⚠️ [VoiceInput] AI enhancement failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Could not reach AI enhancement service. Your current text is preserved.',
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  /**
   * Revert AI enhancement back to original transcription
   */
  const handleRevertText = () => {
    if (previousText !== null && onChange) {
      onChange(previousText);
      setPreviousText(null);
      setStatusMessage({
        type: 'info',
        text: 'Reverted back to your original dictated text.',
      });
    }
  };

  return (
    <div className="space-y-2 mt-1 select-none">
      {/* Control Strip */}
      <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Mic Control & Language Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Record Button */}
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2223] text-white text-xs font-semibold shadow-xs transition-all animate-pulse"
              title="Stop voice recording"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Dictating</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled || !isSupported}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#191B1D] hover:bg-[#333538] text-white text-xs font-medium shadow-xs transition-all disabled:opacity-50"
              title={isSupported ? 'Click to speak your complaint using your microphone' : 'Voice input not supported in this browser'}
            >
              <Mic className="w-3.5 h-3.5 text-[#D2E873]" />
              <span>Speak Complaint</span>
            </button>
          )}

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-[#E6E5DE] rounded-lg px-2 py-1 text-xs text-[#191B1D]">
            <Globe className="w-3 h-3 text-[#7E828B]" />
            <select
              value={selectedLang}
              onChange={(e) => {
                setSelectedLang(e.target.value);
                if (isRecording) {
                  stopRecording();
                }
              }}
              disabled={isRecording || disabled}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer pr-1"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Optional AI Enhancement & Undo Controls */}
        <div className="flex items-center gap-2">
          {previousText !== null && (
            <button
              type="button"
              onClick={handleRevertText}
              disabled={isRecording || disabled}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E5DE] hover:border-[#191B1D] text-[#4B4E54] text-xs font-medium transition-colors"
              title="Revert back to your raw dictated text before AI enhancement"
            >
              <Undo2 className="w-3 h-3 text-[#7E828B]" />
              <span>Undo AI Edit</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleEnhanceWithAi}
            disabled={isRecording || isEnhancing || disabled || !value || value.trim().length < 10}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              value && value.trim().length >= 10
                ? 'bg-[#F2F8D5] border border-[#D2E873] text-[#3E520A] hover:bg-[#E7F3B8]'
                : 'bg-white border border-[#E6E5DE] text-[#A2A6B0] cursor-not-allowed opacity-60'
            }`}
            title="Use NagarMitra AI to fix transcription grammar, organization, and phrasing"
          >
            {isEnhancing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-[#3E520A]" />
                <span>Improving...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-[#8CA81F]" />
                <span>Improve with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Voice Command Detected Toast */}
      {voiceCommandToast && (
        <div className="px-3 py-1.5 rounded-lg bg-[#191B1D] text-white text-[11px] font-medium flex items-center gap-2 animate-fade-in shadow-xs">
          <Volume2 className="w-3.5 h-3.5 text-[#D2E873]" />
          <span>{voiceCommandToast}</span>
        </div>
      )}

      {/* Active Waveform & Interim Transcription Display */}
      {isRecording && (
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#8CA81F]/40 shadow-xs space-y-2 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9E2A2B] animate-ping" />
              <span className="text-xs font-semibold text-[#191B1D]">Listening &amp; Dictating...</span>
            </div>

            {/* Subtle Animated Audio Waveform */}
            <div className="flex items-center gap-0.5 h-4">
              <span className="w-1 bg-[#8CA81F] rounded-full animate-pulse h-2" style={{ animationDelay: '0ms' }} />
              <span className="w-1 bg-[#8CA81F] rounded-full animate-pulse h-4" style={{ animationDelay: '150ms' }} />
              <span className="w-1 bg-[#8CA81F] rounded-full animate-pulse h-3" style={{ animationDelay: '300ms' }} />
              <span className="w-1 bg-[#8CA81F] rounded-full animate-pulse h-5" style={{ animationDelay: '450ms' }} />
              <span className="w-1 bg-[#8CA81F] rounded-full animate-pulse h-2.5" style={{ animationDelay: '200ms' }} />
            </div>
          </div>

          {/* Live Interim Transcript Stream */}
          <div className="text-xs text-[#4B4E54] italic min-h-[1.5rem] bg-white/80 p-2 rounded-lg border border-[#E6E5DE]/80">
            {interimText ? (
              <span className="text-[#191B1D] font-medium">"{interimText}"</span>
            ) : (
              <span className="text-[#A2A6B0]">Listening for your voice... speak now (say "stop recording" to finish)</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#7E828B]">
            <span>Voice command tips: say "stop recording" or "clear description"</span>
            <button
              type="button"
              onClick={stopRecording}
              className="text-[#9E2A2B] font-semibold hover:underline"
            >
              Click here to stop
            </button>
          </div>
        </div>
      )}

      {/* Status & Feedback Notifications */}
      {statusMessage && (
        <div
          className={`px-3 py-2 rounded-xl text-xs flex items-start gap-2 border ${
            statusMessage.type === 'error'
              ? 'bg-[#FBE8E8] border-[#F5C2BE] text-[#9E2A2B]'
              : statusMessage.type === 'success'
              ? 'bg-[#F2F8D5] border-[#D2E873] text-[#3E520A]'
              : 'bg-[#F0EFEA] border-[#E6E5DE] text-[#4B4E54]'
          }`}
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-[#9E2A2B] shrink-0 mt-0.5" />
          ) : statusMessage.type === 'success' ? (
            <Check className="w-3.5 h-3.5 text-[#3E520A] shrink-0 mt-0.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-[#7E828B] shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-snug">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-inherit opacity-70 hover:opacity-100 text-[10px] font-semibold ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Browser Fallback Notice if Not Supported */}
      {!isSupported && (
        <div className="p-2.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-[11px] text-[#7E828B] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#8CA81F] shrink-0" />
          <span>
            Browser Speech Recognition is not available on this browser. You can type your complaint directly into the field below.
          </span>
        </div>
      )}
    </div>
  );
}
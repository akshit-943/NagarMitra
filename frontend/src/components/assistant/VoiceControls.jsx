import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

/**
 * Component: VoiceControls
 * Provides speech-to-text voice input via Web Speech API
 * 
 * @param {Object} props
 * @param {Function} props.onTranscript - Callback when final speech is recognized
 * @param {boolean} [props.disabled] - Whether input is currently disabled
 */
export default function VoiceControls({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionError, setPermissionError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Default to Indian English, versatile for civic accents

      recognition.onstart = () => {
        setIsListening(true);
        setPermissionError(null);
      };

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && typeof onTranscript === 'function') {
          onTranscript(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setPermissionError('Microphone permission blocked. Please allow mic access in your browser.');
        } else if (event.error !== 'no-speech') {
          setPermissionError(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('⚠️ [VoiceControls] Speech recognition initialization failed:', err);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!isSupported || disabled) return;

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setPermissionError(null);
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('⚠️ [VoiceControls] Start error:', err);
      }
    }
  };

  if (!isSupported) {
    return null; // Gracefully omit mic button if browser does not support Web Speech API
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        aria-label={isListening ? 'Stop recording voice' : 'Speak to assistant'}
        title={isListening ? 'Listening... click to stop' : 'Voice input'}
        className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
          isListening
            ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30 ring-2 ring-rose-400'
            : 'bg-white hover:bg-[#F2F1E8] text-[#4B4E54] hover:text-[#191B1D] border border-[#E6E5DE]'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {permissionError && (
        <div className="absolute bottom-full mb-2 right-0 w-64 p-2 bg-[#191B1D] text-white text-[11px] rounded-lg shadow-lg flex items-start gap-1.5 z-50 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{permissionError}</span>
        </div>
      )}
    </div>
  );
}

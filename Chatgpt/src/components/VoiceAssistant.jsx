import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';

const VoiceAssistant = ({ setParentPrompt }) => {
  const { selectedChat, user, axios, token, setUser, messages, syncMessages } = useAppContext();
  
  // UI & Voice Mode States
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
  const [transcript, setTranscript] = useState('');
  const [aiResponseText, setAiResponseText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // References for Web Speech API instances and timers
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const statusRef = useRef(status);

  // Keep statusRef synchronized with the latest status state without re-triggering effects
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Initialize Speech Recognition on mount once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Voice recognition not supported.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setStatus('listening');
        setErrorMessage('');
        setTranscript('');
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied.');
          setStatus('error');
          toast.error('Microphone access denied.');
        } else {
          if (event.error !== 'no-speech') {
            setErrorMessage(`Error: ${event.error}`);
            setStatus('error');
          }
        }
      };

      recognition.onend = () => {
        // Use stable statusRef to check if we should auto-restart continuous listening
        if (statusRef.current === 'listening' && !isProcessingRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        
        if (currentTranscript) {
          setTranscript(currentTranscript);
          // Directly populate spoken text format live to the input box
          if (setParentPrompt) setParentPrompt(currentTranscript);
        }

        // Silence Detection Logic: Check if the last recognized chunk is final
        const lastResult = event.results[event.results.length - 1];
        if (lastResult && lastResult.isFinal && currentTranscript.trim()) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          // Wait 1.2 seconds of silence before automatically stopping and submitting
          silenceTimerRef.current = setTimeout(() => {
            if (!isProcessingRef.current) {
              handleVoiceSubmit(currentTranscript.trim());
            }
          }, 1200);
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setErrorMessage('Microphone init failed.');
    }

    // Unmount cleanup
    return () => {
      isProcessingRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      window.speechSynthesis.cancel();
    };
  }, [setParentPrompt]);

  // Global Keyboard shortcut (Ctrl + M or Cmd + M) to toggle miniature voice mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  const handleClick = () => {
    if (!user) {
      toast('Please login to use Voice Assistant');
      return;
    }
    if (!selectedChat) {
      toast('Please select or create a chat first');
      return;
    }

    if (status === 'listening') {
      stopEverything();
    } else if (status === 'speaking' || status === 'thinking') {
      stopEverything();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    
    window.speechSynthesis.cancel();
    isProcessingRef.current = false;
    setTranscript('');
    setAiResponseText('');
    setErrorMessage('');
    // Clear parent prompt initially when starting fresh voice recording
    if (setParentPrompt) setParentPrompt('');
    
    try {
      recognitionRef.current.start();
      setStatus('listening');
    } catch (e) {
      setStatus('listening');
    }
  };

  const stopEverything = () => {
    isProcessingRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    window.speechSynthesis.cancel();
    setStatus('idle');
  };

  // Strip markdown formatting for smooth text-to-speech reading
  const cleanTextForSpeech = (text) => {
    return text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/[*#_`~]/g, '') // Remove basic markdown characters
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
      .trim();
  };

  // Speak AI response aloud using Web Speech Synthesis
  const speakResponse = (text) => {
    if (!window.speechSynthesis) {
      setStatus('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      setStatus('idle');
      return;
    }

    setAiResponseText(cleanText);
    setStatus('speaking');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onend = () => {
      setStatus('idle');
    };

    utterance.onerror = () => {
      setStatus('idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  // Automatically submit voice message to backend and read response aloud
  const handleVoiceSubmit = async (finalText) => {
    if (!finalText || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setStatus('thinking');

    const chatId = selectedChat?._id;
    if (!chatId) {
      toast.error('Active chat session lost.');
      setStatus('idle');
      isProcessingRef.current = false;
      return;
    }

    // Append user message locally to chat history exactly like ChatBox.jsx
    const userMsg = { role: 'user', content: finalText, timestamp: Date.now(), isImage: false };
    const currentMessages = messages || [];
    const updatedMessages = [...currentMessages, userMsg];
    syncMessages(chatId, updatedMessages);

    // Keep text format inside the input box cleanly populated
    if (setParentPrompt) setParentPrompt(finalText);

    try {
      const { data } = await axios.post(
        `/api/message/text`,
        { chatId, prompt: finalText, isPublished: true },
        { headers: { Authorization: token } }
      );

      if (data.success) {
        syncMessages(chatId, [...updatedMessages, data.reply]);
        setUser(prev => ({ ...prev, credits: prev.credits - 1 }));
        // Speak response aloud automatically
        speakResponse(data.reply.content);
        // Clear input format box once successfully posted and answered
        if (setParentPrompt) setParentPrompt('');
      } else {
        toast.error(data.message || 'Failed to get AI response');
        setStatus('idle');
        isProcessingRef.current = false;
      }
    } catch (err) {
      console.error('Voice submission error:', err);
      toast.error(err.message || 'Error communicating with AI server');
      setStatus('idle');
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Miniature Floating Status Popover when active */}
      {status !== 'idle' && (
        <div className="absolute bottom-full right-0 mb-3 w-64 md:w-72 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 z-50 animate-fade-in flex flex-col gap-2 transition-all">
          
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                status === 'listening' ? 'bg-purple-500 animate-ping' :
                status === 'speaking' ? 'bg-green-500 animate-pulse' :
                'bg-indigo-500'
              }`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                {status === 'listening' && 'Listening...'}
                {status === 'thinking' && 'Thinking...'}
                {status === 'speaking' && 'Speaking...'}
                {status === 'error' && 'Error'}
              </span>
            </div>

            {/* Quick action to stop/cancel */}
            <button
              type="button"
              onClick={stopEverything}
              className="text-[10px] bg-gray-100 dark:bg-white/5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-300 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded transition-all"
            >
              Stop
            </button>
          </div>

          {/* Miniature body content */}
          <div className="text-xs text-gray-600 dark:text-gray-300 min-h-[2rem] flex flex-col justify-center">
            {status === 'listening' && (
              <p className="italic line-clamp-2">
                {transcript ? `"${transcript}"` : <span className="text-gray-400">Speak now...</span>}
              </p>
            )}

            {status === 'thinking' && (
              <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400 py-1">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Processing voice input...</span>
              </div>
            )}

            {status === 'speaking' && (
              <div className="space-y-1">
                {/* Audio Wavebars */}
                <div className="flex items-center gap-1 h-3">
                  <span className="w-1 bg-green-500 rounded-full h-1 animate-[wave_1s_ease-in-out_infinite]" />
                  <span className="w-1 bg-green-500 rounded-full h-3 animate-[wave_1s_ease-in-out_infinite_0.2s]" />
                  <span className="w-1 bg-green-500 rounded-full h-2 animate-[wave_1s_ease-in-out_infinite_0.4s]" />
                  <span className="w-1 bg-green-500 rounded-full h-3 animate-[wave_1s_ease-in-out_infinite_0.6s]" />
                  <span className="w-1 bg-green-500 rounded-full h-1 animate-[wave_1s_ease-in-out_infinite_0.8s]" />
                </div>
                <p className="line-clamp-2 font-medium text-green-600 dark:text-green-400 text-[11px]">
                  "{aiResponseText}"
                </p>
              </div>
            )}

            {status === 'error' && (
              <p className="text-red-500 dark:text-red-400">{errorMessage}</p>
            )}
          </div>

        </div>
      )}

      {/* Trigger Button inline in input bar */}
      <button
        type="button"
        onClick={handleClick}
        title={status === 'listening' ? "Stop listening" : "Voice mode"}
        className={`relative p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
          status === 'listening'
            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 scale-105 ring-2 ring-purple-500/50 animate-pulse'
            : status === 'speaking'
            ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 ring-2 ring-green-500/50'
            : status === 'thinking'
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-white/5'
        }`}
      >
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 transition-transform active:scale-95"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 10v2a7 7 0 01-14 0v-2m7 9v3m-3 0h6"
          />
        </svg>

        {/* Live Status indicator dot directly on icon */}
        {status !== 'idle' && (
          <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#212121] ${
            status === 'listening' ? 'bg-purple-500' :
            status === 'speaking' ? 'bg-green-500' :
            'bg-indigo-500'
          }`} />
        )}
      </button>

      {/* Inline styles for wavebars */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistant;

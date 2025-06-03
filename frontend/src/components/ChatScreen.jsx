import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import tatamiRoomLight from '../assets/room.png';
import tatamiRoomDark from '../assets/roomd.png';
import kagamiAvatar from '../assets/avatars/kagami.png';

function ChatScreen({
  sessionId,
  condition,
  backendCondition,
  participantId,
  initialMessages,
  userAvatarUrl,
  selectedAvatarUrl,
  kagamiChatAvatar,
  apiBaseUrl,
  logFrontendEvent,
  onChatEndSignal,
  darkMode
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [remainingTime, setRemainingTime] = useState(35); // Short for testing, change to 600 for experiment
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionEndTriggered, setSessionEndTriggered] = useState(false); // NEW STATE FOR DUPLICATE CALLS
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); // 👈 For input focus

  const backgroundImage = darkMode ? tatamiRoomDark : tatamiRoomLight;
  const chatBubbleAiAvatar = kagamiChatAvatar || kagamiAvatar;
  const userChatAvatar = backendCondition.avatarType === 'generated'
    ? userAvatarUrl
    : selectedAvatarUrl;

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      const formatted = initialMessages
        .filter(msg => msg.content && msg.role)
        .map(msg => ({
          sender: msg.role === 'assistant' ? 'bot' : 'user',
          text: msg.content
        }));
      setMessages(formatted);
    }
  }, [initialMessages]);

  // COMBINED AUTO-FOCUS EFFECT: Ensures input is focused on load and after messages
  // and handles potential race conditions with a slight delay.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      inputRef.current?.focus();
    }, 100); // Small delay to ensure element is rendered
    return () => clearTimeout(timeoutId); // Cleanup timeout on unmount
  }, [messages, isSending]); // Re-focus when messages change (new bot response) or sending state changes

  // Timer useEffect with sessionEndTriggered flag
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setSessionExpired(true);
          document.body.style.filter = 'grayscale(100%)';
          // --- IMPORTANT: Only call onChatEndSignal once ---
          if (!sessionEndTriggered) {
            setSessionEndTriggered(true); // Set the flag to true
            onChatEndSignal();
          }
          // --- END IMPORTANT ---
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onChatEndSignal, sessionEndTriggered]); // Added sessionEndTriggered to deps

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending || sessionExpired) return;

    const userMessageText = inputMessage.trim();
    const userMessage = { text: userMessageText, sender: 'user' };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    const thinkingMessage = { text: '...', sender: 'bot-thinking' };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      const res = await axios.post(`${apiBaseUrl}/api/session/message`, {
        sessionId,
        message: userMessageText,
      });

      const botMessageText = res.data.response;
      const botMessage = { text: botMessageText, sender: 'bot' };

      setMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(msg => msg.sender === 'bot-thinking');
        if (thinkingIndex > -1) {
          newMessages[thinkingIndex] = botMessage;
        } else {
          newMessages.push(botMessage);
        }
        return newMessages;
      });
      setError(null);
    } catch (err) {
      const errorMessage = { text: 'Oops, something went wrong. Please try again.', sender: 'bot' };
      setMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(msg => msg.sender === 'bot-thinking');
        if (thinkingIndex > -1) {
          newMessages[thinkingIndex] = errorMessage;
        } else {
          newMessages.push(errorMessage);
        }
        return newMessages;
      });
      setError('Message failed to send.');
    } finally {
      setIsSending(false);
      // No need for inputRef.current?.focus() here, as the combined useEffect handles it
      // when `isSending` changes.
    }
  };

  const noAvatar = !backendCondition.avatar;

  return (
    <div className="relative w-full h-full">
      <img
        src={backgroundImage}
        className="absolute -top-[72px] sm:-top-[80px] left-0 right-0 w-full object-cover z-0 pointer-events-none select-none h-[calc(100%+72px)] sm:h-[calc(100%+80px)]"
        alt="Tatami Background"
      />

      {/* Chat Bubble Box */}
      <div
        className={`absolute z-20 overflow-y-auto px-6 py-4 backdrop-blur-md shadow-md
        ${noAvatar
          ? 'inset-x-4 top-0 bottom-20 bg-[#FFF0D0]/80 dark:bg-[#1a1a3a]/70 rounded-[40px]'
          : 'inset-x-4 max-h-[44vh] top-6 rounded-[40px] bg-[#FFF0D0]/90 dark:bg-[#1a1a3a]/80'
        }`}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} items-end mb-2`}
          >
            {msg.sender === 'bot' || msg.sender === 'bot-thinking' ? (
              backendCondition.avatar && ( // Only show Kagami avatar if avatar condition is true
                <img src={chatBubbleAiAvatar} alt="Kagami" className="w-12 h-12 mr-3 rounded-full" />
              )
            ) : null}

            {msg.sender === 'bot-thinking' ? (
              <div className="max-w-[60%] px-5 py-3 rounded-3xl text-base font-medium shadow bg-yellow-400 text-blue-900">
                <span className="animate-pulse-dots">
                  Kagami is typing<span className="dot1">.</span><span className="dot2">.</span><span className="dot3">.</span>
                </span>
              </div>
            ) : (
              <div
                className={`max-w-[60%] px-5 py-3 rounded-3xl text-base font-medium shadow ${
                  msg.sender === 'user'
                    ? 'bg-pink-200 text-blue-900'
                    : 'bg-yellow-400 text-blue-900'
                }`}
              >
                {msg.text}
              </div>
            )}

            {msg.sender === 'user' && backendCondition.avatar && ( // Only show user avatar if avatar condition is true
              <img src={userChatAvatar} alt="User" className="w-12 h-12 ml-3 rounded-full" />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Seated Avatars (conditionally rendered) */}
      {backendCondition.avatar && (
        <div className="absolute bottom-[80px] w-full flex justify-center items-end z-10 pointer-events-none">
          <img src={kagamiAvatar} alt="Kagami" className="h-64 object-contain" />
          <img src={userChatAvatar} alt="User" className="h-64 object-contain" />
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={sendMessage} className="absolute bottom-0 w-full px-4 py-3 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center px-4 py-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending || sessionExpired}
            placeholder={isSending ? "Sending..." : (sessionExpired ? "Session ended." : "Type a message...")}
            className="flex-1 border-none focus:outline-none text-base bg-transparent text-black dark:text-white"
          />
          <button
            type="submit"
            disabled={isSending || sessionExpired || !inputMessage.trim()}
            className="ml-2 p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5 transform rotate-45" />
          </button>
        </div>
      </form>

      {/* Typing animation keyframes */}
      <style>{`
        .animate-pulse-dots span {
          opacity: 0;
          animation: blink-dots 1.4s infinite;
        }

        .animate-pulse-dots .dot1 { animation-delay: 0s; }
        .animate-pulse-dots .dot2 { animation-delay: 0.2s; }
        .animate-pulse-dots .dot3 { animation-delay: 0.4s; }

        @keyframes blink-dots {
          0%, 25% { opacity: 0; }
          50% { opacity: 1; }
          75%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default ChatScreen;
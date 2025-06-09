import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import kagamiAvatar from '../assets/avatars/kagami.png';

function ChatScreen({
  sessionId,
  condition, // Keep this, useful for context if needed, though not directly for redirect
  backendCondition,
  participantId, // Keep this, useful for context if needed
  initialMessages,
  userAvatarUrl,
  selectedAvatarUrl,
  kagamiChatAvatar,
  apiBaseUrl,
  logFrontendEvent, // Prop for logging
  onChatEndSignal, // Prop from App.js
  darkMode,
  rooms
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [remainingTime, setRemainingTime] = useState(600); // 10 minutes
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionEndTriggered, setSessionEndTriggered] = useState(false); // To ensure end logic runs once

  // --- STATE FOR QUALTRICS REDIRECT ---
  const [postSurveyRedirectUrl, setPostSurveyRedirectUrl] = useState('');
  const [redirectError, setRedirectError] = useState(false); // To show a fallback message

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { roomLight, roomDark } = rooms;

  const { roomLightWebP, roomDarkWebP, roomLightPNG, roomDarkPNG } = rooms;
  const currentLightImage = darkMode ? roomDarkPNG : roomLightPNG;
  const currentWebpImage = darkMode ? roomDarkWebP : roomLightWebP;  const chatBubbleAiAvatar = kagamiChatAvatar || kagamiAvatar;
  const userChatAvatar = backendCondition.avatarType === 'generated'
    ? userAvatarUrl
    : selectedAvatarUrl;

  // --- PARSE QUERY PARAMETERS ON INITIAL LOAD (for QUALTRICS redirect URL) ---
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const qualtricsPostUrlFromQuery = queryParams.get('post_survey_url');

    if (qualtricsPostUrlFromQuery) {
      try {
        const decodedUrl = decodeURIComponent(qualtricsPostUrlFromQuery);
        setPostSurveyRedirectUrl(decodedUrl);
        console.log("ChatScreen: Qualtrics Post Survey URL received and set:", decodedUrl);
        // Optional: logFrontendEvent('post_survey_url_received', { url: decodedUrl });
      } catch (e) {
        console.error("ChatScreen: Error decoding post_survey_url:", e, qualtricsPostUrlFromQuery);
        setRedirectError(true); // Treat decoding failure as an error
      }
    } else {
      console.error("CRITICAL: ChatScreen - Qualtrics post_survey_url not found in query parameters!");
      setRedirectError(true); // Set error state
      // Optional: logFrontendEvent('post_survey_url_missing');
    }
  }, []); // Empty dependency array: run only once on mount

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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!sessionExpired) { // Only focus if session is not expired
         inputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isSending, sessionExpired]); // Add sessionExpired

  useEffect(() => {
    if (!sessionId) {
      console.warn("ChatScreen: Timer not started, sessionId is missing.");
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!sessionEndTriggered) { 
            setSessionEndTriggered(true); 
            setSessionExpired(true);      
            document.body.style.filter = 'grayscale(100%)'; 

            const endSessionFlow = async () => {
              try {
                console.log("ChatScreen: Timer expired. Attempting to end session on backend:", sessionId);
                await axios.post(`${apiBaseUrl}/api/session/end`, { sessionId });
                console.log("ChatScreen: Backend session end signal sent successfully.");
                if (logFrontendEvent) logFrontendEvent('backend_session_end_by_timer', { sessionId });
              } catch (error) {
                console.error('ChatScreen: Failed to signal session end to backend:', error);
                if (logFrontendEvent) logFrontendEvent('backend_session_end_by_timer_failed', { sessionId, error: error.message });
              } finally {
                if (onChatEndSignal) {
                    onChatEndSignal();
                }

                // Redirect after a delay
                setTimeout(() => {
                  if (postSurveyRedirectUrl) {
                    console.log("ChatScreen: Redirecting to Qualtrics post-survey:", postSurveyRedirectUrl);
                    window.location.href = postSurveyRedirectUrl;
                  } else {
                    console.error("ChatScreen: Cannot redirect. Post-survey URL was not set or found. Fallback message should be shown.");
                    // `redirectError` should already be true if URL was missing/invalid from mount,
                    // but ensure it's set if postSurveyRedirectUrl is unexpectedly falsy here.
                    setRedirectError(true);
                  }
                }, 2000); // 2-second delay
              }
            };
            endSessionFlow();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId, apiBaseUrl, postSurveyRedirectUrl, onChatEndSignal, sessionEndTriggered, logFrontendEvent]);

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
      // setError(null); // If using this for message send error
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
      // setError('Message failed to send.'); // If using this for message send error
      console.error("ChatScreen: Error sending message:", err); // Log the error
      if (logFrontendEvent) logFrontendEvent('chat_message_send_failed', { error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const noAvatar = !backendCondition.avatar;

  // --- UI FOR REDIRECT ERROR ---
  if (sessionExpired && redirectError && !postSurveyRedirectUrl) {
    return (
      <div style={{
          width: '100%', height: '100vh', display: 'flex',
          flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          textAlign: 'center', padding: '20px', fontFamily: 'Arial, sans-serif',
          backgroundColor: darkMode ? '#1a1a3a' : '#FFF0D0', 
          color: darkMode ? 'white' : 'black',
          filter: 'grayscale(100%)' // Keep grayscale
      }}>
        <h2>Thank You!</h2>
        <p>Your chat session has concluded.</p>
        <p style={{color: 'red', marginTop: '20px'}}>
          There was an issue automatically redirecting you to the final survey.
        </p>
        <p>
          Please return to the Qualtrics tab or window you used for the initial survey.
        </p>
        <p style={{marginTop: '10px'}}>
          If you continue to have issues, please contact the research coordinator.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className={`${darkMode ? 'bg-gray-700 text-white' : 'bg-white/80 text-gray-700'} backdrop-blur-sm px-4 py-1 rounded-full text-sm`}>
          {sessionExpired
            ? "Chat session ended. Preparing to redirect..."
            : `Time left: ${Math.floor(remainingTime / 60)
                .toString()
                .padStart(2, '0')}:${(remainingTime % 60).toString().padStart(2, '0')}`}
        </div>
      </div>

      <picture>
            <source srcSet={currentWebpImage} type="image/webp" />
            <img
                src={currentLightImage}
        className="absolute -top-[72px] sm:-top-[80px] left-0 right-0 w-full object-cover z-0 pointer-events-none select-none h-[calc(100%+72px)] sm:h-[calc(100%+80px)]"
        alt="Background"
      />
        </picture>

      <div
        className={`absolute z-20 overflow-y-auto px-6 py-4 backdrop-blur-md shadow-md
        ${noAvatar
          ? 'inset-x-4 top-0 bottom-20 bg-[#FFF0D0]/80 dark:bg-[#1a1a3a]/70 rounded-[40px]'
          : 'inset-x-4 max-h-[44vh] top-6 rounded-[40px] bg-[#FFF0D0]/90 dark:bg-[#1a1a3a]/80'
        }
        ${sessionExpired ? 'pointer-events-none' : ''}`}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} items-end mb-2`}
          >
            {msg.sender === 'bot' || msg.sender === 'bot-thinking' ? (
              backendCondition.avatar && (
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

            {msg.sender === 'user' && backendCondition.avatar && (
              <img src={userChatAvatar} alt="User" className="w-12 h-12 ml-3 rounded-full" />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {backendCondition.avatar && (
        <div className={`absolute bottom-[80px] w-full flex justify-center items-end z-10 pointer-events-none ${sessionExpired ? 'opacity-50' : ''}`}>
          <img src={kagamiAvatar} alt="Kagami" className="h-64 object-contain" />
          <img src={userChatAvatar} alt="User" className="h-64 object-contain" />
        </div>
      )}

      <form onSubmit={sendMessage} className={`absolute bottom-0 w-full px-4 py-3 z-50 ${sessionExpired ? 'opacity-50 pointer-events-none' : ''}`}>
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

      <style>{`
        .animate-pulse-dots span { opacity: 0; animation: blink-dots 1.4s infinite; }
        .animate-pulse-dots .dot1 { animation-delay: 0s; }
        .animate-pulse-dots .dot2 { animation-delay: 0.2s; }
        .animate-pulse-dots .dot3 { animation-delay: 0.4s; }
        @keyframes blink-dots { 0%, 25% { opacity: 0; } 50% { opacity: 1; } 75%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

export default ChatScreen;
import React, { useState, useRef, useEffect } from 'react';
import kagamiAvatar from '../assets/avatars/kagami.png';
import backgroundImage from '../assets/background_chat.png';
import axios from 'axios';
import smileIcon from '../assets/smile.png'; // Adjust path if needed
import { EmojiPicker } from 'frimousse'; // Make sure this library is installed

// Added 'backendCondition' prop to receive the condition object { avatar: bool, lsm: bool }
export default function ChatInterface({ sessionId, condition, backendCondition, userAvatarUrl, selectedAvatarUrl, apiBaseUrl, initialMessages, participantId, onEndSession }) {
  const conditionString = String(condition || ''); // This is the name like 'avatar_premade_adaptive'
  const isGenerated = conditionString.includes('generated');
  const isPregenerated = conditionString.includes('premade');
  const isNoAvatar = conditionString.includes('noavatar');

  const userAvatar = isGenerated ? userAvatarUrl : selectedAvatarUrl;

  const [messages, setMessages] = useState(() =>
    initialMessages && initialMessages.length > 0
      ? initialMessages
          .filter(msg => msg.content && msg.role)
          .map(msg => ({
            sender: msg.role === 'assistant' ? 'bot' : 'user',
            text: msg.content
          }))
      : []
  );

  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [remainingTime, setRemainingTime] = useState(600); // 600 seconds = 10 min
  const [sessionExpired, setSessionExpired] = useState(false);
  
  // Scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages]);

  // Detect click outside emoji picker
  useEffect(() => {
    const handleClickOutside = event => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // --- Log the backend condition when the component mounts ---
  useEffect(() => {
    console.log("ChatInterface loaded. Session ID:", sessionId);
    // This backendCondition prop comes from App.jsx and contains the { avatar: bool, lsm: bool } object
    console.log("Backend Condition:", backendCondition);
    console.log("LSM enabled for this session:", backendCondition?.lsm); // Check the 'lsm' key directly

  }, [sessionId, backendCondition]); // Effect runs when sessionId or backendCondition props change (mostly once on mount)

  useEffect(() => {
    const countdown = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          setSessionExpired(true);
          document.body.style.filter = 'grayscale(100%)';
          setTimeout(() => {
            window.location.href = "https://redcap.example.com/survey"; // 🔁 Replace with your actual URL
          }, 2000); // small delay for UX
          return 0;
        }
        return prev - 1;
      });
    }, 1000); // Tick every second
  
    return () => clearInterval(countdown);
  }, []);
  

  // Send message to backend
  const handleSend = async () => {
    if (inputValue.trim() === '' || !sessionId || isLoading) return;

    const userMessage = { sender: 'user', text: inputValue };
    // Add user message to history immediately for responsive UI
    setMessages(prev => [...prev, userMessage]);

    const currentInput = inputValue;
    setInputValue('');
    setShowEmojiPicker(false);
    setIsLoading(true);

    // Add a 'thinking' indicator
    const thinkingMessage = { sender: 'bot-thinking', text: '...' };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // --- Send message to the backend ---
      const response = await axios.post(`${apiBaseUrl}/api/session/message`, {
        sessionId,
        message: currentInput
      });

      // --- Place console logs HERE to see the response data including LSM scores ---
      console.log("Message response received:", response.data);
      // Access the LSM scores directly from the response data
      console.log("Raw LSM Score for this turn:", response.data.lsmScore);
      console.log("Smoothed LSM Score after this turn:", response.data.smoothedLsmAfterTurn);
      // Also log the style profile used for the bot's generation
      console.log("Bot Style Profile Used (includes prev smoothed LSM):", response.data.styleProfile);


      const botMessage = { sender: 'bot', text: response.data.response };

      // Replace thinking indicator with the actual bot message
      setMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(msg => msg.sender === 'bot-thinking');
        if (thinkingIndex > -1) newMessages[thinkingIndex] = botMessage;
        else newMessages.push(botMessage); // Fallback if thinking message wasn't found for some reason
        return newMessages;
      });

    } catch (error) {
      console.error('Error sending message:', error);
      // Log detailed error response if available
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
      }
      const fallbackBot = { sender: 'bot', text: 'Oops, something went wrong. Please try again.' };
       // Replace thinking indicator with the fallback error message
      setMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(msg => msg.sender === 'bot-thinking');
        if (thinkingIndex > -1) newMessages[thinkingIndex] = fallbackBot;
        else newMessages.push(fallbackBot); // Fallback
        return newMessages;
      });
    } finally {
      // Ensure loading is set to false regardless of success or failure
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        width: '100%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
{/* Countdown Timer just above input */}
<div className="fixed bottom-[80px] w-full flex justify-center z-40">
  <div className="bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full text-gray-700 text-sm font-mono shadow">
    {sessionExpired
      ? "Session ended"
      : `Time left: ${Math.floor(remainingTime / 60)
          .toString()
          .padStart(2, '0')}:${(remainingTime % 60).toString().padStart(2, '0')}`}
  </div>
</div>

      {/* Messages */}
      {/* Adjusted positioning slightly to accommodate avatar space */}
      <div className="absolute bottom-[48vh] left-1/2 transform -translate-x-1/2 w-full max-w-3xl flex flex-col items-center px-2 space-y-2 overflow-y-auto h-[calc(100vh - 53vh - 80px)] pb-4"> {/* Added max-w-3xl and height/overflow */}
        {messages.map((msg, idx) => {
          if (msg.sender === 'bot-thinking') {
            return (
              <div
                key={`thinking-${idx}`}
                // Use left alignment for bot thinking indicator
                className="max-w-xs sm:max-w-sm md:max-w-md px-4 py-2 rounded-2xl bg-[#3B3B3B] text-[#ffffff] self-start animate-pulse" // Removed specific margins, added self-start
              >
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-1"></div>
                <div className="h-4 bg-gray-600 rounded w-1/2"></div>
              </div>
            );
          }
          return (
            <div
              key={idx}
              className={`max-w-xs sm:max-w-sm md:max-w-md px-4 py-2 rounded-2xl whitespace-pre-wrap ${
                msg.sender === 'bot'
                  ? 'bg-[#3B3B3B] text-[#ffffff] self-start'
                  : 'bg-[#DEDEDE] text-[#222222] self-end'
              }`}
            >
              {msg.text.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Avatars + Table */}
      {/* Ensure these are positioned correctly relative to the bottom */}
      {!isNoAvatar && (
        <>
          <div className="fixed bottom-20 w-full flex justify-center items-end z-40 pointer-events-none"> {/* Added pointer-events-none */}
            <img
              src={kagamiAvatar}
              alt="Kagami Avatar"
              className="h-[45vh] max-h-[550px] w-auto object-contain mr-[-5rem]" // Adjusted margin slightly
            />
            <img
              src={userAvatar}
              alt="User Avatar"
              className="h-[45vh] max-h-[550px] w-auto object-contain ml-[-5rem]" // Adjusted margin slightly
            />
          </div>
        </>
      )}

      {/* Chat Input */}
      <div className="fixed bottom-0 w-full flex justify-center p-4 z-50">
        <div className="flex w-full max-w-3xl items-center bg-white rounded-full shadow-md px-4 py-2"> {/* Added max-w-3xl */}
        <div className="relative mr-2 hidden sm:block">
          <button
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className="block"
            aria-label="Toggle Emoji Picker"
          >
            <img
              src={smileIcon}
              alt="Emoji Picker Icon"
              className="w-6 h-6"
            />
          </button>
            {showEmojiPicker && (
              <div
                ref={pickerRef}
                // Adjusted positioning to be above the input bar
                className="absolute bottom-full mb-6 left-0 z-50 p-2 bg-white rounded-xl shadow-lg border border-gray-200 w-64 max-h-80 overflow-y-auto"
              >
                {/* Ensure EmojiPicker children handle interaction correctly */}
                <EmojiPicker.Root onEmojiSelect={({ emoji }) => setInputValue(prev => prev + emoji)}>
                  <EmojiPicker.Search className="p-2 border-b w-full" /> {/* Added w-full */}
                  <EmojiPicker.Viewport className="overflow-y-auto flex-grow"> {/* Added flex-grow */}
                    <EmojiPicker.Loading>Loading…</EmojiPicker.Loading>
                    <EmojiPicker.Empty>No emoji found.</EmojiPicker.Empty>
                    <EmojiPicker.List className="p-2 text-2xl grid gap-1" /> {/* Use grid for layout */}
                  </EmojiPicker.Viewport>
                </EmojiPicker.Root>
              </div>
            )}
          </div>
          <input
            type="text"
            className="flex-1 border-none focus:outline-none text-lg"
            placeholder={isLoading ? "Sending..." : "Type a message..."}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`ml-2 rounded-full px-4 py-2 transition ${
              !inputValue.trim() || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
      {/* Optional End Session Button (Add this if you need one) */}
      {/* <button
         onClick={onEndSession}
         className="fixed top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
      >
        End Session
      </button> */}
    </div>
  );
}
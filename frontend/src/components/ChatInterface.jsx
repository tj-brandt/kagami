// /Kagami/Frontend/src/components/ChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import capybara from "../assets/capybara.png";
import bground from "../assets/bground.png"

// --- Constants ---
const FRONTEND_DEFAULT_BOT_NAME = "Kagami";
const FRONTEND_NO_AVATAR_BOT_NAME = "Kagami";
const API_BASE_URL = 'http://localhost:8000';

// --- SVG Icon for Send Button (Up Arrow Circle - closer to prototype) ---
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm.53 5.47a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72v5.69a.75.75 0 001.5 0v-5.69l1.72 1.72a.75.75 0 101.06-1.06l-3-3z" clipRule="evenodd" />
  </svg>
);


// --- Chat Interface Component ---
function ChatInterface({ sessionId, condition, initialMessages }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef(null);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastBotMessage = lastMessage?.role === 'assistant' ? lastMessage : null;
  const secondLastMessage = messages.length > 1 ? messages[messages.length - 2] : null;
  const userPrompted = secondLastMessage?.role === 'user';

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastBotMessage]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const messageText = newMessage.trim();
    if (!messageText || isTyping) return;

    const userMessage = { role: 'user', content: messageText };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setNewMessage('');
    setIsTyping(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/session/message`, {
        sessionId: sessionId,
        message: messageText,
      });

      const { response: botResponseContent, styleProfile, lsmScore, smoothedLsmAfterTurn } = response.data;

      const botMessage = {
        role: 'assistant',
        content: botResponseContent,
        avatarDisplayed: condition.avatar,
        debugInfo: { styleProfile, lsmScore, smoothedLsmAfterTurn },
      };

      setMessages((prevMessages) => [...prevMessages, botMessage]);
      console.log('Bot Response Data:', response.data);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { role: 'assistant', content: 'Oops! Something went wrong. Please try again.' };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${bground})`}}
    >
      {/* Chat Box */}
      <motion.div
        className="absolute bottom-[10vh] inset-x-0 mx-auto z-10
                   w-[75%] max-w-3xl h-[18vh] min-h-[120px] max-h-[200px]
                   bg-white/80 backdrop-blur-sm rounded-xl shadow-lg
                   flex flex-col p-3"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex-grow overflow-y-auto mb-2 pr-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
          <AnimatePresence>
            {lastBotMessage && (
              <motion.div
                key={messages.length - 1}
                className="inline-block max-w-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-gray-100 text-gray-800 p-3 rounded-xl rounded-bl-none text-base leading-snug shadow-sm">
                  {lastBotMessage.content}
                </div>
              </motion.div>
            )}

            {isTyping && !lastBotMessage && (
              <motion.div
                key="typing-indicator-box"
                className="inline-block p-3 rounded-xl bg-gray-200 text-gray-600 shadow-sm rounded-bl-none text-sm italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {condition.avatar ? `${FRONTEND_DEFAULT_BOT_NAME} is thinking...` : `${FRONTEND_NO_AVATAR_BOT_NAME} is thinking...`}
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatBottomRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 flex-shrink-0">
          <button
            type="button"
            className="bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-full hover:bg-gray-300 transition duration-150 whitespace-nowrap"
          >
            MiruSync
          </button>
          <input
            type="text"
            className="flex-grow rounded-lg border-none bg-transparent p-3 focus:outline-none focus:ring-0 placeholder-gray-500 text-base"
            placeholder={userPrompted ? "Great question! I would like to..." : "Type your message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isTyping}
          />
          <button
            type="submit"
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition duration-200 ease-in-out
              ${newMessage.trim() && !isTyping ? 'bg-gray-700 hover:bg-gray-900 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
            disabled={!newMessage.trim() || isTyping}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </form>
      </motion.div>

      {/* Capy Image */}
      <motion.img
        src={capybara}
        alt="Kagami"
        className="absolute bottom-20 inset-x-0 mx-auto
                   max-h-[50vh] w-auto h-auto object-contain z-0"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      />
    </div>
  );
}

export default ChatInterface;

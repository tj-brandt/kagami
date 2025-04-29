import React, { useState, useRef, useEffect } from 'react';
import tableImage from '../assets/table.png';
import kagamiAvatar from '../assets/avatars/capybara.png';
import backgroundImage from '../assets/background_chat.png';
import axios from 'axios';
import { EmojiPicker } from 'frimousse';

export default function ChatInterface({ condition, userAvatarUrl, selectedAvatarUrl }) {
  const conditionString = String(condition || '');
  const isGenerated = conditionString.includes('generated');
  const isPregenerated = conditionString.includes('premade');
  const isNoAvatar = conditionString.includes('noavatar');

  const userAvatar = isGenerated ? userAvatarUrl : selectedAvatarUrl;

  const [messages, setMessages] = useState([
    { sender: 'bot', text: "So tell me, how's your day going?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 👇 Detect outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSend = async () => {
    if (inputValue.trim() === '') return;

    const userMessage = { sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowEmojiPicker(false);

    try {
      const fakeBotReply = "I'm just pretending to be smart for now!";
      const botMessage = { sender: 'bot', text: fakeBotReply };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const fallbackBot = { sender: 'bot', text: "Oops, something went wrong." };
      setMessages(prev => [...prev, fallbackBot]);
    }
  };

  const handleKeyDown = (e) => {
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
        overflow: 'hidden',
      }}
    >
      {/* 🧡 Messages */}
      <div className="absolute bottom-[53vh] w-full flex flex-col items-center px-2 space-y-2">
        {messages.map((msg, idx) => (
          <div
          key={idx}
          className={`max-w-xs sm:max-w-sm md:max-w-md px-4 py-2 rounded-2xl ${
            msg.sender === 'bot'
              ? 'bg-[#3B3B3B] text-[#ffffff] mr-40 md:mr-80'
              : 'bg-[#DEDEDE] text-[#222222] ml-40 md:ml-80'
          }`}
        >
          {msg.text}
        </div>
        ))}
      </div>



      {/* 🐾 Avatars + Table */}
      {!isNoAvatar && (
        <>
          <div className="absolute bottom-20 w-full flex justify-center items-end">
            <img
              src={kagamiAvatar}
              alt="Kagami Avatar"
              className="h-[45vh] max-h-[550px] w-auto object-contain"
            />
            <img
              src={userAvatar}
              alt="User Avatar"
              className="h-[45vh] max-h-[550px] w-auto object-contain sm:ml-[-10rem] ml-[-10rem]"
            />
          </div>
          <img
            src={tableImage}
            alt="Table"
            className="absolute max-w-3xl object-contain left-1/2 transform -translate-x-1/2 sm:bottom-[-100px] bottom-[-100px]"
            style={{ zIndex: 20 }}
          />
        </>
      )}

      {/* 💬 Chat Input */}
      <div className="absolute bottom-0 w-full flex justify-center  p-4 z-30">
        <div className="flex w-full max-w-3xl items-center bg-white rounded-full shadow-md px-4 py-2">
          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className="text-2xl hidden sm:block mr-2"
          >
            😊
          </button>

          {/* Text Input */}
          <input
            type="text"
            className="flex-1 border-none focus:outline-none text-lg"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={`ml-2 rounded-full px-4 py-2 transition ${
              !inputValue.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            Send
          </button>
        </div>
      </div>


        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={pickerRef}
            className="hidden sm:block absolute bottom-20 right-10 z-50 p-2 bg-white rounded-xl shadow-lg border border-gray-200 w-64 max-h-80 overflow-y-auto"
            style={{
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <EmojiPicker.Root onEmojiSelect={({ emoji }) => setInputValue(prev => prev + emoji)}>
              <EmojiPicker.Search className="p-2 border-b" />
              <EmojiPicker.Viewport className="overflow-y-auto">
                <EmojiPicker.Loading>Loading…</EmojiPicker.Loading>
                <EmojiPicker.Empty>No emoji found.</EmojiPicker.Empty>
                <EmojiPicker.List className="p-2 text-2xl" />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          </div>
        )}
      </div>
  
  );
}
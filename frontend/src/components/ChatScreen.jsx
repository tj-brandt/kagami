// src/components/ChatScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import useSessionStore from '../store/sessionStore';
import * as api from '../services/api';
import { PaperAirplaneIcon, SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import ChatMessage from './ChatMessage';

function ChatScreen({ logFrontendEvent, kagamiChatAvatar, darkMode, toggleDarkMode, remainingTime }) {
  const { messages, addMessage, replaceThinkingMessage, isSending, setIsSending } = useChatStore();
  const { sessionId, condition, userAvatarUrl, selectedAvatarUrl } = useSessionStore();

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };
  const formattedTime = formatTime(remainingTime);

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const textAreaRef = useRef(null);

  const participantAvatarUrl = condition?.avatarType === 'generated' ? userAvatarUrl : selectedAvatarUrl;
  const showAvatars = condition?.avatar !== false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
  const el = textAreaRef.current;
  if (el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.25)}px`;
  }
}, [inputMessage]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    addMessage({ text: trimmedMessage, sender: 'user' });
    addMessage({ text: '...', sender: 'bot-thinking' });
    setInputMessage('');
    
    try {
      const data = await api.sendMessage(sessionId, trimmedMessage);
      replaceThinkingMessage({ text: data.response, sender: 'bot' });
    } catch (err) {
      console.error("Error sending message:", err);
      replaceThinkingMessage({ text: 'I seem to be having trouble connecting.', sender: 'bot' });
    } finally {
      setIsSending(false);
      setTimeout(() => {
        textAreaRef.current?.focus();
      }, 0);
    }
  };
  
  const isFirstInSequence = (index) => {
    if (index === 0) return true;
    return messages[index].sender !== messages[index - 1].sender;
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-background">
      <div className="relative z-10 flex flex-col h-full w-full">
        <header className="flex-shrink-0 flex items-center justify-between p-4 bg-transparent">
          <div className="flex items-center gap-4 p-2 bg-card/10 backdrop-blur-sm rounded-lg">
            <h1 className="font-serif text-xl font-semibold text-foreground">Kagami</h1>
            <div className="text-sm font-serif text-foreground/80">
              {formattedTime}
            </div>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full text-foreground/70 hover:text-foreground bg-card/10 backdrop-blur-sm" aria-label="Toggle theme">
            {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg, index) => (
              <ChatMessage 
                key={index} 
                message={msg} 
                userAvatarUrl={participantAvatarUrl} 
                kagamiAvatarUrl={kagamiChatAvatar} 
                isFirstInSequence={isFirstInSequence(index)}
                showAvatars={showAvatars}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {showAvatars && (
          <div className="flex-shrink-0 h-32 sm:h-72 flex justify-center items-end pointer-events-none">
            <div className="relative flex items-end justify-center w-full max-w-lg h-full">
              <div className="absolute bottom-0 h-8 w-3/4 bg-black/10 rounded-full blur-xl -translate-y-2 sm:-translate-y-4"></div>
              <img src={kagamiChatAvatar} alt="Kagami" className="h-full object-contain transform -scale-x-100 drop-shadow-lg" />
              <img src={participantAvatarUrl} alt="User Avatar" className="h-full object-contain drop-shadow-lg" />
            </div>
          </div>
        )}

        <footer className="flex-shrink-0 p-4">
          <div className="w-full max-w-3xl mx-auto">
            <form 
              onSubmit={handleSend} 
              className="relative flex items-start w-full rounded-2xl bg-card border border-border/50 shadow-lg dark:shadow-2xl dark:shadow-black/20 focus-within:ring-1 focus-within:ring-border transition-shadow min-h-[104px] p-4"
            >
              <textarea 
                ref={textAreaRef} 
                value={inputMessage} 
                onChange={(e) => setInputMessage(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }} 
                placeholder="Type a message..." 
                rows={1} 
                disabled={isSending} 
                className="w-full bg-transparent text-foreground placeholder-foreground/50 resize-none border-none focus:ring-0 outline-none p-0 pr-14 text-base font-sans overflow-y-auto max-h-[25vh]" 
              />
              <button 
                type="submit" 
                disabled={!inputMessage.trim() || isSending} 
                className="absolute bottom-3 right-3 p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </footer>
      </div>

      <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); }}`}</style>
    </div>
  );
}

export default ChatScreen;
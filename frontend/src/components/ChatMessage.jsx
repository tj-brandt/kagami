// src/components/ChatMessage.jsx
import React from 'react';
import { motion } from 'framer-motion';

const ThinkingIndicator = () => (
  <div className="flex items-center gap-2"  role="status" aria-label="Kagami is typing">
    <div className="w-2 h-2 rounded-full bg-current animate-[bounce_1.4s_infinite_0.1s]"></div>
    <div className="w-2 h-2 rounded-full bg-current animate-[bounce_1.4s_infinite_0.2s]"></div>
    <div className="w-2 h-2 rounded-full bg-current animate-[bounce_1.4s_infinite_0.3s]"></div>
  </div>
);

export default function ChatMessage({ message, userAvatarUrl, kagamiAvatarUrl, isFirstInSequence, showAvatars }) {
  const isUser = message.sender === 'user';
  const isThinking = message.sender === 'bot-thinking';

  const Avatar = ({ url, name }) => {
    if (url) {
      return <img src={url} alt={`${name}'s Avatar`} className="w-8 h-8 rounded-full object-cover" />;
    }
    return (
      <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center font-bold text-foreground/80">
        {name.charAt(0)}
      </div>
    );
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-3 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && showAvatars && (
        <div className="w-8 h-8 flex-shrink-0">
          {isFirstInSequence && <Avatar url={kagamiAvatarUrl} name="K" />}
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`max-w-xl px-4 py-3 rounded-2xl border border-border ${
          isUser
            ? 'bg-gray-200 dark:bg-[#434343] text-foreground rounded-br-lg'
            : 'bg-card text-card-foreground rounded-bl-lg'
        }`}
      >
        {isThinking ? (
          <ThinkingIndicator />
        ) : (
          <p className={`${
            isUser 
              ? 'font-sans text-base' 
              : 'font-serif text-[18px]'
            } whitespace-pre-wrap`}>
            {message.text}
          </p>
        )}
      </div>

      {isUser && showAvatars && (
        <div className="w-8 h-8 flex-shrink-0">
          {isFirstInSequence && <Avatar url={userAvatarUrl} name="Y" />}
        </div>
      )}
    </motion.div>
  );
}
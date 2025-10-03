// frontend/src/store/chatStore.js
import { create } from 'zustand';

const formatMessages = (messages) => {
  if (!messages || !Array.isArray(messages)) return [];
  return messages
    .filter(msg => msg.content && msg.role)
    .map(msg => ({
      sender: msg.role === 'assistant' ? 'bot' : 'user',
      text: msg.content,
    }));
};

const useChatStore = create((set, get) => ({
  // --- STATE ---
  messages: [],
  isSending: false,

  setInitialMessages: (initialMessages) => {
    const formatted = formatMessages(initialMessages);
    set({ messages: formatted });
  },

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  
  replaceThinkingMessage: (botMessage) => set((state) => ({
    messages: state.messages.map(msg => 
      msg.sender === 'bot-thinking' ? botMessage : msg
    ),
  })),

  setIsSending: (status) => set({ isSending: status }),
  
  resetChat: () => set({ messages: [], isSending: false }),
}));

export default useChatStore;
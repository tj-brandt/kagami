// frontend/src/store/sessionStore.js
import { create } from 'zustand';

const useSessionStore = create((set, get) => ({
  // --- STATE ---
  phase: 'loading', // 'loading', 'intro', 'avatar', 'chat', 'survey', 'error'
  sessionId: null,
  participantId: null,
  condition: null,
  userAvatarUrl: '',      // For 'generated' condition
  selectedAvatarUrl: '',  // For 'premade' condition
  qualtricsReturnUrl: '',

  // --- ACTIONS ---
  // Sets the initial session data received from the backend
  initializeSession: (data) => set({
    sessionId: data.sessionId,
    condition: data.condition,
    initialMessages: data.initialHistory,
  }),
  
  // Controls the flow of the experiment UI
  setPhase: (newPhase) => set({ phase: newPhase }),

  // Stores participant info parsed from URL
  setParticipantDetails: (pid, returnUrl) => set({
    participantId: pid,
    qualtricsReturnUrl: returnUrl,
  }),

  // Sets the avatar after selection or generation
  setAvatar: ({ premade, generated }) => set({
    selectedAvatarUrl: premade || '',
    userAvatarUrl: generated || '',
  }),
  
  // Resets the state for a new session or on error
  resetSession: () => set({
    phase: 'loading',
    sessionId: null,
    participantId: null,
    condition: null,
    userAvatarUrl: '',
    selectedAvatarUrl: '',
    qualtricsReturnUrl: '',
  }),
}));

export default useSessionStore;
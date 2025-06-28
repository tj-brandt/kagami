// frontend/src/App.jsx

import React, { useEffect, useCallback, useState, useRef, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import useChatTimer from './hooks/useChatTimer'; 

// Zustand Stores
import useSessionStore from './store/sessionStore';
import useChatStore from './store/chatStore';

// API Service
import * as api from './services/api';

// Asset Imports
import frog from './assets/avatars/frog.webp';
import panda from './assets/avatars/panda.webp';
import sheep from './assets/avatars/sheep.webp';
import cat from './assets/avatars/cat.webp';
import capybara from './assets/avatars/capybara.webp';
import bird from './assets/avatars/bird.webp';
import elephant from './assets/avatars/elephant.webp';
import kagami from './assets/avatars/kagami.webp';
import kagamicrop from './assets/avatars/kagamicrop.webp';
import kagamiPlaceholder from './assets/avatars/kagami.webp';

// Static Component Imports
import SharedLayout from './components/SharedLayout';
import LoadingScreen from './components/LoadingScreen';

// Lazy-loaded Component Imports
const IntroductionScreen = lazy(() => import('./components/IntroductionScreen'));
const AvatarSelectionScreen = lazy(() => import('./components/AvatarSelectionScreen'));
const ChatScreen = lazy(() => import('./components/ChatScreen'));
const SurveyScreen = lazy(() => import('./components/SurveyScreen'));
const ErrorScreen = lazy(() => import('./components/ErrorScreen'));
const DemoEndScreen = lazy(() => import('./components/DemoEndScreen')); // For the demo flow

// --- Constants ---
const QUALTRICS_SURVEY_BASE_URL = 'https://umn.qualtrics.com/jfe/form/SV_cwkkYL6weAb92NU';
const LOADING_SCREEN_MIN_DISPLAY_TIME_MS = 3000;

// --- Main App Component ---
function App() {
  const location = useLocation();
  const { phase, sessionId, condition, qualtricsReturnUrl, setPhase, initializeSession, setParticipantDetails, setAvatar, resetSession } = useSessionStore();
  const { setInitialMessages, resetChat } = useChatStore();

  const [darkMode, setDarkMode] = useState(() => {
    if (localStorage.getItem('theme')) return localStorage.getItem('theme') === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const loadingStartTimeRef = useRef(null);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      document.documentElement.classList.toggle('dark', newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  }, []);

  const logEvent = useCallback(async (eventType, eventData = {}) => {
    const { sessionId, participantId } = useSessionStore.getState();
    const canLogWithoutIds = ['invalid_url_params', 'session_start_failed', 'demo_session_start_requested'].includes(eventType);
    if (!sessionId && !participantId && !canLogWithoutIds) {
      console.warn(`Log event "${eventType}" skipped: No session/participant ID.`);
      return;
    }
    try {
      await api.logFrontendEvent({ sessionId, participantId, eventType, eventData: { ...eventData, client_timestamp_utc: new Date().toISOString() } });
    } catch (error) {
      console.error(`Failed to log frontend event "${eventType}":`, error);
    }
  }, []);

  // --- Primary Effect: Handles both Demo and Experiment startup ---
  useEffect(() => {
    loadingStartTimeRef.current = Date.now();
    resetSession();
    resetChat();

    const isDemoMode = location.pathname.toLowerCase() === '/demo';

    if (isDemoMode) {
      // --- DEMO MODE LOGIC ---
      const demoParticipantId = `demo_user_${uuidv4().slice(0, 8)}`;
      const demoConditionName = 'premade_adaptive';
      
      setParticipantDetails(demoParticipantId, null); // No Qualtrics return URL for demo
      logEvent('demo_session_start_requested');

      api.startSession(demoParticipantId, demoConditionName)
        .then(data => {
          initializeSession(data);
          setInitialMessages(data.initialHistory || []);
          logEvent('demo_session_start_success', { backend_condition: data.condition });
          const elapsed = Date.now() - loadingStartTimeRef.current;
          const remainingDelay = Math.max(0, LOADING_SCREEN_MIN_DISPLAY_TIME_MS - elapsed);
          setTimeout(() => setPhase('intro'), remainingDelay);
        })
        .catch(error => {
          console.error('CRITICAL: Failed to start demo session.', error);
          logEvent('session_start_failed', { error: error.message, status: error.response?.status, mode: 'demo' });
          setPhase('error');
        });
    } else {
      // --- REGULAR EXPERIMENT LOGIC ---
      const urlParams = new URLSearchParams(window.location.search);
      const pidFromUrl = urlParams.get('PROLIFIC_PID');
      const avatarTypeFromUrl = urlParams.get('avatar')?.toLowerCase();
      const lsmTypeFromUrl = urlParams.get('lsm')?.toLowerCase();
      const responseIdFromUrl = urlParams.get('responseid');

      if (pidFromUrl && avatarTypeFromUrl && lsmTypeFromUrl && responseIdFromUrl) {
        const returnUrl = `${QUALTRICS_SURVEY_BASE_URL}?Q_R=${responseIdFromUrl}&ReturnedFromApp=true`;
        setParticipantDetails(pidFromUrl, returnUrl);
        
        const conditionName = `${avatarTypeFromUrl}_${lsmTypeFromUrl}`;
        logEvent('session_start_requested', { conditionName });

        api.startSession(pidFromUrl, conditionName)
          .then(data => {
            initializeSession(data);
            setInitialMessages(data.initialHistory || []);
            logEvent('session_start_success', { backend_condition: data.condition });
            const elapsed = Date.now() - loadingStartTimeRef.current;
            const remainingDelay = Math.max(0, LOADING_SCREEN_MIN_DISPLAY_TIME_MS - elapsed);
            setTimeout(() => setPhase('intro'), remainingDelay);
          })
          .catch(error => {
            console.error('CRITICAL: Failed to start session.', error);
            logEvent('session_start_failed', { error: error.message, status: error.response?.status, mode: 'experiment' });
            setPhase('error');
          });
      } else if (location.pathname !== '/') {
        console.error("CRITICAL: Missing or invalid URL parameters.");
        logEvent('invalid_url_params', { params: window.location.search });
        setPhase('error');
      }
    }
  }, [location.pathname, initializeSession, setInitialMessages, setParticipantDetails, setPhase, logEvent, resetSession, resetChat]);

  // --- Effect for body styles ---
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.body.style.overflow = phase === 'loading' || phase === 'chat' ? 'hidden' : 'auto';
  }, [phase, darkMode]);

  // --- Callback Handlers ---
  const handleIntroComplete = useCallback(() => {
    logEvent('intro_continue_clicked');
    setPhase(condition?.avatar ? 'avatar' : 'chat');
  }, [condition, setPhase, logEvent]);

  const handleAvatarSelected = useCallback(async (avatarUrl) => {
    logEvent('premade_avatar_selected', { avatarUrl });
    setAvatar({ premade: avatarUrl });
    await api.setAvatarDetails(sessionId, avatarUrl);
    setPhase('chat');
  }, [sessionId, setAvatar, setPhase, logEvent]);

  const handleAvatarGenerated = useCallback(async (avatarData) => {
    logEvent('generated_avatar_confirmed', { avatarUrl: avatarData.url, prompt: avatarData.prompt });
    setAvatar({ generated: avatarData.url });
    await api.setAvatarDetails(sessionId, avatarData.url, avatarData.prompt);
    setPhase('chat');
  }, [sessionId, setAvatar, setPhase, logEvent]);

  const handleChatEndSignal = useCallback(() => {
    logEvent('chat_timer_expired');

    if (sessionId) {
      api.endSession(sessionId);
    }
    
    const isDemoMode = location.pathname.toLowerCase() === '/demo';

    setPhase(isDemoMode ? 'demo_end' : 'survey');

  }, [sessionId, logEvent, location.pathname, setPhase]); 

  const { remainingTime } = useChatTimer(
    10 * 60,
    handleChatEndSignal,
    phase === 'chat'
  );



  // --- Main Render Logic ---
  return (
    <SharedLayout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full h-full"
        >
          <Suspense fallback={<LoadingScreen darkMode={darkMode} />}>
            {phase === 'loading' && (
              <LoadingScreen darkMode={darkMode} />
            )}
            {phase === 'intro' && (
              <IntroductionScreen
                onContinue={handleIntroComplete}
                logFrontendEvent={logEvent}
                kagamiIntroAvatar={kagamicrop}
              />
            )}
            {phase === 'avatar' && (
              <AvatarSelectionScreen
                onAvatarSelected={handleAvatarSelected}
                onAvatarGenerated={handleAvatarGenerated}
                logFrontendEvent={logEvent}
                premadeAvatars={{ frog, panda, cat, capybara, bird, sheep, elephant }}
                kagamiPlaceholder={kagamiPlaceholder}
              />
            )}
            {phase === 'chat' && (
              <ChatScreen
                logFrontendEvent={logEvent}
                kagamiChatAvatar={kagami}
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                remainingTime={remainingTime}

              />
            )}
            {phase === 'survey' && (
              <SurveyScreen qualtricsReturnUrl={qualtricsReturnUrl} />
            )}
            {phase === 'demo_end' && (
              <DemoEndScreen />
            )}
            {phase === 'error' && (
              <ErrorScreen logFrontendEvent={logEvent} />
            )}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </SharedLayout>
  );
}

export default App;
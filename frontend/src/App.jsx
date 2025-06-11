// App.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import kagamiLogo from './assets/kagami.png';
import kagamiDarkLogo from './assets/kagamid.png';
import frog from './assets/avatars/frog.png';
import panda from './assets/avatars/panda.png';
import cat from './assets/avatars/cat.png';
import capybara from './assets/avatars/capybara.png';
import bird from './assets/avatars/bird.png';
import elephant from './assets/avatars/elephant.png';
import kagami from './assets/avatars/kagami.png';
import kagamicrop from './assets/avatars/kagamicrop.png';
import roomLightWebP from './assets/room.webp';
import roomDarkWebP from './assets/roomd.webp';
import roomLightPNG from './assets/room.png';
import roomDarkPNG from './assets/roomd.png';

import { AnimatePresence, motion } from 'framer-motion';
import SharedLayout from './components/SharedLayout';
import LoadingScreen from './components/LoadingScreen';
import IntroductionScreen from './components/IntroductionScreen';
import AvatarSelectionScreen from './components/AvatarSelectionScreen';
import ChatScreen from './components/ChatScreen';
import SurveyScreen from './components/SurveyScreen';
import ErrorScreen from './components/ErrorScreen';

// --- Constants ---
const rawApiBaseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '');

const conditionDetails = {
  avatar_premade_static: { avatar: true, avatarType: 'premade', lsm: false },
  avatar_premade_adaptive: { avatar: true, avatarType: 'premade', lsm: true },
  avatar_generated_static: { avatar: true, avatarType: 'generated', lsm: false },
  avatar_generated_adaptive: { avatar: true, avatarType: 'generated', lsm: true },
  noavatar_static: { avatar: false, avatarType: 'none', lsm: false },
  noavatar_adaptive: { avatar: false, avatarType: 'none', lsm: true }
};

const QUALTRICS_SURVEY_BASE_URL = 'https://youruniversity.qualtrics.com/jfe/form/SV_YOUR_SURVEY_ID';

const LOADING_SCREEN_MIN_DISPLAY_TIME_MS = 3000;

// --- END Constants ---

function App() {
  // State variables
  const [isLandscape, setIsLandscape] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [phase, setPhase] = useState('loading');
  const [sessionId, setSessionId] = useState(null);
  const [condition, setCondition] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // NEW: State for the post survey URL, parsed at App level for fallback
  const [appLevelPostSurveyUrl, setAppLevelPostSurveyUrl] = useState('');

  const [qualtricsReturnUrl, setQualtricsReturnUrl] = useState('');

  const [darkMode, setDarkMode] = useState(() => {
    if (localStorage.getItem('theme')) {
      return localStorage.getItem('theme') === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Refs for timers/intervals
  const intervalRef = useRef(null);
  const loadingScreenTimerRef = useRef(null);
  const loadingStartTimeRef = useRef(null);

  // --- Theme Toggling Function ---
  const toggleDarkMode = useCallback(() => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  }, []);

  // --- Logging Function (Wrapped in useCallback) ---
  const logFrontendEvent = useCallback(async (eventType, eventData = {}, overrideIds = {}) => {
  // Use override IDs if provided, otherwise fall back to component state.
      const sid = overrideIds.sessionId || sessionId;
      const pid = overrideIds.participantId || participantId;

      if (!sid && !pid) {
        // Keep your whitelist for events that can be logged without any ID.
        if (!['app_mounted', 'app_mounted_no_pid', 'invalid_url_params', 'session_start_failed', 'session_start_success'].includes(eventType)) {
          console.warn(`Frontend log event "${eventType}" skipped: No session or participant ID available for logging.`);
          return;
        }
      }
      try {
        const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '');
        const payload = {
          // Pass the determined IDs to the backend.
          sessionId: sid,
          participantId: pid,
          eventType: eventType,
          eventData: {
            ...eventData,
            client_timestamp_utc: new Date().toISOString(),
          }
        };
        await axios.post(`${cleanBaseUrl}/api/log/frontend_event`, payload);
        console.log(`Frontend event logged: ${eventType}`, payload);
      } catch (error) {
        console.error(`Failed to log frontend event "${eventType}":`, error);
      }
    }, [sessionId, participantId]); 

  // Helper function to clear the loading progress interval
  const clearLoadingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // --- API Call Functions (Wrapped in useCallback) ---
  const startSession = useCallback(async (pid, avatarType, lsmType) => {
    try {
      // Construct the condition name from the parameters passed to this function
      const conditionName = `${avatarType}_${lsmType}`;

      const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '');
      const res = await axios.post(`${cleanBaseUrl}/api/session/start`, {
        participantId: pid,
        conditionName: conditionName // Pass the single name to the backend
      });

      console.log("API Success: Session Started:", res.data.sessionId);
      clearLoadingInterval();
      setLoadingProgress(100);
      setInitialMessages(res.data.initialHistory || []);
      
      // Use the condition object returned by the backend as the source of truth
      setCondition(res.data.condition);
      setSessionId(res.data.sessionId);

      logFrontendEvent('session_start_success', {
      participant_id_param: pid,
      condition_string_sent: conditionName,
      backend_condition_received: res.data.condition
    }, { participantId: pid, sessionId: res.data.sessionId });

    } catch (error) {
      console.error('Error starting session:', error);
      clearLoadingInterval();
      clearTimeout(loadingScreenTimerRef.current);

      logFrontendEvent('session_start_failed', {
        participant_id_param: pid,
        // Log the types that were passed in, for debugging
        avatar_type_param: avatarType, 
        lsm_type_param: lsmType,
        error_message: error.message,
        error_status: error.response?.status,
        error_data: error.response?.data
      });
      setPhase('error');
    }
  }, [logFrontendEvent]);


  const endSession = useCallback(async () => {
    console.log(`App.jsx: Session ${sessionId} ending from App.jsx perspective, transitioning to survey phase.`);
    if (sessionId && logFrontendEvent) {
      logFrontendEvent('app_level_session_end_acknowledged', { sessionId });
    }
    setPhase('survey');
  }, [sessionId, logFrontendEvent]);


  // --- Effect 0: Manage body overflow and dark mode class ---
  useEffect(() => {
    document.body.style.overflow = phase === 'loading' ? 'hidden' : 'auto';

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.classList.remove('dark');
    };
  }, [phase, darkMode]);


  // --- Effect 1: *** THE MAIN CHANGE IS HERE *** Initial Setup & Parameter Parsing ---
  useEffect(() => {
    // 1. Parse all new parameters from Qualtrics
    const urlParams = new URLSearchParams(window.location.search);
    const pidFromUrl = urlParams.get('PROLIFIC_PID'); // Case-sensitive, match Qualtrics
    const avatarTypeFromUrl = urlParams.get('avatar')?.toLowerCase();
    const lsmTypeFromUrl = urlParams.get('lsm')?.toLowerCase();
    const responseIdFromUrl = urlParams.get('responseid'); 


    console.log("App.jsx: Initializing with URL params:", {
        pid: pidFromUrl,
        avatar: avatarTypeFromUrl,
        lsm: lsmTypeFromUrl,
        responseId: responseIdFromUrl
    });
    
    // Reset state on mount
    setLoadingProgress(0);
    setSessionId(null);
    setParticipantId(null);
    setCondition(null);

    // 2. Construct and save the Qualtrics return URL
    if (responseIdFromUrl) {
      const returnUrl = `${QUALTRICS_SURVEY_BASE_URL}?Q_R=${responseIdFromUrl}&Q_R_DEL=1`;
      setQualtricsReturnUrl(returnUrl);
      console.log("App.jsx: Constructed Qualtrics return URL:", returnUrl);
    } else {
      console.error("App.jsx: CRITICAL - Missing 'responseid' from Qualtrics. Cannot return participant.");
      // You might want to log this or show an error
    }

    // 3. Validate parameters and start the session
    if (pidFromUrl && avatarTypeFromUrl && lsmTypeFromUrl && responseIdFromUrl) {
      setParticipantId(pidFromUrl);
      
      // Start session with the parsed parameters
      startSession(pidFromUrl, avatarTypeFromUrl, lsmTypeFromUrl);

      // --- Start visual loading progress bar ---
      loadingStartTimeRef.current = Date.now();
      let currentProgress = 0;
      intervalRef.current = setInterval(() => {
        currentProgress += 2;
        if (currentProgress >= 96) {
          setLoadingProgress(96);
          clearInterval(intervalRef.current);
        } else {
          setLoadingProgress(currentProgress);
        }
      }, 100);
      
      logFrontendEvent('app_mounted_success', { 
        pid_param: pidFromUrl, 
        avatar_param: avatarTypeFromUrl, 
        lsm_param: lsmTypeFromUrl, 
        responseid_param: responseIdFromUrl
      }, { participantId: pidFromUrl });

    } else {
      // If any parameter is missing, it's a critical error
      console.error("Missing or invalid URL parameters from Qualtrics.");
      logFrontendEvent('invalid_url_params', {
        url_params: window.location.search,
        pid_param: pidFromUrl,
        avatar_param: avatarTypeFromUrl,
        lsm_param: lsmTypeFromUrl,
        responseid_param: responseIdFromUrl
      });
      setPhase('error');
    }

    return () => {
      // Cleanup timers
      clearInterval(intervalRef.current);
      clearTimeout(loadingScreenTimerRef.current);
    };
  }, []); // Empty dependency array ensures this runs only once on mount.


  // --- Effect 2: Handling the Phase Transition from Loading to Intro (or Error) ---
  useEffect(() => {
    if (phase === 'loading' && sessionId) {
      const now = Date.now();
      const startTime = loadingStartTimeRef.current || now;
      const elapsed = now - startTime;
      const remainingDelay = LOADING_SCREEN_MIN_DISPLAY_TIME_MS - elapsed;

      if (remainingDelay <= 0) {
        console.log("Session ID set and minimum loading time met. Transitioning to intro.");
        clearTimeout(loadingScreenTimerRef.current);
        setPhase('intro');
        logFrontendEvent('phase_change', { from: 'loading', to: 'intro' });
      } else {
        console.log(`Session ID set, but waiting for ${remainingDelay}ms for minimum loading time.`);
        loadingScreenTimerRef.current = setTimeout(() => {
          setPhase('intro');
          logFrontendEvent('phase_change', { from: 'loading', to: 'intro' });
        }, remainingDelay);
      }
    }
    if (phase === 'error' && loadingScreenTimerRef.current) {
        clearTimeout(loadingScreenTimerRef.current);
    }

    return () => {
      console.log("App useEffect 2 cleanup");
      clearTimeout(loadingScreenTimerRef.current);
    };
  }, [phase, sessionId, logFrontendEvent]);


  const handleIntroComplete = useCallback(() => {
    console.log("Intro complete, navigating...");
    if (!sessionId || !condition) {
      console.warn("handleIntroComplete called without session or condition.");
      return;
    }

    const nextPhase = condition.avatar ? 'avatar' : 'chat';

    console.log(`Changing phase from intro to ${nextPhase}`);
    setPhase(nextPhase);
    logFrontendEvent('phase_change', { from: 'intro', to: nextPhase, condition_avatar_flag: condition.avatar });

  }, [sessionId, condition, logFrontendEvent]);


  const handleAvatarSelected = useCallback(async (avatarUrl) => {
    console.log("Premade avatar selected:", avatarUrl);
    setSelectedAvatarUrl(avatarUrl);

    if (sessionId && avatarUrl) {
      try {
        await axios.post(`${API_BASE_URL.replace(/\/$/, '')}/api/session/set_avatar_details`, {
          sessionId: sessionId,
          avatarUrl: avatarUrl
        });
        logFrontendEvent('premade_avatar_details_sent', { avatar_url_selected: avatarUrl });
      } catch (error) {
        console.error("Failed to send premade avatar details to backend:", error);
        logFrontendEvent('premade_avatar_details_send_failed', {
          avatar_url_selected: avatarUrl,
          error_message: error.message,
          error_status: error.response?.status
        });
      }
    } else {
      console.warn("Cannot send premade avatar details: missing sessionId or avatarUrl.");
    }

    setPhase('chat');
    logFrontendEvent('phase_change', { from: 'avatar', to: 'chat', avatar_type_flow: 'premade' });

  }, [logFrontendEvent, sessionId]);


  const handleAvatarGenerated = useCallback(async (avatarData) => {
    if (!avatarData || !avatarData.url) {
      console.error("handleAvatarGenerated called with invalid avatarData:", avatarData);
      logFrontendEvent('generated_avatar_invalid_data_received', { received_data: avatarData });
      return;
    }
    console.log("Generated avatar confirmed:", avatarData.url, "Prompt:", avatarData.prompt);
    setUserAvatarUrl(avatarData.url);

    if (sessionId && avatarData.url) {
      try {
        await axios.post(`${API_BASE_URL.replace(/\/$/, '')}/api/session/set_avatar_details`, {
          sessionId: sessionId,
          avatarUrl: avatarData.url,
          avatarPrompt: avatarData.prompt
        });
        logFrontendEvent('generated_avatar_details_sent', { avatar_url_generated: avatarData.url, avatar_prompt_generated: avatarData.prompt });
      } catch (error) {
        console.error("Failed to send generated avatar details to backend:", error);
        logFrontendEvent('generated_avatar_details_send_failed', {
          avatar_url_generated: avatarData.url,
          avatar_prompt_generated: avatarData.prompt,
          error_message: error.message,
          error_status: error.response?.status
        });
      }
    } else {
      console.warn("Cannot send generated avatar details: missing sessionId or avatarData.url.");
    }

    setPhase('chat');
    logFrontendEvent('phase_change', { from: 'avatar', to: 'chat', avatar_type_flow: 'generated' });

  }, [logFrontendEvent, sessionId]);


  const handleChatEndSignal = useCallback(() => {
    console.log("App.jsx: Chat session end signal received from ChatScreen.");
    endSession(); // This will change the phase to 'survey'
  }, [endSession]);


  // --- Main Render Logic ---
  return (
    <SharedLayout
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
      showNavbar={phase !== 'loading'}
      allowMainOverflow={phase === 'chat'}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full h-full"
        >
          {phase === 'loading' && (
            <LoadingScreen
              loadingProgress={loadingProgress}
              kagamiLogo={darkMode ? kagamiDarkLogo : kagamiLogo}
              darkMode={darkMode}
            />
          )}

          {phase === 'intro' && condition && (
            <IntroductionScreen
              condition={condition}
              logFrontendEvent={logFrontendEvent}
              onContinue={handleIntroComplete}
              kagamiIntroAvatar={kagamicrop}
            />
          )}

          {phase === 'avatar' && condition && sessionId && (
            <AvatarSelectionScreen
              condition={condition}
              sessionId={sessionId}
              onAvatarSelected={handleAvatarSelected}
              onAvatarGenerated={handleAvatarGenerated}
              logFrontendEvent={logFrontendEvent}
              apiBaseUrl={API_BASE_URL}
              premadeAvatars={{ frog, panda, cat, capybara, bird, elephant }}
            />
          )}

          {phase === 'chat' && sessionId && condition && participantId ? (
            <ChatScreen
              sessionId={sessionId}
              condition={condition}
              participantId={participantId}
              initialMessages={initialMessages}
              userAvatarUrl={userAvatarUrl}
              selectedAvatarUrl={selectedAvatarUrl}
              apiBaseUrl={API_BASE_URL}
              logFrontendEvent={logFrontendEvent}
              onChatEndSignal={handleChatEndSignal}
              kagamiChatAvatar={kagami}
              darkMode={darkMode}
              rooms={{ roomDarkPNG, roomDarkWebP, roomLightWebP, roomLightPNG }}
            />
          ) : phase === 'chat' && (
            <div className="flex items-center justify-center h-full w-full">
              <p className="text-brand-primary dark:text-dark-text">Loading chat interface...</p>
            </div>
          )}

          {/* MODIFIED: Pass appLevelPostSurveyUrl to SurveyScreen */}
          {phase === 'survey' && <SurveyScreen surveyUrl={qualtricsReturnUrl} />}
          {phase === 'error' && <ErrorScreen />}
        </motion.div>
      </AnimatePresence>
    </SharedLayout>
  );
}

export default App;
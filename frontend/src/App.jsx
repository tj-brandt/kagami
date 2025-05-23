import React, { useState, useEffect, useRef, useCallback } from 'react'; // Import useState, useEffect, useRef, useCallback
import Intro from "./components/Intro"; // Import Intro component
import Avatar from './components/Avatar'; // Assuming this is for Premade Selection
import ChatInterface from './components/ChatInterface'; // Import ChatInterface component
import axios from 'axios'; // Import axios
import AvatarGenerated from './components/AvatarGenerated'; // Assuming this is for Generated Selection
import kagamiLogo from './assets/kagami.png'; // Import logo asset
import frog from './assets/avatars/frog.png';
import panda from './assets/avatars/panda.png';
import cat from './assets/avatars/cat.png';
import capybara from './assets/avatars/capybara.png';
import bird from './assets/avatars/bird.png';
import elephant from './assets/avatars/elephant.png';
import kagami from './assets/avatars/kagami.png';

// --- Constants ---
const rawApiBaseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, ''); // 

const conditionDetails = { // Define conditionDetails
  avatar_premade_static: { avatar: true, lsm: false }, 
  avatar_premade_adaptive: { avatar: true, lsm: true }, 
  avatar_generated_static: { avatar: true, lsm: false }, 
  avatar_generated_adaptive: { avatar: true, lsm: true }, 
  noavatar_static: { avatar: false, lsm: false }, 
  noavatar_adaptive: { avatar: false, lsm: true } 
};
const LOGO_TRANSITION_DELAY_MS = 5000; 
const LOGO_ANIMATION_DURATION_MS = 1000; 
const POST_ANIMATION_BUFFER_MS = 200; 
// --- END Constants ---

function App() {
    // State variables
    const [logoTransitioned, setLogoTransitioned] = useState(false); 
    const [phase, setPhase] = useState('loading'); 
    const [sessionId, setSessionId] = useState(null); 
    const [condition, setCondition] = useState(null); 
    const [participantId, setParticipantId] = useState(null); 
    const [initialMessages, setInitialMessages] = useState([]); 
    const [userAvatarUrl, setUserAvatarUrl] = useState(''); 
    const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(''); 
    const [loadingProgress, setLoadingProgress] = useState(0); 
    const [showIntroBackground, setShowIntroBackground] = useState(false); 

    // Refs for timers/intervals
    const intervalRef = useRef(null); 
    const logoTimerRef = useRef(null); 
    const phaseTransitionTimerRef = useRef(null); 

    // --- Logging Function (Wrapped in useCallback) ---
    const logFrontendEvent = useCallback(async (eventType, eventData = {}) => {
        if (!sessionId && !participantId) {
            if (eventType !== 'app_mounted' && eventType !== 'app_mounted_no_pid' && eventType !== 'invalid_url_params' && eventType !== 'session_start_failed' && eventType !== 'session_start_success') {
                 console.warn(`Frontend log event "${eventType}" skipped: No session or participant ID available for logging.`);
                 return;
            }
        }
        try {
            const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '');
            const payload = {
                sessionId: sessionId, 
                participantId: participantId, 
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
    }, [sessionId, participantId, API_BASE_URL]); 

    // Helper function to clear the loading progress interval
    const clearLoadingInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // --- API Call Functions (Wrapped in useCallback) ---
    const startSession = useCallback(async (pid, condName) => { 
      try {
          const conditionInfoFromUrl = conditionDetails[condName]; 
          const cleanBaseUrl = API_BASE_URL.replace(/\/$/, ''); 
          const res = await axios.post(`${cleanBaseUrl}/api/session/start`, {
              participantId: pid,
              condition: { 
                  avatar: conditionInfoFromUrl.avatar,
                  lsm: conditionInfoFromUrl.lsm 
              },
              conditionName: condName
           });

          console.log("API Success: Session Started:", res.data.sessionId);
          clearLoadingInterval(); 
          setLoadingProgress(100); 
          setInitialMessages(res.data.initialHistory || []); 
          
          setCondition({ name: condName, ...res.data.condition }); 
          setSessionId(res.data.sessionId); 

          logFrontendEvent('session_start_success', {
               participant_id_param: pid, 
               condition_string_param: condName, 
               backend_condition_received: res.data.condition 
           });

      } catch (error) {
          console.error('Error starting session:', error);
          clearLoadingInterval(); 
          clearTimeout(logoTimerRef.current); 

           logFrontendEvent('session_start_failed', {
                participant_id_param: pid,
                condition_string_param: condName,
                error_message: error.message,
                error_status: error.response?.status,
                error_data: error.response?.data
           });
          setPhase('error'); 
      }
    }, [logFrontendEvent, API_BASE_URL]);


    const endSession = useCallback(() => {
      console.log(`Session ${sessionId} ending, transitioning to survey phase.`);
      setPhase('survey'); 
    }, [sessionId]); 


    // --- Effect 0: Manage body overflow based on phase (NEW) ---
    useEffect(() => {
        if (phase === 'loading') {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto'; // Or your default overflow
        }
        // Cleanup on component unmount
        return () => {
            document.body.style.overflow = 'auto'; // Or your default overflow
        };
    }, [phase]);


    // --- Effect 1: Initial Setup, Parameter Parsing, and Starting Session ---
    useEffect(() => { 
        const urlParams = new URLSearchParams(window.location.search);
        const pidFromUrl = urlParams.get('pid');
        const condNameFromUrl = urlParams.get('cond')?.toLowerCase(); 
    
        console.log("App useEffect 1: Initializing..."); 
        setLoadingProgress(0);
        setLogoTransitioned(false);
        setSessionId(null); 
        setShowIntroBackground(false);
        setParticipantId(null); 
        setCondition(null); 
    
        clearTimeout(logoTimerRef.current);
        clearTimeout(phaseTransitionTimerRef.current);
        clearLoadingInterval();
    
        const avatarImages = [frog, panda, cat, capybara, bird, elephant, kagami];
        avatarImages.forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    
        const tempParticipantId = pidFromUrl;
        const doInitialLog = async (eventType, eventData) => {
            try {
                const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '');
                await axios.post(`${cleanBaseUrl}/api/log/frontend_event`, {
                    sessionId: null,
                    participantId: tempParticipantId,
                    eventType,
                    eventData,
                });
                console.log(`Initial frontend event logged: ${eventType}`, eventData);
            } catch (error) { // <<<--- CORRECTED LINE
                console.error(`Failed to log initial frontend event "${eventType}":`, error);
            }
        };
    
        if (tempParticipantId) {
            doInitialLog('app_mounted', { participant_id_param: tempParticipantId, condition_string_param: condNameFromUrl });
        } else {
            doInitialLog('app_mounted_no_pid', { url_params: window.location.search });
        }
    
        if (pidFromUrl && condNameFromUrl && conditionDetails[condNameFromUrl]) {
            setParticipantId(pidFromUrl);
            setCondition({ name: condNameFromUrl, ...conditionDetails[condNameFromUrl] });
    
            startSession(pidFromUrl, condNameFromUrl);
    
            let currentProgress = 0;
            intervalRef.current = setInterval(() => {
                currentProgress += 2; 
                if (currentProgress >= 96) {
                    setLoadingProgress(96);
                    clearLoadingInterval(); 
                } else {
                    setLoadingProgress(currentProgress);
                }
            }, 100); 
    
            logoTimerRef.current = setTimeout(() => {
                setLogoTransitioned(true); 
            }, LOGO_TRANSITION_DELAY_MS);
    
        } else {
            console.error("Missing or invalid pid/cond:", pidFromUrl, condNameFromUrl);
            doInitialLog('invalid_url_params', { url_params: window.location.search, pid_param: pidFromUrl, cond_param: condNameFromUrl });
            setPhase('error');
        }
    
        return () => {
            console.log("App useEffect 1 cleanup");
            clearLoadingInterval();
            clearTimeout(logoTimerRef.current);
            clearTimeout(phaseTransitionTimerRef.current);
        };
    }, []); 


    // --- Effect 2: Handling the Phase Transition from Loading to Intro ---
    useEffect(() => {
      if (phase === 'loading' && logoTransitioned && sessionId) {
        console.log("Phase transition criteria met: loading -> intro");
        clearTimeout(phaseTransitionTimerRef.current);

        phaseTransitionTimerRef.current = setTimeout(() => {
          console.log("Initiating phase change to intro");
          setPhase('intro'); 
          setTimeout(() => setShowIntroBackground(true), 50);
           logFrontendEvent('phase_change', { from: 'loading', to: 'intro' });

        }, LOGO_ANIMATION_DURATION_MS + POST_ANIMATION_BUFFER_MS); 
      }

      return () => {
          console.log("App useEffect 2 cleanup");
          clearTimeout(phaseTransitionTimerRef.current);
      }
    }, [phase, logoTransitioned, sessionId, logFrontendEvent]);


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

    }, [logFrontendEvent, sessionId, API_BASE_URL]); 


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

     }, [logFrontendEvent, sessionId, API_BASE_URL]); 


     const handleChatEndSignal = useCallback(() => {
        console.log("Chat session end signal received from ChatInterface.");
     }, []); 

     const renderAvatarComponent = () => {
        if (!condition || !sessionId) {
             return (
                 <div className="flex items-center justify-center min-h-screen"><p>Loading avatar configuration...</p></div>
             );
         }

        if (condition.name && condition.name.startsWith('avatar_generated')) {
            return (
                <AvatarGenerated
                    sessionId={sessionId}
                    onNext={handleAvatarGenerated} 
                    logFrontendEvent={logFrontendEvent} 
                 />
             );
         } else if (condition.name && condition.name.startsWith('avatar_premade')) {
             return (
                 <Avatar
                     onNext={handleAvatarSelected} 
                     logFrontendEvent={logFrontendEvent} 
                  />
             );
         }
         console.error("Unknown avatar type in condition or condition.name missing:", condition);
         return (
              <div className="flex items-center justify-center min-h-screen text-red-600"><p>Error: Unknown avatar type or condition name missing.</p></div>
         );
     };


    // --- Main Render Logic ---
    return (
      <div
          className={`min-h-screen relative transition-colors duration-500 ease-in-out ${
              phase === 'loading' ? 'bg-white' :
              showIntroBackground ? 'bg-transparent' : 'bg-white'
          }`}
      >
          <div
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in z-0 ${
                  showIntroBackground ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                backgroundColor: 'white',
              }}
          />

          {(phase === 'loading' || phase === 'intro') && (
              <div
                  className={`
                      absolute z-20 transition-all ease-in-out
                      duration-${LOGO_ANIMATION_DURATION_MS}
                      overflow-hidden
                      ${logoTransitioned || phase === 'intro' ?
                          'w-[200px] sm:w-[200px] top-4 left-1/2 transform -translate-x-1/2 sm:left-8 sm:translate-x-0' :
                          'w-[300px] sm:w-[500px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
                      }
                  `}
              >
                  <img
                      src={kagamiLogo} 
                      alt="Kagami Logo"
                      className="w-full h-auto object-contain block relative z-10"
                  />
                  {phase === 'loading' && !logoTransitioned && (
                      <div
                         className="absolute inset-0 w-full h-full pointer-events-none z-20
                                   bg-gradient-to-r from-transparent via-white to-transparent
                                   animate-shimmer"
                         />
                  )}
              </div>
          )}

          {phase === 'loading' && (
              // MODIFIED: Loading bar container classes for mobile positioning
              <div className="absolute left-0 w-full flex flex-col items-center z-30 px-4 sm:px-0 bottom-[20vh] sm:bottom-10 sm:pb-10">
                   {/* MODIFIED: Reduced margin-bottom for "Loading..." text on mobile */}
                   {!logoTransitioned && <p className="text-gray-700 text-lg mb-4 sm:mb-10">Loading...</p>}
                   <div className="w-3/4 max-w-md h-2 bg-gray-200 rounded overflow-hidden mb-2">
                       <div className="h-full bg-blue-500 rounded transition-width duration-150 ease-linear" style={{ width: `${loadingProgress}%` }} />
                   </div>
                   <p className="text-gray-600 text-sm">Loading... {loadingProgress}%</p>
              </div>
          )}

          <div className="relative z-10">
              {phase === 'intro' && condition && ( 
                  <Intro 
                      condition={condition.name} 
                      logFrontendEvent={logFrontendEvent} 
                      onContinue={handleIntroComplete} 
                  />
              )}

              {phase === 'avatar' && renderAvatarComponent()}


              {phase === 'chat' && sessionId && condition && participantId ? ( 
                  <ChatInterface 
                     sessionId={sessionId}
                     condition={condition.name} 
                     backendCondition={condition}
                     participantId={participantId}
                     initialMessages={initialMessages}
                     userAvatarUrl={userAvatarUrl} 
                     selectedAvatarUrl={selectedAvatarUrl} 
                     apiBaseUrl={API_BASE_URL} 
                     logFrontendEvent={logFrontendEvent} 
                   />
              ) : phase === 'chat' && ( 
                   <div className="flex items-center justify-center min-h-screen"><p>Loading chat interface...</p></div>
              )}


              {phase === 'survey' && (
                  <div className="flex flex-col items-center justify-center min-h-screen">
                      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
                          <h2 className="text-2xl font-bold mb-4">Experiment Complete</h2>
                          <p className="mb-4">Thank you for your participation!</p>
                          <p>Please click the link below to proceed to the final survey:</p>
                          <a href="YOUR_SURVEY_URL_HERE" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition duration-200">
                              Open Survey
                          </a>
                      </div>
                  </div>
              )}

               {phase === 'error' && (
                  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
                      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
                          <h2 className="text-2xl font-bold mb-4 text-red-600">Error</h2>
                          <p className="mb-4">Failed to start the session or invalid parameters provided (pid/cond).</p>
                          <p>Please check the link or contact the administrator.</p>
                      </div>
                  </div>
               )}
          </div>
        </div> 
    );
  }

  export default App;
import React, { useState, useEffect, useRef } from 'react';
import Intro from "./components/Intro";
import Avatar from './components/Avatar';
import ChatInterface from './components/ChatInterface';
import axios from 'axios';
import AvatarGenerated from './components/AvatarGenerated';
import kagamiLogo from './assets/kagami.png';
import bgImage from './assets/bg.png'; // Background for intro phase

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const conditionDetails = {
  avatar_premade_static: { avatar: true, adaptive: false },
  avatar_premade_adaptive: { avatar: true, adaptive: true },
  avatar_generated_static: { avatar: true, adaptive: false },
  avatar_generated_adaptive: { avatar: true, adaptive: true },
  noavatar_static: { avatar: false, adaptive: false },
  noavatar_adaptive: { avatar: false, adaptive: true }
};
const LOGO_TRANSITION_DELAY_MS = 5000;
const LOGO_ANIMATION_DURATION_MS = 1000; // Corresponds to duration-1000 in Tailwind
const POST_ANIMATION_BUFFER_MS = 200;

function App() {
  // State variables
  const [logoTransitioned, setLogoTransitioned] = useState(false);
  const [phase, setPhase] = useState('loading'); // loading, intro, avatar, chat, survey, error
  const [sessionId, setSessionId] = useState(null);
  const [condition, setCondition] = useState(null); // Full condition object { name, avatar, lsm }
  const [participantId, setParticipantId] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showIntroBackground, setShowIntroBackground] = useState(false); // Controls intro background fade

  // Refs for timers/intervals
  const intervalRef = useRef(null); // For loading progress interval
  const logoTimerRef = useRef(null); // For the 5-second logo transition delay
  const phaseTransitionTimerRef = useRef(null); // For delaying phase change after logo animates

  // Helper function to clear the loading progress interval
  const clearLoadingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // --- Effect 1: Initial Setup, Parameter Parsing, and Starting Session ---
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const pid = urlParams.get('pid');
      const cond = urlParams.get('cond')?.toLowerCase();

      // Reset states on mount/param change
      setLoadingProgress(0);
      setLogoTransitioned(false);
      setSessionId(null);
      setShowIntroBackground(false);

      // Clear any lingering timers from previous renders or StrictMode
      clearTimeout(logoTimerRef.current);
      clearTimeout(phaseTransitionTimerRef.current);
      clearLoadingInterval();

      // Validate parameters and proceed
      if (pid && cond && conditionDetails[cond]) {
        setParticipantId(pid);
        // Set initial condition based on URL (will be updated by API response)
        setCondition({ name: cond, ...conditionDetails[cond] });

        // Initiate session start API call
        startSession(pid, cond);

        // Start simulating loading progress
        let currentProgress = 0;
        intervalRef.current = setInterval(() => {
            currentProgress += 2; // Simulate ~20% per second
            if (currentProgress >= 96) { // Cap simulation before 100%
                 setLoadingProgress(96);
                 clearLoadingInterval(); // Stop simulation interval
             } else { setLoadingProgress(currentProgress); }
        }, 100); // Update every 100ms

        // Start the timer for the logo's visual transition
        logoTimerRef.current = setTimeout(() => {
            setLogoTransitioned(true); // Trigger logo animation CSS
        }, LOGO_TRANSITION_DELAY_MS);

      } else {
        // Invalid parameters, go directly to error phase
        console.error("Missing or invalid pid/cond:", pid, cond);
        setPhase('error');
      }

      // Cleanup function for this effect
      return () => {
          clearLoadingInterval();
          clearTimeout(logoTimerRef.current);
          clearTimeout(phaseTransitionTimerRef.current);
      };
      // Run only once on mount (or when pid/cond conceptually change, though not dependencies here)
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Effect 2: Handling the Phase Transition from Loading to Intro ---
  // This effect waits for conditions: logo visually transitioned AND API call succeeded
  useEffect(() => {
    if (phase === 'loading' && logoTransitioned && sessionId) {
      // Clear any previous transition timer (safety measure)
      clearTimeout(phaseTransitionTimerRef.current);

      // Start a new timer to delay the actual phase change
      // This allows the logo's CSS animation (1000ms) to complete
      phaseTransitionTimerRef.current = setTimeout(() => {
        setPhase('intro'); // Change phase to render Intro component
        // Start fading in the intro background slightly after phase change begins
        setTimeout(() => setShowIntroBackground(true), 50);
      }, LOGO_ANIMATION_DURATION_MS + POST_ANIMATION_BUFFER_MS); // Wait for animation + buffer
    }

    // Cleanup function for this effect
    return () => clearTimeout(phaseTransitionTimerRef.current);
  }, [phase, logoTransitioned, sessionId]); // Dependencies that trigger this check

  // --- API Call Functions ---
  const startSession = async (pid, cond) => {
    try {
        const conditionInfo = conditionDetails[cond]; // Get initial info from URL param details
        const cleanBaseUrl = API_BASE_URL.replace(/\/$/, ''); // Ensure no trailing slash
        const res = await axios.post(`${cleanBaseUrl}/api/session/start`, {
            participantId: pid,
            condition: { // Send expected structure to backend
                avatar: conditionInfo.avatar,
                lsm: conditionInfo.adaptive
            }
         });

        // API Success
        console.log("API Success: Session Started:", res.data.sessionId);
        clearLoadingInterval(); // Stop progress simulation
        setLoadingProgress(100); // Set progress to 100%
        setInitialMessages(res.data.initialHistory || []); // Store initial messages
        // **Crucially, update condition state with the definitive values from the backend**
        setCondition({ name: cond, ...res.data.condition });
        // Set sessionId LAST - this triggers Effect 2 to check for phase transition readiness
        setSessionId(res.data.sessionId);

    } catch (error) {
        console.error('Error starting session:', error);
        clearLoadingInterval(); // Stop simulation on error
        clearTimeout(logoTimerRef.current); // Stop logo timer if API fails early
        setPhase('error'); // Go to error phase
    }
  };

  const endSession = async () => {
    // Potentially add API call to backend to mark session end here
    console.log(`Session ${sessionId} ended.`);
    setPhase('survey'); // Go to survey phase
   };

  // --- Main Render Logic ---
  return (
    // Outermost container: Handles background color transition between phases
    <div
        className={`min-h-screen relative transition-colors duration-500 ease-in-out ${
            phase === 'loading' ? 'bg-white' : // Loading phase has white background
            showIntroBackground ? 'bg-transparent' : 'bg-white' // Intro starts white, fades to reveal image below
        }`}
    >
        {/* Background Image Container (For Intro and potentially subsequent phases) */}
        {/* Positioned behind everything else (z-0) */}
        <div
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in z-0 ${
                showIntroBackground ? 'opacity-100' : 'opacity-0' // Fade IN the image background
            }`}
            style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        />

        {/* Logo Container - Rendered during loading and intro phases */}
        {/* Positioned absolutely with high z-index */}
        {(phase === 'loading' || phase === 'intro') && (
            <div
                className={`
                    absolute z-20 transition-all ease-in-out // High z-index
                    duration-${LOGO_ANIMATION_DURATION_MS} // Animation duration from constant
                    overflow-hidden // Necessary to clip the shimmer effect
                    ${logoTransitioned || phase === 'intro' ?
                        // FINAL State (Top-Left on desktop, Top-Center on mobile)
                        'w-[200px] sm:w-[200px] top-4 left-1/2 transform -translate-x-1/2 sm:left-8 sm:translate-x-0' :
                        // INITIAL State (Centered during loading)
                        'w-[300px] sm:w-[500px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
                    }
                `}
            >
                {/* Logo Image */}
                <img
                    src={kagamiLogo}
                    alt="Kagami Logo"
                    className="w-full h-auto object-contain block relative z-10" // z-index below shimmer overlay
                />

                {/* Shimmer Overlay (Inside Logo Container) */}
                {/* Only shown during loading phase before logo transitions */}
                {phase === 'loading' && !logoTransitioned && (
                    <div
                       className="absolute inset-0 w-full h-full pointer-events-none z-20 // Shimmer ON TOP of image (z-20 > z-10)
                                 bg-gradient-to-r from-transparent via-white to-transparent // Visible white shimmer
                                 animate-shimmer" // Assumes 'animate-shimmer' is defined in tailwind.config.js
                     />
                )}
            </div>
        )}


        {/* Loading Elements Container (Progress Bar & Text) */}
        {/* Moved OUTSIDE the main content area div to ensure visibility */}
        {/* Rendered only during the loading phase */}
        {phase === 'loading' && (
            <div className="absolute bottom-0 left-0 w-full pb-10 flex flex-col items-center z-30"> {/* HIGHEST Z-INDEX */}
                 {/* Loading text shown only before logo animates */}
                 {!logoTransitioned && <p className="text-gray-700 text-lg mb-10">Loading...</p>}
                 {/* Progress bar and percentage always shown during loading */}
                 <div className="w-3/4 max-w-md h-2 bg-gray-200 rounded overflow-hidden mb-2">
                     <div className="h-full bg-blue-500 rounded transition-width duration-150 ease-linear" style={{ width: `${loadingProgress}%` }} />
                 </div>
                 <p className="text-gray-600 text-sm">Loading... {loadingProgress}%</p>
            </div>
        )}


        {/* Content Area - Holds the main component for each phase (Intro, Avatar, Chat, etc.) */}
        {/* Positioned relatively, z-index below logo/loading bar but above background */}
        <div className="relative z-10">
            {/* Intro Phase Content */}
            {phase === 'intro' && condition && (
                <Intro
                    condition={condition} // Pass necessary condition info
                    onContinue={() => { // Callback to proceed to next phase
                        if (!sessionId) return; // Safety check
                        // Navigate based on condition details (fetched from backend)
                        if (condition?.avatar) { setPhase('avatar'); }
                        else { setPhase('chat'); }
                    }}
                />
            )}

            {/* Avatar Phase Content (Conditional based on generated vs premade) */}
            {phase === 'avatar' && condition && sessionId && (
                 condition.name.startsWith('avatar_generated')
                 ? ( <AvatarGenerated sessionId={sessionId} onNext={(url) => { setUserAvatarUrl(url); setPhase('chat'); }} /> )
                 : ( <Avatar sessionId={sessionId} onNext={(url) => { setSelectedAvatarUrl(url); setPhase('chat'); }} /> )
            )}
            {/* Loading placeholder for Avatar phase if data isn't ready */}
            {phase === 'avatar' && (!condition || !sessionId) && (
                 <div className="flex items-center justify-center min-h-screen"><p>Loading avatar configuration...</p></div>
            )}

            {/* Chat Phase Content */}
            {phase === 'chat' && sessionId && condition && (
                <ChatInterface
                   sessionId={sessionId}
                   condition={condition.name} // Pass condition name if needed
                   backendCondition={condition} // Pass full condition object
                   participantId={participantId}
                   initialMessages={initialMessages}
                   userAvatarUrl={userAvatarUrl} // For generated avatar display
                   selectedAvatarUrl={selectedAvatarUrl} // For premade avatar display
                   onEndSession={endSession} // Callback to end session
                   apiBaseUrl={API_BASE_URL}
                 />
            )}
             {/* Loading placeholder for Chat phase if data isn't ready */}
            {phase === 'chat' && (!sessionId || !condition) && (
                 <div className="flex items-center justify-center min-h-screen"><p>Loading chat interface...</p></div>
            )}

            {/* Survey Phase Content */}
            {phase === 'survey' && (
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
                        <h2 className="text-2xl font-bold mb-4">Experiment Complete</h2>
                        <p className="mb-4">Thank you for your participation!</p>
                        <p>Please click the link below to proceed to the final survey:</p>
                        {/* Remember to replace YOUR_SURVEY_URL_HERE */}
                        <a href="YOUR_SURVEY_URL_HERE" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition duration-200">
                            Open Survey
                        </a>
                    </div>
                </div>
            )}

             {/* Error Phase Content (Overlay) */}
             {phase === 'error' && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"> {/* Fixed overlay with high z-index */}
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
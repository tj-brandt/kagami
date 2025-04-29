import OrientationWarning from './components/OrientationWarning';
import React, { useState, useEffect } from 'react';
import Intro from "./components/Intro";
import Avatar from './components/Avatar';
import ChatInterface from './components/ChatInterface';
import axios from 'axios';
import kagamiLogo from './assets/kagami-logo.png'; // Adjust path if needed
import AvatarGenerated from './components/AvatarGenerated';

// Define your backend API URL
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const conditionDetails = {
  avatar_premade_static: { avatar: true, adaptive: false },
  avatar_premade_adaptive: { avatar: true, adaptive: true },
  avatar_generated_static: { avatar: true, adaptive: false },
  avatar_generated_adaptive: { avatar: true, adaptive: true },
  noavatar_static: { avatar: false, adaptive: false },
  noavatar_adaptive: { avatar: false, adaptive: true }
};


function App() {
  const [phase, setPhase] = useState('loading'); // Start at loading
  const [participantId, setParticipantId] = useState(null);
  const [sessionId, setSessionId] = useState(null); // <-- sessionId state
  const [condition, setCondition] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pid = urlParams.get('pid');
    const cond = urlParams.get('cond')?.toLowerCase();

    if (pid && cond && conditionDetails[cond]) {
      setParticipantId(pid);
      setCondition({
        name: cond,
        ...conditionDetails[cond]
      });
      // Do NOT start session immediately here.
      // The phase will become 'intro', and the Intro component's continue
      // button will trigger the next step, which includes starting the session.
      // If the condition is 'avatar_generated', the flow will then go
      // Intro -> AvatarGenerated (which *does* need the sessionId, but gets it *after* startSession)
      // Let's slightly adjust the flow. startSession MUST run before AvatarGenerated.
      // Option 1: Call startSession right after setting condition if pid/cond are valid.
      // Option 2: Call startSession within the Intro component's onContinue for ALL cases.
      // Option 1 seems simpler if sessionId is needed early. Let's stick to Option 1.
      startSession(pid, cond); // <-- Keep startSession here

    } else {
      setPhase('error');
    }
  }, []);


  const startSession = async (pid, cond) => {
    try {
      const conditionInfo = conditionDetails[cond]; // <-- get the mapping directly
      console.log("Attempting to start session for PID:", pid, "Condition:", cond);
      const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '');  // remove trailing slash if it exists
      console.log("API_BASE_URL is:", cleanBaseUrl);
      const res = await axios.post(`${cleanBaseUrl}/api/session/start`, {
        participantId: pid,
        condition: {
          avatar: conditionInfo.avatar,
          lsm: conditionInfo.adaptive
        }
      });
      console.log("Session started. Session ID:", res.data.sessionId);
      setSessionId(res.data.sessionId); // <-- sessionId is set here
      setInitialMessages(res.data.initialHistory);
      setPhase('intro'); // Phase changes after successful session start
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Please check the server or try again.');
      setPhase('error');
    }
  };




  const endSession = async () => {
    console.log(`Session ${sessionId} ended.`);
    // Optional: Call a backend endpoint to formally end the session or log it
    // try {
    //   await axios.post(`${API_BASE_URL}/api/session/end`, { sessionId: sessionId });
    // } catch (error) {
    //   console.error('Error ending session on backend:', error);
    // }
    setPhase('survey');
  };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <img src={kagamiLogo} alt="Kagami Café Logo" className="w-48 mb-4 animate-pulse" />
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="mb-4">Missing or invalid participant ID and/or condition.</p>
          <p>Please check your link and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cover bg-center relative">
      <OrientationWarning />
      {phase === 'intro' && (
        <Intro
          condition={condition}
          onContinue={() => {
             // After Intro, if avatar condition is true, go to 'avatar' phase.
             // If avatar condition is false, skip to 'chat' phase.
            if (condition?.avatar) {
              setPhase('avatar');
            } else {
              setPhase('chat');
            }
          }}
        />
      )}
      {phase === 'avatar' && (
         // Only render AvatarGenerated or Avatar if condition is not null and sessionId is available
        condition && sessionId ? (
            condition.name.startsWith('avatar_generated') ? (
              // Pass the sessionId state as a prop to AvatarGenerated
              <AvatarGenerated
              sessionId={sessionId}
              onNext={(generatedAvatarUrl) => {
                setUserAvatarUrl(generatedAvatarUrl);
                setPhase('chat');
              }}
              />
            ) : (
              // Pre-made avatar screen, also might need sessionId for logging?
              // If Avatar doesn't use sessionId, remove the sessionId check above or pass it anyway.
              <Avatar
              sessionId={sessionId}
              onNext={(selectedAvatarUrl) => {
                setSelectedAvatarUrl(selectedAvatarUrl);
                setPhase('chat');
              }}
              /> // Passing sessionId to Avatar too, just in case
            )
        ) : (
            // Optional: Show a loading or error state if avatar phase is reached but sessionId is missing
            <div className="flex flex-col items-center justify-center flex-grow">
                <p>Loading avatar configuration...</p>
            </div>
        )
      )}
      {phase === 'chat' && (
        // Only render ChatInterface if sessionId is available
        sessionId ? (
            <ChatInterface
            sessionId={sessionId}
            condition={condition?.name}  // Only pass the condition string!
            participantId={participantId}
            initialMessages={initialMessages}
            userAvatarUrl={userAvatarUrl}
            selectedAvatarUrl={selectedAvatarUrl}
            onEndSession={endSession}
          />  
        ) : (
             // Optional: Show a loading or error state if chat phase is reached but sessionId is missing
             <div className="flex flex-col items-center justify-center flex-grow">
                 <p>Loading chat...</p>
             </div>
        )
      )}
      {phase === 'survey' && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">Experiment Complete</h2>
            <p className="mb-4">Thank you for participating!</p>
            <p>Please proceed to the following survey:</p>
            <a href="YOUR_SURVEY_URL_HERE" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Open Survey
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
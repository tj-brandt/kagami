import React, { useState } from 'react';
import Intro from "./components/Intro";
import OnboardingSequence from './components/OnboardingSequence';
import Avatar from './components/Avatar';
import Ready from './components/Ready';
import ChatInterface from './components/ChatInterface';
import axios from 'axios';
import ConditionSelector from './components/ConditionSelector.jsx';

// Define your backend API URL
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

function App() {
  const [phase, setPhase] = useState('select'); // Start with condition selection
  const [participantId, setParticipantId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [condition, setCondition] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);

  const startSession = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/session/start`, {
        condition: condition
      });
      setSessionId(res.data.sessionId);
      setInitialMessages(res.data.initialHistory);
      setPhase('intro');
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Please check the server or try again.');
    }
  };

  const endSession = async () => {
    console.log(`Session ${sessionId} ended.`);
    setPhase('survey');
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex flex-col" style={{ backgroundImage: 'url(/bground.png)' }}>
      {phase === 'select' && (
        <ConditionSelector
          onSelect={(cond) => {
            setCondition(cond);
            startSession(); // Start session without participant ID
          }}
        />
      )}
      {phase === 'onboarding' && (
        <OnboardingSequence
          condition={condition}
          onDone={() =>
            condition?.avatar ? setPhase('avatar') : setPhase('ready') // ✅ Skip Avatar phase if no avatar
          }
          onReturn={() => setPhase('intro')}
        />
      )}
      {phase === 'avatar' && condition?.avatar && (
        <Avatar onNext={() => setPhase('ready')} />
      )}
      {phase === 'ready' && (
        <Ready
          onNext={() => setPhase('chat')}
          onReturn={() =>
            condition?.avatar ? setPhase('avatar') : setPhase('onboarding')
          }
        />
      )}
      {phase === 'intro' && (
        <Intro
          condition={condition}
          onContinue={() => setPhase('onboarding')} // ✅ Go to onboarding next
        />
      )}
      {phase === 'chat' && (
        <ChatInterface
          sessionId={sessionId}
          condition={condition}
          initialMessages={initialMessages}
        />
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

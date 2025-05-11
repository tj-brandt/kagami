import React, { useState, useRef, useEffect } from 'react';
import kagamiAvatar from '../assets/avatars/kagami.png';
import axios from 'axios';
import smileIcon from '../assets/smile.png';
import { EmojiPicker } from 'frimousse';
import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min';

export default function ChatInterface({ 
  sessionId, 
  condition, // This is the string like "Avatar_Generated_Adaptive" passed from App.js
  backendCondition, // This is the {avatar: bool, lsm: bool} object from backend session start
  userAvatarUrl,      // URL for generated avatar
  selectedAvatarUrl,  // URL for premade avatar
  apiBaseUrl, 
  initialMessages, 
  participantId       // Passed as a prop
  // onEndSession // Optional
}) {
  const vantaRef = useRef(null);

  useEffect(() => {
    let vantaEffect = null;

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && vantaRef.current) {
      vantaEffect = FOG({
        el: vantaRef.current,
        THREE: THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        highlightColor: 0xffffff,
        midtoneColor: 0xe1e1e1,
        lowlightColor: 0xc5c5c5,
        baseColor: 0xffffff,
        blurFactor: 0.58,
        speed: 0.10
      });
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, []);
  const conditionString = String(condition || ''); 
  const isGenerated = conditionString.includes('generated');
  // const isPregenerated = conditionString.includes('premade'); // Not strictly needed if userAvatar logic covers it
  const isNoAvatar = conditionString.includes('noavatar');

  // Determine which avatar to display for the user side (if any)
  // This logic seems fine based on your prop names
  const userDisplayAvatar = isGenerated ? userAvatarUrl : selectedAvatarUrl;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 

  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- STATE FOR REDCAP REDIRECT ---
  const [postSurveyRedirectUrl, setPostSurveyRedirectUrl] = useState('');
  const [redirectError, setRedirectError] = useState(false); // To show a fallback message

  const [remainingTime, setRemainingTime] = useState(600); // 10 minutes in seconds
  const [sessionExpired, setSessionExpired] = useState(false);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0); 
  };
  
  // --- PARSE QUERY PARAMETERS ON INITIAL LOAD (for REDCap redirect URL) ---
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const redcapPostUrlFromQuery = queryParams.get('post_survey_url');

    if (redcapPostUrlFromQuery) {
      // It's good practice to decode, though your test showed it wasn't encoded
      const decodedUrl = decodeURIComponent(redcapPostUrlFromQuery);
      setPostSurveyRedirectUrl(decodedUrl);
      console.log("REDCap Post Survey URL received and set:", decodedUrl);
    } else {
      console.error("CRITICAL: REDCap post_survey_url not found in query parameters!");
      setRedirectError(true); // Set error state to display fallback message later
    }
  }, []); // Empty dependency array: run only once on mount

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      const formatted = initialMessages
        .filter(msg => msg.content && msg.role)
        .map(msg => ({
          sender: msg.role === 'assistant' ? 'bot' : 'user',
          text: msg.content
        }));
      setMessages(formatted);
    }
    focusInput();
  }, [initialMessages]); 

  useEffect(() => {
    if (!isLoading && inputRef.current) {
        if (!showEmojiPicker) { 
            focusInput();
        }
    }
  }, [isLoading, showEmojiPicker]);

  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = event => {
      if (pickerRef.current && !pickerRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target) && 
          event.target?.closest('button[aria-label="Toggle Emoji Picker"]') === null 
         ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    console.log("ChatInterface loaded. Session ID:", sessionId);
    console.log("Passed condition string from App.js:", condition);
    console.log("Backend Condition Object:", backendCondition);
    console.log("LSM enabled for this session:", backendCondition?.lsm); 
    console.log("Participant ID:", participantId);
  }, [sessionId, backendCondition, condition, participantId]); 

  // --- COUNTDOWN TIMER AND SESSION END LOGIC ---
  useEffect(() => {
    if (!sessionId) return; // Don't start countdown if sessionID isn't ready

    const countdown = setInterval(() => { 
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          if (!sessionExpired) { // Ensure this block runs only once
            setSessionExpired(true);
            document.body.style.filter = 'grayscale(100%)';

            const endSessionFlow = async () => {
              try {
                console.log("Timer expired. Attempting to end session:", sessionId);
                await axios.post(`${apiBaseUrl}/api/session/end`, { sessionId });
                console.log("Session end signal sent successfully to backend.");
              } catch (error) {
                console.error('Failed to signal session end to backend:', error);
              } finally {
                // Redirect after a delay, regardless of backend call success
                setTimeout(() => {
                  if (postSurveyRedirectUrl) {
                    console.log("Redirecting to REDCap post-survey:", postSurveyRedirectUrl);
                    window.location.href = postSurveyRedirectUrl;
                  } else {
                    console.error("Cannot redirect: Post-survey URL was not set. Fallback message should be shown.");
                    // The redirectError state will trigger a message in the UI
                    setRedirectError(true); // Ensure this is set if URL is missing
                  }
                }, 2000); // 2-second delay to allow backend call and give user a moment
              }
            };
            endSessionFlow();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  
    return () => clearInterval(countdown);
  }, [sessionId, apiBaseUrl, postSurveyRedirectUrl, sessionExpired]); // Added sessionExpired to prevent re-runs

  const handleSend = async () => {
    if (inputValue.trim() === '' || !sessionId || isLoading || sessionExpired) return;

    const userMessage = { sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);

    const currentInput = inputValue;
    setInputValue('');
    
    setIsLoading(true);
    if (showEmojiPicker) {
        setShowEmojiPicker(false); 
    }

    const thinkingMessage = { sender: 'bot-thinking', text: '...' };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      const response = await axios.post(`${apiBaseUrl}/api/session/message`, {
        sessionId,
        message: currentInput
      });

      console.log("Message response received:", response.data);
      // console.log("Raw LSM Score for this turn:", response.data.lsmScore); // Optional: keep for debugging
      // console.log("Smoothed LSM Score after this turn:", response.data.smoothedLsmAfterTurn);
      // console.log("Bot Style Profile Used (includes prev smoothed LSM):", response.data.styleProfile);

      const botMessage = { sender: 'bot', text: response.data.response };

      setMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(msg => msg.sender === 'bot-thinking');
        if (thinkingIndex > -1) newMessages[thinkingIndex] = botMessage;
        else newMessages.push(botMessage); 
        return newMessages;
      });

    } catch (error) {
      console.error('Error sending message:', error);
      // ... (error handling as before) ...
      const fallbackBot = { sender: 'bot', text: 'Oops, something went wrong. Please try again.' };
      setMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(msg => msg.sender === 'bot-thinking');
        if (thinkingIndex > -1) newMessages[thinkingIndex] = fallbackBot;
        else newMessages.push(fallbackBot); 
        return newMessages;
      });
    } finally {
      setIsLoading(false); 
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey && !sessionExpired) { // Prevent send if session expired
      e.preventDefault();
      handleSend();
    }
  };

  // --- UI FOR REDIRECT ERROR ---
  if (sessionExpired && redirectError && !postSurveyRedirectUrl) {
    return (
      <div style={{ 
          width: '100%', height: '100vh', display: 'flex', 
          flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
          textAlign: 'center', padding: '20px', fontFamily: 'Arial, sans-serif',
          filter: 'grayscale(100%)' // Keep grayscale if session expired
      }}>
        <h2>Thank You!</h2>
        <p>Your chat session has concluded.</p>
        <p style={{color: 'red', marginTop: '20px'}}>
          There was an issue automatically redirecting you to the final survey.
        </p>
        <p>
          Please return to the REDCap tab or window you used for the initial survey,
          or use the link provided by the research team to complete the post-survey.
        </p>
        <p style={{marginTop: '10px'}}>
          If you continue to have issues, please contact the research coordinator.
        </p>
      </div>
    );
  }


  return (
  <div
    ref={vantaRef}
    id="vanta-bg"
    style={{
      width: '100%',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}
      onClick={(e) => {
        const emojiPickerButton = e.target.closest('button[aria-label="Toggle Emoji Picker"]');
        const sendButton = e.target.closest('button'); 

        if (pickerRef.current && !pickerRef.current.contains(e.target) &&
            inputRef.current && !inputRef.current.contains(e.target) &&
            !emojiPickerButton && 
            !(sendButton && sendButton.textContent?.match(/Send|Sending.../)) 
            ) {
          if (!isLoading && !showEmojiPicker && !sessionExpired) { 
            focusInput();
          }
        }
      }}
    >
      {/* Countdown Timer */}
      <div className="fixed bottom-[80px] w-full flex justify-center z-40">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full text-gray-700 text-sm font-mono shadow">
          {sessionExpired
            ? "Chat session ended. Preparing to redirect..."
            : `Time left: ${Math.floor(remainingTime / 60)
                .toString()
                .padStart(2, '0')}:${(remainingTime % 60).toString().padStart(2, '0')}`}
        </div>
      </div>

      {/* Messages */}
      <div className="absolute bottom-[48vh] left-1/2 transform -translate-x-1/2 w-full max-w-3xl flex flex-col items-center px-2 space-y-2 overflow-y-auto h-[calc(100vh - 53vh - 80px)] pb-4">
        {messages.map((msg, idx) => {
          if (msg.sender === 'bot-thinking') {
            // ... (thinking message as before) ...
            return (
              <div
                key={`thinking-${idx}`}
                className="max-w-xs sm:max-w-sm md:max-w-md px-4 py-2 rounded-2xl bg-[#3B3B3B] text-[#ffffff] self-start animate-pulse" 
              >
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-1"></div>
                <div className="h-4 bg-gray-600 rounded w-1/2"></div>
              </div>
            );
          }
          return (
            // ... (regular message as before) ...
            <div
              key={idx}
              className={`w-xl sm:max-w-sm md:max-w-md px-4 py-2 rounded-2xl whitespace-pre-wrap ${
                msg.sender === 'bot'
                  ? 'bg-[#3B3B3B] text-[#ffffff] self-start'
                  : 'bg-[#DEDEDE] text-[#222222] self-end'
              }`}
            >
              {msg.text.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Avatars */}
      {!isNoAvatar && (
        <>
          <div className="fixed bottom-20 w-full flex justify-center items-end z-30 pointer-events-none">
            <img
              src={kagamiAvatar}
              alt="Kagami Avatar"
              className="h-[45vh] max-h-[550px] w-auto object-contain mr-[-5rem]" 
            />
            <img
              src={userDisplayAvatar} // Use the determined user avatar
              alt="User Avatar"
              className="h-[45vh] max-h-[550px] w-auto object-contain ml-[-5rem]" 
            />
          </div>
        </>
      )}

      {/* Chat Input - Disable if sessionExpired */}
      <div className={`fixed bottom-0 w-full flex justify-center p-4 z-50 ${sessionExpired ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex w-full max-w-3xl items-center bg-white rounded-full shadow-md px-4 py-2"> 
          <div className="relative mr-2 hidden sm:block">
            <button
            onClick={(e) => {
              if (sessionExpired) return;
              e.stopPropagation(); 
              setShowEmojiPicker(prev => !prev);
            }}
            className="block"
              aria-label="Toggle Emoji Picker"
              disabled={sessionExpired}
            >
              <img src={smileIcon} alt="Emoji Picker Icon" className="w-6 h-6" />
            </button>
            {showEmojiPicker && !sessionExpired && ( // Also hide picker if session expired
              <div
                ref={pickerRef}
                className="absolute bottom-full mb-6 left-0 z-50 p-2 bg-white rounded-xl shadow-lg border border-gray-200 w-64 max-h-80 overflow-y-auto"
                onClick={(e) => e.stopPropagation()} 
              >
                <EmojiPicker.Root onEmojiSelect={({ emoji }) => {
                    setInputValue(prev => prev + emoji);
                }}>
                  <EmojiPicker.Search className="p-2 border-b w-full" /> 
                  <EmojiPicker.Viewport className="overflow-y-auto flex-grow"> 
                    <EmojiPicker.Loading>Loading…</EmojiPicker.Loading>
                    <EmojiPicker.Empty>No emoji found.</EmojiPicker.Empty>
                    <EmojiPicker.List className="p-2 text-2xl grid gap-1" /> 
                  </EmojiPicker.Viewport>
                </EmojiPicker.Root>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 border-none focus:outline-none text-lg"
            placeholder={isLoading ? "Sending..." : (sessionExpired ? "Session ended." : "Type a message...")}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || sessionExpired}
            onClick={(e) => e.stopPropagation()} 
          />
          <button
            onClick={(e) => {
                if (sessionExpired) return;
                e.stopPropagation(); 
                handleSend();
            }}
            disabled={!inputValue.trim() || isLoading || sessionExpired}
            className={`ml-2 rounded-full px-4 py-2 transition ${
              !inputValue.trim() || isLoading || sessionExpired
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
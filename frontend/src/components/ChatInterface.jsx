import React, { useState, useRef, useEffect } from 'react';
import kagamiAvatar from '../assets/avatars/kagami.png';
import axios from 'axios';
import smileIcon from '../assets/smile.png';
import { EmojiPicker } from 'frimousse';
import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min.js';

export default function ChatInterface({ 
  sessionId, 
  condition, 
  backendCondition, 
  userAvatarUrl,      
  selectedAvatarUrl,  
  apiBaseUrl, 
  initialMessages, 
  participantId       
}) {
  const vantaRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto'; 
    };
  }, []); 

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
  const isNoAvatar = conditionString.includes('noavatar');
  const userDisplayAvatar = isGenerated ? userAvatarUrl : selectedAvatarUrl;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 

  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [postSurveyRedirectUrl, setPostSurveyRedirectUrl] = useState('');
  const [redirectError, setRedirectError] = useState(false); 

  const [remainingTime, setRemainingTime] = useState(600); 
  const [sessionExpired, setSessionExpired] = useState(false);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0); 
  };
  
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const redcapPostUrlFromQuery = queryParams.get('post_survey_url');

    if (redcapPostUrlFromQuery) {
      const decodedUrl = decodeURIComponent(redcapPostUrlFromQuery);
      setPostSurveyRedirectUrl(decodedUrl);
      console.log("REDCap Post Survey URL received and set:", decodedUrl);
    } else {
      console.error("CRITICAL: REDCap post_survey_url not found in query parameters!");
      setRedirectError(true); 
    }
  }, []); 

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

  useEffect(() => {
    if (!sessionId) return; 

    const countdown = setInterval(() => { 
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          if (!sessionExpired) { 
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
                setTimeout(() => {
                  if (postSurveyRedirectUrl) {
                    console.log("Redirecting to REDCap post-survey:", postSurveyRedirectUrl);
                    window.location.href = postSurveyRedirectUrl;
                  } else {
                    console.error("Cannot redirect: Post-survey URL was not set. Fallback message should be shown.");
                    setRedirectError(true); 
                  }
                }, 2000); 
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
  }, [sessionId, apiBaseUrl, postSurveyRedirectUrl, sessionExpired]); 

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
    if (e.key === 'Enter' && !e.shiftKey && !sessionExpired) { 
      e.preventDefault();
      handleSend();
    }
  };

  if (sessionExpired && redirectError && !postSurveyRedirectUrl) {
    return (
      <div style={{ 
          width: '100%', height: '100vh', display: 'flex', 
          flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
          textAlign: 'center', padding: '20px', fontFamily: 'Arial, sans-serif',
          filter: 'grayscale(100%)' 
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

  // Define heights for layout calculations (adjust if input bar/timer changes significantly)
  const INPUT_BAR_ESTIMATED_HEIGHT_PX = 70; // For tailwind: p-4 outer, py-2 inner, ~h-14 + padding
  const TIMER_HEIGHT_PX = 30; // Approx height of timer
  const AVATAR_AREA_BOTTOM_MARGIN_VH = 48; // Where messages should sit above

  return (
  <div
    ref={vantaRef}
    id="vanta-bg"
    style={{
      width: '100%',
      height: '100vh',
      position: 'relative',
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
      <div className="fixed bottom-[80px] w-full flex justify-center z-40 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full text-gray-700 text-sm font-mono shadow pointer-events-auto">
          {sessionExpired
            ? "Chat session ended. Preparing to redirect..."
            : `Time left: ${Math.floor(remainingTime / 60)
                .toString()
                .padStart(2, '0')}:${(remainingTime % 60).toString().padStart(2, '0')}`}
        </div>
      </div>

      {/* Messages */}
      {/* REVERTED: Message container position and height to previous working style */}
      <div 
        className="absolute left-1/2 transform -translate-x-1/2 w-full max-w-3xl flex flex-col items-center px-2 space-y-2 overflow-y-auto pt-4 pb-4"
        style={{
          bottom: `${AVATAR_AREA_BOTTOM_MARGIN_VH}vh`,
          // Height calculation: 
          // (100vh - AVATAR_AREA_BOTTOM_MARGIN_VH_for_messages) 
          // - top_padding (1rem from pt-4)
          // This makes the message container occupy the space from top of screen down to where avatars start
          height: `calc(${100 - AVATAR_AREA_BOTTOM_MARGIN_VH}vh - 1rem)` 
        }}
      >
        {messages.map((msg, idx) => {
          if (msg.sender === 'bot-thinking') {
            return (
              <div
                key={`thinking-${idx}`}
                // REVERTED: Bubble styling
                className="max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl bg-[#3B3B3B] text-[#ffffff] self-start animate-pulse" 
              >
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-1"></div>
                <div className="h-4 bg-gray-600 rounded w-1/2"></div>
              </div>
            );
          }
          return (
            <div
              key={idx}
              // REVERTED: Bubble styling
              className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl whitespace-pre-wrap text-base ${
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
          <div className="fixed bottom-10 sm:bottom-12 md:bottom-16 w-full flex justify-center items-end z-30 pointer-events-none">
            <img
              src={kagamiAvatar}
              alt="Kagami Avatar"
              className="h-[35vh] sm:h-[40vh] md:h-[45vh] max-h-[400px] sm:max-h-[480px] md:max-h-[550px] w-auto object-contain mr-[-3rem] sm:mr-[-4rem] md:mr-[-5rem]" 
            />
            <img
              src={userDisplayAvatar} 
              alt="User Avatar"
              className="h-[35vh] sm:h-[40vh] md:h-[45vh] max-h-[400px] sm:max-h-[480px] md:max-h-[550px] w-auto object-contain ml-[-3rem] sm:ml-[-4rem] md:ml-[-5rem]" 
            />
          </div>
        </>
      )}

      {/* Chat Input */}
      {/* Styles for input area are kept from previous successful iteration as they were generally fine */}
      <div className={`fixed bottom-0 w-full flex justify-center p-2 sm:p-4 z-50 ${sessionExpired ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex w-full max-w-xl sm:max-w-2xl md:max-w-3xl items-center bg-white rounded-full shadow-md px-3 py-1.5 sm:px-4 sm:py-2"> 
          <div className="relative mr-1 sm:mr-2 hidden sm:block">
            <button
            onClick={(e) => {
              if (sessionExpired) return;
              e.stopPropagation(); 
              setShowEmojiPicker(prev => !prev);
            }}
            className="block p-1"
              aria-label="Toggle Emoji Picker"
              disabled={sessionExpired}
            >
              <img src={smileIcon} alt="Emoji Picker Icon" className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            {showEmojiPicker && !sessionExpired && ( 
              <div
                ref={pickerRef}
                className="absolute bottom-full mb-2 sm:mb-4 md:mb-6 left-0 z-50 p-1 sm:p-2 bg-white rounded-xl shadow-lg border border-gray-200 w-56 sm:w-64 max-h-64 sm:max-h-80 overflow-y-auto"
                onClick={(e) => e.stopPropagation()} 
              >
                <EmojiPicker.Root onEmojiSelect={({ emoji }) => {
                    setInputValue(prev => prev + emoji);
                }}>
                  <EmojiPicker.Search className="p-1.5 sm:p-2 border-b w-full text-sm" /> 
                  <EmojiPicker.Viewport className="overflow-y-auto flex-grow"> 
                    <EmojiPicker.Loading>Loading…</EmojiPicker.Loading>
                    <EmojiPicker.Empty>No emoji found.</EmojiPicker.Empty>
                    <EmojiPicker.List className="p-1 sm:p-2 text-xl sm:text-2xl grid gap-1" /> 
                  </EmojiPicker.Viewport>
                </EmojiPicker.Root>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 border-none focus:outline-none text-base sm:text-lg bg-transparent"
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
            className={`ml-1 sm:ml-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 transition text-sm sm:text-base ${
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
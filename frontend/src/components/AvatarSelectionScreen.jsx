// src/components/AvatarSelectionScreen.jsx
import React, { useEffect } from 'react';
import useSessionStore from '../store/sessionStore';
import PremadeAvatarGallery from './PremadeAvatarGallery';
import GeneratedAvatarInterface from './GeneratedAvatarInterface';

function AvatarSelectionScreen({
  onAvatarSelected,
  onAvatarGenerated,
  logFrontendEvent,
  premadeAvatars,
  kagamiPlaceholder
}) {
  const { condition, sessionId } = useSessionStore();

  useEffect(() => {
    if (condition) {
      logFrontendEvent('avatar_selection_screen_viewed', { avatar_type: condition.avatarType });
    }
  }, [condition, logFrontendEvent]);
  
  if (!condition) {
    return <div className="text-center text-foreground/60 p-8">Loading...</div>;
  }

  const isGeneratedCondition = condition.avatarType === 'generated';

  const renderAvatarContent = () => {
    if (isGeneratedCondition) {
      return (
        <GeneratedAvatarInterface
          sessionId={sessionId}
          onAvatarGenerated={onAvatarGenerated}
          logFrontendEvent={logFrontendEvent}
          kagamiPlaceholder={kagamiPlaceholder}
        />
      );
    }
    return (
      <PremadeAvatarGallery
        premadeAvatars={premadeAvatars}
        onSelect={onAvatarSelected}
        logFrontendEvent={logFrontendEvent}
      />
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-4 text-center">
        {isGeneratedCondition ? 'Create Your Companion' : 'Select Your Avatar'}
      </h1>
      <p className="text-lg text-foreground/80 mb-8 text-center max-w-md">
        {isGeneratedCondition 
          ? 'Describe an avatar that feels most like you.' 
          : 'Pick the one that feels most like you.'
        }
      </p>

      <div className="w-full">
        {renderAvatarContent()}
      </div>

    </div>
  );
}

export default AvatarSelectionScreen;
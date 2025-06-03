import React, { useState, useEffect } from 'react';
import PremadeAvatarGallery from './PremadeAvatarGallery';
import GeneratedAvatarInterface from './GeneratedAvatarInterface';

function AvatarSelectionScreen({
  condition,
  sessionId,
  onAvatarSelected,
  onAvatarGenerated,
  logFrontendEvent,
  apiBaseUrl,
  premadeAvatars // Pass the object of imported premade avatar images
}) {
  useEffect(() => {
    logFrontendEvent('avatar_selection_screen_viewed', { avatar_type: condition.avatarType });
  }, [condition, logFrontendEvent]);

  const renderAvatarContent = () => {
    if (condition.avatarType === 'premade') {
      return (
        <PremadeAvatarGallery
          premadeAvatars={premadeAvatars}
          onSelect={onAvatarSelected}
          logFrontendEvent={logFrontendEvent}
        />
      );
    } else if (condition.avatarType === 'generated') {
      return (
        <GeneratedAvatarInterface
          sessionId={sessionId}
          onGenerate={onAvatarGenerated}
          logFrontendEvent={logFrontendEvent}
          apiBaseUrl={apiBaseUrl}
        />
      );
    }
    // Fallback in case of unexpected condition.avatarType
    return (
      <div className="flex items-center justify-center h-full w-full text-red-600 dark:text-red-400">
        <p>Error: Unknown avatar type configured for this condition.</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center h-full w-full p-4 bg-bg-surface-light dark:bg-dark-bg text-brand-primary dark:text-dark-text transition-colors duration-500">
      {condition.avatarType === 'premade' && (
        <div className="text-center mt-8 px-4 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4">Select your avatar</h2>
          <p className="text-lg mb-6 text-brand-primary dark:text-dark-text">Pick the one that feels most like you.</p>
        </div>
      )}
      <div className="flex-1 w-full overflow-y-auto pb-4"> {/* Added overflow for scrollable content */}
        {renderAvatarContent()}
      </div>
    </div>
  );
}

export default AvatarSelectionScreen;
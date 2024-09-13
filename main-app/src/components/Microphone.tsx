'use client';
import { useEffect } from 'react';
import { useRecordVoice } from '@/hooks/useRecordVoice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // Import FontAwesome
import { faMicrophone } from '@fortawesome/free-solid-svg-icons'; // Import microphone icon

// Define the props type
interface MicrophoneProps {
  playAudio: (audioChunks: string[]) => void; // Expect an array of strings
  isVisible: boolean;
}

const Microphone: React.FC<MicrophoneProps> = ({ playAudio, isVisible }) => {
  const { startRecording, stopRecording, recording, text } = useRecordVoice(playAudio);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        startRecording();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startRecording, stopRecording]);

  if (!isVisible){
    return null;
  }

  return (
    <>
      {/* Microphone Button */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex flex-col justify-center items-center z-50 pointer-events-none">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className="border-none bg-transparent cursor-pointer pointer-events-auto"
        >
          <FontAwesomeIcon
            icon={faMicrophone}
            size="4x"
            className={`text-red-500 transition-transform duration-300 ease-in-out ${recording ? 'animate-pulse text-red-300' : ''}`}
          />
        </button>
        <p className="text-white text-base mt-2">
          {text || 'Press and hold spacebar or click the microphone to record.'}
        </p>
      </div>
    </>
  );
};

export default Microphone;

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import dynamic from 'next/dynamic';
import { SignedIn, SignedOut, useAuth } from '@clerk/nextjs';
import Header from './Header';
import { sendPredefinedMessage } from '@/utils/speechSynthesis';
import * as THREE from 'three';
import { useRecordVoice } from '@/hooks/useRecordVoice';

// Correct dynamic import with default export
const Experience = dynamic(() => import('@/components/Experience').then((mod) => mod.default), {
  ssr: false,
});
const Microphone = dynamic(() => import('@/components/Microphone').then((mod) => mod.default), {
  ssr: false,
});

// Define the props type for HomeClient
interface HomeClientProps {
  userId: string;
}

interface UserSession {
  id: number;
  status: string;
  // Add other properties as needed
}

export default function HomeClient({ userId }: HomeClientProps) {
  const {isSignedIn} = useAuth();
  const [audioBase64, setAudioBase64] = useState<string[]>([]); // Now it's an array of strings
  const [isMicVisible, setIsMicVisible] = useState(false);
  const [messagePlaying, setMessagePlaying] = useState(false); // Track whether the message is playing
  const cameraDistance = 100;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const predefinedMessageSent = useRef(false);
  // Define a state to hold the transcription text
  const [text, setText] = useState<string | null>(null); // Now managing text in HomeClient
  const audioRef = useRef<THREE.Audio | null>(null); // Add this ref for audio handling
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [confirmText, setConfirmText] = useState(''); // State for new session confirmation input
  const [conversationHistory, setConversationHistory] = useState([]); // State to store conversation history

  const logConversation = async (message: string, sender: 'user' | 'ai') => {
    if (!activeSession) return;
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: activeSession.id, message, sender }),
      });
      if (response.ok) {
        console.log("Logged conversation:", { message, sender });
      } else {
        console.error('Failed to log conversation:', response.statusText);
      }
    } catch (error) {
      console.error('Error logging conversation:', error);
    }
  };

  // Modify playAudio to accept an array of strings
  const playAudio = (audioChunks: string[]) => {
    if (audioChunks.length > 0) {
      console.log('Received audio chunks in HomeClient: ', audioChunks);
      setAudioBase64(audioChunks);
    } else {
      console.error('No audio chunks provided');
    }
  };

  // Stop current audio playback
  const stopAudio = () => {
    if (audioRef.current && audioRef.current.isPlaying) {
      audioRef.current.stop();
    }
  };

  // Pass stopAudioPlayback to the useRecordVoice hook
  const { startRecording, stopRecording } = useRecordVoice(playAudio, stopAudio, logConversation, activeSession);

  const handleGetStarted = async () => {
    if (isSubmitting || activeSession) return; // Prevent further calls if already submitting
    console.log("Get Started button clicked, stopping message and enabling microphone. New Session started");
    setIsSubmitting(true); // Prevent multiple clicks
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId,
        },
        body: JSON.stringify({ confirm: 'start new simulation' }), // Skipping confirmation for this example
      });

      if (response.ok) {
        const data = await response.json();
        setActiveSession(data.newSession);
        console.log("New session started:", data.newSession);

        // Ensure the session is set before showing the microphone
        setTimeout(() => {
          setIsMicVisible(true); // Show the microphone
          setMessagePlaying(false); // Stop any predefined message
        }, 500); // Slight delay to ensure session state is updated
      } else {
        console.error('Failed to start a new session.');
      }
    } catch (error) {
      console.error('Error starting a new session:', error);
    }
  
    setIsSubmitting(false);
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;

    try {
      const response = await fetch('/api/session', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });

      if (response.ok) {
        setActiveSession(null);
        setIsMicVisible(false); // Hide the microphone until a new session starts
      } else {
        console.error('Failed to complete session.');
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  // Function to handle starting a new session
  const handleConfirmNewSession = async () => {
    if (confirmText !== 'start new simulation') {
      alert('You must type "start new simulation" to confirm.');
      return;
    }

    // Reset confirmation text
    setConfirmText('');

    // Start a new session
    await handleGetStarted();
  };

  const fetchConversationHistory = async () => {
    if (!activeSession) return;
    try {
      const response = await fetch(`/api/conversations?sessionId=${activeSession.id}`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setConversationHistory(data);
        console.log("Fetched conversation history:", data);
      } else {
        console.error('Failed to fetch conversation history:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching conversation history:', error);
    }
  };

  // Function to fetch active session
  const fetchUserSession = async () => {
    try {
      const response = await fetch('/api/session', {
        method: 'GET',
      });
      if (!response.ok) {
        console.error('Failed to fetch session:', response.statusText);
        return null;
      }
      const data = await response.json();
      return data.activeSession; // Ensure this matches the API response structure
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      const getSessionForUser = async () => {
        const session = await fetchUserSession();
        if (session) {
          setActiveSession(session);
          fetchConversationHistory(); // Fetch history if an active session exists
        } else {
          console.error('No active session found for the user.');
        }
      };
      getSessionForUser();
    }
  }, [isSignedIn, userId]);

  // Play the predefined message when the user signs in
useEffect(() => {
  const initiatePredefinedMessage = async () => {
    if (!predefinedMessageSent.current) {
      predefinedMessageSent.current = true; // Mark it as sent
      await sendPredefinedMessage(setAudioBase64);
    }
  };

  if (isSignedIn && !activeSession) {
    initiatePredefinedMessage();
  }
}, [isSignedIn, activeSession]);

// Sync user with Prisma database on sign-in
useEffect(() => {
  if (isSignedIn) {
    const syncUser = async () => {
      try {
        const response = await fetch('/api/sync-user', {
          method: 'GET',
        });
        if (!response.ok) {
          console.error('Failed to sync user:', response.statusText);
        }
      } catch (error) {
        console.error('Error syncing user:', error);
      }
    };

    syncUser();
  }
}, [isSignedIn]);

 // Check for active sessions on sign-in
 useEffect(() => {
  if (isSignedIn) {
    const checkActiveSession = async () => {
      try {
        const response = await fetch('/api/session', {
          method: 'GET',
        });
        // Ensure the response is okay
        if (!response.ok) {
          console.error('Error fetching active session:', response.statusText);
          return;
        }
        const data = await response.json();

        // Handle errors returned in the JSON response
        if (data.error) {
          console.error('Error in response:', data.error);
          return;
        }

        // Handle the case when no active session is found
        if (data.activeSession === null) {
          console.log("No active session found.");
          setActiveSession(null);
          return;
        }

        setActiveSession(data.activeSession);
        if (data.activeSession) {
          console.log("Active session found:", data.activeSession);
          fetchConversationHistory(); // Fetch history if active session exists
        }
      } catch (error) {
        console.error('Error checking active session:', error);
      }
    };
    console.log(userId)
    checkActiveSession();
  }
}, [isSignedIn, userId]);

useEffect(() => {
  console.log("Active session updated:", activeSession);
}, [activeSession]);

useEffect(() => {
  console.log("isMicVisible:", isMicVisible);
}, [isMicVisible]);

  return (
    <main className="h-screen min-h-screen">
      <SignedIn>
        <Header userId={userId} />
        <Canvas
          camera={{
            position: [0, 0, cameraDistance],
            fov: 75,
          }}
        >
          <OrbitControls
            enablePan={false}
            minDistance={5}
            maxDistance={15}
            maxPolarAngle={Math.PI / 2.2}
          />
          <Experience audioChunks={audioBase64} audioRef={audioRef}  />
        </Canvas>

        {/* Show the "Get Started" button if the microphone is not visible */}
        {!isMicVisible && !activeSession && (
          <div className="flex justify-center mt-4">
            <button
              onClick={handleGetStarted}
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
            >
              Get Started
            </button>
          </div>
        )}
         {/* Active session controls */}
         {activeSession && activeSession &&(
          <>
            <p className="text-center text-gray-500 mt-2">
              You have an active session. Please complete it before starting a new one.
            </p>
            <div className="flex justify-center mt-4">
              <button
                onClick={handleCompleteSession}
                className="bg-red-500 text-white px-4 py-2 rounded-md"
              >
                Complete Current Session
              </button>
            </div>
            {/* Show "Start New Simulation" button only after the session is completed */}
          </>
        )}

         {/* Conditionally show the microphone and the transcription */}
         {isMicVisible && activeSession &&(
          <>
            <Microphone playAudio={playAudio} isVisible={isMicVisible} setText={setText} stopAudio={stopAudio} logConversation={logConversation} activeSession={activeSession}/>
          </>
        )}

        {/* Predefined message status */}
        {messagePlaying && (
          <p className="text-center text-gray-500 mt-2">Predefined message playing...</p>
        )}
      </SignedIn>
      <SignedOut>
        <p>Please sign in to use this feature.</p>
      </SignedOut>
    </main>
  );
}
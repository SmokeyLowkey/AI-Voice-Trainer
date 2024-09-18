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
  const { startRecording, stopRecording } = useRecordVoice(playAudio, stopAudio);

  const handleGetStarted = async () => {
    if (isSubmitting) return; // Prevent further calls if already submitting
    console.log("Get Started button clicked, stopping message and enabling microphone");
    setIsSubmitting(true); // Prevent multiple clicks
    setMessagePlaying(false); // Stop the predefined message
    setIsMicVisible(true); // Show the microphone
    setIsSubmitting(false); // Reset after the function completes
  };

  // Send the predefined message when the user signs in
 useEffect(() => {
  const initiatePredefinedMessage = async () => {
    if (!predefinedMessageSent.current) {
      predefinedMessageSent.current = true; // Mark it as sent
      await sendPredefinedMessage(setAudioBase64);
    }
  };

  initiatePredefinedMessage();
}, []);

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
        {!isMicVisible && (
          <div className="flex justify-center mt-4">
            <button
              onClick={handleGetStarted}
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
            >
              Get Started
            </button>
          </div>
        )}

         {/* Conditionally show the microphone and the transcription */}
         {isMicVisible && (
          <>
            <Microphone playAudio={playAudio} isVisible={isMicVisible} setText={setText} stopAudio={stopAudio} />
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
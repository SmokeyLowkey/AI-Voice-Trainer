'use client';

import React, { useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import dynamic from 'next/dynamic';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import Header from './Header';

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
  const [audioBase64, setAudioBase64] = useState<string[]>([]); // Now it's an array of strings
  const cameraDistance = 100;

  // Modify playAudio to accept an array of strings
  const playAudio = (audioChunks: string[]) => {
    if (audioChunks.length > 0) {
      console.log('Received audio chunks: ', audioChunks);
      setAudioBase64(audioChunks);
    } else {
      console.error('No audio chunks provided');
    }
  };

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
          <Experience audioChunks={audioBase64} />
        </Canvas>
        <Microphone playAudio={playAudio} />
      </SignedIn>
      <SignedOut>
        <p>Please sign in to use this feature.</p>
      </SignedOut>
    </main>
  );
}

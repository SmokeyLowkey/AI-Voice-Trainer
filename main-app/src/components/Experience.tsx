'use client';
import React, { useEffect, useRef } from 'react';
import { useFrame, extend, useThree } from "@react-three/fiber";
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { Reflector } from 'three/examples/jsm/objects/Reflector';
import { ShaderMaterial, IcosahedronGeometry, AudioListener, AudioLoader } from 'three';


// Extend three.js with postprocessing passes for React Three Fiber
extend({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass });

interface ExperienceProps {
  audioChunks: string[];
}

const Experience: React.FC<ExperienceProps> = ({ audioChunks }) => {
  const composer = useRef<EffectComposer | null>(null);
  const { scene, camera, gl } = useThree();
  const shaderMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const analyserRef = useRef<THREE.AudioAnalyser | null>(null);
  const clock = useRef(new THREE.Clock());
  const audioRef = useRef<THREE.Audio | null>(null);

  const backgroundColor = 0x000000; // Set the background color here

  useEffect(() => {
    console.log("Received audio chunks in Experience:", audioChunks); // Debug log
    if (audioChunks && audioChunks.length > 0) {
      playAudioChunks(audioChunks);
    } else {
      console.log("No audio chunks to play.");
    }
  }, [audioChunks]);

  const base64ToBlob = (base64: string, type = 'audio/wav'): Blob => {
    if (base64.includes(',')) {
      base64 = base64.split(',')[1]; // Get the actual base64 content
    }

    const binaryString = window.atob(base64); // Decode base64 string
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type });
  };

  const stopCurrentSound = () => {
    if (audioRef.current && audioRef.current.isPlaying) {
      console.log("Stopping current sound.");
      audioRef.current.stop(); // Stop the currently playing sound
    }
  };

  const playAudioChunks = async (audioChunks: string[]) => {
    if (audioChunks.length === 0) {
      console.log('No audio chunks to play.');
      return;
    }
    for (const chunk of audioChunks) {
      stopCurrentSound();
      console.log("Playing chunk:", chunk); // Debug log for each chunk being played
      const listener = new AudioListener();
      camera.add(listener);

      const sound = new THREE.Audio(listener);
      const audioLoader = new AudioLoader();

      const blob = base64ToBlob(chunk, 'audio/wav');
      const audioUrl = URL.createObjectURL(blob);

      console.log("Audio URL:", audioUrl); // Log the URL for debugging

      await new Promise<void>((resolve, reject) => {
        audioLoader.load(audioUrl, (buffer) => {
          sound.setBuffer(buffer);
          sound.setLoop(false);
          sound.setVolume(1);
          sound.play();
          analyserRef.current = new THREE.AudioAnalyser(sound, 256);
          if (sound.source) {
            sound.source.onended = () => resolve();
          }
        }, undefined, (error) => {
          console.error("Error loading audio: ", error);
          reject(error);
        });
      });
    }
  };

  useEffect(() => {
    if (audioChunks && audioChunks.length > 0) {
      playAudioChunks(audioChunks);
    }
  }, [audioChunks]);

  useEffect(() => {
    const loadShaders = async () => {
      try {
        const vertexShaderResponse = await fetch('/shaders/vertexShader.glsl');
        const fragmentShaderResponse = await fetch('/shaders/fragmentShader.glsl');
        if (!vertexShaderResponse.ok || !fragmentShaderResponse.ok) {
          throw new Error('Failed to load shaders');
        }
        const vertexShader = await vertexShaderResponse.text();
        const fragmentShader = await fragmentShaderResponse.text();

        const uniforms = {
          u_time: { value: 0.0 },
          u_frequency: { value: 0.0 },
          u_red: { value: 1.0 },
          u_green: { value: 1.0 },
          u_blue: { value: 1.0 },
        };

        const geometry = new IcosahedronGeometry(4, 30);
        shaderMaterialRef.current = new ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
          wireframe: true,
        });

        const mesh = new THREE.Mesh(geometry, shaderMaterialRef.current);
        meshRef.current = mesh;
        scene.add(mesh);
      } catch (error) {
        console.error('Error loading shaders:', error);
      }
    };
    loadShaders();
  }, [scene]);

  useEffect(() => {
    const params = {
      threshold: 0.5,
      strength: 0.5,
      radius: 0.8,
    };

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      params.strength,
      params.radius,
      params.threshold
    );
    const outputPass = new OutputPass();

    composer.current = new EffectComposer(gl);
    composer.current.addPass(renderScene);
    composer.current.addPass(bloomPass);
    composer.current.addPass(outputPass);

    // Set the scene background color
    scene.background = new THREE.Color(backgroundColor);

    const groundMirror = new Reflector(new THREE.PlaneGeometry(100, 100), {
      clipBias: 0.003,
      textureWidth: window.innerWidth * window.devicePixelRatio,
      textureHeight: window.innerHeight * window.devicePixelRatio,
      color: backgroundColor,
      recursion: 1,
    });
    groundMirror.position.y = -8;
    groundMirror.rotation.x = -Math.PI / 2;
    scene.add(groundMirror as THREE.Object3D);

    window.addEventListener('resize', () => {
      (camera as THREE.PerspectiveCamera).aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      gl.setSize(window.innerWidth, window.innerHeight);
      composer.current?.setSize(window.innerWidth, window.innerHeight);
    });
  }, [camera, scene, gl]);

  useFrame(() => {
    if (!analyserRef.current || !meshRef.current || !shaderMaterialRef.current) return;

    const elapsedTime = clock.current.getElapsedTime();
    const frequency = analyserRef.current.getAverageFrequency();

    shaderMaterialRef.current.uniforms.u_time.value = elapsedTime;
    shaderMaterialRef.current.uniforms.u_frequency.value = frequency;

    const scale = 1 + (frequency / 100);
    meshRef.current.scale.set(scale, scale, scale);

    meshRef.current.rotation.y += 0.01;

    composer.current?.render();
  });

  return null;
};

export default Experience;

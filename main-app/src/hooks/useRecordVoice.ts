import { useEffect, useState, useRef } from "react";
import { blobToBase64 } from "@/utils/blobToBase64";

// Define the types for the props and functions
interface UseRecordVoiceReturn {
  recording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  text: string;
}

export const useRecordVoice = (playAudio: (audioChunks: string[]) => void): UseRecordVoiceReturn => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState("");
  const isRecording = useRef(false);
  const chunks = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null); // Ref to store media stream

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      // Stop all tracks in the media stream
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "inactive") {
      isRecording.current = true;
      mediaRecorder.start();
      setRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      isRecording.current = false;
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const getTranscriptionAndAudio = async (base64data: string) => {
    try {
      console.log("Sending audio data for transcription:", base64data);

      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioData: base64data }),
      }).then((res) => res.json());

      const { transcription } = transcriptionResponse;
      console.log("Received transcription:", transcription);
      setText(transcription);

      const gptResponse = await fetch("/api/gpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcription }),
      });

      const audioChunks: string[] = [];
      const reader = gptResponse.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      let jsonText = '';
      if (reader) {
        let { value, done } = await reader.read();
        while (!done) {
          jsonText += decoder.decode(value, { stream: true });
          const lines = jsonText.split('\n');

          for (let i = 0; i < lines.length - 1; i++) {
            try {
              const parsedLine = JSON.parse(lines[i]);
              console.log('Parsed chunk:', parsedLine);
              audioChunks.push(parsedLine.audio);
            } catch (err) {
              console.error('Error parsing JSON line:', lines[i], err);
            }
          }

          jsonText = lines[lines.length - 1];
          ({ value, done } = await reader.read());
        }
      }

      console.log("All chunks received:", audioChunks);
      playAudio(audioChunks);
    } catch (error) {
      console.error("Error processing audio:", error);
    }
  };

  const initialMediaRecorder = (stream: MediaStream) => {
    stopMediaStream(); // Stop any existing stream before starting a new one
    mediaStreamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.onstart = () => {
      chunks.current = [];
    };

    mediaRecorder.ondataavailable = (ev: BlobEvent) => {
      chunks.current.push(ev.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(chunks.current, { type: "audio/wav" });
      blobToBase64(audioBlob, getTranscriptionAndAudio);
    };

    setMediaRecorder(mediaRecorder);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        if (!isRecording.current) {
          startRecording();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        if (isRecording.current) {
          stopRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mediaRecorder]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(initialMediaRecorder)
        .catch((err) => console.error("Error accessing microphone", err));
    }

    return () => stopMediaStream();
  }, []);

  return { recording, startRecording, stopRecording, text };
};

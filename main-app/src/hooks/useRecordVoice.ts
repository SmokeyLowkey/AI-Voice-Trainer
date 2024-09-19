import { useEffect, useState, useRef } from "react";
import { blobToBase64 } from "@/utils/blobToBase64";

// Define the types for the props and functions
interface UseRecordVoiceReturn {
  recording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  text: string;
  stopAudioPlayback: () => void; // Add this to stop audio playback
}
// Define UserSession interface at the top of the file
interface UserSession {
  id: number;
  status: string;
  // Add other properties as needed
}

export const useRecordVoice = (
  playAudio: (audioChunks: string[]) => void,
  stopAudio: () => void,
  logConversation: (message: string, sender: "user" | "ai") => void,
  activeSession: UserSession | null,
): UseRecordVoiceReturn => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState("");
  const isRecording = useRef(false);
  const chunks = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null); // Ref to store media stream
  const retryCount = useRef(0); // Track retry attempts
  const maxRetries = 5; // Maximum number of retries

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      // Stop all tracks in the media stream
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "inactive") {
      // Interrupt current audio playback
      stopAudio(); // Stop any playing audio
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
      console.log("this is the activesession id begining of the try: ",activeSession?.id);
      console.log("Sending audio data for transcription:", base64data);

      // Introduce a more controlled wait loop to ensure activeSession is ready
      let waitTime = 0;
      const maxWaitTime = 5000; // Maximum wait time in milliseconds

      while ((!activeSession || !activeSession.id) && waitTime < maxWaitTime) {
        console.log("Waiting for active session to be ready...");
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before checking again
        waitTime += 500;
      }

      if (!activeSession || !activeSession.id) {
        console.log("this is the session id: ", activeSession?.id)
        console.error("No active session ID available after waiting.");
        return;
      }

      // Proceed with the transcription request
      // Reset retry count
      retryCount.current = 0;

      const sessionId = activeSession.id;
      console.log("Using sessionID: ", sessionId);

      // send transcription request
      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioData: base64data, sessionId }),
      }).then((res) => res.json());

      const { transcription } = transcriptionResponse;
      console.log("Received transcription:", transcription);
      setText(transcription);

      // Log the user's transcription
      logConversation(transcription, "user");

      const gptResponse = await fetch("/api/gpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcription, sessionId }),
      });

      const audioChunks: string[] = [];
      const reader = gptResponse.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      let jsonText = "";
      if (reader) {
        let { value, done } = await reader.read();
        while (!done) {
          jsonText += decoder.decode(value, { stream: true });
          const lines = jsonText.split("\n");

          for (let i = 0; i < lines.length - 1; i++) {
            try {
              const parsedLine = JSON.parse(lines[i]);
              console.log("Parsed chunk:", parsedLine);
              audioChunks.push(parsedLine.audio);
            } catch (err) {
              console.error("Error parsing JSON line:", lines[i], err);
            }
          }

          jsonText = lines[lines.length - 1];
          ({ value, done } = await reader.read());
        }
      }
      console.log("Received transcription text:", transcription);
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

  return {
    recording,
    startRecording,
    stopRecording,
    text,
    stopAudioPlayback: stopAudio,
  };
};

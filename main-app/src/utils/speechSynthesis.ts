import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/nextjs";

export const sendPredefinedMessage = async (
  setAudioChunks: (chunks: string[]) => void,
  firstName: string,
  messageType: 'welcome' | 'completion' = 'welcome' // default to 'welcome'
) => {
  try {
    let message = '';
    if (messageType === 'welcome') {
      message = `Welcome, ${firstName}, to the app. Here an AI model will roleplay customer interactions with you and score you based on accuracy and flow of the call. Make sure you follow your call service guidelines! So... ready to get started? Press the button!`;
    } else if (messageType === 'completion') {
      message = `You have completed the session ${firstName}! Take a moment to review your performance, and feel free to start a new simulation anytime.`;
    }

    const response = await fetch("/api/predefined-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcription: message,
        type: messageType,
      }),
    });

    // Handle the stream reading and audio processing as before...
    if (!response.body) throw new Error("No body in response");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let audioChunks: string[] = [];
    let receivedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      receivedText += chunk;

      try {
        const jsonObjects = receivedText.split("\n").filter(Boolean);
        jsonObjects.forEach((jsonString) => {
          const json = JSON.parse(jsonString);
          if (json.audio) audioChunks.push(json.audio);
        });
        receivedText = "";
      } catch (error) {
        console.error("Error parsing chunk:", error);
      }
    }

    setAudioChunks(audioChunks);
  } catch (error) {
    console.error("Error fetching predefined message audio:", error);
  }
};


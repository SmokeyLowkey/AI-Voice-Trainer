import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";

export const sendPredefinedMessage = async (
  setAudioChunks: (chunks: string[]) => void
) => {
  try {
    const response = await fetch("/api/gpt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcription:
          "Welcome to the app... Here an AI model will roleplay customer interactions with you and score you based on accuracy and flow of the call. Make sure you follow your call service guidelines! So... ready to get started? press the button!",
        type: "predefined",
      }),
    });

    if (!response.body) {
      throw new Error("ReadableStream not supported");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let audioChunks: string[] = [];
    let receivedText = ""; // To handle incomplete chunks

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("Stream complete");
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      console.log("Received chunk:", chunk);

      // Accumulate the received text
      receivedText += chunk;

      // Try to parse valid JSON objects from the accumulated text
      try {
        const jsonObjects = receivedText.split("\n").filter(Boolean); // Split by newline and remove empty strings
        jsonObjects.forEach((jsonString) => {
          const json = JSON.parse(jsonString);
          if (json.audio) {
            audioChunks.push(json.audio); // Add audio chunk
          }
        });
        receivedText = ""; // Clear accumulated text after successful parsing
      } catch (error) {
        console.error("Error parsing chunk:", error);
        // Keep accumulating text until valid JSON is found
      }
    }

    setAudioChunks(audioChunks);
  } catch (error) {
    console.error("Error fetching predefined message audio:", error);
  }
};

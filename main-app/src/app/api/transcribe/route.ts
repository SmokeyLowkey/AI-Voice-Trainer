import OpenAI, { toFile } from "openai";
import { NextApiRequest, NextApiResponse } from "next";
import { buffer } from 'micro';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    console.log("Incoming request to transcribe");

    // Get raw body data since bodyParser is false
    const rawBody = await buffer(req);
    const body = rawBody.toString();
    const { audioData }: { audioData: string } = JSON.parse(body);

    if (!audioData) {
      res.status(400).json({ error: "No audio data provided" });
      return;
    }

    console.log("Received Base64 audio data of size:", audioData.length);

    // Decode Base64 audio data
    const audioBuffer = Buffer.from(audioData, "base64");

    console.log("Decoded audio buffer size:", audioBuffer.length);

    // Use OpenAI's toFile utility to create a virtual file
    const file = await toFile(audioBuffer, "audio.wav", {
      type: "audio/wav", // Correct property is `type`, not `contentType`
    });

    console.log("Virtual file created successfully");

    // Make the Whisper transcription request
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    console.log("Transcription result:", transcription.text);

    res.status(200).json({ transcription: transcription.text });
  } catch (error: any) {
    console.error("Error during transcription:", error.message || error.response?.data);

    res.status(500).json({ error: "Error processing transcription" });
  }
}

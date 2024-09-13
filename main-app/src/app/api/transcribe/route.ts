import OpenAI, { toFile } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request): Promise<Response> {
  try {
    console.log("Incoming request to transcribe");

    // Get raw body data since bodyParser is disabled in the app router
    const rawBody = await req.arrayBuffer();
    console.log("this is after the const rawBody...");
    
    const body = Buffer.from(rawBody).toString();  // Convert ArrayBuffer to string
    const { audioData }: { audioData: string } = JSON.parse(body);

    if (!audioData) {
      return new Response(JSON.stringify({ error: "No audio data provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({ transcription: transcription.text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error during transcription:", error.message || error.response?.data);

    return new Response(JSON.stringify({ error: "Error processing transcription" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

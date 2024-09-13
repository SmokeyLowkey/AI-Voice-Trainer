import OpenAI, { toFile } from "openai";
import { ElevenLabsClient, ElevenLabs } from "elevenlabs";
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import { Groq } from 'groq-sdk';
import { ReadableStream } from 'stream/web';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY!);

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const textModel = process.env.TEXT_MODEL || 'openai';
const speechService = process.env.SPEECH_SERVICE || 'elevenlabs';
const MAX_CHUNK_SIZE = 1900;

export async function POST(req: Request): Promise<Response> {
  const encoder = new TextEncoder();
  // Log to verify that the request was received
  console.log("Request received in API route");

  const { transcription, type }: { transcription: string | null, type: string } = await req.json();

  console.log("Received transcription:", transcription);
  console.log("Received type:", type);

  if (!transcription) {
    return new Response(JSON.stringify({ error: 'No transcription provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          let textResponse = '';

          if (type === 'predefined') {
            console.log("Handling predefined message...");
            // If this is the predefined message, use it directly
            textResponse = transcription;
          } else {
            console.log("Handling user-generated transcription...");
            // Process the transcription with the chosen model
            if (textModel === 'openai') {
              console.log("Sending transcription to OpenAI for processing...");
              const gptResponse = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: transcription ?? '' }],
              });
              textResponse = gptResponse.choices[0].message.content ?? '';
              console.log("Received response from OpenAI:", textResponse);
            } else if (textModel === 'groq') {
              console.log("Received response from Groq:", textResponse);
              const groqResponse = await groqClient.chat.completions.create({
                messages: [{ role: 'user', content: transcription ?? '' }],
                model: 'llama3-8b-8192',
              });
              textResponse = groqResponse.choices[0].message.content ?? '';
              console.log("Received response from Groq:", textResponse);
            } else if (textModel === 'deepgram') {
              textResponse = transcription ?? '';
              console.log("Handling transcription with Deepgram:", textResponse);
            }
          }

          const textChunks = splitTextIntoChunks(textResponse, MAX_CHUNK_SIZE);
          console.log("Split text into chunks:", textChunks);

          for (const chunk of textChunks) {
            let audioBuffer: Buffer | undefined;
            if (speechService === 'elevenlabs') {
              console.log("Sending chunk to ElevenLabs for speech synthesis...");
              audioBuffer = await synthesizeSpeechWithElevenLabs(chunk);
              console.log("Received audio buffer from ElevenLabs");
            } else if (speechService === 'deepgram') {
              console.log("Sending chunk to Deepgram for speech synthesis...");
              audioBuffer = await synthesizeSpeechWithDeepgram(chunk);
              console.log("Received audio buffer from Deepgram");
            }

            if (!audioBuffer) throw new Error("Failed to synthesize audio");

            const audioBase64 = audioBuffer.toString('base64');
            const jsonChunk = JSON.stringify({ audio: audioBase64 });
            
            // Log each audio chunk that is being sent back
            console.log("Sending audio chunk back to client");

            // Ensure the chunk is newline-separated for easy client-side parsing
            controller.enqueue(encoder.encode(jsonChunk + '\n'));

            // Delay before sending the next chunk to simulate natural flow
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          const err = error as Error;
          console.error('Error during chunk processing: ', err.message || err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    }) as unknown as BodyInit, // Explicitly cast to `BodyInit`
    {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
    }
  );
}

// Helper function to split text into chunks
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';

  words.forEach((word) => {
    if (currentChunk.length + word.length + 1 <= maxLength) {
      currentChunk += `${word} `;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = `${word} `;
    }
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Helper function to synthesize speech using ElevenLabs
async function synthesizeSpeechWithElevenLabs(chunk: string): Promise<Buffer> {
  const chunkResponse = await elevenLabsClient.textToSpeech.convert('pMsXgVXv3BLzUgSXRplE', {
    optimize_streaming_latency: ElevenLabs.OptimizeStreamingLatency.Zero,
    output_format: ElevenLabs.OutputFormat.Mp344100128,
    text: chunk,
    voice_settings: {
      stability: 0.1,
      similarity_boost: 0.3,
      style: 0.2,
    },
  });

  const audioChunks: Buffer[] = [];
  for await (const audioChunk of chunkResponse) {
    audioChunks.push(audioChunk);
  }

  return Buffer.concat(audioChunks);
}

// Helper function to synthesize speech using Deepgram
async function synthesizeSpeechWithDeepgram(chunk: string): Promise<Buffer> {
    const deepgramResponse = await deepgram.speak.request(
      { text: chunk },
      {
        model: 'aura-asteria-en',
        encoding: 'linear16',
        container: 'wav',
      }
    );
  
    const audioChunks: Uint8Array[] = [];
    const stream = await deepgramResponse.getStream() as ReadableStream<Uint8Array> | null; // Explicit cast

    if (stream === null) {
        throw new Error('Stream is null');
    }
  
    const reader = stream.getReader();
    let done: boolean | undefined = false;
  
    while (!done) {
      const { value, done: isDone } = await reader.read();
      if (value) {
        audioChunks.push(value); // Collect the chunk
      }
      done = isDone;
    }
  
    // Concatenate the collected chunks into a single buffer
    return Buffer.concat(audioChunks.map((chunk) => Buffer.from(chunk)));
  }
  
  

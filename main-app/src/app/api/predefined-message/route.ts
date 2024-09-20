// src/app/api/predefined-message/route.ts
import { NextResponse } from 'next/server';
import { ElevenLabsClient, ElevenLabs } from 'elevenlabs';
import { createClient as createDeepgramClient } from '@deepgram/sdk';

const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY!);


const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

export async function POST(req: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const { transcription }: { transcription: string } = await req.json();

  if (!transcription) {
    return new Response(JSON.stringify({ error: 'No transcription provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Directly use the transcription as the text response
    const textResponse = transcription;

    const textChunks = splitTextIntoChunks(textResponse, 1900);

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for (const chunk of textChunks) {
              console.log("Sending chunk to deepgram for speech synthesis...");
              const audioBuffer = await synthesizeSpeechWithDeepgram(chunk);

              if (!audioBuffer) throw new Error("Failed to synthesize audio");

              const audioBase64 = audioBuffer.toString('base64');
              const jsonChunk = JSON.stringify({ audio: audioBase64 });
              console.log("Sending audio chunk back to client");

              controller.enqueue(encoder.encode(jsonChunk + '\n'));

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
      }) as unknown as BodyInit,
      {
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
        },
      }
    );
  } catch (error) {
    console.error('Error processing predefined message:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
        model: 'aura-orion-en',
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
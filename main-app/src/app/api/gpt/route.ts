import OpenAI, { toFile } from "openai";
import { ElevenLabsClient, ElevenLabs } from "elevenlabs";
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import { Groq } from 'groq-sdk';
import { PrismaClient } from "@prisma/client";
import { ReadableStream } from 'stream/web';
import {auth} from '@clerk/nextjs/server'

const prisma = new PrismaClient();

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
  // Extract userId from Clerk's authentication
  const { userId } = auth(); 
   // Handle unauthorized request
   if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const encoder = new TextEncoder();
  // Log to verify that the request was received
  console.log("Request received in API route");

  const { transcription, sessionId, type }: { transcription: string | null, sessionId: number, type: string } = await req.json();

  console.log("Received transcription:", transcription);
  console.log("Received type:", type);

  if (!transcription || !sessionId) {
    return new Response(JSON.stringify({ error: 'No transcription or session ID provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch conversation history for context
    const conversationHistory = await prisma.conversation.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }, // Ensure the history is in chronological order
    });

    // Combine the conversation history into a single context string
    const context = conversationHistory
      .map(conv => `${conv.sender}: ${conv.message}`)
      .join('\n');

    let textResponse = '';

    if (type === 'predefined') {
      textResponse = transcription;
    } else {
      console.log("Handling user-generated transcription...");
      if (textModel === 'openai') {
        console.log("Sending transcription and context to OpenAI...");
        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an AI assistant.' }, // AI system prompt
            { role: 'user', content: context }, // Include conversation history for context
            { role: 'user', content: transcription ?? '' }, // Current user input
          ],
        });
        textResponse = gptResponse.choices[0].message.content ?? '';
        console.log("Received response from OpenAI:", textResponse);
      } else if (textModel === 'groq') {
        // Handle Groq similar to OpenAI, using `context`
        console.log("Sending transcription and context to Groq...");
        const groqResponse = await groqClient.chat.completions.create({
          messages: [
            { role: 'user', content: context },
            { role: 'user', content: transcription ?? '' },
          ],
          model: 'llama3-8b-8192',
        });
        textResponse = groqResponse.choices[0].message.content ?? '';
        console.log("Received response from Groq:", textResponse);
      }
    }

    // Log the AI response to the database
    await prisma.conversation.create({
      data: {
        sessionId,
        userId: userId, // Ensure the userId is provided
        sender: 'ai',
        message: textResponse,
      },
    });

    const textChunks = splitTextIntoChunks(textResponse, MAX_CHUNK_SIZE);
    console.log("Split text into chunks:", textChunks);

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
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

              console.log("Sending audio chunk back to client");

              // Ensure the chunk is newline-separated for easy client-side parsing
              controller.enqueue(encoder.encode(jsonChunk + '\n'));

              // Delay to simulate natural flow
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
    console.error('Error handling AI conversation:', error);
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
  
  

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Log a new conversation message
export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { sessionId, message, sender } = await request.json();

  if (!sessionId || !message || !sender) {
    return new NextResponse('Invalid input', { status: 400 });
  }

  try {
    const parsedSessionId = parseInt(sessionId, 10);  // Convert sessionId to an integer

    // Add a new conversation to the existing session
    await prisma.conversation.create({
      data: {
        sessionId: parsedSessionId, // Ensure sessionId is an integer
        userId: userId,       // Ensure userId is also an integer
        message,
        sender,
      },
    });

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error logging conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Fetch conversation history for a session
export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new NextResponse('Session ID is required', { status: 400 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        sessionId: parseInt(sessionId),
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return new NextResponse(JSON.stringify(conversations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

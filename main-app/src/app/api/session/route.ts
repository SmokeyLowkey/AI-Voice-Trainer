import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Check for active sessions
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    console.log(userId);

    const activeSession = await prisma.session.findFirst({
      where: {
        userId: userId,
        status: 'active',
      },
    });

    if (!activeSession) {
      return new NextResponse('No active session found', { status: 404 });
    }

    return NextResponse.json({activeSession: activeSession || null});
  } catch (error) {
    console.error('Error fetching active session:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Start a new session
export async function POST(request: Request) {
  const { userId } = auth();
  console.log(userId);
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { confirm } = await request.json();

  // Check if the user confirmed "start new simulation"
  if (confirm !== 'start new simulation') {
    return new NextResponse('Confirmation text does not match.', { status: 400 });
  }

  // Check for active session before creating a new one
  const activeSession = await prisma.session.findFirst({
    where: {
      userId: userId,
      status: 'active',
    },
  });

  if (activeSession) {
    return new NextResponse('Complete the current session before starting a new one.', { status: 409 });
  }

  // Create a new session
  const newSession = await prisma.session.create({
    data: {
      userId: userId,
      status: 'active',
    },
  });

  return NextResponse.json({ newSession });
}

// Mark session as completed
export async function PATCH(request: Request) {
  const { userId } = auth();
  console.log(userId);
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { sessionId } = await request.json();

  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'completed' },
  });

  return new NextResponse('Session completed successfully.', { status: 200 });
}

import { NextResponse } from 'next/server';
import { currentUser, auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Get user's information from Clerk
  const user = await currentUser();
  if (!user) {
    return new NextResponse('User not found', { status: 404 });
  }

  // Try to find the user in the Prisma database using Clerk's userId
  let dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  // If the user does not exist in the database, create a new record
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        clerkId: user.id,
        name: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.emailAddresses[0]?.emailAddress ?? '',
      },
    });
  }

  // If dbUser still doesn't exist, redirect to the sign-in page
  if (!dbUser) {
    return new NextResponse(null, {
      status: 302, // 302 Found - temporary redirect
      headers: {
        Location: '/sign-in',
      },
    });
  }

  // Perform additional logic if needed with dbUser object
  // Example: redirect to a specific page after syncing
  return new NextResponse(null, {
    status: 302, // 302 Found - temporary redirect
    headers: {
      Location: '/dashboard',
    },
  });
}

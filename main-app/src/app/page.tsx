// src/app/page.tsx (Server Component)
import { auth } from '@clerk/nextjs/server';
import HomeClient from '@/components/HomeClient';

// Server Component (default behavior in the app directory)
export default async function Home() {
  // Fetch user data from Clerk's server-side auth
  const { userId } = auth();

  return <HomeClient userId={userId || ''} />;
}

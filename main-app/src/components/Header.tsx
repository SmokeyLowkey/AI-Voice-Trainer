import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import React from 'react';

// Define the type for the props
interface HeaderProps {
  userId: string | null;
}

export default function Header({ userId }: HeaderProps) {
  return (
    <div className="bg-gray-600 items-center">
      <div className="container mx-auto flex justify-between py-4">
        <div>
          {userId ? (
            <div className="flex gap-4 items-end">
              <UserButton />
            </div>
          ) : (
            <div className="flex gap-4 items-center">
              <Link href="/sign-up">Sign Up</Link>
              <Link href="/sign-in">Sign In</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

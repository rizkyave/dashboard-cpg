'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/components/LoginPage';
import { useAuth } from '@/context/AuthContext';

export default function Page() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  return <LoginPage onSuccess={() => router.push('/')} />;
}


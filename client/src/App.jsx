import React, { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import Spinner from './components/ui/Spinner';
import { PageSuspenseFallback } from './components/ui/SuspenseFallback';

const AppShell = lazy(() => import('./components/layout/AppShell'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));

function AppRouter() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '16px', background: 'var(--bg-base)',
      }}>
        <div style={{
          fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.5px',
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>✦ AURORA</div>
        <Spinner size={28} />
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageSuspenseFallback label="Loading page" />}>
        {authPage === 'login'
          ? <LoginPage onSwitchToSignup={() => setAuthPage('signup')} />
          : <SignupPage onSwitchToLogin={() => setAuthPage('login')} />}
      </Suspense>
    );
  }

  return (
    <ChatProvider>
      <Suspense fallback={<PageSuspenseFallback label="Loading chat" />}>
        <AppShell />
      </Suspense>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

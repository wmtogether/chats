// Source/Pages/Login.tsx
import React, { useState } from 'react';
import authService from '../Library/Authentication/jwt';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!identifier) {
      setError('Please enter your username or UID.');
      setIsLoading(false);
      return;
    }

    try {
      await authService.login({
        identifier: identifier.trim(),
        password: password || undefined,
      });
      
      onLoginSuccess();
    } catch (error) {
      console.error('Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 transition-colors duration-300">
      {/* MD3 Card: 
        - Rounded-3xl (approx 24-28px)
        - Surface color background
      */}
      <div className="w-full max-w-sm">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="headline-medium text-on-surface">Welcome back</h1>
          <p className="body-medium mt-2 text-on-surface-variant">
            Please enter your UID or username to sign in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Username/UID Field (Outlined Variant) */}
          <div className="group relative">
            <input
              type="text"
              id="identifier"
              className="peer w-full rounded-full border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-transparent outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Username or UID"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
            />
            {/* Floating Label Simulation */}
            <label
              htmlFor="identifier"
              className="body-medium text-on-surface-variant absolute left-3 top-0 -translate-y-1/2 bg-surface px-1 transition-all 
              peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-primary"
            >
              Username or UID
            </label>
          </div>

          {/* Password Field (Outlined Variant) */}
          <div className="group relative">
            <input
              type="password"
              id="password"
              className="peer w-full rounded-full border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-transparent outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <label
              htmlFor="password"
              className="body-medium text-on-surface-variant absolute left-3 top-0 -translate-y-1/2 bg-surface px-1 transition-all 
              peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-primary"
            >
              Password (optional)
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-error-container p-3 text-center">
              <p className="body-medium text-on-error-container">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex flex-col gap-4">
            {/* Primary Button: Pill shape (rounded-full) */}
            <button
              type="submit"
              disabled={isLoading}
              className="label-large relative flex w-full items-center justify-center overflow-hidden rounded-full bg-primary py-3 text-on-primary shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Login'}
            </button>

            {/* Text Button */}
            <button
              type="button"
              className="label-large text-primary hover:text-primary/80 hover:underline"
              disabled={isLoading}
            >
              Need help?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
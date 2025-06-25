import React, { createContext, useContext, useState, useEffect } from "react";
import { UserSubscription } from "../types";

interface AuthContextType {
  user: any | null;
  loading: boolean;
  subscription: UserSubscription | null;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuth0Configured: boolean;
  connectionError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// Mock user data for development
const MOCK_USER = {
  sub: "github|12345678",
  email: "developer@example.com",
  picture: "https://avatars.githubusercontent.com/u/12345678?v=4",
  name: "Demo Developer",
  nickname: "demo-dev",
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if Auth0 is properly configured (for display purposes)
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  const isAuth0Configured = !!(
    domain &&
    clientId &&
    domain !== "your-auth0-domain.auth0.com" &&
    clientId !== "your-auth0-client-id"
  );

  // Initialize mock auth state
  useEffect(() => {
    const initAuth = async () => {
      // Simulate loading time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if user was previously signed in (localStorage)
      const savedUser = localStorage.getItem("mock-auth-user");
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error("Error parsing saved user:", error);
          localStorage.removeItem("mock-auth-user");
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Mock subscription - you can change this to test different subscription states
  const subscription: UserSubscription | null = user
    ? {
        userId: user.sub,
        isPaid: false, // Change to true to test Pro features
        planType: "free", // Change to 'pro' to test Pro features
      }
    : null;

  const signInWithGitHub = async () => {
    setLoading(true);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log("🎭 Mock sign-in successful");
      setUser(MOCK_USER);
      localStorage.setItem("mock-auth-user", JSON.stringify(MOCK_USER));
    } catch (error) {
      console.error("Mock sign-in error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("🎭 Mock sign-out successful");
      setUser(null);
      localStorage.removeItem("mock-auth-user");
    } catch (error) {
      console.error("Mock sign-out error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Show configuration status but no connection error since we're mocking
  let connectionError = null;
  if (!isAuth0Configured) {
    connectionError = "Using mock authentication for development";
  }

  const value = {
    user,
    loading,
    subscription,
    signInWithGitHub,
    signOut,
    isAuth0Configured: true, // Always true for mock
    connectionError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

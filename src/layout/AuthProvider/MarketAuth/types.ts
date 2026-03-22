import { type ReactNode } from 'react';

export interface MarketUserProfile {
  accountId?: string | number | null;
  userName?: string | null;
}

export interface MarketAuthSession {
  accessToken?: string;
}

export interface MarketAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  session?: MarketAuthSession | null;
}

export interface MarketAuthContextType extends MarketAuthState {
  getAccessToken: () => string | undefined;
  getCurrentUserInfo: () => MarketUserProfile | null;
  signIn: () => Promise<void>;
}

export interface MarketAuthProviderProps {
  children: ReactNode;
  isDesktop?: boolean;
}

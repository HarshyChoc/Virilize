'use client';

import { createContext, type PropsWithChildren, use, useMemo } from 'react';

import { type MarketAuthContextType, type MarketAuthProviderProps } from './types';

const noop = async () => {};

const MarketAuthContext = createContext<MarketAuthContextType>({
  getAccessToken: () => undefined,
  getCurrentUserInfo: () => null,
  isAuthenticated: false,
  isLoading: false,
  session: null,
  signIn: noop,
});

export const MarketAuthProvider = ({ children }: PropsWithChildren<MarketAuthProviderProps>) => {
  const value = useMemo<MarketAuthContextType>(
    () => ({
      getAccessToken: () => undefined,
      getCurrentUserInfo: () => null,
      isAuthenticated: false,
      isLoading: false,
      session: null,
      signIn: noop,
    }),
    [],
  );

  return <MarketAuthContext value={value}>{children}</MarketAuthContext>;
};

export const useMarketAuth = () => use(MarketAuthContext);

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const getGoogleConnectorsConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    runtimeEnv: {
      GOOGLE_CONNECTOR_CALENDAR_URL: process.env.GOOGLE_CONNECTOR_CALENDAR_URL,
      GOOGLE_CONNECTOR_DRIVE_URL: process.env.GOOGLE_CONNECTOR_DRIVE_URL,
      GOOGLE_CONNECTOR_GMAIL_URL: process.env.GOOGLE_CONNECTOR_GMAIL_URL,
      GOOGLE_CONNECTOR_YOUTUBE_URL: process.env.GOOGLE_CONNECTOR_YOUTUBE_URL,
    },
    server: {
      GOOGLE_CONNECTOR_CALENDAR_URL: z.string().optional(),
      GOOGLE_CONNECTOR_DRIVE_URL: z.string().optional(),
      GOOGLE_CONNECTOR_GMAIL_URL: z.string().optional(),
      GOOGLE_CONNECTOR_YOUTUBE_URL: z.string().optional(),
    },
  });
};

export const googleConnectorsEnv = getGoogleConnectorsConfig();

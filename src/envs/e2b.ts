import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const getE2BConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    runtimeEnv: {
      E2B_API_KEY: process.env.E2B_API_KEY,
      E2B_TEMPLATE: process.env.E2B_TEMPLATE,
      E2B_TIMEOUT_MS: process.env.E2B_TIMEOUT_MS,
    },
    server: {
      E2B_API_KEY: z.string().optional(),
      E2B_TEMPLATE: z.string().optional(),
      E2B_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(55 * 60 * 1000),
    },
  });
};

export const e2bEnv = getE2BConfig();

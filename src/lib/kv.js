import { createClient } from '@vercel/kv';

export const kv = createClient({
  url: "https://liberal-sunbird-40663.upstash.io",
  token: "AZ7XAAIgcDEyNzk0YzZkNDdlNjg0ZjNkOWNmOWFmNDEzY2IxMTdjMg",
});

export const CACHE_KEYS = {
  SEMANTIC: 'semantic:',
  ANALYSIS: 'analysis:',
};

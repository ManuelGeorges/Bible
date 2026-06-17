import { Redis } from '@upstash/redis';

// استخدام @upstash/redis مباشرة بدلاً من @vercel/kv لضمان العمل في المتصفح والموبايل
export const kv = new Redis({
  url: "https://liberal-sunbird-40663.upstash.io",
  token: "AZ7XAAIgcDEyNzk0YzZkNDdlNjg0ZjNkOWNmOWFmNDEzY2IxMTdjMg",
});

export const CACHE_KEYS = {
  SEMANTIC: 'semantic:',
  ANALYSIS: 'analysis:',
  STUDY_PLAN: 'study_plan:',
};

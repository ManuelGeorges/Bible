import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agios.bible',
  appName: 'Agios Bible',
  webDir: 'out',
  "server": {
    "url": "https://agios-bible.vercel.app/",
    "cleartext": true
  },

};
export default config;

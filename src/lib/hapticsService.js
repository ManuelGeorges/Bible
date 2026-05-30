import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const HapticService = {
  // اهتزاز خفيف للضغط العادي (Buttons, Tabs)
  light: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  },

  // اهتزاز متوسط (Selection, Toggles)
  medium: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  },

  // اهتزاز عند النجاح (Correct Answer, Save Success)
  success: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    }
  },

  // اهتزاز عند الخطأ (Wrong Answer, Error)
  error: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Error });
    }
  },

  // اهتزاز خفيف عند الاختيار (Selection change)
  selection: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionStart();
      setTimeout(() => Haptics.selectionEnd(), 100);
    }
  }
};

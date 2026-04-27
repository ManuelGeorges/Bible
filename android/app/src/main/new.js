// Change this in your Settings.jsx:
const updateSubSetting = async (key, value) => {
  if (!masterNotifications) return;
  const updated = { ...notifications, [key]: value };
  setNotifications(updated);
  localStorage.setItem('notificationSettings', JSON.stringify(updated));
  
  // PUSH TO NATIVE
  if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateSettings) {
      window.AgiosScannerNative.updateSettings(JSON.stringify(updated), masterNotifications);
  }
};

const handleMasterToggle = async () => {
  const nextState = !masterNotifications;
  // ... (your existing permission logic)
  setMasterNotifications(nextState);
  localStorage.setItem('masterNotifications', nextState.toString());
  
  // PUSH TO NATIVE
  if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateSettings) {
      window.AgiosScannerNative.updateSettings(JSON.stringify(notifications), nextState);
  }
};
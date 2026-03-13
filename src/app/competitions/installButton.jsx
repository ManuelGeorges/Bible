"use client";

import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsReady(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsReady(false);
    }
  };

  if (!isReady) return null;

  return (
    <button
      onClick={handleInstallClick}
      style={{
        padding: "10px 20px",
        backgroundColor: "#fbbf24",
        color: "#000",
        borderRadius: "8px",
        fontWeight: "bold",
        border: "none",
        cursor: "pointer",
        fontSize: "16px"
      }}
    >
      تثبيت تطبيق الكتاب المقدس
    </button>
  );
}
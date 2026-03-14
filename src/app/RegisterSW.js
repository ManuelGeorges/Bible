"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker Registered");
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  window.location.reload();
                }
              };
            }
          };
        })
        .catch(() => console.log("Service Worker Failed"));
    }
  }, []);

  return null;
}
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
      const swUrl = "/sw.js";

      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  if (!sessionStorage.getItem("sw_updated")) {
                    sessionStorage.setItem("sw_updated", "true");
                    window.location.reload();
                  }
                }
              };
            }
          };
        })
        .catch((err) => console.log("Service Worker Failed", err));

      navigator.serviceWorker.ready.then((reg) => {
        reg.update();
      });
    }
  }, []);

  return null;
}
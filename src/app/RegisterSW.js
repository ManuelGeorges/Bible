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
        .catch((err) => console.log("SW Registration Failed", err));

      navigator.serviceWorker.ready.then((reg) => {
        reg.update();
      });
    }
  }, []);

  return null;
}
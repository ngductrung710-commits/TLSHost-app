"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Deferred until after load: registration competes with the first render for
 * the same main thread, and a host opening the calendar cares about the
 * calendar arriving, not about being installable a second sooner.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs the install prompt and offline page.
        // Everything else keeps working, so there is nothing to tell anyone.
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

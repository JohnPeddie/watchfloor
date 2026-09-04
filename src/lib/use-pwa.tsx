"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = {
  /** Running as an installed app (no browser chrome). */
  standalone: boolean;
  /** Page Fullscreen API is active — hides the address bar in a normal tab. */
  fullscreen: boolean;
  /** Chromium will offer a real install (HTTPS + manifest + service worker). */
  canInstall: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  install: () => Promise<void>;
};

const PwaContext = createContext<PwaContextValue | null>(null);

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const display = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
  const ios = "standalone" in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone);
  return display || ios;
}

async function requestPageFullscreen(): Promise<void> {
  const node = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (document.fullscreenElement) return;
  if (node.requestFullscreen) {
    try {
      await node.requestFullscreen();
    } catch {
      // Blocked by the browser (no user gesture, Permissions-Policy, or HTTP).
    }
    return;
  }
  try {
    await node.webkitRequestFullscreen?.();
  } catch {
    // Older WebKit: same permission gate.
  }
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [standalone, setStandalone] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const sync = () => {
      setStandalone(isStandalone());
      setFullscreen(Boolean(document.fullscreenElement));
    };
    sync();
    const media = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)");
    media.addEventListener("change", sync);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      media.removeEventListener("change", sync);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!window.isSecureContext) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => {
      promptRef.current = null;
      setCanInstall(false);
      setStandalone(true);
    });
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      await requestPageFullscreen();
    } catch {
      // Browsers reject this without a user gesture, or if fullscreen is blocked.
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // Already left fullscreen.
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await exitFullscreen();
    else await enterFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  const install = useCallback(async () => {
    const prompt = promptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      promptRef.current = null;
      setCanInstall(false);
    }
  }, []);

  const value: PwaContextValue = {
    standalone,
    fullscreen,
    canInstall,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    install,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextValue {
  const value = useContext(PwaContext);
  if (!value) {
    return {
      standalone: false,
      fullscreen: false,
      canInstall: false,
      enterFullscreen: async () => undefined,
      exitFullscreen: async () => undefined,
      toggleFullscreen: async () => undefined,
      install: async () => undefined,
    };
  }
  return value;
}

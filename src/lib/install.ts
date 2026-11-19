/** captures the browser's install prompt so Settings can offer "Install Mise". */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const watchInstall = () => {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
};

export const onInstallChange = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const canPromptInstall = () => deferred !== null;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const promptInstall = async () => {
  if (!deferred) return false;
  const prompt = deferred;
  deferred = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  notify();
  return choice.outcome === "accepted";
};

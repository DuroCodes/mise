const key = (accountId: string) => `mise-walkthrough:${accountId}`;
const openEvent = "mise:walkthrough";

export const walkthroughSeen = (accountId: string) => {
  try {
    return localStorage.getItem(key(accountId)) === "done";
  } catch {
    // without storage it would reopen on every visit, so treat it as seen.
    return true;
  }
};

export const markWalkthroughSeen = (accountId: string) => {
  try {
    localStorage.setItem(key(accountId), "done");
  } catch {
    // nothing to do; it just shows again next time.
  }
};

export const openWalkthrough = () => window.dispatchEvent(new Event(openEvent));

export const onOpenWalkthrough = (listener: () => void) => {
  window.addEventListener(openEvent, listener);
  return () => window.removeEventListener(openEvent, listener);
};

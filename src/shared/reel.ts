/** TikTok / Instagram share links that need audio transcription, not HTML scrape. */
export const isReelUrl = (raw: string) => {
  try {
    const host = new URL(raw.trim()).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    return (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "instagram.com" ||
      host === "instagr.am"
    );
  } catch {
    return false;
  }
};

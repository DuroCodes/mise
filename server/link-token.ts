/** eight characters from 6 random bytes. Unguessable here, short enough to read. */
const tokenBytes = 6;

export const linkToken = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(tokenBytes))).toString(
    "base64url"
  );

/** old links were longer. Both lengths still match until those are reissued. */
export const linkTokenShape = /^[A-Za-z0-9_-]{8,64}$/;

export const freshToken = (taken: (token: string) => boolean) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = linkToken();
    if (!taken(token)) return token;
  }
  return linkToken();
};

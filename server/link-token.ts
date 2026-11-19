const tokenLength = 8;
const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const linkToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(tokenLength));
  let token = "";
  for (const byte of bytes) token += alphabet[byte % alphabet.length];
  return token;
};

export const linkTokenShape = /^[A-Za-z0-9]{8}$/;

export const freshToken = (taken: (token: string) => boolean) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = linkToken();
    if (!taken(token)) return token;
  }
  return linkToken();
};

import { uploadDir } from "./db";

export const imageExtension = (type: string) =>
  type === "image/png"
    ? "png"
    : type === "image/webp"
      ? "webp"
      : type === "image/gif"
        ? "gif"
        : type === "image/avif"
          ? "avif"
          : "jpg";

export const saveUpload = async (
  data: Blob | Uint8Array,
  extension: string
) => {
  const name = `${crypto.randomUUID()}.${extension}`;
  await Bun.write(`${uploadDir}/${name}`, data);
  return `/uploads/${name}`;
};

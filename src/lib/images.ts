/**
 * shrinks a phone photo before upload (they're often 4-12MB, over the 5MB
 * limit). Returns a JPEG no wider or taller than `max` pixels.
 */
export const shrinkPhoto = async (file: File, max = 1600, quality = 0.85) => {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (
    scale === 1 &&
    file.size <= 4 * 1024 * 1024 &&
    file.type === "image/jpeg"
  ) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
};

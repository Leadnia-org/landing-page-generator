export async function imageFileToWebpBytes(file: File): Promise<Uint8Array> {
  ensureImageFile(file);

  if (file.type === "image/webp") {
    return new Uint8Array(await file.arrayBuffer());
  }

  const blob = await imageFileToWebpBlob(file);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function imageFileToWebpDataUrl(file: File): Promise<string> {
  ensureImageFile(file);
  const blob = file.type === "image/webp" ? file : await imageFileToWebpBlob(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function ensureImageFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(`Le fichier "${file.name}" n'est pas une image.`);
  }
}

async function imageFileToWebpBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Impossible de préparer la conversion WebP.");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
  if (!blob) {
    throw new Error("Impossible de convertir l'image en WebP dans ce navigateur.");
  }

  return blob;
}

export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  ensureImageFile(file);
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

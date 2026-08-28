import pica from "pica";

export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

export async function resizeForRemoval(source: Blob, maxDimension = 1024) {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  await pica().resize(bitmap, canvas);
  bitmap.close();
  return pica().toBlob(canvas, "image/png", 0.95);
}

export type RemovalFrame = {
  originalWidth: number;
  originalHeight: number;
  paddedSize: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

/**
 * Most background-removal models operate on square images.  Pad the image
 * ourselves, then retain the exact crop metadata so the cutout can be placed
 * back into the original frame without stretching its subject.
 */
export async function prepareImageForRemoval(source: Blob, maxDimension = 1024): Promise<{ blob: Blob; frame: RemovalFrame }> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const cropWidth = Math.max(1, Math.round(bitmap.width * scale));
  const cropHeight = Math.max(1, Math.round(bitmap.height * scale));
  const paddedSize = Math.max(cropWidth, cropHeight);
  const cropX = Math.floor((paddedSize - cropWidth) / 2);
  const cropY = Math.floor((paddedSize - cropHeight) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = paddedSize;
  canvas.height = paddedSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image for background removal");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, paddedSize, paddedSize);
  context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight);
  const frame = { originalWidth: bitmap.width, originalHeight: bitmap.height, paddedSize, cropX, cropY, cropWidth, cropHeight };
  bitmap.close();
  return { blob: await pica().toBlob(canvas, "image/png", 0.95), frame };
}

export async function restoreCutoutFrame(cutout: Blob, frame: RemovalFrame) {
  const bitmap = await createImageBitmap(cutout);
  const scaleX = bitmap.width / frame.paddedSize;
  const scaleY = bitmap.height / frame.paddedSize;
  const canvas = document.createElement("canvas");
  canvas.width = frame.originalWidth;
  canvas.height = frame.originalHeight;
  const context = canvas.getContext("2d");
  if (!context) return cutout;
  context.drawImage(
    bitmap,
    Math.round(frame.cropX * scaleX),
    Math.round(frame.cropY * scaleY),
    Math.round(frame.cropWidth * scaleX),
    Math.round(frame.cropHeight * scaleY),
    0,
    0,
    frame.originalWidth,
    frame.originalHeight,
  );
  bitmap.close();
  return pica().toBlob(canvas, "image/png", 0.95);
}

export async function trimTransparentEdges(source: Blob, padding = 8) {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
    if (data[(y * canvas.width + x) * 4 + 3] > 8) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return source;
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(canvas.width - 1, right + padding); bottom = Math.min(canvas.height - 1, bottom + padding);
  const output = document.createElement("canvas");
  output.width = right - left + 1; output.height = bottom - top + 1;
  output.getContext("2d")?.drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
  return new Promise<Blob>((resolve) => output.toBlob((blob) => resolve(blob ?? source), "image/png"));
}

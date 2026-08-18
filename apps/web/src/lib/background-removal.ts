import { resizeForRemoval, trimTransparentEdges } from "./image-processing";

type WorkerResponse = { id: string; type: "progress" | "complete" | "error"; buffer?: ArrayBuffer; message?: string; progress?: { status?: string; progress?: number } };

export async function removeImageBackground(source: Blob, onProgress?: (label: string) => void) {
  onProgress?.("Preparing image…");
  const resized = await resizeForRemoval(source);
  const buffer = await resized.arrayBuffer();
  const worker = new Worker(new URL("../workers/background-removal.worker.ts", import.meta.url), { type: "module" });
  const id = crypto.randomUUID();
  try {
    const cutout = await new Promise<Blob>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.id !== id) return;
        if (data.type === "progress") {
          const percent = data.progress?.progress;
          onProgress?.(typeof percent === "number" ? `Loading remover ${Math.round(percent)}%…` : "Removing background…");
        } else if (data.type === "complete" && data.buffer) resolve(new Blob([data.buffer], { type: "image/png" }));
        else if (data.type === "error") reject(new Error(data.message));
      };
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage({ id, buffer, mimeType: resized.type || "image/png" }, [buffer]);
    });
    onProgress?.("Trimming edges…");
    return await trimTransparentEdges(cutout);
  } finally {
    worker.terminate();
  }
}

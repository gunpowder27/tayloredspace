import { resizeForRemoval, trimTransparentEdges } from "./image-processing";

type WorkerResponse = { id: string; type: "progress" | "complete" | "error"; buffer?: ArrayBuffer; message?: string; progress?: { status?: string; progress?: number } };

type PendingRemoval = {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  onProgress?: (label: string) => void;
};

let sharedWorker: Worker | undefined;
const pendingRemovals = new Map<string, PendingRemoval>();

function getWorker() {
  if (sharedWorker) return sharedWorker;

  sharedWorker = new Worker(new URL("../workers/background-removal.worker.ts", import.meta.url), { type: "module" });
  sharedWorker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const pending = pendingRemovals.get(data.id);
    if (!pending) return;

    if (data.type === "progress") {
      const percent = data.progress?.progress;
      pending.onProgress?.(typeof percent === "number" ? `Loading remover ${Math.round(percent)}%…` : "Removing background…");
      return;
    }

    pendingRemovals.delete(data.id);
    if (data.type === "complete" && data.buffer) pending.resolve(new Blob([data.buffer], { type: "image/png" }));
    else pending.reject(new Error(data.message || "Background removal failed"));
  };
  sharedWorker.onerror = (event) => {
    const error = new Error(event.message || "Background removal worker failed");
    pendingRemovals.forEach(({ reject }) => reject(error));
    pendingRemovals.clear();
    sharedWorker?.terminate();
    sharedWorker = undefined;
  };

  return sharedWorker;
}

export async function removeImageBackground(source: Blob, onProgress?: (label: string) => void) {
  onProgress?.("Preparing image…");
  const resized = await resizeForRemoval(source);
  const buffer = await resized.arrayBuffer();
  const id = crypto.randomUUID();
  const worker = getWorker();
  const cutout = await new Promise<Blob>((resolve, reject) => {
    pendingRemovals.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, buffer, mimeType: resized.type || "image/png" }, [buffer]);
  });
  onProgress?.("Trimming edges…");
  return trimTransparentEdges(cutout);
}

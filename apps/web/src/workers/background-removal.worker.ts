/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

type Request = { id: string; type?: "remove"; buffer: ArrayBuffer; mimeType: string } | { id: string; type: "warmup" };
type Progress = { status?: string; progress?: number };

let removerPromise: ReturnType<typeof pipeline<"background-removal">> | undefined;

function getRemover(progress_callback: (progress: Progress) => void) {
  removerPromise ??= pipeline("background-removal", "onnx-community/ormbg-ONNX", {
    dtype: "q8",
    device: "wasm",
    progress_callback,
  });
  return removerPromise;
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const remover = await getRemover((progress) => self.postMessage({ id: data.id, type: "progress", progress }));
    if (data.type === "warmup") {
      self.postMessage({ id: data.id, type: "ready" });
      return;
    }
    const input = new Blob([data.buffer], { type: data.mimeType });
    const imageUrl = URL.createObjectURL(input);
    try {
      const result = await remover(imageUrl);
      const output = await result.toBlob("image/png");
      const buffer = await output.arrayBuffer();
      self.postMessage({ id: data.id, type: "complete", buffer }, [buffer]);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  } catch (error) {
    self.postMessage({ id: data.id, type: "error", message: error instanceof Error ? error.message : "Background removal failed" });
  }
};

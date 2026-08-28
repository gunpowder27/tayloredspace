export const TAYLOREDSPACE_BRIDGE_EVENT = "tayloredspace:capture" as const;
export const TAYLOREDSPACE_BRIDGE_ACK_EVENT = "tayloredspace:capture:ack" as const;
export const TAYLOREDSPACE_BRIDGE_READY_EVENT = "tayloredspace:bridge:ready" as const;

export type TayloredPieceType = "product" | "inspiration" | "render" | "upload" | "note";

export type ProductMetadata = {
  sourceUrl: string;
  title?: string;
  price?: string;
  currency?: string;
  retailer?: string;
};

export type PiecePosition = { x: number; y: number; width: number; height: number };
export type PieceCrop = { x: number; y: number; width: number; height: number; naturalWidth: number; naturalHeight: number };

export type TayloredPiece = {
  id: string;
  boardId: string;
  type: TayloredPieceType;
  createdAt: string;
  updatedAt: string;
  imageDataUrl?: string;
  imageAssetId?: string;
  imageVariant?: "original" | "cutout";
  text?: string;
  product?: ProductMetadata;
  position: PiecePosition;
  /** A saved piece can exist in the collection without being placed on the board. */
  onBoard?: boolean;
  /** Board-only presentation state. */
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  crop?: PieceCrop | null;
  zIndex?: number;
  /** Extra board instance of a saved item; hidden from Saved Pieces. */
  isBoardDuplicate?: boolean;
};

export type ExtensionCapture = {
  id: string;
  capturedAt: string;
  imageUrl: string;
  imageDataUrl?: string;
  product: ProductMetadata;
};

export const captureToPiece = (capture: ExtensionCapture, boardId = "default"): TayloredPiece => ({
  id: capture.id,
  boardId,
  type: "product",
  createdAt: capture.capturedAt,
  updatedAt: capture.capturedAt,
  imageDataUrl: capture.imageDataUrl ?? capture.imageUrl,
  product: capture.product,
  position: { x: 120, y: 120, width: 320, height: 320 },
  onBoard: false,
});

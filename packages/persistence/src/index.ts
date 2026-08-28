import Dexie, { type EntityTable } from "dexie";
import type { TayloredPiece } from "@tayloredspace/domain";

export type PieceImageAsset = {
  pieceId: string;
  original: Blob;
  cutout?: Blob;
  updatedAt: string;
};

class TayloredSpaceDatabase extends Dexie {
  pieces!: EntityTable<TayloredPiece, "id">;
  imageAssets!: EntityTable<PieceImageAsset, "pieceId">;

  constructor() {
    super("tayloredspace");
    this.version(1).stores({ pieces: "id, boardId" });
    this.version(2).stores({ pieces: "id, boardId", imageAssets: "pieceId" });
  }
}

const db = new TayloredSpaceDatabase();

export const pieceStore = {
  list(boardId = "default") { return db.pieces.where("boardId").equals(boardId).toArray(); },
  get(id: string) { return db.pieces.get(id); },
  async put(piece: TayloredPiece) { await db.pieces.put(piece); },
  async putMany(pieces: TayloredPiece[]) { await db.pieces.bulkPut(pieces); },
  async remove(id: string) {
    await db.transaction("rw", db.pieces, db.imageAssets, async () => {
      await db.pieces.delete(id);
      await db.imageAssets.delete(id);
    });
  },
};

export const imageAssetStore = {
  get(pieceId: string) { return db.imageAssets.get(pieceId); },
  list() { return db.imageAssets.toArray(); },
  async put(asset: PieceImageAsset) { await db.imageAssets.put(asset); },
};

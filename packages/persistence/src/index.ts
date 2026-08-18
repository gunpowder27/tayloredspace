import { openDB, type DBSchema } from "idb";
import type { TayloredPiece } from "@tayloredspace/domain";

interface TayloredSpaceDB extends DBSchema {
  pieces: { key: string; value: TayloredPiece; indexes: { "by-board": string } };
}

const db = () => openDB<TayloredSpaceDB>("tayloredspace", 1, {
  upgrade(database) {
    const pieces = database.createObjectStore("pieces", { keyPath: "id" });
    pieces.createIndex("by-board", "boardId");
  },
});

export const pieceStore = {
  async list(boardId = "default") { return (await db()).getAllFromIndex("pieces", "by-board", boardId); },
  async put(piece: TayloredPiece) { await (await db()).put("pieces", piece); },
  async putMany(pieces: TayloredPiece[]) {
    const database = await db();
    const tx = database.transaction("pieces", "readwrite");
    await Promise.all([...pieces.map((piece) => tx.store.put(piece)), tx.done]);
  },
  async remove(id: string) { await (await db()).delete("pieces", id); },
};

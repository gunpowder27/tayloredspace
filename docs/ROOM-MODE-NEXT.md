# Next milestone — Room Mode foundation

Room Mode begins only after the Phase 1 demo gate is green. The first slice is still 2D and local-first; it does not introduce 3D, accounts, or cloud sync.

## Proposed slice

1. Create a room with exact width and depth.
2. Add doors and windows to wall edges.
3. Place TayloredPieces at real-world dimensions.
4. Rotate, align, duplicate, lock, undo, and redo.
5. Save the room scene locally alongside the shopping board.
6. Switch between shopping board and scaled floor-plan views without duplicating products.

## Data additions

- `Room`: id, name, width, depth, unit, openings, createdAt, updatedAt.
- `RoomPlacement`: pieceId, roomId, x, y, width, depth, rotation, locked.
- A flat scene dictionary with schema validation and a command-based undo boundary.

## Explicitly deferred

- 3D rendering
- photorealistic room generation
- collaboration and cloud sync
- checkout, price tracking, and social features


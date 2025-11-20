import { Piece, PieceType, PlayerColor, Position, Move } from '../types';
import { BOARD_COLS, BOARD_ROWS, getInitialPieces } from '../constants';

// Helper to check boundaries
const isWithinBoard = (p: Position) => p.x >= 0 && p.x < BOARD_COLS && p.y >= 0 && p.y < BOARD_ROWS;

// Get piece at position
const getPieceAt = (pieces: Piece[], pos: Position): Piece | undefined => {
  return pieces.find(p => p.position.x === pos.x && p.position.y === pos.y);
};

// Utility: locate general of a given color
export const findGeneral = (pieces: Piece[], color: PlayerColor): Piece | undefined => {
  return pieces.find(p => p.type === PieceType.GENERAL && p.color === color);
};

// Helper to apply a move to a set of pieces (Pure function)
export const applyMove = (pieces: Piece[], move: Move): Piece[] => {
  return pieces
    .filter(p => p.id !== move.capturedPieceId)
    .map(p => {
      if (p.id === move.pieceId) {
        return { ...p, position: move.to };
      }
      return p;
    });
};

// Helper to reconstruct board state from a list of moves
export const reconstructBoard = (moves: Move[]): Piece[] => {
  let pieces = getInitialPieces();
  for (const move of moves) {
    pieces = applyMove(pieces, move);
  }
  return pieces;
};

export const isGeneralFacingGeneral = (pieces: Piece[]): boolean => {
    const redGen = pieces.find(p => p.type === PieceType.GENERAL && p.color === PlayerColor.RED);
    const blackGen = pieces.find(p => p.type === PieceType.GENERAL && p.color === PlayerColor.BLACK);

    if (!redGen || !blackGen) return false;
    if (redGen.position.x !== blackGen.position.x) return false;

    // Check if there are pieces between them
    const col = redGen.position.x;
    const minY = Math.min(redGen.position.y, blackGen.position.y);
    const maxY = Math.max(redGen.position.y, blackGen.position.y);

    for (let y = minY + 1; y < maxY; y++) {
        if (getPieceAt(pieces, { x: col, y })) return false;
    }
    return true;
};

// Check if move is valid based on piece rules
export const getValidMoves = (piece: Piece, allPieces: Piece[]): Position[] => {
  const moves: Position[] = [];
  const { x, y } = piece.position;
  const isRed = piece.color === PlayerColor.RED;

  // Helper to add move if empty or enemy
  const tryAddMove = (tx: number, ty: number) => {
    if (!isWithinBoard({ x: tx, y: ty })) return false;
    const target = getPieceAt(allPieces, { x: tx, y: ty });
    if (!target) {
      moves.push({ x: tx, y: ty });
      return true; // Continue path if sliding
    } else if (target.color !== piece.color) {
      moves.push({ x: tx, y: ty });
      return false; // Blocked by enemy (capturable)
    }
    return false; // Blocked by friendly
  };

  switch (piece.type) {
    case PieceType.GENERAL: // Orthogonal 1 step, within palace
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        // Palace boundaries
        const validX = tx >= 3 && tx <= 5;
        const validY = isRed ? (ty >= 7 && ty <= 9) : (ty >= 0 && ty <= 2);
        if (validX && validY) tryAddMove(tx, ty);
      });
      break;

    case PieceType.ADVISOR: // Diagonal 1 step, within palace
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        const validX = tx >= 3 && tx <= 5;
        const validY = isRed ? (ty >= 7 && ty <= 9) : (ty >= 0 && ty <= 2);
        if (validX && validY) tryAddMove(tx, ty);
      });
      break;

    case PieceType.ELEPHANT: // Diagonal 2 steps, cannot cross river, eye blocking
      [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        // River boundary
        if (isRed && ty < 5) return;
        if (!isRed && ty > 4) return;

        // Check eye
        const eyeX = x + dx / 2;
        const eyeY = y + dy / 2;
        if (!getPieceAt(allPieces, { x: eyeX, y: eyeY })) {
          tryAddMove(tx, ty);
        }
      });
      break;

    case PieceType.HORSE: // L shape, check leg
      [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        // Check leg (the orthogonal adjacent square)
        const legX = x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0);
        const legY = y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0);
        if (!getPieceAt(allPieces, { x: legX, y: legY })) {
          tryAddMove(tx, ty);
        }
      });
      break;

    case PieceType.CHARIOT: // Rook movements
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        let i = 1;
        while (true) {
          const tx = x + dx * i;
          const ty = y + dy * i;
          if (!tryAddMove(tx, ty)) {
             break;
          }
          const target = getPieceAt(allPieces, { x: tx, y: ty });
          if (target) break; 
          i++;
        }
      });
      break;

    case PieceType.CANNON: // Move like rook, capture needs mount
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        let i = 1;
        let hasMount = false;
        while (true) {
          const tx = x + dx * i;
          const ty = y + dy * i;
          if (!isWithinBoard({x: tx, y: ty})) break;

          const target = getPieceAt(allPieces, { x: tx, y: ty });
          
          if (!hasMount) {
            if (!target) {
              moves.push({ x: tx, y: ty });
            } else {
              hasMount = true; // Found the screen
            }
          } else {
            if (target) {
              if (target.color !== piece.color) {
                moves.push({ x: tx, y: ty }); // Capture
              }
              break; // Cannot jump over two
            }
          }
          i++;
        }
      });
      break;

    case PieceType.SOLDIER: // Forward 1, side 1 after river
      const forward = isRed ? -1 : 1;
      // Forward
      tryAddMove(x, y + forward);
      
      // Horizontal if crossed river
      const crossedRiver = isRed ? y <= 4 : y >= 5;
      if (crossedRiver) {
        tryAddMove(x - 1, y);
        tryAddMove(x + 1, y);
      }
      break;
  }

  // Filter out moves that violate "Flying General" rule
  // (Kings cannot face each other directly without a piece in between)
  return moves.filter(movePos => {
      // Simulate move
      const simulatedPieces = allPieces.map(p => {
          if (p.id === piece.id) return { ...p, position: movePos };
          // If target position has a piece, it gets captured (removed)
          if (p.position.x === movePos.x && p.position.y === movePos.y) return null; 
          return p;
      }).filter(p => p !== null) as Piece[];

      return !isGeneralFacingGeneral(simulatedPieces);
  });
};

export const generateBoardDescription = (pieces: Piece[], turn: PlayerColor): string => {
  let desc = `Current Turn: ${turn}. Board State:\n`;
  pieces.forEach(p => {
    desc += `${p.color} ${p.type} at (${p.position.x}, ${p.position.y})\n`;
  });
  return desc;
};

// --- Threat / check helpers ---

const isSquareThreatened = (pieces: Piece[], target: Position, defender: PlayerColor): boolean => {
  const attacker = defender === PlayerColor.RED ? PlayerColor.BLACK : PlayerColor.RED;
  const opponentPieces = pieces.filter(p => p.color === attacker);

  for (const piece of opponentPieces) {
    // Special case: flying general rule also implies threat along open file
    if (piece.type === PieceType.GENERAL && piece.position.x === target.x) {
      const minY = Math.min(piece.position.y, target.y);
      const maxY = Math.max(piece.position.y, target.y);
      let blocked = false;
      for (let y = minY + 1; y < maxY; y++) {
        if (getPieceAt(pieces, { x: target.x, y })) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }

    const moves = getValidMoves(piece, pieces);
    if (moves.some(m => m.x === target.x && m.y === target.y)) {
      return true;
    }
  }
  return false;
};

export const isInCheck = (pieces: Piece[], color: PlayerColor): boolean => {
  const general = findGeneral(pieces, color);
  if (!general) return true; // No general means game should already be over
  if (isGeneralFacingGeneral(pieces)) return true;
  return isSquareThreatened(pieces, general.position, color);
};

export const hasAnyLegalMove = (pieces: Piece[], color: PlayerColor): boolean => {
  const ownPieces = pieces.filter(p => p.color === color);
  for (const piece of ownPieces) {
    const moves = getValidMoves(piece, pieces);
    for (const moveTarget of moves) {
      const target = getPieceAt(pieces, moveTarget);
      const simulatedMove: Move = {
        pieceId: piece.id,
        from: piece.position,
        to: moveTarget,
        capturedPieceId: target?.id,
        timestamp: Date.now(),
        notation: ''
      };
      const nextPieces = applyMove(pieces, simulatedMove);
      if (!isInCheck(nextPieces, color)) {
        return true;
      }
    }
  }
  return false;
};

export const evaluateGameState = (pieces: Piece[], turn: PlayerColor) => {
  const inCheck = isInCheck(pieces, turn);
  const hasMoves = hasAnyLegalMove(pieces, turn);

  return {
    inCheck,
    checkmated: inCheck && !hasMoves,
    stalemated: !inCheck && !hasMoves
  };
};

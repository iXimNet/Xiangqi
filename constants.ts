import { Piece, PieceType, PlayerColor } from './types';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

export const INITIAL_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR";

export const PIECE_LABELS: Record<string, string> = {
  [`${PlayerColor.RED}_${PieceType.GENERAL}`]: '帅',
  [`${PlayerColor.BLACK}_${PieceType.GENERAL}`]: '将',
  [`${PlayerColor.RED}_${PieceType.ADVISOR}`]: '仕',
  [`${PlayerColor.BLACK}_${PieceType.ADVISOR}`]: '士',
  [`${PlayerColor.RED}_${PieceType.ELEPHANT}`]: '相',
  [`${PlayerColor.BLACK}_${PieceType.ELEPHANT}`]: '象',
  [`${PlayerColor.RED}_${PieceType.HORSE}`]: '马',
  [`${PlayerColor.BLACK}_${PieceType.HORSE}`]: '馬',
  [`${PlayerColor.RED}_${PieceType.CHARIOT}`]: '车',
  [`${PlayerColor.BLACK}_${PieceType.CHARIOT}`]: '車',
  [`${PlayerColor.RED}_${PieceType.CANNON}`]: '炮',
  [`${PlayerColor.BLACK}_${PieceType.CANNON}`]: '砲',
  [`${PlayerColor.RED}_${PieceType.SOLDIER}`]: '兵',
  [`${PlayerColor.BLACK}_${PieceType.SOLDIER}`]: '卒',
};

// Generate initial pieces array
export const getInitialPieces = (): Piece[] => {
  const pieces: Piece[] = [];
  let idCounter = 0;

  const createPiece = (type: PieceType, color: PlayerColor, x: number, y: number) => {
    pieces.push({
      id: `p_${idCounter++}_${color}_${type}`,
      type,
      color,
      position: { x, y }
    });
  };

  // Black pieces (Top, y=0 to 4)
  createPiece(PieceType.CHARIOT, PlayerColor.BLACK, 0, 0);
  createPiece(PieceType.HORSE, PlayerColor.BLACK, 1, 0);
  createPiece(PieceType.ELEPHANT, PlayerColor.BLACK, 2, 0);
  createPiece(PieceType.ADVISOR, PlayerColor.BLACK, 3, 0);
  createPiece(PieceType.GENERAL, PlayerColor.BLACK, 4, 0);
  createPiece(PieceType.ADVISOR, PlayerColor.BLACK, 5, 0);
  createPiece(PieceType.ELEPHANT, PlayerColor.BLACK, 6, 0);
  createPiece(PieceType.HORSE, PlayerColor.BLACK, 7, 0);
  createPiece(PieceType.CHARIOT, PlayerColor.BLACK, 8, 0);
  createPiece(PieceType.CANNON, PlayerColor.BLACK, 1, 2);
  createPiece(PieceType.CANNON, PlayerColor.BLACK, 7, 2);
  [0, 2, 4, 6, 8].forEach(x => createPiece(PieceType.SOLDIER, PlayerColor.BLACK, x, 3));

  // Red pieces (Bottom, y=5 to 9)
  createPiece(PieceType.CHARIOT, PlayerColor.RED, 0, 9);
  createPiece(PieceType.HORSE, PlayerColor.RED, 1, 9);
  createPiece(PieceType.ELEPHANT, PlayerColor.RED, 2, 9);
  createPiece(PieceType.ADVISOR, PlayerColor.RED, 3, 9);
  createPiece(PieceType.GENERAL, PlayerColor.RED, 4, 9);
  createPiece(PieceType.ADVISOR, PlayerColor.RED, 5, 9);
  createPiece(PieceType.ELEPHANT, PlayerColor.RED, 6, 9);
  createPiece(PieceType.HORSE, PlayerColor.RED, 7, 9);
  createPiece(PieceType.CHARIOT, PlayerColor.RED, 8, 9);
  createPiece(PieceType.CANNON, PlayerColor.RED, 1, 7);
  createPiece(PieceType.CANNON, PlayerColor.RED, 7, 7);
  [0, 2, 4, 6, 8].forEach(x => createPiece(PieceType.SOLDIER, PlayerColor.RED, x, 6));

  return pieces;
};
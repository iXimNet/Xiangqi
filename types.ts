export enum PlayerColor {
  RED = 'red',
  BLACK = 'black',
}

export type GameResult = PlayerColor | 'draw';

export enum PieceType {
  GENERAL = 'general', // Shuai/Jiang
  ADVISOR = 'advisor', // Shi
  ELEPHANT = 'elephant', // Xiang
  HORSE = 'horse', // Ma
  CHARIOT = 'chariot', // Ju
  CANNON = 'cannon', // Pao
  SOLDIER = 'soldier', // Bing/Zu
}

export interface Position {
  x: number; // 0-8 (Column)
  y: number; // 0-9 (Row)
}

export interface Piece {
  id: string;
  type: PieceType;
  color: PlayerColor;
  position: Position;
}

export interface PlayerInfo {
  id?: string;
  name?: string;
  avatar?: string;
}

export interface Move {
  pieceId: string;
  from: Position;
  to: Position;
  capturedPieceId?: string; // If a piece was captured
  timestamp: number;
  notation: string; // e.g., "Red Chariot 1 -> 2"
}

export interface GameSession {
  id: string;
  startTime: number;
  lastUpdated: number;
  status: 'active' | 'finished';
  winner?: GameResult;
  resultReason?: 'capture' | 'checkmate' | 'stalemate' | 'draw-agreed' | 'resign';
  players?: {
    red?: PlayerInfo;
    black?: PlayerInfo;
  };
  pieces: Piece[];
  turn: PlayerColor;
  moves: Move[];
  name: string;
}

export interface GameStats {
  gamesPlayed: number;
  redWins: number;
  blackWins: number;
  unfinished: number;
  draws: number;
}

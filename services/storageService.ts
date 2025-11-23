import { GameSession, GameStats, PlayerColor } from '../types';
import { getInitialPieces } from '../constants';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

type ApiResponse<T> = { [key: string]: T };

const safeFetch = async <T>(path: string, init?: RequestInit, throwOnError = false): Promise<T | null> => {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init
    });
    if (!res.ok) {
      console.error('API error', res.status, res.statusText);
      if (throwOnError) throw new Error(`API Error: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as T;
  } catch (err) {
    console.error('API request failed', err);
    if (throwOnError) throw err;
    return null;
  }
};

export const fetchHistory = async (): Promise<GameSession[]> => {
  const res = await safeFetch<ApiResponse<GameSession[]>>('/games/history');
  return res?.games ?? [];
};

export const fetchCurrentGame = async (): Promise<GameSession | null> => {
  // Throw on error so the UI knows if it's a connection issue vs just no game
  const res = await safeFetch<ApiResponse<GameSession | null>>('/games/current', undefined, true);
  return res?.game ?? null;
};

const persistGame = async (session: GameSession, method: 'POST' | 'PUT') => {
  await safeFetch<ApiResponse<GameSession>>(
    method === 'POST' ? '/games' : `/games/${session.id}`,
    {
      method,
      body: JSON.stringify({ game: session })
    },
    true // Throw on error
  );
};

export const createNewGame = async (): Promise<GameSession> => {
  const session: GameSession = {
    id: Date.now().toString(),
    startTime: Date.now(),
    lastUpdated: Date.now(),
    status: 'active',
    pieces: getInitialPieces(),
    turn: PlayerColor.RED,
    moves: [],
    name: `对局 ${new Date().toLocaleString('zh-CN')}`
  };

  await persistGame(session, 'POST');
  return session;
};

export const updateGame = async (session: GameSession): Promise<void> => {
  await persistGame(session, 'PUT');
};

export const fetchStats = async (): Promise<GameStats> => {
  const res = await safeFetch<ApiResponse<GameStats>>('/games/stats');
  return res?.stats ?? { gamesPlayed: 0, redWins: 0, blackWins: 0, unfinished: 0, draws: 0 };
};

// Poll-based subscription to reflect remote updates across clients
export const subscribeToGameUpdates = (callback: () => void) => {
  const interval = window.setInterval(callback, 4000);
  return () => window.clearInterval(interval);
};

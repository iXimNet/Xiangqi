import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DB_PATH = path.join(DATA_DIR, 'xiangqi.db');
let db;
try {
  db = new Database(DB_PATH);
} catch (e) {
  console.error('打开数据库失败，尝试备份并重建', e);
  try {
    const corruptName = `xiangqi.db.corrupt.${Date.now()}`;
    try { await fs.promises.rename(DB_PATH, path.join(DATA_DIR, corruptName)); } catch {}
    db = new Database(DB_PATH);
  } catch (e2) {
    console.error('数据库重建再次失败', e2);
    process.exit(1);
  }
}

if (process.env.CHECK_DB_INTEGRITY === '1') {
  try {
    const row = db.prepare('PRAGMA integrity_check').get();
    const val = row && Object.values(row)[0];
    if (val !== 'ok') {
      console.warn('数据库完整性检查未通过:', val);
    }
  } catch (e) {
    console.warn('执行完整性检查时出错', e);
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  status TEXT,
  winner TEXT,
  reason TEXT,
  startTime INTEGER,
  lastUpdated INTEGER,
  redPlayer TEXT,
  blackPlayer TEXT,
  payload TEXT
);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_lastUpdated ON games(lastUpdated);
`);

const toStoredRow = (game) => ({
  id: game.id,
  status: game.status || 'active',
  winner: game.winner || null,
  reason: game.resultReason || null,
  startTime: game.startTime || Date.now(),
  lastUpdated: game.lastUpdated || Date.now(),
  redPlayer: JSON.stringify(game.players?.red || null),
  blackPlayer: JSON.stringify(game.players?.black || null),
  payload: JSON.stringify(game)
});

const persistGame = (game) => {
  const row = toStoredRow(game);
  db.prepare(`
    INSERT INTO games (id, status, winner, reason, startTime, lastUpdated, redPlayer, blackPlayer, payload)
    VALUES (@id, @status, @winner, @reason, @startTime, @lastUpdated, @redPlayer, @blackPlayer, @payload)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status,
      winner=excluded.winner,
      reason=excluded.reason,
      startTime=excluded.startTime,
      lastUpdated=excluded.lastUpdated,
      redPlayer=excluded.redPlayer,
      blackPlayer=excluded.blackPlayer,
      payload=excluded.payload
  `).run(row);
};

const mapRowToGame = (row) => row ? JSON.parse(row.payload) : null;

app.get('/api/games/current', (req, res) => {
  const row = db.prepare(`SELECT payload FROM games WHERE status = 'active' ORDER BY lastUpdated DESC LIMIT 1`).get();
  res.json({ game: mapRowToGame(row) });
});

app.get('/api/games/history', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.prepare(`SELECT payload FROM games WHERE status = 'finished' ORDER BY lastUpdated DESC LIMIT ?`).all(limit);
  res.json({ games: rows.map(mapRowToGame).filter(Boolean) });
});

app.get('/api/games/stats', (req, res) => {
  const finished = db.prepare(`SELECT winner, COUNT(*) as total FROM games WHERE status = 'finished' GROUP BY winner`).all();
  const gamesPlayedRow = db.prepare(`SELECT COUNT(*) as total FROM games WHERE status = 'finished'`).get();
  const unfinishedRow = db.prepare(`SELECT COUNT(*) as total FROM games WHERE status != 'finished'`).get();

  const redWins = finished.find(r => r.winner === 'red')?.total || 0;
  const blackWins = finished.find(r => r.winner === 'black')?.total || 0;
  const draws = finished.find(r => r.winner === 'draw')?.total || 0;

  res.json({
    stats: {
      gamesPlayed: gamesPlayedRow?.total || 0,
      redWins,
      blackWins,
      draws,
      unfinished: unfinishedRow?.total || 0
    }
  });
});

app.get('/api/games/:id', (req, res) => {
  const row = db.prepare(`SELECT payload FROM games WHERE id = ?`).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ game: mapRowToGame(row) });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, time: Date.now() });
});

app.post('/api/games', (req, res) => {
  const game = req.body?.game;
  if (!game?.id) {
    res.status(400).json({ error: 'Game payload missing id' });
    return;
  }
  persistGame(game);
  res.json({ game });
});

app.put('/api/games/:id', (req, res) => {
  const game = req.body?.game;
  if (!game?.id || game.id !== req.params.id) {
    res.status(400).json({ error: 'Game payload missing or id mismatch' });
    return;
  }
  persistGame(game);
  res.json({ game });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Xiangqi API server listening on port ${PORT}`);
});

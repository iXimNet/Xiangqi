
import React, { useState, useEffect, useRef } from 'react';
import Board from './components/Board';
import { GameSession, Move, PlayerColor, GameStats, Piece, GameResult } from './types';
import * as Server from './services/storageService';
import * as AIService from './services/aiService';
import { applyMove, reconstructBoard, evaluateGameState, findGeneral, isInCheck } from './services/xiangiRules';

type AppView = 'play' | 'history';

// --- SUB-COMPONENTS defined OUTSIDE to prevent re-mounting ---

interface HeaderProps {
  view: AppView;
  setView: (v: AppView) => void;
  stats: GameStats;
}

const Header: React.FC<HeaderProps> = ({ view, setView, stats }) => (
  <div className="w-full bg-[#262422] border-b border-[#4a3b32] p-3 shadow-lg z-50 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 md:w-10 md:h-10 bg-wood-dark rounded-full flex items-center justify-center border-2 border-[#dcb35c]">
        <span className="text-lg md:text-xl text-wood-light font-serif font-bold">将</span>
      </div>
      <div>
        <h1 className="text-[#dcb35c] font-bold text-base md:text-lg leading-none">中国象棋</h1>
        <p className="text-gray-500 text-[10px] md:text-xs">Master Xiangqi</p>
      </div>
    </div>

    <div className="hidden md:flex gap-4 text-xs">
      <div className="text-gray-400">总局数: <span className="text-white">{stats.gamesPlayed}</span></div>
      <div className="text-red-400">红胜: <span className="text-white">{stats.redWins}</span></div>
      <div className="text-gray-300">黑胜: <span className="text-white">{stats.blackWins}</span></div>
      <div className="text-amber-200">和棋: <span className="text-white">{stats.draws}</span></div>
    </div>

    <div className="flex gap-2">
      {view === 'play' ? (
        <button
          onClick={() => setView('history')}
          className="px-3 py-1.5 bg-blue-900/30 border border-blue-800 text-blue-200 text-xs md:text-sm rounded hover:bg-blue-900/50 transition"
        >
          📜 历史/复盘
        </button>
      ) : (
        <button
          onClick={() => setView('play')}
          className="px-3 py-1.5 bg-green-900/30 border border-green-800 text-green-200 text-xs md:text-sm rounded hover:bg-green-900/50 transition"
        >
          ♟️ 返回对局
        </button>
      )}
    </div>
  </div>
);

interface PlayViewProps {
  currentSession: GameSession | null;
  startNewGame: () => void;
  handleMove: (move: Move) => void;
  handleGameOver: (winner: GameResult) => void;
  analyzeBoard: () => void;
  isAnalyzing: boolean;
  aiAnalysis: string;
  setAiAnalysis: (s: string) => void;
  checkAlert: string;
  playerSide: PlayerColor | null;
  canMove: boolean;
  isFlipped: boolean;
}

const PlayView: React.FC<PlayViewProps> = ({
  currentSession,
  startNewGame,
  handleMove,
  handleGameOver,
  analyzeBoard,
  isAnalyzing,
  aiAnalysis,
  setAiAnalysis,
  checkAlert,
  playerSide,
  canMove,
  isFlipped
}) => {
  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
        <p className="text-gray-400 animate-pulse">正在连接服务器...</p>
        <button onClick={startNewGame} className="px-6 py-2 bg-amber-600 rounded text-white">
          初始化游戏
        </button>
      </div>
    )
  }

  const isFinished = currentSession.status === 'finished';
  const lastMove = currentSession.moves.length > 0 ? currentSession.moves[currentSession.moves.length - 1] : null;

  return (
    <div className="flex-1 flex flex-col items-center relative overflow-y-auto scrollbar-hide py-4">
      {/* Status Bar */}
      <div className="mb-4 flex items-center gap-3 z-10 shrink-0">
        <div className={`
                    px-6 py-2 rounded-full font-bold shadow-lg border border-white/10 text-sm backdrop-blur-md transition-colors duration-300
                    ${isFinished
            ? 'bg-purple-900/90 text-purple-100 ring-2 ring-purple-500'
            : currentSession.turn === PlayerColor.RED ? 'bg-red-900/90 text-red-100 ring-1 ring-red-500' : 'bg-gray-800/90 text-gray-100 ring-1 ring-gray-500'
          }
                  `}>
          {isFinished
            ? `🏆 获胜: ${currentSession.winner === 'draw' ? '和棋' : currentSession.winner === PlayerColor.RED ? '红方' : '黑方'}`
            : `👉 ${currentSession.turn === PlayerColor.RED ? '红方' : '黑方'} 走棋`
          }
        </div>
        {playerSide && (
          <div className="px-3 py-1 rounded-full bg-white/5 text-xs border border-white/10">
            你是：{playerSide === PlayerColor.RED ? '红方' : '黑方'} {canMove ? '(可落子)' : '(等待对方)'}
          </div>
        )}
        {checkAlert && !isFinished && (
          <div className="px-3 py-1 rounded-full bg-amber-800/80 text-amber-100 text-xs shadow border border-amber-700 animate-pulse">
            {checkAlert}
          </div>
        )}
      </div>

      {/* Board Container - Max width constraint for nicer looking board */}
      <div className="w-full max-w-[500px] px-2 shrink-0">
        <Board
          pieces={currentSession.pieces}
          turn={currentSession.turn}
          onMove={handleMove}
          onGameOver={handleGameOver}
          canMove={canMove}
          lastMove={lastMove}
          isFlipped={isFlipped}
        />
      </div>

      {/* Action Bar */}
      <div className="mt-6 flex gap-4 z-10 pb-8 shrink-0">
        <button
          onClick={startNewGame}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-b from-amber-600 to-amber-700 rounded-xl text-white font-bold shadow-lg active:scale-95 transition border border-amber-500"
        >
          <span>⚔️</span> {isFinished ? '再来一局' : '重开一局'}
        </button>

        {!isFinished && (
          <button
            onClick={analyzeBoard}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-5 py-3 bg-purple-700/80 rounded-xl text-white font-bold shadow-lg active:scale-95 transition disabled:opacity-50 border border-purple-500"
          >
            {isAnalyzing ? '分析中...' : '🤖 AI 分析'}
          </button>
        )}
      </div>

      {/* AI Modal */}
      {aiAnalysis && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-800/95 backdrop-blur border border-purple-500/50 p-4 rounded-xl shadow-2xl animate-fade-in z-50">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
            <span className="text-purple-300 font-bold text-sm">🤖 AI 大师点评</span>
            <button onClick={() => setAiAnalysis('')} className="text-gray-400 hover:text-white px-2">✕</button>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
        </div>
      )}
    </div>
  );
};

interface HistoryViewProps {
  historyList: GameSession[];
  selectedHistorySession: GameSession | null;
  setSelectedHistorySession: (s: GameSession | null) => void;
  activeReplaySession: GameSession | null;
  currentSession: GameSession | null;
  historyStep: number;
  setHistoryStep: (n: number) => void;
  isPlayingHistory: boolean;
  togglePlayback: () => void;
  jumpToStep: (n: number) => void;
  stopPlayback: () => void;
  isFlipped: boolean;
}

const HistoryView: React.FC<HistoryViewProps> = ({
  historyList,
  selectedHistorySession,
  setSelectedHistorySession,
  activeReplaySession,
  currentSession,
  historyStep,
  isPlayingHistory,
  togglePlayback,
  jumpToStep,
  stopPlayback,
  isFlipped
}) => {
  const getHistoryPieces = (): Piece[] => {
    if (!activeReplaySession) return [];
    const movesToApply = activeReplaySession.moves.slice(0, historyStep);
    return reconstructBoard(movesToApply);
  };

  const displayPieces = getHistoryPieces();
  const historyMove = activeReplaySession && historyStep > 0 ? activeReplaySession.moves[historyStep - 1] : null;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#1e1c1a]">

      {/* Sidebar: Game List */}
      <div className="w-full md:w-64 bg-[#262422] border-b md:border-b-0 md:border-r border-[#4a3b32] flex flex-col shrink-0 max-h-[200px] md:max-h-full">
        <div className="p-3 bg-[#2d2a26] border-b border-[#4a3b32] font-bold text-[#dcb35c]">
          📜 历史对局
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {/* Option to view Current Live Game in History Mode */}
          <button
            onClick={() => setSelectedHistorySession(null)}
            className={`w-full text-left p-3 rounded text-sm flex justify-between items-center transition
                              ${!selectedHistorySession ? 'bg-amber-900/40 border border-amber-700/50 text-amber-100' : 'hover:bg-white/5 text-gray-400'}
                          `}
          >
            <span>进行中/最新对局</span>
            <span className="text-xs bg-green-900 text-green-300 px-1.5 rounded">LIVE</span>
          </button>

          <div className="h-px bg-[#4a3b32] my-2 mx-2"></div>

          {historyList.length === 0 && <div className="text-gray-600 text-xs text-center py-4">无历史记录</div>}

          {historyList.map(game => (
            <button
              key={game.id}
              onClick={() => setSelectedHistorySession(game)}
              className={`w-full text-left p-3 rounded text-sm flex flex-col transition
                                  ${selectedHistorySession?.id === game.id ? 'bg-blue-900/40 border border-blue-700/50 text-blue-100' : 'hover:bg-white/5 text-gray-400'}
                              `}
            >
              <div className="flex justify-between w-full">
                <span>{new Date(game.startTime).toLocaleDateString()}</span>
                <span className={`text-xs px-1 rounded ${game.winner === PlayerColor.RED ? 'text-red-400' : game.winner === PlayerColor.BLACK ? 'text-gray-300' : 'text-amber-300'}`}>
                  {game.winner ? (game.winner === 'draw' ? '和棋' : game.winner === PlayerColor.RED ? '红胜' : '黑胜') : '未完'}
                </span>
              </div>
              <span className="text-xs text-gray-600 mt-1">{game.moves.length} 手</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center: Replay Board */}
      <div className="flex-1 flex flex-col items-center relative bg-[#1e1c1a] overflow-hidden">

        {/* Replay Info Header */}
        <div className="w-full p-2 bg-[#151413] border-b border-[#333] flex justify-between items-center z-10 text-xs md:text-sm text-gray-400 px-4">
          <span>
            {activeReplaySession ? (activeReplaySession.id === currentSession?.id ? '当前对局' : '历史存档') : '无数据'}
          </span>
          <span>第 {historyStep} / {activeReplaySession?.moves.length || 0} 手</span>
        </div>

        <div className="flex-1 w-full flex flex-col items-center justify-center p-2 overflow-y-auto">
          <div className="w-full max-w-[450px] pointer-events-none">
            {activeReplaySession ? (
              <Board
                pieces={displayPieces}
                turn={PlayerColor.RED} // Visual only
                onMove={() => { }}
                onGameOver={() => { }}
                canMove={false}
                lastMove={historyMove}
                isFlipped={isFlipped}
              />
            ) : (
              <div className="text-gray-500 flex h-[400px] items-center justify-center border-2 border-dashed border-gray-700 rounded">
                请选择对局
              </div>
            )}
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="w-full p-4 bg-[#262422] border-t border-[#4a3b32] flex justify-center items-center gap-6 shrink-0 z-20 safe-pb">
          <button onClick={() => jumpToStep(0)} className="text-gray-400 hover:text-white active:scale-90 transition">
            ⏮ <span className="hidden md:inline text-xs">开始</span>
          </button>
          <button onClick={() => jumpToStep(historyStep - 1)} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 active:scale-95 transition border border-gray-600">
            ◀
          </button>
          <button
            onClick={togglePlayback}
            className="w-14 h-14 bg-amber-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-amber-500 active:scale-95 transition border-4 border-[#262422] -mt-8"
          >
            <span className="text-xl ml-0.5">{isPlayingHistory ? '⏸' : '▶'}</span>
          </button>
          <button onClick={() => jumpToStep(historyStep + 1)} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 active:scale-95 transition border border-gray-600">
            ▶
          </button>
          <button onClick={() => activeReplaySession && jumpToStep(activeReplaySession.moves.length)} className="text-gray-400 hover:text-white active:scale-90 transition">
            <span className="hidden md:inline text-xs">最新</span> ⏭
          </button>
        </div>
      </div>

      {/* Right: Move List (Desktop only usually, or collapsible) */}
      <div className="hidden lg:flex w-64 bg-[#262422] border-l border-[#4a3b32] flex-col shrink-0">
        <div className="p-3 border-b border-[#4a3b32] bg-[#2d2a26]">
          <h3 className="text-[#dcb35c] font-bold">着法详情</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {!activeReplaySession && <div className="text-center text-gray-600 mt-8 text-sm">未选择</div>}
          {activeReplaySession?.moves.map((m, i) => (
            <div
              key={i}
              onClick={() => {
                stopPlayback();
                jumpToStep(i + 1);
              }}
              className={`
                                  flex items-center px-3 py-2 rounded cursor-pointer text-sm transition border-l-2
                                  ${(i + 1) === historyStep
                  ? 'bg-blue-900/30 border-blue-500 text-white'
                  : 'border-transparent hover:bg-white/5 text-gray-400'}
                              `}
            >
              <span className="w-8 font-mono text-xs opacity-50">{(i + 1)}.</span>
              <span className={`${m.pieceId.includes('red') ? 'text-red-300' : 'text-gray-300'}`}>
                {m.notation}
              </span>
            </div>
          ))}
          {/* Spacer for scrolling */}
          <div className="h-4"></div>
        </div>
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

export default function App() {
  const PLAYER_SIDE_STORAGE = 'xiangqi_player_side';
  const [view, setView] = useState<AppView>('play');
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [stats, setStats] = useState<GameStats>({ gamesPlayed: 0, redWins: 0, blackWins: 0, unfinished: 0, draws: 0 });
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [checkAlert, setCheckAlert] = useState('');
  const [playerSide, setPlayerSide] = useState<PlayerColor | null>(null);

  // History / Playback State
  const [historyList, setHistoryList] = useState<GameSession[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<GameSession | null>(null);
  const [historyStep, setHistoryStep] = useState<number>(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const playbackIntervalRef = useRef<number | null>(null);

  // Initial Data Load
  useEffect(() => {
    refreshData();
    // Subscribe to "server" updates
    const unsubscribe = Server.subscribeToGameUpdates(() => {
      refreshData();
    });

    return () => {
      unsubscribe();
      stopPlayback();
    };
  }, []);

  const refreshData = async () => {
    const [session, fetchedStats, history] = await Promise.all([
      Server.fetchCurrentGame(),
      Server.fetchStats(),
      Server.fetchHistory()
    ]);

    setHistoryList(history || []);
    if (fetchedStats) {
      setStats(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(fetchedStats)) {
          return fetchedStats;
        }
        return prev;
      });
    }

    let nextSession: GameSession | null = null;
    if (session) {
      const prev = currentSession;
      if (!prev) {
        nextSession = session;
      } else if (session.id !== prev.id || session.lastUpdated > prev.lastUpdated) {
        nextSession = session;
      } else {
        nextSession = prev;
      }
    }
    setCurrentSession(nextSession);

    if (nextSession && (!playerSide || nextSession.id !== currentSession?.id)) {
      // Try to restore persisted side for this game id
      try {
        const stored = localStorage.getItem(PLAYER_SIDE_STORAGE);
        const parsed: Record<string, PlayerColor> | null = stored ? JSON.parse(stored) : null;
        const remembered = parsed?.[nextSession.id];
        if (remembered) {
          setPlayerSide(remembered);
        } else if (!playerSide) {
          // First-time assignment for this game id
          const side = nextSession.turn;
          setPlayerSide(side);
          const updated = { ...(parsed || {}), [nextSession.id]: side };
          localStorage.setItem(PLAYER_SIDE_STORAGE, JSON.stringify(updated));
        }
      } catch {
        if (!playerSide) {
          setPlayerSide(nextSession.turn);
        }
      }
    }
  };

  const startNewGame = async () => {
    const session = await Server.createNewGame();
    setCurrentSession(session);
    setPlayerSide(PlayerColor.RED);
    try {
      const stored = localStorage.getItem(PLAYER_SIDE_STORAGE);
      const parsed: Record<string, PlayerColor> = stored ? JSON.parse(stored) : {};
      parsed[session.id] = PlayerColor.RED;
      localStorage.setItem(PLAYER_SIDE_STORAGE, JSON.stringify(parsed));
    } catch { /* ignore persistence error */ }
    setAiAnalysis('');
    setCheckAlert('');
    // Refresh history list as the old game might have been archived
    const [history, newStats] = await Promise.all([Server.fetchHistory(), Server.fetchStats()]);
    setHistoryList(history || []);
    if (newStats) setStats(newStats);
    setView('play');
  };

  const finishGame = async (winner: GameResult, reason: GameSession['resultReason'], sessionOverride?: GameSession) => {
    const baseSession = sessionOverride || currentSession;
    if (!baseSession) return;

    const finishedSession: GameSession = {
      ...baseSession,
      status: 'finished',
      winner,
      resultReason: reason,
      lastUpdated: Date.now()
    };

    setCurrentSession(finishedSession);
    setCheckAlert('');
    await Server.updateGame(finishedSession);
    const [history, newStats] = await Promise.all([Server.fetchHistory(), Server.fetchStats()]);
    setHistoryList(history || []);
    if (newStats) setStats(newStats);

    if (winner === 'draw') {
      setAiAnalysis('对局以和棋结束。');
    } else {
      setAiAnalysis(`游戏结束! ${winner === PlayerColor.RED ? '红方' : '黑方'} 获胜!`);
    }
  };

  const handleMove = async (move: Move) => {
    if (!currentSession || view === 'history') return;
    if (playerSide && playerSide !== currentSession.turn) {
      setCheckAlert('当前轮到对方行棋');
      return;
    }

    const newPieces = applyMove(currentSession.pieces, move);
    const nextTurn = currentSession.turn === PlayerColor.RED ? PlayerColor.BLACK : PlayerColor.RED;

    // Illegal if move leaves the player still in check (self-resolving is required)
    if (isInCheck(newPieces, currentSession.turn)) {
      setCheckAlert('非法走法：己方仍被将军');
      return;
    }

    const updatedSession: GameSession = {
      ...currentSession,
      pieces: newPieces,
      turn: nextTurn,
      moves: [...currentSession.moves, move],
      lastUpdated: Date.now(),
      status: 'active'
    };

    // If the move captured a general, end immediately
    const redGeneral = findGeneral(newPieces, PlayerColor.RED);
    const blackGeneral = findGeneral(newPieces, PlayerColor.BLACK);
    if (!redGeneral || !blackGeneral) {
      const winner = redGeneral ? PlayerColor.RED : PlayerColor.BLACK;
      await finishGame(winner, 'capture', updatedSession);
      return;
    }

    const evaluation = evaluateGameState(newPieces, nextTurn);
    if (evaluation.checkmated) {
      await finishGame(currentSession.turn, 'checkmate', updatedSession);
      return;
    }
    if (evaluation.stalemated) {
      await finishGame('draw', 'stalemate', updatedSession);
      return;
    }

    setCheckAlert(evaluation.inCheck ? `${nextTurn === PlayerColor.RED ? '红方' : '黑方'} 被将军` : '');
    setCurrentSession(updatedSession);
    await Server.updateGame(updatedSession);
  };

  const handleGameOver = async (winner: GameResult) => {
    if (currentSession?.status === 'finished') return;
    await finishGame(winner, winner === 'draw' ? 'stalemate' : 'capture');
  };

  const analyzeBoard = async () => {
    if (!currentSession) return;
    setIsAnalyzing(true);
    const currentPieces = currentSession.pieces;
    const lastMove = currentSession.moves[currentSession.moves.length - 1] || null;

    const analysis = await AIService.analyzeGame(
      currentPieces,
      currentSession.turn,
      lastMove ? lastMove.notation : null
    );
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  // --- History Playback Logic ---

  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      window.clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlayingHistory(false);
  };

  const activeReplaySession = selectedHistorySession || currentSession;

  const togglePlayback = () => {
    if (!activeReplaySession) return;

    if (isPlayingHistory) {
      stopPlayback();
    } else {
      // If at end, restart
      if (historyStep >= activeReplaySession.moves.length) {
        setHistoryStep(0);
      }
      setIsPlayingHistory(true);
      playbackIntervalRef.current = window.setInterval(() => {
        setHistoryStep(prev => {
          if (!activeReplaySession || prev >= activeReplaySession.moves.length) {
            stopPlayback();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const jumpToStep = (step: number) => {
    if (!activeReplaySession) return;
    const safeStep = Math.max(0, Math.min(step, activeReplaySession.moves.length));
    setHistoryStep(safeStep);
    if (isPlayingHistory) stopPlayback();
  };

  // Handle view switching
  useEffect(() => {
    if (view === 'play') {
      stopPlayback();
      setSelectedHistorySession(null);
    } else {
      // When entering history, default to the current session if no history selected
      if (!selectedHistorySession && currentSession) {
        setHistoryStep(currentSession.moves.length);
      }
    }
  }, [view]);

  // Update check alert when session changes
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'active') {
      setCheckAlert('');
      return;
    }
    const evaluation = evaluateGameState(currentSession.pieces, currentSession.turn);
    setCheckAlert(evaluation.inCheck ? `${currentSession.turn === PlayerColor.RED ? '红方' : '黑方'} 被将军` : '');
  }, [currentSession?.id, currentSession?.lastUpdated]);

  // When selecting a different session in history, reset step
  useEffect(() => {
    if (activeReplaySession) {
      setHistoryStep(activeReplaySession.moves.length);
      stopPlayback();
    }
  }, [activeReplaySession?.id]);

  const isFlipped = playerSide === PlayerColor.BLACK;
  const canMove = !!(currentSession && currentSession.status === 'active' && playerSide === currentSession.turn);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#2d2a26] text-gray-100 font-sans selection:bg-amber-500/30 touch-manipulation">
      <Header view={view} setView={setView} stats={stats} />
      
      {view === 'play' ? (
        <PlayView
          currentSession={currentSession}
          startNewGame={startNewGame}
          handleMove={handleMove}
          handleGameOver={handleGameOver}
          analyzeBoard={analyzeBoard}
          isAnalyzing={isAnalyzing}
          aiAnalysis={aiAnalysis}
          setAiAnalysis={setAiAnalysis}
          checkAlert={checkAlert}
          playerSide={playerSide}
          canMove={canMove}
          isFlipped={isFlipped}
        />
      ) : (
        <HistoryView 
          historyList={historyList}
          selectedHistorySession={selectedHistorySession}
          setSelectedHistorySession={setSelectedHistorySession}
          activeReplaySession={activeReplaySession}
          currentSession={currentSession}
          historyStep={historyStep}
          setHistoryStep={setHistoryStep}
          isPlayingHistory={isPlayingHistory}
          togglePlayback={togglePlayback}
          jumpToStep={jumpToStep}
          stopPlayback={stopPlayback}
          isFlipped={isFlipped}
        />
      )}
    </div>
  );
}

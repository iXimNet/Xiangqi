
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  isFinished: boolean;
}

const Header: React.FC<HeaderProps> = ({ view, setView, stats, isFinished }) => (
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
      <div className="text-xs text-gray-400">
        红:{stats.redWins} | 黑:{stats.blackWins} | 和:{stats.draws}
      </div>
    </div>
    <div className="flex items-center gap-2">
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
  checkAlert: string;
  playerSide: PlayerColor | null;
  canMove: boolean;
  isFlipped: boolean;
  connectionError: boolean;
  slowMotionPieceId?: string | null;
}

const PlayView: React.FC<PlayViewProps> = ({
  currentSession,
  startNewGame,
  handleMove,
  handleGameOver,
  checkAlert,
  playerSide,
  canMove,
  isFlipped,
  connectionError,
  slowMotionPieceId
}) => {
  if (connectionError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
        <div className="text-red-400 text-xl font-bold">⚠️ 连接服务器失败</div>
        <p className="text-gray-400 text-sm">无法连接到游戏服务器，请检查网络或服务器状态。</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-700 hover:bg-red-600 rounded text-white transition">
          重试连接
        </button>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
        <p className="text-gray-400 animate-pulse">正在连接服务器...</p>
        <div className="text-amber-500 text-sm">正在自动初始化游戏...</div>
      </div>
    )
  }

  const isFinished = currentSession.status === 'finished';
  const lastMove = currentSession.moves.length > 0 ? currentSession.moves[currentSession.moves.length - 1] : null;

  return (
    <div className="flex-1 flex flex-col items-center relative overflow-y-auto scrollbar-hide py-4">
      {/* Status Bar */}
      {/* Status Bar */}
      <div className="mb-4 flex items-center gap-3 z-10 shrink-0 min-h-[40px]">
        {isFinished && (
          <div className="px-6 py-2 rounded-full font-bold shadow-lg border border-white/10 text-sm backdrop-blur-md transition-colors duration-300 bg-purple-900/90 text-purple-100 ring-2 ring-purple-500">
            🏆 获胜: {currentSession.winner === 'draw' ? '和棋' : currentSession.winner === PlayerColor.RED ? '红方' : '黑方'}
          </div>
        )}

        {checkAlert && !isFinished && (
          <div className="px-3 py-1 rounded-full bg-amber-800/80 text-amber-100 text-xs shadow border border-amber-700 animate-pulse">
            {checkAlert}
          </div>
        )}
      </div>

      {/* Board Container - Max width constraint for nicer looking board */}
      <div className="w-full max-w-[500px] px-2 shrink-0 relative">
        {/* Dynamic Turn Indicator - Centered on Left Side */}
        {!isFinished && (
          <div
            className={`absolute transform z-40 transition-all duration-500 ease-in-out px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm shadow-lg border backdrop-blur-md animate-pulse whitespace-nowrap
              ${currentSession.turn === PlayerColor.RED
                ? 'bg-red-900/90 text-red-100 border-red-500'
                : 'bg-gray-800/90 text-gray-100 border-gray-500'}
            `}
            style={{
              left: '-10px',
              transform: 'translateX(-100%)',
              top: (currentSession.turn === PlayerColor.RED ? !isFlipped : isFlipped) ? 'auto' : '20%',
              bottom: (currentSession.turn === PlayerColor.RED ? !isFlipped : isFlipped) ? '20%' : 'auto',
            }}
          >
            👉 {currentSession.turn === PlayerColor.RED ? '红方' : '黑方'} 走棋
          </div>
        )}

        <Board
          pieces={currentSession.pieces}
          turn={currentSession.turn}
          onMove={handleMove}
          onGameOver={handleGameOver}
          canMove={canMove}
          lastMove={lastMove}
          isFlipped={isFlipped}
          slowMotionPieceId={slowMotionPieceId}
        />
      </div>

      {/* Action Bar - Removed Restart Button */}
      <div className="mt-4 flex flex-col items-center gap-4 z-10 pb-8 shrink-0">
        {playerSide && !isFinished && (
          <div className="px-4 py-1.5 rounded-full bg-white/5 text-xs border border-white/10 text-gray-400">
            你是：<span className={playerSide === PlayerColor.RED ? 'text-red-400' : 'text-gray-300'}>{playerSide === PlayerColor.RED ? '红方' : '黑方'}</span> {canMove ? '(请落子)' : '(等待对方)'}
          </div>
        )}

        {isFinished && (
          <button
            onClick={startNewGame}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-b from-amber-600 to-amber-700 rounded-xl text-white font-bold shadow-lg active:scale-95 transition border border-amber-500"
          >
            <span>⚔️</span> 再来一局
          </button>
        )}
      </div>
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
  const currentSessionRef = useRef(currentSession);
  useEffect(() => { currentSessionRef.current = currentSession; }, [currentSession]);

  const [stats, setStats] = useState<GameStats>({ gamesPlayed: 0, redWins: 0, blackWins: 0, unfinished: 0, draws: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [checkAlert, setCheckAlert] = useState('');
  const [playerSide, setPlayerSide] = useState<PlayerColor | null>(null);
  const playerSideRef = useRef(playerSide);
  useEffect(() => { playerSideRef.current = playerSide; }, [playerSide]);

  const [connectionError, setConnectionError] = useState(false);
  const [showCheckFlash, setShowCheckFlash] = useState(false);
  const [winningAnimation, setWinningAnimation] = useState<{ winner: GameResult, text: string, showText: boolean } | null>(null);
  const [replayPieceOverride, setReplayPieceOverride] = useState<{ id: string, position: { x: number, y: number } } | null>(null);
  const [slowMotionPieceId, setSlowMotionPieceId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frozenBoardState, setFrozenBoardState] = useState<{ pieces: Piece[], session: GameSession } | null>(null);

  const isFlipped = playerSide === PlayerColor.BLACK;
  console.log("App Render:", { playerSide, isFlipped, frozen: !!frozenBoardState, session: currentSession?.id });

  // History / Playback State
  const [historyList, setHistoryList] = useState<GameSession[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<GameSession | null>(null);
  const [historyStep, setHistoryStep] = useState<number>(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const playbackIntervalRef = useRef<number | null>(null);

  // Initial Data Load


  const startNewGame = async () => {
    console.log("startNewGame called!");
    try {
      const session = await Server.createNewGame();
      setCurrentSession(session);

      // Preserve current player side, or default to RED if none
      const currentSide = playerSideRef.current || PlayerColor.RED;
      setPlayerSide(currentSide);

      try {
        const stored = localStorage.getItem(PLAYER_SIDE_STORAGE);
        const parsed: Record<string, PlayerColor> = stored ? JSON.parse(stored) : {};
        parsed[session.id] = currentSide;
        localStorage.setItem(PLAYER_SIDE_STORAGE, JSON.stringify(parsed));
      } catch { /* ignore persistence error */ }
    } catch (e) {
      console.error("Failed to start new game", e);
      setConnectionError(true);
    }
    setCheckAlert('');
    // Refresh history list as the old game might have been archived
    const [history, newStats] = await Promise.all([Server.fetchHistory(), Server.fetchStats()]);
    setHistoryList(history || []);
    if (newStats) setStats(newStats);
    setView('play');
  };

  const triggerGameEndAnimation = (winner: GameResult, finishedSession: GameSession, preMoveSession: GameSession | null, isPassive: boolean = false) => {
    console.log("Starting animation sequence", { winner, isPassive, hasPreMove: !!preMoveSession });
    // Freeze the board state from BEFORE the winning move
    // This keeps all pieces in their pre-move positions
    if (preMoveSession) {
      setFrozenBoardState({ pieces: preMoveSession.pieces, session: preMoveSession });
    }

    const lastMove = finishedSession.moves[finishedSession.moves.length - 1];
    if (lastMove) {
      // Step 1: Immediately set piece to starting position
      setReplayPieceOverride({ id: lastMove.pieceId, position: lastMove.from });
      setSlowMotionPieceId(lastMove.pieceId);

      // Step 2: After a brief moment, trigger slow move to destination
      setTimeout(() => {
        setReplayPieceOverride({ id: lastMove.pieceId, position: lastMove.to });

        // If there was a captured piece, remove it from the frozen board state so it doesn't show under the moving piece
        if (preMoveSession) {
          setFrozenBoardState(prev => {
            if (!prev) return null;
            return {
              ...prev,
              pieces: prev.pieces.filter(p => p.position.x !== lastMove.to.x || p.position.y !== lastMove.to.y)
            };
          });
        }
      }, 100);
    }

    setTimeout(() => {
      // 2. Show "Check" (General) animation
      // Keep replayPieceOverride and slowMotionPieceId active to prevent any snapping
      setShowCheckFlash(true);

      setTimeout(() => {
        // 3. Hide Check flash, Show Win Text
        setShowCheckFlash(false);
        setWinningAnimation({
          winner,
          text: `${winner === PlayerColor.RED ? '红方' : '黑方'}获胜`,
          showText: true
        });

        // 4. Wait 3s, then fade out Win Text
        setTimeout(() => {
          setWinningAnimation(prev => prev ? { ...prev, showText: false } : null);

          // 5. Start Countdown (5s)
          setCountdown(5);
          const interval = setInterval(() => {
            setCountdown(prev => {
              if (prev === null || prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          // 6. After 5s countdown, clear UI and prepare for restart
          setTimeout(() => {
            clearInterval(interval);
            setCountdown(null);
            setWinningAnimation(null);

            // Wait a brief moment for the countdown UI to clear, then start new game
            setTimeout(() => {
              // Clear all overrides and frozen state just before restart
              setSlowMotionPieceId(null);
              setReplayPieceOverride(null);
              setFrozenBoardState(null);

              // Only the active player (winner) should create the new game.
              // Passive players (losers/observers) should just wait for the new game to be detected by refreshData.
              if (!isPassive) {
                console.log("Active player starting new game...");
                startNewGame();
              } else {
                console.log("Passive player waiting for new game...");
              }
            }, 300); // Small delay to ensure countdown UI is gone
          }, 5000);

        }, 3000); // Display win text for 3s
      }, 1000); // Display check flash for 1s
    }, 2000); // Wait 2s for slow move
  };

  const refreshData = useCallback(async () => {
    try {
      const [session, fetchedStats, history] = await Promise.all([
        Server.fetchCurrentGame(),
        Server.fetchStats(),
        Server.fetchHistory()
      ]);

      setConnectionError(false);
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

      // Robust check for game finish using history
      // This handles cases where /games/current skips the finished state or we miss the update
      const prev = currentSessionRef.current;
      if (prev && prev.status === 'active' && history) {
        const prevInHistory = history.find(h => h.id === prev.id);
        if (prevInHistory && prevInHistory.status === 'finished' && prevInHistory.winner !== 'draw') {
          console.log("Detected finish via history!", prevInHistory.id);
          // Only trigger if we haven't already (though prev.status === 'active' guards this)
          triggerGameEndAnimation(prevInHistory.winner, prevInHistory, prev, true);

          // Update nextSession to this finished state temporarily so we don't re-trigger
          // But wait, if 'session' is already the NEW game, we might want to show that AFTER animation?
          // The animation sequence doesn't block state updates, but it overlays the board.
          // triggerGameEndAnimation sets 'frozenBoardState', which overrides the rendered board.
          // So it is safe to update currentSession to the new game in the background.
        }
      }

      if (session) {
        if (!prev) {
          nextSession = session;
        } else if (session.id !== prev.id || session.lastUpdated > prev.lastUpdated) {
          // Keep the direct check too, just in case history is lagging (unlikely) or for redundancy
          if (session.status === 'finished' && prev.status === 'active' && session.winner !== 'draw') {
            console.log("Triggering passive animation (direct)!");
            triggerGameEndAnimation(session.winner, session, prev, true);
          }
          nextSession = session;
        } else {
          nextSession = prev;
        }
      } else {
        // No active game found, auto-initialize
        if (!currentSessionRef.current) {
          try {
            const newSession = await Server.createNewGame();
            nextSession = newSession;
          } catch (e) {
            console.error("Auto-init failed", e);
            setConnectionError(true);
            return;
          }
        }
      }

      if (nextSession) {
        setCurrentSession(nextSession);
        // Sync player side if needed
        const currentPlayerSide = playerSideRef.current;
        if (!currentPlayerSide) {
          // Try to restore persisted side for this game id
          try {
            const stored = localStorage.getItem(PLAYER_SIDE_STORAGE);
            const parsed: Record<string, PlayerColor> | null = stored ? JSON.parse(stored) : null;
            const remembered = parsed?.[nextSession.id];
            if (remembered) {
              setPlayerSide(remembered);
            } else {
              // First-time assignment for this game id
              const side = nextSession.turn;
              setPlayerSide(side);
              const updated = { ...(parsed || {}), [nextSession.id]: side };
              localStorage.setItem(PLAYER_SIDE_STORAGE, JSON.stringify(updated));
            }
          } catch {
            setPlayerSide(nextSession.turn);
          }
        }
      }
    } catch (error) {
      console.error("Connection error during refresh", error);
      setConnectionError(true);
    }
  }, []); // Stable dependency

  // Initial Data Load and Subscription
  useEffect(() => {
    refreshData();
    const unsubscribe = Server.subscribeToGameUpdates(() => {
      refreshData();
    });
    return () => {
      unsubscribe();
      stopPlayback();
    };
  }, [refreshData]);



  const finishGame = async (winner: GameResult, reason: GameSession['resultReason'], sessionOverride?: GameSession, preMoveSession?: GameSession) => {
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

    if (winner !== 'draw') {
      triggerGameEndAnimation(winner, finishedSession, preMoveSession || null);
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
      // Set slow motion for the winning move
      setSlowMotionPieceId(move.pieceId);
      // Pass the pre-move session to finishGame
      await finishGame(winner, 'capture', updatedSession, currentSession);
      return;
    }

    const evaluation = evaluateGameState(newPieces, nextTurn);
    if (evaluation.checkmated) {
      // Set slow motion for the winning move
      setSlowMotionPieceId(move.pieceId);
      // Pass the pre-move session to finishGame
      await finishGame(currentSession.turn, 'checkmate', updatedSession, currentSession);
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
    const newCheckAlert = evaluation.inCheck ? `${currentSession.turn === PlayerColor.RED ? '红方' : '黑方'} 被将军` : '';
    setCheckAlert(newCheckAlert);

    if (evaluation.inCheck) {
      setShowCheckFlash(true);
      const timer = setTimeout(() => setShowCheckFlash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentSession?.id, currentSession?.lastUpdated]);

  // When selecting a different session in history, reset step
  useEffect(() => {
    if (activeReplaySession) {
      setHistoryStep(activeReplaySession.moves.length);
      stopPlayback();
    }
  }, [activeReplaySession?.id]);


  const canMove = !!(currentSession && currentSession.status === 'active' && playerSide === currentSession.turn);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#2d2a26] text-gray-100 font-sans selection:bg-amber-500/30 touch-manipulation">
      <Header
        view={view}
        setView={setView}
        stats={stats}
        isFinished={currentSession?.status === 'finished'}
      />

      {/* Check Flash Animation */}
      {showCheckFlash && currentSession && playerSide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`${isInCheck(currentSession.pieces, playerSide) ? 'rotate-180' : ''}`}>
            <div
              className="text-6xl md:text-8xl font-bold text-red-600 tracking-widest drop-shadow-2xl animate-bounce-in-out"
              style={{
                textShadow: '0 0 20px rgba(255,0,0,0.8), 2px 2px 0px #300'
              }}
            >
              将军
            </div>
          </div>
        </div>
      )}

      {/* Winning Animation Overlay */}
      {winningAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-1000">
          <div className="flex flex-col items-center">
            <div
              className={`
                  text-7xl md:text-9xl font-bold tracking-widest drop-shadow-2xl mb-8
                  transition-opacity duration-1000
                  ${winningAnimation.showText ? 'opacity-100' : 'opacity-0'}
                  ${winningAnimation.winner === PlayerColor.RED ? 'text-red-500' : 'text-gray-200'}
                `}
              style={{
                textShadow: winningAnimation.winner === PlayerColor.RED
                  ? '0 0 30px rgba(220, 38, 38, 0.8), 4px 4px 0px #300'
                  : '0 0 30px rgba(255, 255, 255, 0.5), 4px 4px 0px #000'
              }}
            >
              {winningAnimation.text}
            </div>
            {countdown !== null && (
              <div className="text-white text-2xl font-bold animate-pulse drop-shadow-md bg-black/40 px-6 py-2 rounded-full">
                {countdown}秒后自动开始新对局...
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'play' ? (
        <PlayView
          currentSession={frozenBoardState ? {
            ...frozenBoardState.session,
            pieces: frozenBoardState.pieces.map(p =>
              replayPieceOverride && p.id === replayPieceOverride.id
                ? { ...p, position: replayPieceOverride.position }
                : p
            )
          } : (currentSession ? {
            ...currentSession,
            pieces: currentSession.pieces.map(p =>
              replayPieceOverride && p.id === replayPieceOverride.id
                ? { ...p, position: replayPieceOverride.position }
                : p
            )
          } : null)}
          startNewGame={startNewGame}
          handleMove={handleMove}
          handleGameOver={handleGameOver}
          checkAlert={checkAlert}
          playerSide={playerSide}
          canMove={canMove}
          isFlipped={isFlipped}
          connectionError={connectionError}
          slowMotionPieceId={slowMotionPieceId}
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

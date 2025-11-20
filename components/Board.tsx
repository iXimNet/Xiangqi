
import React, { useEffect, useState, useRef } from 'react';
import { Piece as PieceModel, Position, PlayerColor, Move, GameResult } from '../types';
import Piece from './Piece';
import { getValidMoves } from '../services/xiangiRules';

interface BoardProps {
  pieces: PieceModel[];
  turn: PlayerColor;
  onMove: (move: Move) => void;
  onGameOver: (winner: GameResult) => void;
  lastMove: Move | null;
  canMove: boolean;
  isFlipped: boolean;
}

const Board: React.FC<BoardProps> = ({ pieces, turn, onMove, onGameOver, lastMove, canMove, isFlipped }) => {
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const toViewPos = (pos: Position) => ({
    x: isFlipped ? (8 - pos.x) : pos.x,
    y: isFlipped ? (9 - pos.y) : pos.y,
  });
  
  // Clear selection if turn changes
  useEffect(() => {
    setSelectedPieceId(null);
    setValidMoves([]);
  }, [turn]);

  const handlePieceInteraction = (piece: PieceModel) => {
    if (!canMove) return;
    // If clicking a piece of the wrong color...
    if (piece.color !== turn) {
      // If we already have a piece selected, try to capture this one
      if (selectedPieceId) {
        handleTargetInteraction(piece.position);
      }
      return;
    }
    
    // If clicking the currently selected piece, deselect it
    if (selectedPieceId === piece.id) {
      setSelectedPieceId(null);
      setValidMoves([]);
    } else {
      // Select new piece
      setSelectedPieceId(piece.id);
      const moves = getValidMoves(piece, pieces);
      setValidMoves(moves);
    }
  };

  const handleTargetInteraction = (targetPos: Position) => {
    if (!canMove) return;
    if (!selectedPieceId) return;
    
    const piece = pieces.find(p => p.id === selectedPieceId);
    if (!piece) return;

    // Check if the target position is a valid move for the selected piece
    const isValid = validMoves.some(m => m.x === targetPos.x && m.y === targetPos.y);
    
    if (isValid) {
      const targetPiece = pieces.find(p => p.position.x === targetPos.x && p.position.y === targetPos.y);
      
      const move: Move = {
        pieceId: piece.id,
        from: piece.position,
        to: targetPos,
        capturedPieceId: targetPiece?.id,
        timestamp: Date.now(),
        notation: `${piece.color === PlayerColor.RED ? '红' : '黑'}${piece.type} (${piece.position.x},${piece.position.y})->(${targetPos.x},${targetPos.y})`
      };
      
      // Optimistic cleanup BEFORE calling onMove
      setSelectedPieceId(null);
      setValidMoves([]);

      // Execute move
      onMove(move);

      // Check for General kill (Win condition)
      if (targetPiece && targetPiece.type === 'general') {
         setTimeout(() => onGameOver(piece.color), 200);
      }

    }
    // If clicking invalid square, selection persists (do nothing)
  };

  // SVG Grid Generation
  const renderGrid = () => {
    const lines = [];
    
    // Horizontal lines
    for (let i = 0; i < 10; i++) {
      lines.push(
        <line key={`h-${i}`} x1="5.55%" y1={`${i * 10 + 5}%`} x2="94.44%" y2={`${i * 10 + 5}%`} stroke="#5d4037" strokeWidth="1.5" />
      );
    }
    // Vertical lines (split by river)
    for (let i = 0; i < 9; i++) {
      const x = i * 11.11 + 5.55;
      if (i === 0 || i === 8) {
        lines.push(<line key={`v-full-${i}`} x1={`${x}%`} y1="5%" x2={`${x}%`} y2="95%" stroke="#5d4037" strokeWidth="1.5" />);
      } else {
        lines.push(<line key={`v-top-${i}`} x1={`${x}%`} y1="5%" x2={`${x}%`} y2="45%" stroke="#5d4037" strokeWidth="1.5" />);
        lines.push(<line key={`v-bot-${i}`} x1={`${x}%`} y1="55%" x2={`${x}%`} y2="95%" stroke="#5d4037" strokeWidth="1.5" />);
      }
    }
    // Palace diagonals
    lines.push(<line key="p1" x1="38.88%" y1="5%" x2="61.11%" y2="25%" stroke="#5d4037" strokeWidth="1.5" />);
    lines.push(<line key="p2" x1="61.11%" y1="5%" x2="38.88%" y2="25%" stroke="#5d4037" strokeWidth="1.5" />);
    lines.push(<line key="p3" x1="38.88%" y1="75%" x2="61.11%" y2="95%" stroke="#5d4037" strokeWidth="1.5" />);
    lines.push(<line key="p4" x1="61.11%" y1="75%" x2="38.88%" y2="95%" stroke="#5d4037" strokeWidth="1.5" />);

    return lines;
  };

  return (
    <div 
      ref={boardRef}
      className={`relative w-full max-w-[500px] aspect-[9/10] bg-wood-light mx-auto shadow-2xl rounded-sm border-4 border-[#8b5a2b] select-none touch-none ${!canMove ? 'opacity-90' : ''}`}
      // Disable context menu to prevent accidental long-press behavior
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* SVG Grid Layer */}
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        {renderGrid()}
        {/* River Text */}
        <text x="25%" y="51.5%" dominantBaseline="middle" textAnchor="middle" fill="#8b5a2b" className="text-2xl font-serif opacity-60 select-none">楚 河</text>
        <text x="75%" y="51.5%" dominantBaseline="middle" textAnchor="middle" fill="#8b5a2b" className="text-2xl font-serif opacity-60 select-none">汉 界</text>
      </svg>

      {/* Move Indicators Layer (Z-30: Always on top of everything) */}
      {validMoves.map((pos, idx) => (
        <div
          key={`move-${idx}`}
          onPointerDown={(e) => {
            e.stopPropagation(); 
            e.preventDefault();
            handleTargetInteraction(pos);
          }}
          // High Z-index to ensure they sit ON TOP of pieces (for captures)
          // Hit area is full square for easier tapping
          // Added 'group' for hover effects on children
          className="absolute z-30 flex items-center justify-center cursor-pointer group"
          style={{ 
              left: `${toViewPos(pos).x * 11.11}%`, 
              top: `${toViewPos(pos).y * 10}%`,
              width: '11.11%',
              height: '10%'
          }}
        >
          {/* Hover Effect Circle: Matches Piece Size (85% height, aspect square) */}
          <div className="absolute h-[85%] aspect-square rounded-full bg-blue-400/0 group-hover:bg-blue-400/20 transition-all duration-200 pointer-events-none"></div>

          {/* The Blue Dot */}
          <div className="w-3 h-3 md:w-4 md:h-4 bg-blue-600 rounded-full shadow-sm ring-2 ring-white/50 pointer-events-none relative z-10"></div>
        </div>
      ))}

      {/* Previous Move Source Indicator (Visual Only) */}
      {lastMove && (
        <div 
          className="absolute z-0 flex items-center justify-center pointer-events-none"
          style={{ 
              left: `${toViewPos(lastMove.from).x * 11.11}%`, 
              top: `${toViewPos(lastMove.from).y * 10}%`,
              width: '11.11%',
              height: '10%'
          }}
        >
             <div className="w-full h-full border-2 border-dashed border-green-600/50 rounded-full scale-75"></div>
        </div>
      )}

      {/* Pieces Layer (Z-20) */}
      {pieces.map(piece => (
        <Piece
          key={piece.id}
          piece={piece}
          isSelected={selectedPieceId === piece.id}
          onClick={() => handlePieceInteraction(piece)}
          lastMoved={lastMove?.pieceId === piece.id}
          viewPosition={toViewPos(piece.position)}
        />
      ))}
    </div>
  );
};

export default Board;

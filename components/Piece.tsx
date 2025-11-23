
import React from 'react';
import { Piece as PieceType, PlayerColor } from '../types';
import { PIECE_LABELS } from '../constants';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  onClick: () => void;
  lastMoved: boolean;
  viewPosition?: { x: number; y: number };
  rotate?: boolean;
  isSlowMotion?: boolean;
}

const Piece: React.FC<PieceProps> = ({ piece, isSelected, onClick, lastMoved, viewPosition, rotate, isSlowMotion }) => {
  const isRed = piece.color === PlayerColor.RED;
  const label = PIECE_LABELS[`${piece.color}_${piece.type}`];
  const display = viewPosition ?? piece.position;

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault(); // Stop ghost clicks, scrolling, and browser default behaviors
        onClick();
      }}
      className={`
        absolute flex items-center justify-center touch-none
        transition-all z-20 cursor-pointer
        ${isSlowMotion ? 'duration-[2000ms] ease-in-out' : 'duration-300'}
      `}
      style={{
        // Use exact percentages matching the grid logic (9 cols, 10 rows)
        width: '11.11%',
        height: '10%',
        left: `${display.x * 11.11}%`,
        top: `${display.y * 10}%`,
      }}
    >
      <div className={`
        h-[85%] aspect-square rounded-full flex items-center justify-center
        shadow-md border-2 relative
        ${isRed ? 'border-red-600 text-red-600' : 'border-gray-800 text-gray-800'}
        ${isSelected ? 'scale-110 ring-4 ring-blue-400 z-30 bg-[#ffe8c2]' : 'bg-[#f3dcb0]'}
        ${lastMoved ? 'ring-2 ring-green-500 shadow-green-500/50' : ''}
        ${lastMoved ? 'ring-2 ring-green-500 shadow-green-500/50' : ''}
      `}
        style={{
          transform: rotate ? 'rotate(180deg)' : 'none'
        }}
      >
        {/* Inner ring for aesthetics */}
        <div className={`
            absolute inset-1 rounded-full border 
            ${isRed ? 'border-red-300' : 'border-gray-400'}
        `}></div>

        <span className="font-serif font-bold text-xl md:text-2xl lg:text-3xl select-none relative -top-[1px]">
          {label}
        </span>
      </div>
    </div>
  );
};

export default Piece;

import { Piece, PlayerColor, PieceType } from "../types";
import { generateBoardDescription } from "./xiangiRules";

const API_BASE =
  (import.meta as any).env?.VITE_LLM_API_BASE ||
  (process.env as any).LLM_API_BASE ||
  'https://api.openai.com/v1';
const API_KEY =
  (import.meta as any).env?.VITE_LLM_API_KEY ||
  (process.env as any).LLM_API_KEY ||
  '';
const MODEL =
  (import.meta as any).env?.VITE_LLM_MODEL ||
  (process.env as any).LLM_MODEL ||
  'gpt-4o-mini';

export const analyzeGame = async (pieces: Piece[], turn: PlayerColor, lastMoveNotation: string | null, moves?: { notation: string }[]): Promise<string> => {
  if (!API_KEY) {
    return "API Key missing. Cannot analyze.";
  }

  try {
    // Enhanced board description with strategic context
    const redPieces = pieces.filter(p => p.color === PlayerColor.RED);
    const blackPieces = pieces.filter(p => p.color === PlayerColor.BLACK);

    const pieceTypeNames: Record<PieceType, string> = {
      [PieceType.GENERAL]: '帅/将',
      [PieceType.ADVISOR]: '仕/士',
      [PieceType.ELEPHANT]: '相/象',
      [PieceType.HORSE]: '马',
      [PieceType.CHARIOT]: '车',
      [PieceType.CANNON]: '炮',
      [PieceType.SOLDIER]: '兵/卒'
    };

    const getPieceName = (piece: Piece): string => {
      return `${piece.color === PlayerColor.RED ? '红' : '黑'}${pieceTypeNames[piece.type]}`;
    };

    // Build structured board description
    let boardDesc = '=== 当前棋盘布局 ===\n';
    boardDesc += `当前轮次: ${turn === PlayerColor.RED ? '红方' : '黑方'}\n\n`;

    // Piece counts
    boardDesc += '双方子力统计:\n';
    boardDesc += `红方: ${redPieces.length} 子\n`;
    boardDesc += `黑方: ${blackPieces.length} 子\n\n`;

    // Group pieces by type for clarity
    boardDesc += '红方棋子:\n';
    redPieces.forEach(p => {
      boardDesc += `  ${getPieceName(p)} 位于 第${p.position.x + 1}列第${10 - p.position.y}行\n`;
    });

    boardDesc += '\n黑方棋子:\n';
    blackPieces.forEach(p => {
      boardDesc += `  ${getPieceName(p)} 位于 第${p.position.x + 1}列第${10 - p.position.y}行\n`;
    });

    // Add move history if available
    let moveHistory = '';
    if (moves && moves.length > 0) {
      moveHistory = '\n=== 棋谱记录 ===\n';
      moveHistory += '说明：每一手棋的记录格式为 "[红/黑]棋子类型 起始位置 -> 目标位置"\n';
      moveHistory += '位置采用坐标系统：横坐标0-8（第1-9列），纵坐标0-9（第1-10行）\n\n';

      // Show last 10 moves for context
      const recentMoves = moves.slice(-10);
      moveHistory += `最近${recentMoves.length}手棋：\n`;
      recentMoves.forEach((move, idx) => {
        const moveNum = moves.length - recentMoves.length + idx + 1;
        moveHistory += `第${moveNum}手: ${move.notation}\n`;
      });
    }

    const prompt = `
你是一名资深中国象棋大师和教练。

${boardDesc}${moveHistory}

${lastMoveNotation ? `最后一手棋: ${lastMoveNotation}` : '开局阶段，尚未走棋'}

请用中文简洁点评当前局面（不超过100字），包括：
1. 双方形势判断（谁占优势或均势）
2. 关键威胁或战术机会
3. 简要建议（如有明显好棋）

要求：专业、友好、实用。`;

    const url = `${API_BASE.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful Xiangqi coach.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 120,
        temperature: 0.6
      })
    });

    if (!res.ok) {
      console.error('LLM API error', res.status, await res.text());
      return 'AI 服务暂不可用，请稍后重试。';
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "未获取到有效回复。";
  } catch (error) {
    console.error("AI Analysis failed", error);
    return "AI 服务暂不可用，请稍后重试。";
  }
};

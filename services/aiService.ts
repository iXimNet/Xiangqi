import { Piece, PlayerColor } from "../types";
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

export const analyzeGame = async (pieces: Piece[], turn: PlayerColor, lastMoveNotation: string | null): Promise<string> => {
  if (!API_KEY) {
    return "API Key missing. Cannot analyze.";
  }

  try {
    const boardDesc = generateBoardDescription(pieces, turn);
    const prompt = `
你是一名中国象棋大师兼简洁解说员。
当前局面：
${boardDesc}
上一手：${lastMoveNotation || "开局未走棋"}。

请用中文不超过 100 字点评：
1) 谁占优势？
2) 关键威胁或机会是什么？
语气：简洁、专业、友好。`;

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

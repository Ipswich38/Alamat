// Alamat Chess — pieces are Alamat heroes, captures trigger a fight.
// Chess piece types map to heroes; team tint distinguishes Dawn vs Dusk.

export type ChessTeam = 'dawn' | 'dusk';
export type ChessPieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export interface ChessPiece {
  id: string;
  type: ChessPieceType;
  team: ChessTeam;
  heroId: string; // Alamat hero id backing this piece
  hasMoved?: boolean;
}

export interface BoardPos { r: number; c: number; } // 0..7
export type Board = (ChessPiece | null)[][]; // 8x8

export const PIECE_HERO: Record<ChessPieceType, string> = {
  king: 'zenith',
  queen: 'argent',
  rook: 'bedrock',
  bishop: 'willow',
  knight: 'hollow',
  pawn: 'veer',
};

export const PIECE_LABEL: Record<ChessPieceType, string> = {
  king: 'Hari', queen: 'Reyna', rook: 'Kuta', bishop: 'Babaylan', knight: 'Mandirigma', pawn: 'Kawal',
};

export const PIECE_VALUE: Record<ChessPieceType, number> = {
  pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0,
};

export function pieceSymbol(type: ChessPieceType, team: ChessTeam): string {
  const map: Record<ChessPieceType, string> = {
    king: team==='dawn' ? '♔' : '♚',
    queen: team==='dawn' ? '♕' : '♛',
    rook: team==='dawn' ? '♖' : '♜',
    bishop: team==='dawn' ? '♗' : '♝',
    knight: team==='dawn' ? '♘' : '♞',
    pawn: team==='dawn' ? '♙' : '♟',
  };
  return map[type];
}

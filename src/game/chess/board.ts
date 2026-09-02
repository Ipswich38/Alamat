import type { Board, BoardPos, ChessPiece, ChessTeam, ChessPieceType } from './types';
import { PIECE_HERO } from './types';

function make(type: ChessPieceType, team: ChessTeam, id: string): ChessPiece {
  return { id, type, team, heroId: PIECE_HERO[type] };
}

export function initialBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const order: ChessPieceType[] = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
  // Dusk (black) top 0,1
  order.forEach((t,c) => b[0][c] = make(t,'dusk',`dusk-${t}-${c}`));
  for(let c=0;c<8;c++) b[1][c] = make('pawn','dusk',`dusk-pawn-${c}`);
  // Dawn (white) bottom 6,7 — dawn pawns face up
  for(let c=0;c<8;c++) b[6][c] = make('pawn','dawn',`dawn-pawn-${c}`);
  order.forEach((t,c) => b[7][c] = make(t,'dawn',`dawn-${t}-${c}`));
  return b;
}

export function cloneBoard(b: Board): Board { return b.map(row=>row.slice()); }

export function posEq(a: BoardPos, b: BoardPos){ return a.r===b.r && a.c===b.c; }

function inside(r:number,c:number){ return r>=0&&r<8&&c>=0&&c<8; }

export function legalMoves(board: Board, from: BoardPos): BoardPos[] {
  const p = board[from.r][from.c];
  if(!p) return [];
  const out: BoardPos[] = [];
  const enemy = (r:number,c:number)=> { const t=board[r][c]; return t && t.team!==p.team; };
  const empty = (r:number,c:number)=> !board[r][c];
  const push = (r:number,c:number, captureOnly=false, emptyOnly=false)=>{
    if(!inside(r,c)) return false;
    const t=board[r][c];
    if(t && t.team===p.team) return false;
    if(captureOnly && !t) return false;
    if(emptyOnly && t) return false;
    out.push({r,c});
    return !t; // true if can continue sliding
  };
  const { type, team } = p;
  const dir = team==='dawn' ? -1 : 1;
  const startRow = team==='dawn' ? 6 : 1;
  if(type==='pawn'){
    if(empty(from.r+dir, from.c)) {
      push(from.r+dir, from.c, false, true);
      if(from.r===startRow && empty(from.r+dir*2, from.c)) push(from.r+dir*2, from.c, false, true);
    }
    for(const dc of [-1,1]){
      if(inside(from.r+dir, from.c+dc) && enemy(from.r+dir, from.c+dc)) out.push({r:from.r+dir,c:from.c+dc});
    }
    return out;
  }
  if(type==='knight'){
    for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) push(from.r+dr, from.c+dc);
    return out;
  }
  if(type==='king'){
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) push(from.r+dr, from.c+dc);
    return out;
  }
  const dirs: [number,number][] = [];
  if(type==='rook' || type==='queen') dirs.push([1,0],[-1,0],[0,1],[0,-1]);
  if(type==='bishop' || type==='queen') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  for(const [dr,dc] of dirs){
    for(let k=1;k<8;k++){
      const r=from.r+dr*k, c=from.c+dc*k;
      if(!inside(r,c)) break;
      const t=board[r][c];
      if(t && t.team===p.team) break;
      out.push({r,c});
      if(t) break;
    }
  }
  return out;
}

export function isKingInCheck(board: Board, team: ChessTeam): boolean {
  let kr=-1,kc=-1;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){ const p=board[r][c]; if(p && p.type==='king' && p.team===team){ kr=r;kc=c; }}
  if(kr<0) return false;
  const opp: ChessTeam = team==='dawn' ? 'dusk':'dawn';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=board[r][c]; if(!p || p.team!==opp) continue;
    if(legalMoves(board,{r,c}).some(m=>m.r===kr && m.c===kc)) return true;
  }
  return false;
}

export function findKing(board: Board, team: ChessTeam): BoardPos | null {
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){ const p=board[r][c]; if(p && p.type==='king' && p.team===team) return {r,c}; }
  return null;
}

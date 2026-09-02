'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HEROES } from '@/game/heroes';
import { sound } from '@/game/audio/synth';
import { haptics } from '@/game/audio/haptics';
import type { Board, BoardPos, ChessPiece } from '@/game/chess/types';
import { pieceSymbol, PIECE_LABEL } from '@/game/chess/types';
import { initialBoard, legalMoves, cloneBoard } from '@/game/chess/board';

const TILE = 2.4;
const BOARD_SIZE = TILE * 8;

function worldForTile(r:number,c:number){ return { x: (c-3.5)*TILE, z: (r-3.5)*TILE }; }

function heroForPiece(p: ChessPiece){
  return HEROES.find(h=>h.id===p.heroId) ?? HEROES[0];
}

export default function ChessBoard3D(){
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const [board,setBoard]=useState<Board>(()=>initialBoard());
  const boardRef=useRef(board); boardRef.current=board;
  const [turn,setTurn]=useState<'dawn'|'dusk'>('dawn');
  const [selected,setSelected]=useState<BoardPos|null>(null);
  const [moves,setMoves]=useState<BoardPos[]>([]);
  const [log,setLog]=useState<string>('Dawn to move — Hari vs Hari');
  const [captured,setCaptured]=useState<ChessPiece[]>([]);
  const [winner,setWinner]=useState<string|null>(null);
  const selectedRef=useRef<BoardPos|null>(null); selectedRef.current=selected;
  const movesRef=useRef(moves); movesRef.current=moves;

  // 3D scene
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:false});
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio));
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
    const scene=new THREE.Scene();
    scene.background=new THREE.Color('#0b1220');
    scene.fog=new THREE.Fog('#0b1220', 18, 38);

    const w=canvas.clientWidth||800, h=canvas.clientHeight||600;
    const camera=new THREE.PerspectiveCamera(42, w/h, 0.1, 200);
    camera.position.set(0, 18, 14); camera.lookAt(0,0,0);

    // Light
    const sun=new THREE.DirectionalLight(0xfff4e0, 2.8); sun.position.set(-10,18,-8); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun); scene.add(sun.target);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x2a3a2f, 1.2));
    scene.add(new THREE.AmbientLight(0xffffff,0.45));

    // Board tiles
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const isLight=(r+c)%2===0;
      const geo=new THREE.BoxGeometry(TILE*0.98,0.18,TILE*0.98);
      const mat=new THREE.MeshStandardMaterial({ color: isLight?0xe8dcc8:0x4a3a2a, roughness:0.82 });
      const m=new THREE.Mesh(geo,mat);
      const wpos=worldForTile(r,c);
      m.position.set(wpos.x, -0.09, wpos.z); m.receiveShadow=true; m.userData={r,c}; scene.add(m);
    }
    // Border
    const border=new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE+0.8,0.28,BOARD_SIZE+0.8), new THREE.MeshStandardMaterial({color:0x1e293b, roughness:0.7}));
    border.position.y=-0.22; border.receiveShadow=true; scene.add(border);

    // Piece meshes group
    const pieceGroup=new THREE.Group(); scene.add(pieceGroup);
    // Highlight helpers
    const selectRing=new THREE.Mesh(new THREE.RingGeometry(TILE*0.42,TILE*0.52,32), new THREE.MeshBasicMaterial({color:0xFFD700, transparent:true, opacity:0.9, side:THREE.DoubleSide}));
    selectRing.rotation.x=-Math.PI/2; selectRing.position.y=0.02; selectRing.visible=false; scene.add(selectRing);
    const moveDots: THREE.Mesh[]=[];

    let raf=0, disposed=false;
    const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();

    function rebuildPieces(b: Board, sel: BoardPos|null, mvs: BoardPos[]){
      pieceGroup.clear();
      // move dots
      moveDots.forEach(d=>scene.remove(d)); moveDots.length=0;
      mvs.forEach(pos=>{
        const dot=new THREE.Mesh(new THREE.CircleGeometry(TILE*0.22,18), new THREE.MeshBasicMaterial({color:0x00E5FF, transparent:true, opacity:0.72, side:THREE.DoubleSide}));
        dot.rotation.x=-Math.PI/2; const w=worldForTile(pos.r,pos.c); dot.position.set(w.x,0.04,w.z); dot.renderOrder=5; scene.add(dot); moveDots.push(dot);
      });
      if(sel){ const w=worldForTile(sel.r,sel.c); selectRing.position.set(w.x,0.03,w.z); selectRing.visible=true; } else selectRing.visible=false;

      for(let r=0;r<8;r++) for(let c=0;c<8;c++){
        const p=b[r][c]; if(!p) continue;
        const hero=heroForPiece(p);
        const wpos=worldForTile(r,c);
        // Piece body — capsule + hero portrait billboard
        const g=new THREE.Group(); g.position.set(wpos.x,0.35,wpos.z); g.userData={r,c};
        const isSel=sel && sel.r===r && sel.c===c;
        const baseColor = p.team==='dawn' ? 0xFFD700 : 0x8b1a1a;
        const body=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.62,1.05,12), new THREE.MeshStandardMaterial({color: hero.palette? hero.palette.cloth as any : baseColor, roughness:0.7}));
        body.castShadow=true; body.position.y=0.45; g.add(body);
        const head=new THREE.Mesh(new THREE.SphereGeometry(0.42,12,10), new THREE.MeshStandardMaterial({color: p.team==='dawn'?0xfff6cc:0xff6b6b}));
        head.position.y=1.15; g.add(head);
        // Symbol sprite via canvas texture
        const cvs=document.createElement('canvas'); cvs.width=128; cvs.height=128;
        const ctx=cvs.getContext('2d')!; ctx.fillStyle=p.team==='dawn'?'#0f172a':'#fff'; ctx.fillRect(0,0,128,128); ctx.font='bold 72px serif'; ctx.textAlign='center'; ctx.fillStyle=p.team==='dawn'?'#FFD700':'#7a0000'; ctx.fillText(pieceSymbol(p.type,p.team),64,86);
        const tex=new THREE.CanvasTexture(cvs); tex.needsUpdate=true;
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex})); sprite.position.y=1.75; sprite.scale.set(1.1,1.1,1); g.add(sprite);
        // Gold rim if selected
        if(isSel){ const rim=new THREE.Mesh(new THREE.TorusGeometry(0.78,0.08,8,20), new THREE.MeshBasicMaterial({color:0xFFD700})); rim.rotation.x=Math.PI/2; rim.position.y=0.08; g.add(rim); }
        pieceGroup.add(g);
      }
    }

    const onResize=()=>{
      const w=canvas.clientWidth||1, h=canvas.clientHeight||1;
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    };
    onResize(); window.addEventListener('resize', onResize);

    const onPointer=(e: PointerEvent)=>{
      const rect=canvas.getBoundingClientRect();
      mouse.x=((e.clientX-rect.left)/rect.width)*2-1; mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const hits=raycaster.intersectObjects(scene.children, true);
      // find tile
      let hitPos: BoardPos|null=null;
      for(const h of hits){
        let o: any = h.object;
        while(o){
          if(o.userData && typeof o.userData.r==='number') { hitPos={r:o.userData.r, c:o.userData.c}; break; }
          o=o.parent;
        }
        if(hitPos) break;
      }
      if(!hitPos) return;
      handleClick(hitPos);
    };
    canvas.addEventListener('pointerdown', onPointer as any);

    function handleClick(pos: BoardPos){
      const b=boardRef.current; const sel=selectedRef.current; const mvs=movesRef.current;
      const piece=b[pos.r][pos.c];
      // Click on legal move
      if(sel && mvs.some(m=>m.r===pos.r && m.c===pos.c)){
        doMove(sel, pos);
        return;
      }
      // Select own piece
      if(piece && piece.team===turn){
        selectedRef.current=pos; setSelected(pos);
        const m=legalMoves(b,pos);
        movesRef.current=m; setMoves(m);
        sound.playPing('select'); haptics.tick();
        rebuildPieces(b,pos,m);
      } else {
        selectedRef.current=null; setSelected(null); movesRef.current=[]; setMoves([]);
        rebuildPieces(b,null,[]);
      }
    }

    function doMove(from:BoardPos, to:BoardPos){
      const b=cloneBoard(boardRef.current);
      const moving=b[from.r][from.c]!;
      const target=b[to.r][to.c];
      const isCapture=!!target;
      const isPawnPromo = moving.type==='pawn' && (to.r===0 || to.r===7);
      b[to.r][to.c]= isPawnPromo ? { id:moving.id+'-promoted', type:'queen', team:moving.team, heroId: 'argent' } : moving;
      b[from.r][from.c]=null;
      // win check
      let win:string|null=null;
      if(target && target.type==='king'){
        win = moving.team==='dawn' ? 'Dawn wins — Hari captured!' : 'Dusk wins — Hari captured!';
      }
      boardRef.current=b; setBoard(b);
      // fight VFX: flash + shake
      if(isCapture){
        sound.playPing('select'); haptics.tick();
        // temporary flash
        const w=worldForTile(to.r,to.c);
        const flash=new THREE.Mesh(new THREE.CircleGeometry(TILE*0.6,20), new THREE.MeshBasicMaterial({color:0xff3b30, transparent:true, opacity:0.55, side:THREE.DoubleSide}));
        flash.rotation.x=-Math.PI/2; flash.position.set(w.x,0.06,w.z); scene.add(flash);
        let t=0; const anim=()=>{ t+=0.06; flash.material.opacity=0.55*(1-t); flash.scale.set(1+t,1,1+t); if(t<1) requestAnimationFrame(anim); else scene.remove(flash); };
        anim();
        setCaptured(prev=>[...prev, target!]);
        setLog(`${PIECE_LABEL[moving.type]} ${String.fromCharCode(97+from.c)}${8-from.r} → ${String.fromCharCode(97+to.c)}${8-to.r} ⚔️ captured ${PIECE_LABEL[target!.type]}!`);
        if(win){ setWinner(win); setLog(win); }
      } else {
        setLog(`${PIECE_LABEL[moving.type]} to ${String.fromCharCode(97+to.c)}${8-to.r}`);
      }
      selectedRef.current=null; setSelected(null); movesRef.current=[]; setMoves([]);
      if(!win) setTurn(prev=> prev==='dawn'?'dusk':'dawn');
      rebuildPieces(b,null,[]);
    }

    // initial rebuild + loop
    rebuildPieces(boardRef.current,null,[]);
    const clock={t:0};
    const loop=()=>{
      if(disposed) return;
      raf=requestAnimationFrame(loop);
      clock.t+=0.016;
      selectRing.rotation.z+=0.02;
      renderer.render(scene,camera);
    }; loop();

    return ()=>{
      disposed=true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); canvas.removeEventListener('pointerdown', onPointer as any);
      renderer.dispose(); scene.traverse((n:any)=>{ if(n.geometry) n.geometry.dispose(); if(n.material){ const mats=Array.isArray(n.material)?n.material:[n.material]; mats.forEach((m:any)=>m.dispose()); }});
    };
  }, [turn]);

  return (
    <div style={{width:'100%',height:'100dvh',background:'#020617',display:'flex',flexDirection:'column'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',background:'rgba(11,17,32,0.92)',borderBottom:'1px solid rgba(255,255,255,0.08)',color:'#FFF'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:900,letterSpacing:1.2}}>ALAMAT CHESS</span>
          <span style={{fontSize:12,background: turn==='dawn'?'rgba(255,215,0,0.18)':'rgba(239,68,68,0.18)', border:`1px solid ${turn==='dawn'?'#FFD700':'#ef4444'}`, color: turn==='dawn'?'#FFD700':'#f87171', padding:'2px 8px', borderRadius:999, fontWeight:800}}>{turn.toUpperCase()} TO MOVE</span>
          {winner && <span style={{background:'#10b981',color:'#fff',padding:'2px 8px',borderRadius:999,fontWeight:800,fontSize:12}}>{winner}</span>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{ setBoard(initialBoard()); boardRef.current=initialBoard(); setTurn('dawn'); setSelected(null); setMoves([]); setCaptured([]); setWinner(null); setLog('New battle — Dawn to move'); }} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',color:'#FFF',padding:'6px 12px',borderRadius:999,cursor:'pointer',fontWeight:700}}>New Game</button>
          <a href="/" style={{background:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#FFF',padding:'6px 12px',borderRadius:999,textDecoration:'none',fontWeight:800}}>Lobby</a>
        </div>
      </header>
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 280px',minHeight:0}}>
        <div style={{position:'relative',minHeight:0}}>
          <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} />
          <div style={{position:'absolute',left:10,top:10,background:'rgba(15,23,42,0.82)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'8px 10px',color:'#CBD5E1',fontSize:12,backdropFilter:'blur(8px)'}}>
            <div style={{fontWeight:800,color:'#FFD700',marginBottom:4}}>How to play</div>
            <div>Tap your piece (gold ring) → cyan dots = legal moves</div>
            <div>Capture = ⚔️ fight burst</div>
            <div style={{marginTop:6,color:'#94A3B8'}}>King=Zenith, Queen=Argent, Rook=Bedrock, Bishop=Willow, Knight=Hollow, Pawn=Veer</div>
          </div>
        </div>
        <aside style={{background:'rgba(15,23,42,0.96)',borderLeft:'1px solid rgba(255,255,255,0.08)',padding:12,overflowY:'auto',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:'rgba(30,41,59,0.6)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:10}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:0.8,color:'#94A3B8'}}>BATTLE LOG</div>
            <div style={{marginTop:6,fontSize:13,color:'#F1F5F9',fontWeight:600}}>{log}</div>
            {selected && <div style={{marginTop:6,fontSize:12,color:'#00E5FF'}}>Selected {String.fromCharCode(97+selected.c)}{8-selected.r} → {moves.length} moves</div>}
          </div>
          <div style={{background:'rgba(30,41,59,0.6)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:10}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:0.8,color:'#94A3B8'}}>CAPTURED (FIGHT WINS)</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
              {captured.length===0 ? <span style={{fontSize:12,color:'#64748B'}}>No captures yet — move to fight</span> : captured.map((p,i)=>(
                <span key={i} title={`${p.team} ${p.type}`} style={{background: p.team==='dawn'?'rgba(255,215,0,0.14)':'rgba(239,68,68,0.14)', border:`1px solid ${p.team==='dawn'?'#FFD700':'#ef4444'}`, color:p.team==='dawn'?'#FFD700':'#fca5a5', padding:'4px 8px', borderRadius:999, fontSize:12, fontWeight:700}}>{pieceSymbol(p.type,p.team)} {PIECE_LABEL[p.type]}</span>
              ))}
            </div>
          </div>
          <div style={{background:'rgba(30,41,59,0.6)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:10}}>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:0.8,color:'#94A3B8'}}>PIECE LEGEND</div>
            {(['king','queen','rook','bishop','knight','pawn'] as const).map(t=>(
              <div key={t} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:6}}>
                <span style={{color:'#F1F5F9',fontWeight:700}}>{PIECE_LABEL[t]} ({t})</span>
                <span style={{color:'#94A3B8'}}>{HEROES.find(h=>h.id=== (t==='king'?'zenith':t==='queen'?'argent':t==='rook'?'bedrock':t==='bishop'?'willow':t==='knight'?'hollow':'veer'))?.name}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

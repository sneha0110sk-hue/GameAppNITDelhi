import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, increment, runTransaction } from 'firebase/firestore';
import { Heart, Diamond, Club, Spade, RotateCcw, Pencil, Check, X, LogOut, UserCircle, Play, Eye, EyeOff } from 'lucide-react';

// --- STYLES ---
const styles = `
.game-table {
  background: radial-gradient(circle at center, #35654d 0%, #1a472a 70%, #0f2918 100%);
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
}
.game-table::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("https://www.transparenttextures.com/patterns/felt.png");
  opacity: 0.4;
  pointer-events: none;
}
.card-base {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: -1px 1px 3px rgba(0,0,0,0.3);
  transform-style: preserve-3d;
}
.card-hover:hover {
  transform: translateY(-15px) scale(1.05) !important;
  box-shadow: 0 10px 20px rgba(0,0,0,0.4);
  z-index: 50;
}
.card-pattern {
  background-color: #1e3a8a;
  background-image: radial-gradient(#3b82f6 15%, transparent 16%),
  radial-gradient(#3b82f6 15%, transparent 16%);
  background-size: 8px 8px;
  background-position: 0 0, 4px 4px;
}
.glass-panel {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
.glass-btn {
  background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.2s;
}
.glass-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.2);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}
@keyframes dealCard {
  from { opacity: 0; transform: translateY(-100px) scale(0.5); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-deal {
  animation: dealCard 0.4s ease-out forwards;
}
@keyframes pulse-gold {
  0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255, 215, 0, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
}
.glow-gold {
  animation: pulse-gold 2s infinite;
}
@media (max-height: 500px) and (orientation: landscape) {
  .player-avatar { transform: scale(0.7); }
  .hand-container { bottom: -10px; }
}
`;

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: 'AIzaSyCeptMaJH4tukZcHyCUZxoSkRb-nS2Sd48',
  authDomain: 'card-game-nitdelhi.firebaseapp.com',
  projectId: 'card-game-nitdelhi',
  storageBucket: 'card-game-nitdelhi.firebasestorage.app',
  messagingSenderId: '84315014098',
  appId: '1:84315014098:web:a67396e168fe494864be0b',
  measurementId: 'G-XFW3DCCRJT',
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.error("Firebase init error:", err);
}

const APP_ID = 'court-piece-production-v1';

// --- CONSTANTS & HELPERS ---
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

const generateDeck = () => {
  const deck = [];
  SUITS.forEach(suit => RANKS.forEach(rank => deck.push({ suit, rank, value: RANK_VALUES[rank], id: `${rank}${suit}` })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const getSuitIcon = (suit, size = 16) => {
  const className = suit === 'H' || suit === 'D' ? "text-red-600 drop-shadow-sm" : "text-gray-900 drop-shadow-sm";
  switch (suit) {
    case 'H': return <Heart size={size} className={`${className} fill-current`} />;
    case 'D': return <Diamond size={size} className={`${className} fill-current`} />;
    case 'S': return <Spade size={size} className={`${className} fill-current`} />;
    case 'C': return <Club size={size} className={`${className} fill-current`} />;
    default: return null;
  }
};

const Card = ({ card, faceDown = false, onClick, playable = false, isSmall = false, index = 0, total = 1, dealDelay = 0 }) => {
  const rotation = total > 1 ? (index - (total - 1) / 2) * 5 : 0;
  const translateY = total > 1 ? Math.abs(index - (total - 1) / 2) * 2 : 0;

  // REVERTED SIZES: Back to a balanced standard size to prevent overlap
  const smallClasses = 'w-8 h-11 md:w-12 md:h-16 text-[8px] md:text-xs';
  const normalClasses = 'w-14 h-20 md:w-20 md:h-28 text-xs md:text-base';

  const animationStyle = { animationDelay: `${dealDelay}s` };

  if (faceDown) {
    return (
      <div 
        onClick={playable ? onClick : undefined} 
        style={{ ...animationStyle, transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
        className={`card-base card-pattern rounded-md border border-white/50 ${isSmall ? smallClasses : normalClasses} ${playable ? 'cursor-pointer card-hover ring-2 ring-yellow-400' : ''} flex items-center justify-center relative animate-deal`}
      >
        <div className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-sm"></div>
      </div>
    );
  }
  if (!card) return <div className={`${isSmall ? smallClasses : normalClasses} border-2 border-dashed border-white/20 rounded-md`}></div>;
  const isRed = card.suit === 'H' || card.suit === 'D';
  return (
    <div 
      onClick={playable ? onClick : undefined} 
      style={{ ...animationStyle, transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
      className={`card-base bg-white rounded-md flex flex-col items-center justify-between p-1 md:p-1.5 select-none relative animate-deal ${isSmall ? smallClasses : normalClasses} ${playable ? 'cursor-pointer card-hover ring-2 md:ring-4 ring-yellow-400 z-10' : ''}`}
    >
      <div className="self-start font-bold leading-none flex flex-col items-center"><span className={isRed ? 'text-red-600' : 'text-black'}>{card.rank}</span><div className="scale-75 origin-top">{getSuitIcon(card.suit, 10)}</div></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">{getSuitIcon(card.suit, isSmall ? 12 : 24)}</div>
      <div className="self-end font-bold leading-none rotate-180 flex flex-col items-center"><span className={isRed ? 'text-red-600' : 'text-black'}>{card.rank}</span><div className="scale-75 origin-top">{getSuitIcon(card.suit, 10)}</div></div>
    </div>
  );
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Game Crashed</h1>
          <button onClick={() => window.location.reload()} className="bg-white text-red-900 px-6 py-3 rounded font-bold shadow-lg hover:bg-gray-200">Reload Game</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// --- GAME COMPONENT ---
function GameApp() {
  const [user, setUser] = useState(null);
  const [gameId, setGameId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  
  // UI State for toggling the board view during bidding
  const [viewingBoard, setViewingBoard] = useState(false);

  useEffect(() => { if (auth) return onAuthStateChanged(auth, setUser); }, []);

  // --- AUTH ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); setError(''); }
    catch (err) { setError("Google Login Failed: " + err.message); }
    setLoading(false);
  };
  const handleGuestLogin = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); setError(''); }
    catch (err) { setError("Guest Login Failed: " + err.message); }
    setLoading(false);
  };
  const handleSignOut = async () => { await signOut(auth); setGameState(null); setGameId(''); };

  // --- SYNC ---
  useEffect(() => {
    if (!user || !gameId || !db) return;
    const unsubscribe = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) { 
        setGameState(snap.data()); 
        setError(''); 
      } else { if (gameId.length > 5) setError("Game not found. Check code."); }
    }, (err) => console.error(err));
    return () => unsubscribe();
  }, [user, gameId]);

  // Reset view board state when turn changes
  useEffect(() => {
    setViewingBoard(false);
  }, [gameState?.currentTurnIndex]);

  // --- ACTIONS ---
  const createGame = async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
      const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', newId), {
        id: newId, hostId: user.uid, status: 'LOBBY',
        players: [{ uid: user.uid, name: user.displayName || 'Player 1', photo: user.photoURL, team: 'A', seatIndex: 0, hand:[], faceUp:[], faceDown:[] }],
        deck: [], currentTurnIndex: 0, dealerIndex: 0,
        bid: { winnerIndex: null, amount: 0, suit: null, currentHighBid: 0, passedPlayers: [] },
        trick: [], scores: { A: 0, B: 0 }
      });
      setGameId(newId);
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  const joinGame = async () => {
    if (!user || !gameId || !db) return;
    setLoading(true);
    const gameRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game not found! Check code.";
        const data = gameDoc.data();
        
        if (data.players.some(p => p.uid === user.uid)) throw "ALREADY_JOINED";
        if (data.players.length >= 6) throw "Game Full!";
        
        const idx = data.players.length;
        const newPlayer = { 
          uid: user.uid, 
          name: user.displayName || `Player ${idx+1}`, 
          photo: user.photoURL, 
          team: idx % 2 === 0 ? 'A' : 'B', 
          seatIndex: idx, 
          hand:[], faceUp:[], faceDown:[] 
        };
        transaction.update(gameRef, { players: [...data.players, newPlayer] });
      });
    } catch (err) { 
      if (err === "ALREADY_JOINED") alert("You are already in this game!");
      else if (typeof err === 'string') alert(err);
      else alert("Connection Error: " + err.message); 
    }
    setLoading(false);
  };

  const addBot = async () => {
    if (!user || !gameId || !db) return;
    setLoading(true);
    const gameRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game not found!";
        const data = gameDoc.data();
        if (data.players.length >= 6) throw "Game is full!";
        
        const idx = data.players.length;
        const botId = `bot-${Date.now()}`;
        const newPlayer = { 
          uid: botId, 
          name: `Bot ${idx+1}`, 
          photo: null,
          team: idx % 2 === 0 ? 'A' : 'B', 
          seatIndex: idx, 
          hand:[], faceUp:[], faceDown:[] 
        };
        transaction.update(gameRef, { players: [...data.players, newPlayer] });
      });
    } catch (err) { alert(err); }
    setLoading(false);
  };

  const startGame = async () => {
    const deck = generateDeck();
    const players = [...gameState.players];
    players.forEach((p, i) => {
      const s = i * 8;
      p.faceDown = deck.slice(s, s+3); p.faceUp = deck.slice(s+3, s+6); p.hand = deck.slice(s+6, s+8);
    });
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), {
      status: 'BIDDING', players, currentTurnIndex: 0, 'bid.currentHighBid': 0
    });
  };

  // Game logic functions
  const updatePlayerName = async () => {
    if (!user || !gameId || !editingName.trim()) return;
    const updatedPlayers = gameState.players.map(p => p.uid === user.uid ? { ...p, name: editingName.trim() } : p);
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), { players: updatedPlayers });
    setIsEditingName(false);
  };
  
  const makeBid = async (a) => {
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
    const myIndex = mySeatIndex;
    if (a === 0) {
      const passed = [...(gameState.bid?.passedPlayers || []), myIndex];
      let updates = { 'bid.passedPlayers': passed, currentTurnIndex: (gameState.currentTurnIndex + 1) % 6 };
      if (passed.length === 5 && (gameState.bid?.currentHighBid || 0) > 0) {
        updates['bid.winnerIndex'] = gameState.bid.currentHighBidder; updates['bid.amount'] = gameState.bid.currentHighBid;
      } else if (passed.length === 6) { updates['bid.winnerIndex'] = gameState.dealerIndex; updates['bid.amount'] = 5; }
      await updateDoc(ref, updates);
    } else { await updateDoc(ref, { 'bid.currentHighBid': a, 'bid.currentHighBidder': myIndex, currentTurnIndex: (gameState.currentTurnIndex + 1) % 6 }); }
  };
  
  const selectMasterSuit = async (s) => await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), { 'bid.suit': s, status: 'PLAYING', currentTurnIndex: gameState.bid.winnerIndex });
  
  const playCard = async (c, s) => {
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
    const myIdx = mySeatIndex;
    const p = gameState.players[myIdx];
    const ls = gameState.trick.length > 0 ? gameState.trick[0].card.suit : null;
    const hv = ls ? [...p.hand, ...p.faceUp].some(cd => cd.suit === ls) : false;
    if (s === 'faceDown' && (p.hand.length > 0 || p.faceUp.length > 0) && !(!hv && ls)) { alert("Cannot play blind!"); return; }
    if (s !== 'faceDown' && ls && hv && c.suit !== ls) { alert(`Must follow ${ls}!`); return; }
    const up = { ...p };
    up[s] = up[s].filter(cd => cd.id !== c.id);
    const nt = [...gameState.trick, { card: c, playerIndex: myIdx }];
    let updates = { [`players.${myIdx}`]: up, trick: nt, currentTurnIndex: (gameState.currentTurnIndex + 1) % 6 };
    if (nt.length === 6) {
      let widx = 0, wcard = nt[0].card, trump = gameState.bid?.suit;
      for (let i=1; i<6; i++) {
        const nc = nt[i].card;
        if (nc.suit === trump && wcard.suit !== trump) { wcard = nc; widx = i; }
        else if (nc.suit === wcard.suit && nc.value > wcard.value) { wcard = nc; widx = i; }
      }
      const winPid = nt[widx].playerIndex;
      updates[`scores.${gameState.players[winPid].team}`] = increment(1);
      updates['trick'] = [];
      updates['currentTurnIndex'] = winPid;
    }
    await updateDoc(ref, updates);
  };

  // --- CALCULATED STATE ---
  const amIJoined = useMemo(() => gameState?.players.some(p => p.uid === user?.uid), [gameState, user]);
  const mySeatIndex = useMemo(() => {
    const idx = gameState?.players.findIndex(p => p.uid === user?.uid);
    return idx !== -1 ? idx : 0; 
  }, [gameState, user]);
  
  const getPlayer = (offset) => {
    if (!gameState) return null;
    const targetSeat = (mySeatIndex + offset) % 6;
    return gameState.players.find(p => p.seatIndex === targetSeat);
  };

  if (loading) return <><style>{styles}</style><div className="game-table min-h-screen text-white flex items-center justify-center font-serif text-2xl flex-col gap-4"><div className="animate-spin text-gold"><RotateCcw size={48}/></div>Processing...</div></>;
  if (!user) return <><style>{styles}</style><div className="game-table min-h-screen text-white flex flex-col items-center justify-center p-4"><div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center"><h1 className="text-4xl md:text-5xl font-serif text-gold mb-8">Royal Court</h1><div className="space-y-4"><button onClick={handleGoogleLogin} className="w-full bg-white text-gray-900 font-bold py-3 rounded-lg flex justify-center gap-2"><img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5"/>Login with Google</button><button onClick={handleGuestLogin} className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2"><UserCircle size={20}/>Play as Guest</button></div>{error && <div className="mt-4 text-red-300 text-sm">{error}</div>}</div></div></>;

  // --- LOBBY ---
  if (!gameState || gameState.status === 'LOBBY') {
    return (
      <>
        <style>{styles}</style>
        <div className="game-table min-h-screen text-white flex flex-col items-center justify-center p-4">
          <div className="glass-panel p-6 md:p-8 rounded-2xl max-w-md w-full text-center relative">
            <button onClick={handleSignOut} className="absolute top-4 right-4 text-gray-400 hover:text-white"><LogOut size={20}/></button>
            <h1 className="text-3xl md:text-5xl font-serif text-gold mb-6 drop-shadow-lg">Royal Court</h1>
            {error && <div className="bg-red-900/50 text-red-200 p-2 rounded mb-4 text-sm">{error}</div>}

            {!gameState && (
              <div className="space-y-4">
                <div className="text-sm text-gray-300 mb-2 flex justify-center gap-2 items-center">
                  {user.photoURL && <img src={user.photoURL} className="w-6 h-6 rounded-full"/>}
                  <span className="text-gold font-bold">{user.displayName || 'Guest'}</span>
                </div>
                <button onClick={createGame} className="w-full bg-gold text-black font-bold py-3 rounded-lg shadow-lg">Create Table</button>
                <div className="flex gap-2">
                  <input type="text" placeholder="ENTER CODE" className="flex-1 bg-black/40 border border-white/20 rounded px-3 text-center uppercase" value={gameId} onChange={e=>setGameId(e.target.value.toUpperCase().trim())} />
                </div>
              </div>
            )}

            {gameState && !amIJoined && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-black/40 p-4 rounded-xl border border-green-500/50">
                  <div className="text-green-400 font-bold mb-2">Table Found!</div>
                  <div className="text-2xl font-mono text-gold tracking-widest mb-4">{gameState.id}</div>
                  <div className="text-sm text-gray-300 mb-4">Players: {gameState.players.length} / 6</div>
                  <button onClick={joinGame} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                    <Check size={24} /> SIT DOWN & JOIN
                  </button>
                </div>
                <button onClick={()=>setGameId('')} className="text-sm text-gray-400 underline">Cancel</button>
              </div>
            )}

            {gameState && amIJoined && (
              <div className="space-y-6 animate-in zoom-in">
                <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                  <div className="text-sm text-gray-400">Share Code</div>
                  <div className="text-2xl md:text-3xl font-mono text-gold tracking-widest select-all">{gameState.id}</div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {gameState.players.map((p,i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded text-sm md:text-base">
                      {isEditingName && p.uid === user.uid ? (
                         <div className="flex gap-2 flex-1 items-center">
                           <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1 bg-black/50 border border-white/30 rounded px-2 py-1 text-white" autoFocus />
                           <button onClick={updatePlayerName} className="text-green-400"><Check size={16} /></button>
                           <button onClick={() => setIsEditingName(false)} className="text-red-400"><X size={16} /></button>
                         </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {p.photo && <img src={p.photo} className="w-6 h-6 rounded-full border border-gold/50"/>}
                          <span>{p.name} {p.uid === user.uid && '(You)'}</span>
                          {p.uid === user.uid && <button onClick={() => { setEditingName(p.name); setIsEditingName(true); }} className="text-gray-400 hover:text-white"><Pencil size={12}/></button>}
                        </div>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${p.team==='A'?'bg-red-900/50':'bg-blue-900/50'}`}>Team {p.team}</span>
                    </div>
                  ))}
                </div>
                {gameState.hostId === user.uid ? (
                  <div className="flex flex-col gap-2">
                    <button disabled={gameState.players.length>=6} onClick={addBot} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 rounded shadow flex justify-center gap-2 items-center">
                      <UserCircle size={20}/> Add Bot
                    </button>
                    <button disabled={gameState.players.length<6} onClick={startGame} className="w-full bg-green-600 disabled:bg-gray-600 py-3 rounded font-bold shadow-lg text-sm md:text-base flex justify-center gap-2"><Play size={20}/> START GAME ({gameState.players.length}/6)</button>
                  </div>
                ) : (
                  <div className="text-yellow-400 animate-pulse text-sm">Waiting for Host to Start...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // --- GAMEPLAY UI ---
  const positions = [
    "bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-30", // Me
    "bottom-28 right-0 md:bottom-32 md:right-8 scale-75 md:scale-100 origin-bottom-right", // P1
    "top-28 right-0 md:top-32 md:right-8 scale-75 md:scale-100 origin-top-right", // P2
    "top-14 md:top-8 left-1/2 -translate-x-1/2 origin-top", // P3
    "top-28 left-0 md:top-32 md:left-8 scale-75 md:scale-100 origin-top-left", // P4
    "bottom-28 left-0 md:bottom-32 md:left-8 scale-75 md:scale-100 origin-bottom-left" // P5
  ];

  // Safe Accessors
  const currentBid = gameState.bid?.currentHighBid || 0;
  const bidSuit = gameState.bid?.suit;
  const winnerIndex = gameState.bid?.winnerIndex;
  const isMyTurn = gameState?.currentTurnIndex === mySeatIndex;

  return (
    <>
      <style>{styles}</style>
      <div className="game-table text-white font-sans select-none">
        <div className="absolute top-0 left-0 right-0 p-2 md:p-4 flex justify-between items-start z-50 pointer-events-none">
          <div className="glass-panel p-2 md:p-3 rounded-xl pointer-events-auto">
            <div className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider mb-1">Score</div>
            <div className="flex gap-3 md:gap-6 font-serif text-sm md:text-xl">
              <span className="text-red-300">A: <b className="text-white">{(gameState.scores || {}).A || 0}</b></span>
              <span className="text-blue-300">B: <b className="text-white">{(gameState.scores || {}).B || 0}</b></span>
            </div>
          </div>
          {bidSuit && (
            <div className="glass-panel px-4 py-1 md:px-6 md:py-2 rounded-b-xl md:rounded-b-2xl -mt-2 md:-mt-4 flex flex-col items-center pointer-events-auto border-t-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <div className="text-gold text-[10px] md:text-xs uppercase mb-1">Master</div>
              <div className="bg-white rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-inner">{getSuitIcon(bidSuit, 20)}</div>
              <div className="text-[10px] md:text-xs mt-1 font-bold">Bid: {gameState.bid?.amount}</div>
            </div>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center perspective-[1000px]">
          {[0, 1, 2, 3, 4, 5].map(offset => {
            const player = getPlayer(offset);
            if (!player) return null;
            const isMe = offset === 0;
            const isActive = gameState.currentTurnIndex === player.seatIndex;
            
            // Calculate delay based on player sequence
            const dealDelay = (player.seatIndex * 8) * 0.05;

            return (
              <div key={offset} className={`absolute ${positions[offset]} flex flex-col items-center transition-all duration-500`}>
                <div className={`relative mb-2 md:mb-4 transition-all duration-300 ${isActive ? 'scale-110 md:scale-125 z-40' : 'scale-100 z-10 opacity-80'}`}>
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-serif text-sm md:text-xl font-bold shadow-2xl border-2 overflow-hidden ${player.team === 'A' ? 'bg-gradient-to-br from-red-900 to-red-700 border-red-400' : 'bg-gradient-to-br from-blue-900 to-blue-700 border-blue-400'} ${isActive ? 'glow-gold ring-2 ring-gold' : ''}`}>
                    {player.photo ? <img src={player.photo} className="w-full h-full object-cover"/> : player.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-4 md:-bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] md:text-xs whitespace-nowrap border border-white/10">{isMe ? 'YOU' : player.name}</div>
                </div>
                {isMe ? (
                  <div className="flex flex-col items-center -space-y-16 md:-space-y-24 transition-all duration-300 pb-2 md:pb-4">
                    <div className="flex gap-2 md:gap-4 opacity-90 mb-8">{(player.faceDown || []).filter(c=>c&&c.id).map((c,i)=><Card key={c.id} dealDelay={dealDelay + i*0.05} faceDown isSmall playable={isActive && player.hand.length===0 && player.faceUp.length===0} onClick={()=>playCard(c,'faceDown')}/>)}</div>
                    <div className="flex gap-2 md:gap-4 z-10 mb-8 md:mb-12">{(player.faceUp || []).filter(c=>c&&c.id).map((c,i)=><Card key={c.id} dealDelay={dealDelay + 3*0.05 + i*0.05} card={c} playable={isActive} onClick={()=>playCard(c,'faceUp')}/>)}</div>
                    <div className="flex -space-x-3 md:-space-x-4 h-24 md:h-32 items-end z-20 hover:-space-x-1 transition-all">{(player.hand || []).filter(c=>c&&c.id).map((c,i)=><Card key={c.id} dealDelay={dealDelay + 6*0.05 + i*0.05} card={c} index={i} total={player.hand.length} playable={isActive} onClick={()=>playCard(c,'hand')}/>)}</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center -space-y-3 md:-space-y-4 scale-100 opacity-60">
                     <div className="flex gap-0.5 md:gap-1">{(player.faceDown || []).map((_,i)=><Card key={i} dealDelay={dealDelay + i*0.05} faceDown isSmall/>)}</div>
                     <div className="flex gap-0.5 md:gap-1 z-10">{(player.faceUp || []).map((c,i)=><Card key={i} dealDelay={dealDelay + 3*0.05 + i*0.05} card={c} isSmall/>)}</div>
                     <div className="flex gap-0.5 md:gap-1 z-20">{(player.hand || []).map((_,i)=><Card key={i} dealDelay={dealDelay + 6*0.05 + i*0.05} faceDown isSmall/>)}</div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="w-32 h-32 md:w-64 md:h-64 relative flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-white/5 rounded-full animate-pulse"></div>
            {(gameState.trick || []).filter(p => p && p.card).map((play, i) => {
              const relIdx = (play.playerIndex - mySeatIndex + 6) % 6;
              const rotations = [0, -60, -120, 180, 120, 60];
              return (<div key={i} className="absolute animate-deal" style={{ transform: `rotate(${rotations[relIdx]}deg) translateY(-40px) scale(0.8)` }}><div className="md:scale-125 origin-center"><Card card={play.card}/></div></div>);
            })}
          </div>
        </div>
        
        {/* BIDDING UI - NOW WITH TOGGLE */}
        {gameState.status === 'BIDDING' && isMyTurn && !bidSuit && (
          <>
            {/* 1. MINIMIZED STATE (Just a button to bring back UI) */}
            {viewingBoard ? (
              <div className="absolute bottom-8 left-4 z-50 md:bottom-10 md:left-10">
                <button onClick={() => setViewingBoard(false)} className="bg-blue-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-blue-500 transition animate-bounce text-sm md:text-base">
                  <RotateCcw size={16} className="md:w-5 md:h-5"/> Open Bidding
                </button>
              </div>
            ) : (
              /* 2. MAXIMIZED STATE (The full UI) */
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in p-4">
                <div className="glass-panel p-4 md:p-8 rounded-2xl text-center border-gold border-2 max-w-sm w-full relative">
                  
                  {/* TOGGLE BUTTON */}
                  <button 
                    onClick={() => setViewingBoard(true)} 
                    className="absolute top-2 right-2 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 flex flex-col items-center gap-1"
                    title="Hide to see cards"
                  >
                    <Eye size={24} />
                    <span className="text-[10px]">View Table</span>
                  </button>

                  {winnerIndex === mySeatIndex ? (
                     <div><h2 className="text-xl md:text-3xl font-serif text-gold mb-4 md:mb-6">Choose Master Suit</h2><div className="flex gap-2 md:gap-4 justify-center">{SUITS.map(s=><button key={s} onClick={()=>selectMasterSuit(s)} className="bg-white p-2 md:p-4 rounded-xl hover:scale-110 transition shadow-lg">{getSuitIcon(s,32)}</button>)}</div></div>
                  ) : (
                    <div><h2 className="text-xl md:text-2xl font-serif mb-2">Place Bid</h2><div className="text-gold mb-4 md:mb-6">Current High: {currentBid}</div><div className="grid grid-cols-4 gap-2 mb-4">{[5,6,7,8].map(n=><button key={n} disabled={n<=currentBid} onClick={()=>makeBid(n)} className="bg-gold text-black font-bold py-2 md:py-3 rounded hover:bg-yellow-300 disabled:opacity-20 transition">{n}</button>)}</div><button onClick={()=>makeBid(0)} className="w-full bg-white/10 hover:bg-red-900/50 py-2 md:py-3 rounded text-red-300 border border-red-900/30">PASS</button></div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

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
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { Heart, Diamond, Club, Spade, RotateCcw, Pencil, Check, X, LogOut, UserCircle } from 'lucide-react';

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

// --- CONSTANTS ---
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

// --- HELPERS ---
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

// --- CARD COMPONENT ---
const Card = ({ card, faceDown = false, onClick, playable = false, isSmall = false, index = 0, total = 1 }) => {
  const rotation = total > 1 ? (index - (total - 1) / 2) * 5 : 0;
  const translateY = total > 1 ? Math.abs(index - (total - 1) / 2) * 2 : 0;

  if (faceDown) {
    return (
      <div 
        onClick={playable ? onClick : undefined}
        style={{ transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
        className={`card-base card-pattern rounded-md border border-white/50
          ${isSmall ? 'w-6 h-9 md:w-8 md:h-12' : 'w-12 h-16 md:w-20 md:h-28'} 
          ${playable ? 'cursor-pointer card-hover ring-2 ring-yellow-400' : ''}
          flex items-center justify-center relative`}
      >
        <div className="w-4 h-4 rounded-full bg-white/20 backdrop-blur-sm"></div>
      </div>
    );
  }

  if (!card) return <div className={`${isSmall ? 'w-6 h-9 md:w-8 md:h-12' : 'w-12 h-16 md:w-20 md:h-28'} border-2 border-dashed border-white/20 rounded-md`}></div>;
  const isRed = card.suit === 'H' || card.suit === 'D';

  return (
    <div 
      onClick={playable ? onClick : undefined}
      style={{ transform: `rotate(${rotation}deg) translateY(${translateY}px)` }}
      className={`card-base bg-white rounded-md flex flex-col items-center justify-between p-0.5 md:p-1 select-none relative
        ${isSmall ? 'w-6 h-9 md:w-8 md:h-12 text-[8px] md:text-xs' : 'w-12 h-16 md:w-20 md:h-28 text-xs md:text-base'} 
        ${playable ? 'cursor-pointer card-hover ring-2 md:ring-4 ring-yellow-400 z-10' : ''}`}
    >
      <div className="self-start font-bold leading-none flex flex-col items-center">
        <span className={isRed ? 'text-red-600' : 'text-black'}>{card.rank}</span>
        <div className="scale-75 origin-top">{getSuitIcon(card.suit, 8)}</div>
      </div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {getSuitIcon(card.suit, isSmall ? 10 : 20)}
      </div>
      <div className="self-end font-bold leading-none rotate-180 flex flex-col items-center">
        <span className={isRed ? 'text-red-600' : 'text-black'}>{card.rank}</span>
        <div className="scale-75 origin-top">{getSuitIcon(card.suit, 8)}</div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [gameId, setGameId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  // --- AUTH LOGIC ---
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setError('');
    } catch (err) {
      console.error(err);
      setError("Google Login Failed: " + err.message);
    }
    setLoading(false);
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
      setError('');
    } catch (err) {
      setError("Guest Login Failed: " + err.message);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setGameState(null);
    setGameId('');
  };

  // --- GAME SYNC ---
  useEffect(() => {
    if (!user || !gameId || !db) return;
    const unsubscribe = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) {
        setGameState(snap.data());
        setError('');
      } else {
        if (gameId.length > 5) setError("Game not found. Check the code.");
      }
    }, (err) => {
      console.error("Snapshot error:", err);
      setError("Connection lost. Reconnecting...");
    });
    return () => unsubscribe();
  }, [user, gameId]);

  // --- ACTIONS ---
  const createGame = async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
      const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
      // Use Google Display Name if available, otherwise default
      const userName = user.displayName ? user.displayName : 'Player 1';
      const userPhoto = user.photoURL || null;

      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', newId), {
        id: newId, hostId: user.uid, status: 'LOBBY',
        players: [{ uid: user.uid, name: userName, photo: userPhoto, team: 'A', seatIndex: 0, hand: [], faceUp: [], faceDown: [] }],
        deck: [], currentTurnIndex: 0, dealerIndex: 0,
        bid: { winnerIndex: null, amount: 0, suit: null, currentHighBid: 0, passedPlayers: [] },
        trick: [], scores: { A: 0, B: 0 }
      });
      setGameId(newId);
    } catch (err) {
      alert("Error creating game: " + err.message);
    }
    setLoading(false);
  };

  const joinGame = async () => {
    if (!user || !gameId || !db) return;
    setLoading(true);
    try {
      const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
      const snap = await getDoc(ref);
      if (!snap.exists()) { alert("Game not found!"); setLoading(false); return; }
      
      const data = snap.data();
      const alreadyJoined = data.players.find(p => p.uid === user.uid);
      if (alreadyJoined) { setLoading(false); return; }
      if (data.players.length >= 6) { alert("Game full!"); setLoading(false); return; }

      const idx = data.players.length;
      // Use Google Display Name if available, otherwise Player X
      const userName = user.displayName ? user.displayName : `Player ${idx+1}`;
      const userPhoto = user.photoURL || null;

      await updateDoc(ref, {
        players: arrayUnion({ uid: user.uid, name: userName, photo: userPhoto, team: idx%2===0?'A':'B', seatIndex: idx, hand:[], faceUp:[], faceDown:[] })
      });
    } catch (err) {
      alert("Error joining: " + err.message);
    }
    setLoading(false);
  };

  const updatePlayerName = async () => {
    if (!user || !gameId || !editingName.trim()) return;
    const updatedPlayers = gameState.players.map(p => 
      p.uid === user.uid ? { ...p, name: editingName.trim() } : p
    );
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), { players: updatedPlayers });
    setIsEditingName(false);
  };

  const startEditing = (currentName) => { setEditingName(currentName); setIsEditingName(true); };

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

  const makeBid = async (amount) => {
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
    const myIndex = mySeatIndex;
    if (amount === 0) {
      const passed = [...(gameState.bid.passedPlayers || []), myIndex];
      let updates = { 'bid.passedPlayers': passed, currentTurnIndex: (gameState.currentTurnIndex + 1) % 6 };
      if (passed.length === 5 && gameState.bid.currentHighBid > 0) {
        updates['bid.winnerIndex'] = gameState.bid.currentHighBidder;
        updates['bid.amount'] = gameState.bid.currentHighBid;
      } else if (passed.length === 6) {
        updates['bid.winnerIndex'] = gameState.dealerIndex; updates['bid.amount'] = 5;
      }
      await updateDoc(ref, updates);
    } else {
      await updateDoc(ref, { 'bid.currentHighBid': amount, 'bid.currentHighBidder': myIndex, currentTurnIndex: (gameState.currentTurnIndex + 1) % 6 });
    }
  };

  const selectMasterSuit = async (suit) => {
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId), {
      'bid.suit': suit, status: 'PLAYING', currentTurnIndex: gameState.bid.winnerIndex
    });
  };

  const playCard = async (card, source) => {
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'games', gameId);
    const myIdx = mySeatIndex;
    const player = gameState.players[myIdx];
    const leadSuit = gameState.trick.length > 0 ? gameState.trick[0].card.suit : null;
    const hasVisibleLead = leadSuit ? [...player.hand, ...player.faceUp].some(c => c.suit === leadSuit) : false;
    
    if (source === 'faceDown' && (player.hand.length > 0 || player.faceUp.length > 0) && !(!hasVisibleLead && leadSuit)) { alert("Cannot play blind card yet!"); return; }
    if (source !== 'faceDown' && leadSuit && hasVisibleLead && card.suit !== leadSuit) { alert(`Must follow suit (${leadSuit})`); return; }

    const updatedPlayer = { ...player };
    updatedPlayer[source] = updatedPlayer[source].filter(c => c.id !== card.id);
    const newTrick = [...gameState.trick, { card, playerIndex: myIdx }];
    
    let updates = { [`players.${myIdx}`]: updatedPlayer, trick: newTrick, currentTurnIndex: (gameState.currentTurnIndex + 1) % 6 };
    
    if (newTrick.length === 6) {
      let winIdx = 0;
      let winCard = newTrick[0].card;
      const trump = gameState.bid.suit;
      for (let i=1; i<6; i++) {
        const c = newTrick[i].card;
        if (c.suit === trump && winCard.suit !== trump) { winCard = c; winIdx = i; }
        else if (c.suit === winCard.suit && c.value > winCard.value) { winCard = c; winIdx = i; }
      }
      const winnerPlayerIdx = newTrick[winIdx].playerIndex;
      const team = gameState.players[winnerPlayerIdx].team;
      updates[`scores.${team}`] = increment(1);
      updates['trick'] = [];
      updates['currentTurnIndex'] = winnerPlayerIdx;
    }
    await updateDoc(ref, updates);
  };

  // --- RENDERING ---
  const mySeatIndex = useMemo(() => gameState?.players.findIndex(p => p.uid === user?.uid) ?? -1, [gameState, user]);
  const getPlayer = (offset) => gameState ? gameState.players[(mySeatIndex + offset) % 6] : null;

  if (loading) return (
    <>
      <style>{styles}</style>
      <div className="game-table min-h-screen text-white flex items-center justify-center font-serif text-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin text-gold"><RotateCcw size={48} /></div>
          <div>Loading...</div>
        </div>
      </div>
    </>
  );

  // --- LOGIN SCREEN (New!) ---
  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <div className="game-table min-h-screen text-white flex flex-col items-center justify-center p-4">
          <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
            <h1 className="text-4xl md:text-5xl font-serif text-gold mb-8 drop-shadow-lg">Royal Court</h1>
            <div className="space-y-4">
              <button 
                onClick={handleGoogleLogin}
                className="w-full bg-white text-gray-900 font-bold py-3 rounded-lg hover:bg-gray-100 shadow-lg transition flex items-center justify-center gap-2"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
                Sign in with Google
              </button>
              <div className="text-sm text-gray-400">- OR -</div>
              <button 
                onClick={handleGuestLogin}
                className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 shadow-lg transition flex items-center justify-center gap-2"
              >
                <UserCircle size={20} />
                Play as Guest
              </button>
            </div>
            {error && <div className="mt-4 text-red-300 text-sm bg-red-900/40 p-2 rounded">{error}</div>}
          </div>
        </div>
      </>
    );
  }

  // --- LOBBY & GAME ---
  if (!gameState || gameState.status === 'LOBBY') {
    return (
      <>
        <style>{styles}</style>
        <div className="game-table min-h-screen text-white flex flex-col items-center justify-center p-4">
          <div className="glass-panel p-6 md:p-8 rounded-2xl max-w-md w-full text-center relative">
            
            {/* Sign Out Button */}
            <button 
              onClick={handleSignOut} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>

            <h1 className="text-3xl md:text-5xl font-serif text-gold mb-6 md:mb-8 drop-shadow-lg">Royal Court</h1>
            {error && <div className="bg-red-900/50 text-red-200 p-2 rounded mb-4 text-sm">{error}</div>}
            
            {!gameState ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-300 mb-2 flex items-center justify-center gap-2">
                  Logged in as: 
                  {user.photoURL && <img src={user.photoURL} className="w-6 h-6 rounded-full" alt="" />}
                  <span className="text-gold font-bold">{user.displayName || 'Guest'}</span>
                </div>
                <button onClick={createGame} className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:brightness-110 shadow-lg transition">Create Table</button>
                <div className="flex gap-2">
                  <input type="text" placeholder="CODE" className="flex-1 bg-black/40 border border-white/20 rounded px-3 text-center uppercase" value={gameId} onChange={e=>setGameId(e.target.value.toUpperCase())} />
                  <button onClick={joinGame} className="glass-btn px-4 md:px-6 py-2 rounded font-bold">Join</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                  <div className="text-sm text-gray-400">TABLE CODE</div>
                  <div className="text-2xl md:text-3xl font-mono text-gold tracking-widest select-all">{gameState.id}</div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {gameState.players.map((p,i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded text-sm md:text-base">
                      {isEditingName && p.uid === user.uid ? (
                         <div className="flex gap-2 flex-1 items-center">
                           <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1 bg-black/50 border border-white/30 rounded px-2 py-1 text-white" autoFocus />
                           <button onClick={updatePlayerName} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
                           <button onClick={() => setIsEditingName(false)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                         </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {p.photo && <img src={p.photo} className="w-6 h-6 rounded-full border border-gold/50" alt="" />}
                          <span>{p.name} {p.uid === user.uid && '(You)'}</span>
                          {p.uid === user.uid && (
                            <button onClick={() => startEditing(p.name)} className="text-gray-400 hover:text-white transition-colors"><Pencil size={12} /></button>
                          )}
                        </div>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${p.team==='A'?'bg-red-900/50':'bg-blue-900/50'}`}>Team {p.team}</span>
                    </div>
                  ))}
                </div>
                {gameState.hostId === user.uid && (
                  <button disabled={gameState.players.length<6} onClick={startGame} className="w-full bg-green-600 disabled:bg-gray-600 py-3 rounded font-bold shadow-lg text-sm md:text-base">START GAME ({gameState.players.length}/6)</button>
                )}
                <button onClick={() => window.location.reload()} className="text-xs text-gray-400 underline hover:text-white">Refresh if stuck</button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // GAME UI
  const positions = [
    "bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-30", // Me
    "bottom-28 right-0 md:bottom-32 md:right-8 scale-75 md:scale-100 origin-bottom-right", // P1
    "top-28 right-0 md:top-32 md:right-8 scale-75 md:scale-100 origin-top-right", // P2
    "top-14 md:top-8 left-1/2 -translate-x-1/2 origin-top", // P3
    "top-28 left-0 md:top-32 md:left-8 scale-75 md:scale-100 origin-top-left", // P4
    "bottom-28 left-0 md:bottom-32 md:left-8 scale-75 md:scale-100 origin-bottom-left" // P5
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="game-table text-white font-sans select-none">
        
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-2 md:p-4 flex justify-between items-start z-50 pointer-events-none">
          <div className="glass-panel p-2 md:p-3 rounded-xl pointer-events-auto">
            <div className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider mb-1">Score</div>
            <div className="flex gap-3 md:gap-6 font-serif text-sm md:text-xl">
              <span className="text-red-300">A: <b className="text-white">{gameState.scores.A}</b></span>
              <span className="text-blue-300">B: <b className="text-white">{gameState.scores.B}</b></span>
            </div>
          </div>
          
          {gameState.bid.suit && (
            <div className="glass-panel px-4 py-1 md:px-6 md:py-2 rounded-b-xl md:rounded-b-2xl -mt-2 md:-mt-4 flex flex-col items-center pointer-events-auto border-t-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <div className="text-gold text-[10px] md:text-xs uppercase mb-1">Master</div>
              <div className="bg-white rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-inner">
                {getSuitIcon(gameState.bid.suit, 20)}
              </div>
              <div className="text-[10px] md:text-xs mt-1 font-bold">Bid: {gameState.bid.amount}</div>
            </div>
          )}
        </div>

        {/* Game Area */}
        <div className="absolute inset-0 flex items-center justify-center perspective-[1000px]">
          {[0, 1, 2, 3, 4, 5].map(offset => {
            const player = getPlayer(offset);
            if (!player) return null;
            const isMe = offset === 0;
            const isActive = gameState.currentTurnIndex === player.seatIndex;

            return (
              <div key={offset} className={`absolute ${positions[offset]} flex flex-col items-center transition-all duration-500`}>
                <div className={`relative mb-2 md:mb-4 transition-all duration-300 ${isActive ? 'scale-110 md:scale-125 z-40' : 'scale-90 md:scale-100 z-10 opacity-80'}`}>
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-serif text-sm md:text-xl font-bold shadow-2xl border-2 overflow-hidden ${player.team === 'A' ? 'bg-gradient-to-br from-red-900 to-red-700 border-red-400' : 'bg-gradient-to-br from-blue-900 to-blue-700 border-blue-400'} ${isActive ? 'glow-gold ring-2 ring-gold' : ''}`}>
                    {/* Render Google Photo OR Initials */}
                    {player.photo ? (
                      <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                      player.name.charAt(0)
                    )}
                  </div>
                  <div className="absolute -bottom-4 md:-bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] md:text-xs whitespace-nowrap border border-white/10">
                    {isMe ? 'YOU' : player.name}
                  </div>
                </div>

                {isMe ? (
                  <div className="flex flex-col items-center -space-y-12 md:-space-y-16 transition-all duration-300 pb-2 md:pb-4">
                    <div className="flex gap-1 md:gap-2 opacity-90">
                      {player.faceDown.map((c) => <Card key={c.id} faceDown isSmall playable={isActive && player.hand.length===0 && player.faceUp.length===0} onClick={()=>playCard(c,'faceDown')} />)}
                    </div>
                    <div className="flex gap-1 md:gap-2 z-10 mb-2 md:mb-4">
                      {player.faceUp.map((c) => <Card key={c.id} card={c} isSmall playable={isActive} onClick={()=>playCard(c,'faceUp')} />)}
                    </div>
                    <div className="flex -space-x-3 md:-space-x-4 h-24 md:h-32 items-end z-20 hover:-space-x-1 transition-all">
                      {player.hand.map((c, i) => (
                        <Card key={c.id} card={c} index={i} total={player.hand.length} playable={isActive} onClick={()=>playCard(c,'hand')} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center -space-y-3 md:-space-y-4 scale-90 opacity-60">
                     <div className="flex gap-0.5 md:gap-1">{player.faceDown.map((_,i)=><Card key={i} faceDown isSmall/>)}</div>
                     <div className="flex gap-0.5 md:gap-1 z-10">{player.faceUp.map((c,i)=><Card key={i} card={c} isSmall/>)}</div>
                     <div className="flex gap-0.5 md:gap-1 z-20">{player.hand.map((_,i)=><Card key={i} faceDown isSmall/>)}</div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="w-32 h-32 md:w-64 md:h-64 relative flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-white/5 rounded-full animate-pulse"></div>
            {gameState.trick.map((play, i) => {
              const relIdx = (play.playerIndex - mySeatIndex + 6) % 6;
              const rotations = [0, -60, -120, 180, 120, 60];
              return (
                <div key={i} className="absolute animate-deal" style={{ transform: `rotate(${rotations[relIdx]}deg) translateY(-40px) scale(0.8)` }}>
                  <div className="md:scale-125 origin-center"><Card card={play.card} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Overlay */}
        {gameState.status === 'BIDDING' && isActive && !gameState.bid.suit && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in p-4">
            <div className="glass-panel p-4 md:p-8 rounded-2xl text-center border-gold border-2 max-w-sm w-full">
              {gameState.bid.winnerIndex === mySeatIndex ? (
                 <div>
                   <h2 className="text-xl md:text-3xl font-serif text-gold mb-4 md:mb-6">Choose Master Suit</h2>
                   <div className="flex gap-2 md:gap-4 justify-center">
                     {SUITS.map(s => <button key={s} onClick={()=>selectMasterSuit(s)} className="bg-white p-2 md:p-4 rounded-xl hover:scale-110 transition shadow-lg">{getSuitIcon(s, 32)}</button>)}
                   </div>
                 </div>
              ) : (
                <div>
                  <h2 className="text-xl md:text-2xl font-serif mb-2">Place Bid</h2>
                  <div className="text-gold mb-4 md:mb-6">Current High: {gameState.bid.currentHighBid}</div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[5,6,7,8].map(n => (
                      <button key={n} disabled={n<=gameState.bid.currentHighBid} onClick={()=>makeBid(n)} className="bg-gold text-black font-bold py-2 md:py-3 rounded hover:bg-yellow-300 disabled:opacity-20 transition">
                        {n}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>makeBid(0)} className="w-full bg-white/10 hover:bg-red-900/50 py-2 md:py-3 rounded text-red-300 border border-red-900/30">PASS</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

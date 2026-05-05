'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Play, Shuffle, ArrowLeft, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';

const GOAL_STATE = [1, 2, 3, 4, 5, 6, 7, 8, 0];

const isSolvable = (puzzle) => {
  let inversions = 0;
  for (let i = 0; i < puzzle.length - 1; i++) {
    for (let j = i + 1; j < puzzle.length; j++) {
      if (puzzle[i] !== 0 && puzzle[j] !== 0 && puzzle[i] > puzzle[j]) {
        inversions++;
      }
    }
  }
  return inversions % 2 === 0;
};

const getSolvablePuzzle = () => {
  let puzzle;
  do {
    puzzle = [...GOAL_STATE].sort(() => Math.random() - 0.5);
  } while (!isSolvable(puzzle) || puzzle.join(',') === GOAL_STATE.join(','));
  return puzzle;
};

const manhattanDistance = (state) => {
  let dist = 0;
  for (let i = 0; i < state.length; i++) {
    const val = state[i];
    if (val !== 0) {
      const targetX = (val - 1) % 3;
      const targetY = Math.floor((val - 1) / 3);
      const x = i % 3;
      const y = Math.floor(i / 3);
      dist += Math.abs(x - targetX) + Math.abs(y - targetY);
    }
  }
  return dist;
};

const algorithmDescriptions = {
  astar: {
    title: "A* Search (Optimal)",
    description: "A* uses the Manhattan Distance heuristic to estimate the distance to the target. It guarantees the shortest sequence of moves while exploring significantly fewer states than BFS."
  },
  bfs: {
    title: "Breadth-First Search",
    description: "BFS explores all possible puzzle states level by level. It guarantees the shortest path to the solution but will explore a massive number of states, making it very slow for complex puzzles."
  },
  dfs: {
    title: "Depth-First Search",
    description: "DFS plunges deep into the state tree. It does NOT guarantee the shortest path and will often take long, winding, chaotic routes to solve the puzzle. It is bound to a max depth to prevent freezing."
  }
};

const DpadButton = ({ direction, icon: Icon, isSolving, isWin, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.1, boxShadow: '0 0 15px rgba(255, 255, 255, 0.6)' }}
    whileTap={{ scale: 0.9 }}
    onClick={() => onClick(direction)}
    disabled={isSolving || isWin}
    style={{
      width: '50px',
      height: '50px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid #fff',
      color: '#000',
      cursor: isSolving || isWin ? 'not-allowed' : 'pointer',
      opacity: isSolving || isWin ? 0.5 : 1,
      padding: 0,
      outline: 'none',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)'
    }}
  >
    <Icon size={24} />
  </motion.button>
);

const solvePuzzle = (initialState, algorithm = 'astar') => {
  const getNeighbors = (state) => {
    const neighbors = [];
    const emptyIdx = state.indexOf(0);
    const x = emptyIdx % 3;
    const y = Math.floor(emptyIdx / 3);

    const moves = [
      { dx: 0, dy: -1 }, // up
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: 0 }   // right
    ];

    for (let { dx, dy } of moves) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < 3 && ny >= 0 && ny < 3) {
        const nIdx = ny * 3 + nx;
        const newState = [...state];
        [newState[emptyIdx], newState[nIdx]] = [newState[nIdx], newState[emptyIdx]];
        neighbors.push(newState);
      }
    }
    return neighbors;
  };

  let nodesExplored = 0;
  const buildPath = (current) => {
    const path = [];
    let curr = current;
    while (curr !== null) {
      path.push(curr.state);
      curr = curr.parent;
    }
    return path.reverse();
  };

  if (algorithm === 'astar') {
    const startNode = { state: initialState, g: 0, h: manhattanDistance(initialState), parent: null };
    const openSet = [startNode];
    const closedSet = new Set([initialState.join(',')]);

    while (openSet.length > 0 && nodesExplored < 100000) {
      openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
      const current = openSet.shift();
      nodesExplored++;

      if (current.state.join(',') === GOAL_STATE.join(',')) {
        return { path: buildPath(current), nodesExplored };
      }

      for (let neighborState of getNeighbors(current.state)) {
        const stateStr = neighborState.join(',');
        if (!closedSet.has(stateStr)) {
          closedSet.add(stateStr);
          openSet.push({ state: neighborState, g: current.g + 1, h: manhattanDistance(neighborState), parent: current });
        }
      }
    }
  } else if (algorithm === 'bfs') {
    const queue = [{ state: initialState, parent: null }];
    const closedSet = new Set([initialState.join(',')]);

    while (queue.length > 0 && nodesExplored < 150000) {
      const current = queue.shift();
      nodesExplored++;

      if (current.state.join(',') === GOAL_STATE.join(',')) {
        return { path: buildPath(current), nodesExplored };
      }

      for (let neighborState of getNeighbors(current.state)) {
        const stateStr = neighborState.join(',');
        if (!closedSet.has(stateStr)) {
          closedSet.add(stateStr);
          queue.push({ state: neighborState, parent: current });
        }
      }
    }
  } else if (algorithm === 'dfs') {
    const stack = [{ state: initialState, parent: null, depth: 0 }];
    const closedSet = new Set([initialState.join(',')]);

    while (stack.length > 0 && nodesExplored < 150000) {
      const current = stack.pop();
      nodesExplored++;

      if (current.state.join(',') === GOAL_STATE.join(',')) {
        return { path: buildPath(current), nodesExplored };
      }

      if (current.depth < 40) { // Bound depth
        for (let neighborState of getNeighbors(current.state)) {
          const stateStr = neighborState.join(',');
          if (!closedSet.has(stateStr)) {
            closedSet.add(stateStr);
            stack.push({ state: neighborState, parent: current, depth: current.depth + 1 });
          }
        }
      }
    }
  }
  
  return null;
};

export default function PuzzleGame() {
  const [board, setBoard] = useState(GOAL_STATE);
  const [isSolving, setIsSolving] = useState(false);
  const [moves, setMoves] = useState(0);
  const [algorithm, setAlgorithm] = useState('astar');
  const [metrics, setMetrics] = useState({ nodesExplored: 0, timeTaken: 0, pathLength: 0 });

  useEffect(() => {
    setBoard(getSolvablePuzzle());
  }, []);

  const handleTileClick = React.useCallback((index) => {
    if (isSolving) return;
    const emptyIdx = board.indexOf(0);
    const x = index % 3;
    const y = Math.floor(index / 3);
    const ex = emptyIdx % 3;
    const ey = Math.floor(emptyIdx / 3);

    const isAdjacent = Math.abs(x - ex) + Math.abs(y - ey) === 1;
    if (isAdjacent) {
      const newBoard = [...board];
      [newBoard[index], newBoard[emptyIdx]] = [newBoard[emptyIdx], newBoard[index]];
      setBoard(newBoard);
      setMoves(m => m + 1);
    }
  }, [board, isSolving]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSolving) return;
      const emptyIdx = board.indexOf(0);
      const ex = emptyIdx % 3;
      const ey = Math.floor(emptyIdx / 3);
      let targetIdx = -1;

      // Cursor keys move tiles into the empty space
      if (e.key === 'ArrowUp' && ey < 2) targetIdx = emptyIdx + 3; // Tile below moves up
      if (e.key === 'ArrowDown' && ey > 0) targetIdx = emptyIdx - 3; // Tile above moves down
      if (e.key === 'ArrowLeft' && ex < 2) targetIdx = emptyIdx + 1; // Tile to the right moves left
      if (e.key === 'ArrowRight' && ex > 0) targetIdx = emptyIdx - 1; // Tile to the left moves right

      if (targetIdx !== -1) {
        handleTileClick(targetIdx);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [board, isSolving, handleTileClick]);

  const handleDirectionClick = (direction) => {
    if (isSolving) return;
    const emptyIdx = board.indexOf(0);
    const ex = emptyIdx % 3;
    const ey = Math.floor(emptyIdx / 3);
    let targetIdx = -1;

    if (direction === 'up' && ey < 2) targetIdx = emptyIdx + 3;
    if (direction === 'down' && ey > 0) targetIdx = emptyIdx - 3;
    if (direction === 'left' && ex < 2) targetIdx = emptyIdx + 1;
    if (direction === 'right' && ex > 0) targetIdx = emptyIdx - 1;

    if (targetIdx !== -1) {
      handleTileClick(targetIdx);
    }
  };

  const handleShuffle = () => {
    if (isSolving) return;
    setBoard(getSolvablePuzzle());
    setMoves(0);
    setMetrics({ nodesExplored: 0, timeTaken: 0, pathLength: 0 });
  };

  const handleSolve = async () => {
    if (isSolving) return;
    if (board.join(',') === GOAL_STATE.join(',')) return;
    
    setIsSolving(true);
    // Add small delay to let UI show solving state
    await new Promise(r => setTimeout(r, 50));
    
    const startTime = performance.now();
    const result = solvePuzzle(board, algorithm);
    const endTime = performance.now();
    
    if (result) {
      const { path, nodesExplored } = result;
      setMetrics({
        nodesExplored,
        timeTaken: (endTime - startTime).toFixed(2),
        pathLength: path.length - 1
      });
      
      const speedMs = algorithm === 'dfs' ? 100 : 300; // faster animation for dfs since it's long
      
      for (let i = 1; i < path.length; i++) {
        await new Promise(r => setTimeout(r, speedMs));
        setBoard(path[i]);
        setMoves(m => m + 1);
      }
    } else {
      alert("Solution took too long to find or depth bound exceeded.");
    }
    setIsSolving(false);
  };

  const isWin = board.join(',') === GOAL_STATE.join(',');

  return (
    <>
      <div className="animated-bg"></div>
      <div className="app-container">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="header glass-panel glass-panel-glow"
        >
          <div>
            <h1 className="heading-glow">NEURAL PATHFINDER</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
              8-Puzzle A* Optimization Model
            </p>
          </div>
          <div>
            <Link href="/" className="btn" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Back to Grid
            </Link>
          </div>
        </motion.header>

        <div className="main-content">
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="sidebar glass-panel"
          >
            <h3 style={{ color: 'var(--neon-cyan)', borderBottom: '1px solid var(--grid-line)', paddingBottom: '10px' }}>
              ALGORITHM
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <button 
                className={`btn ${algorithm === 'astar' ? 'btn-active' : ''}`}
                onClick={() => setAlgorithm('astar')}
                disabled={isSolving}
              >
                A* Search (Optimal)
              </button>
              <button 
                className={`btn ${algorithm === 'bfs' ? 'btn-active' : ''}`}
                onClick={() => setAlgorithm('bfs')}
                disabled={isSolving}
              >
                Breadth-First Search
              </button>
              <button 
                className={`btn ${algorithm === 'dfs' ? 'btn-active' : ''}`}
                onClick={() => setAlgorithm('dfs')}
                disabled={isSolving}
              >
                Depth-First Search
              </button>
            </div>

            <div className="explanation-panel" style={{ marginTop: '20px' }}>
              <h4>{algorithmDescriptions[algorithm].title}</h4>
              <p>{algorithmDescriptions[algorithm].description}</p>
            </div>

            <div className="metrics-box" style={{ marginTop: '20px' }}>
              <div className="metric-row">
                <span>Nodes Explored:</span>
                <span className="metric-value">{metrics.nodesExplored}</span>
              </div>
              <div className="metric-row">
                <span>Time Taken:</span>
                <span className="metric-value">{metrics.timeTaken} ms</span>
              </div>
              <div className="metric-row">
                <span>Solution Length:</span>
                <span className="metric-value">{metrics.pathLength} moves</span>
              </div>
            </div>
          </motion.aside>

          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel grid-wrapper" 
            style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
          >
            <h2 style={{ color: isWin ? 'var(--neon-green)' : 'var(--neon-cyan)' }}>
              {isWin ? 'PUZZLE SOLVED!' : '8-PUZZLE'}
            </h2>
            
            <div style={{ 
              position: 'relative', 
              width: '320px', 
              height: '320px', 
              background: 'rgba(5, 15, 30, 0.95)', 
              borderRadius: '10px', 
              border: `1px solid ${isWin ? 'var(--neon-green)' : 'rgba(0, 229, 255, 0.5)'}`, 
              padding: '10px',
              boxShadow: isWin ? '0 0 30px rgba(0, 255, 170, 0.3)' : '0 0 20px rgba(0, 229, 255, 0.2)'
            }}>
              {board.map((tile, idx) => {
                const x = (idx % 3) * 100 + 10;
                const y = Math.floor(idx / 3) * 100 + 10;
                if (tile === 0) return null;
                return (
                  <motion.div
                    key={tile}
                    layout
                    initial={false}
                    animate={{ x, y }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={() => handleTileClick(idx)}
                    style={{
                      position: 'absolute',
                      width: '90px',
                      height: '90px',
                      background: isWin ? 'var(--neon-green)' : 'var(--bg-panel)',
                      border: `1px solid ${isWin ? '#fff' : 'var(--neon-teal)'}`,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem',
                      fontFamily: 'Outfit',
                      fontWeight: '800',
                      color: isWin ? '#000' : '#fff',
                      cursor: isSolving ? 'default' : 'pointer',
                      boxShadow: isWin ? 'none' : '0 0 10px rgba(0, 229, 255, 0.2)'
                    }}
                  >
                    {tile}
                  </motion.div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button className="btn" onClick={handleShuffle} disabled={isSolving}>
                <Shuffle size={16} /> Shuffle
              </button>
              <button className="btn btn-primary" onClick={handleSolve} disabled={isSolving || isWin}>
                <Play size={16} /> Auto-Solve
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '1.1rem' }}>
              Current Moves: <span style={{ color: 'var(--neon-yellow)' }}>{moves}</span>
            </div>
          </motion.div>

          <motion.aside 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="sidebar right-sidebar glass-panel"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <h3 style={{ color: 'var(--neon-yellow)', borderBottom: '1px solid var(--grid-line)', paddingBottom: '10px', width: '100%', textAlign: 'left' }}>
              MANUAL CONTROLS
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '15px', textAlign: 'center', lineHeight: '1.5' }}>
              Use these buttons or your keyboard's arrow keys to slide tiles into the empty space.
            </p>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 50px)', 
              gap: '8px', 
              marginTop: '30px', 
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '20px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.05)'
            }}>
              <div />
              <DpadButton direction="up" icon={ArrowUp} isSolving={isSolving} isWin={isWin} onClick={handleDirectionClick} />
              <div />
              <DpadButton direction="left" icon={ArrowLeft} isSolving={isSolving} isWin={isWin} onClick={handleDirectionClick} />
              <DpadButton direction="down" icon={ArrowDown} isSolving={isSolving} isWin={isWin} onClick={handleDirectionClick} />
              <DpadButton direction="right" icon={ArrowRight} isSolving={isSolving} isWin={isWin} onClick={handleDirectionClick} />
            </div>
          </motion.aside>
        </div>
      </div>
    </>
  );
}

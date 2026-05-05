'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import Node from '../components/Node';
import { bfs, dfs, astar, getNodesInShortestPathOrder, getNextAiMove } from '../lib/algorithms';
import { Play, RotateCcw, Crosshair, Cpu, Gamepad2, Layers, Square, BookOpen, Award, Zap } from 'lucide-react';

const NUM_ROWS = 21;
const NUM_COLS = 35;

const KNOWLEDGE_FACTS = [
  "A* Search was invented in 1968 by Peter Hart, Nils Nilsson, and Bertram Raphael at SRI International.",
  "BFS guarantees the shortest path on an unweighted graph because it explores all nodes level by level.",
  "Dijkstra's Algorithm is a special case of A* where the heuristic h(x) is exactly 0 for all nodes.",
  "DFS can be implemented efficiently using recursion or explicitly using a LIFO stack. It does not guarantee shortest paths.",
  "The game of Pac-Man uses simple vector targeting for its ghosts rather than complex pathfinding like A*.",
  "Pathfinding is a crucial component in modern GPS navigation systems, often using optimized variants of A*.",
  "Heuristics must be 'admissible' (never overestimate the true cost) for A* to guarantee finding the optimal path.",
  "Manhattan distance is a commonly used heuristic for grid-based pathfinding where you can only move in 4 directions.",
  "Euclidean distance (straight line) is often used as a heuristic when diagonal movement is allowed."
];

const getInitialGrid = () => {
  const grid = [];
  for (let row = 0; row < NUM_ROWS; row++) {
    const currentRow = [];
    for (let col = 0; col < NUM_COLS; col++) {
      currentRow.push({
        col,
        row,
        isStart: false,
        isEnd: false,
        isWall: false,
        isVisited: false,
        isPath: false,
        previousNode: null,
        fScore: Infinity,
        gScore: Infinity,
        hScore: undefined,
      });
    }
    grid.push(currentRow);
  }
  return grid;
};

const algorithmDescriptions = {
  astar: {
    title: "A* Search (Optimal)",
    description: "A* uses heuristics to estimate the distance to the target, allowing it to prioritize promising paths. It guarantees the shortest path while exploring fewer nodes than Dijkstra or BFS."
  },
  bfs: {
    title: "Breadth-First Search",
    description: "BFS explores the grid level by level, expanding evenly in all directions. It guarantees the shortest path on an unweighted grid but explores many unnecessary nodes."
  },
  dfs: {
    title: "Depth-First Search",
    description: "DFS plunges as deep as possible before backtracking. It does NOT guarantee the shortest path and can get trapped in winding patterns, making it a poor choice for optimal pathfinding."
  }
};

export default function PathfindingVisualizer() {
  const [grid, setGrid] = useState([]);
  const [mouseIsPressed, setMouseIsPressed] = useState(false);
  const [algorithm, setAlgorithm] = useState('astar');
  const [speed, setSpeed] = useState(10); // 1 to 50
  const [mode, setMode] = useState('visualizer'); // 'visualizer' | 'game'
  const [showHeuristics, setShowHeuristics] = useState(false);
  const [metrics, setMetrics] = useState({ steps: 0, pathLength: 0, timeMs: 0 });
  const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'playing' | 'won' | 'lost' | 'paused'

  // Game Enhancements
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [orbPos, setOrbPos] = useState(null);
  const [activeFact, setActiveFact] = useState(null);
  const [collectedFacts, setCollectedFacts] = useState([]);

  // Draw Mode
  const [placeMode, setPlaceMode] = useState('wall'); // 'wall' | 'start' | 'target'

  // Positions
  const [startPos, setStartPos] = useState({ row: 10, col: 5 });
  const [endPos, setEndPos] = useState({ row: 10, col: 29 });
  const [playerPos, setPlayerPos] = useState({ row: 10, col: 5 });
  const [aiPos, setAiPos] = useState({ row: 1, col: 1 });

  // 3D & View Controls
  const [is3DView, setIs3DView] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotation, setRotation] = useState({ x: 60, z: -45 });
  const [isDraggingCam, setIsDraggingCam] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Refs for animation and game loop
  const gameIntervalRef = useRef(null);
  const isVisualizingRef = useRef(false);
  const [isVisualizingUI, setIsVisualizingUI] = useState(false);
  const timeoutIdsRef = useRef([]);

  useEffect(() => {
    initializeGrid();
  }, []);

  useEffect(() => {
    if (grid.length > 0) {
      initializeGrid(true);
    }
  }, [startPos, endPos]);

  const initializeGrid = useCallback((keepWalls = false) => {
    const initialGrid = getInitialGrid();
    if (keepWalls) {
      grid.forEach(row => {
        row.forEach(node => {
          if (node.isWall) initialGrid[node.row][node.col].isWall = true;
        });
      });
    }
    
    // Set special nodes based on mode
    if (mode === 'visualizer') {
      initialGrid[startPos.row][startPos.col].isStart = true;
      initialGrid[endPos.row][endPos.col].isEnd = true;
    } else {
      initialGrid[playerPos.row][playerPos.col].isStart = false; // Player is separate state
      initialGrid[endPos.row][endPos.col].isEnd = true;
    }

    setGrid(initialGrid);
    setMetrics({ steps: 0, pathLength: 0, timeMs: 0 });
    
    // Clear DOM classes from previous visualizations
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let col = 0; col < NUM_COLS; col++) {
        const el = document.getElementById(`node-${row}-${col}`);
        if (el) {
          // preserve wall and endpoints
          el.className = `node ${initialGrid[row][col].isWall ? 'node-wall' : ''} ${initialGrid[row][col].isStart ? 'node-start' : ''} ${initialGrid[row][col].isEnd ? 'node-end' : ''}`;
        }
      }
    }
  }, [grid, startPos, endPos, mode, playerPos]);

  // Handle Mouse Events for drawing walls
  const handleMouseDown = (row, col) => {
    if (isVisualizingRef.current || gameStatus === 'playing') return;
    
    if (placeMode === 'start' && mode === 'visualizer') {
      if (row === endPos.row && col === endPos.col) return;
      setStartPos({ row, col });
      return;
    }
    
    if (placeMode === 'target') {
      if (mode === 'visualizer' && row === startPos.row && col === startPos.col) return;
      if (mode === 'game' && row === playerPos.row && col === playerPos.col) return;
      setEndPos({ row, col });
      return;
    }

    if (mode === 'visualizer' && ((row === startPos.row && col === startPos.col) || (row === endPos.row && col === endPos.col))) return;
    if (mode === 'game' && ((row === playerPos.row && col === playerPos.col) || (row === aiPos.row && col === aiPos.col) || (row === endPos.row && col === endPos.col))) return;
    
    const newGrid = [...grid];
    const node = newGrid[row][col];
    newGrid[row][col] = { ...node, isWall: !node.isWall };
    setGrid(newGrid);
    setMouseIsPressed(true);
  };

  const handleMouseEnter = (row, col) => {
    if (!mouseIsPressed || isVisualizingRef.current || gameStatus === 'playing') return;
    if (placeMode !== 'wall') return;

    if (mode === 'visualizer' && ((row === startPos.row && col === startPos.col) || (row === endPos.row && col === endPos.col))) return;
    if (mode === 'game' && ((row === playerPos.row && col === playerPos.col) || (row === aiPos.row && col === aiPos.col) || (row === endPos.row && col === endPos.col))) return;
    
    const newGrid = [...grid];
    const node = newGrid[row][col];
    newGrid[row][col] = { ...node, isWall: !node.isWall };
    setGrid(newGrid);
  };

  const handleMouseUp = () => {
    setMouseIsPressed(false);
    setIsDraggingCam(false);
  };

  // 3D Camera Controls
  const handleWrapperMouseDown = (e) => {
    if (is3DView) {
      setIsDraggingCam(true);
      setHasDragged(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleWrapperMouseMove = (e) => {
    if (isDraggingCam && is3DView) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setRotation(prev => ({
        x: Math.min(85, Math.max(20, prev.x - deltaY * 0.5)),
        z: prev.z + deltaX * 0.5
      }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Visualizer Animation
  const animateShortestPath = (nodesInShortestPathOrder) => {
    const speedMs = 500 / speed;
    for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
      const tid = setTimeout(() => {
        const node = nodesInShortestPathOrder[i];
        if (!node.isStart && !node.isEnd) {
          document.getElementById(`node-${node.row}-${node.col}`).className = 'node node-path';
        }
        if (i === nodesInShortestPathOrder.length - 1) {
          isVisualizingRef.current = false;
          setIsVisualizingUI(false);
        }
      }, speedMs * i);
      timeoutIdsRef.current.push(tid);
    }
  };

  const animateAlgorithm = (visitedNodesInOrder, nodesInShortestPathOrder) => {
    const speedMs = 500 / speed;
    for (let i = 0; i <= visitedNodesInOrder.length; i++) {
      if (i === visitedNodesInOrder.length) {
        const tid = setTimeout(() => {
          animateShortestPath(nodesInShortestPathOrder);
        }, speedMs * i);
        timeoutIdsRef.current.push(tid);
        return;
      }
      const tid = setTimeout(() => {
        const node = visitedNodesInOrder[i];
        if (!node.isStart && !node.isEnd) {
          document.getElementById(`node-${node.row}-${node.col}`).className = 'node node-visited';
        }
      }, speedMs * i);
      timeoutIdsRef.current.push(tid);
    }
  };

  const cancelSearch = () => {
    timeoutIdsRef.current.forEach(tid => clearTimeout(tid));
    timeoutIdsRef.current = [];
    isVisualizingRef.current = false;
    setIsVisualizingUI(false);
    initializeGrid(true); // reset visually to clear partial paths
  };

  const visualize = () => {
    if (isVisualizingRef.current) return;
    setIsVisualizingUI(true);
    timeoutIdsRef.current = []; // reset timeout array
    initializeGrid(true); // reset visited nodes but keep walls
    isVisualizingRef.current = true;
    
    const startNode = grid[startPos.row][startPos.col];
    const finishNode = grid[endPos.row][endPos.col];
    
    // Create clean copy of grid for algorithm
    const gridClone = grid.map(row => row.map(n => ({ ...n, previousNode: null, isVisited: false, gScore: Infinity, fScore: Infinity, hScore: undefined })));
    const startClone = gridClone[startPos.row][startPos.col];
    const finishClone = gridClone[endPos.row][endPos.col];

    const startTime = performance.now();
    let visitedNodesInOrder = [];

    if (algorithm === 'bfs') {
      visitedNodesInOrder = bfs(gridClone, startClone, finishClone);
    } else if (algorithm === 'dfs') {
      visitedNodesInOrder = dfs(gridClone, startClone, finishClone);
    } else if (algorithm === 'astar') {
      visitedNodesInOrder = astar(gridClone, startClone, finishClone);
    }
    
    const endTime = performance.now();
    const nodesInShortestPathOrder = getNodesInShortestPathOrder(finishClone);
    
    // Update grid state with heuristics if astar
    if (algorithm === 'astar' && showHeuristics) {
        // We must reset isVisited to false before setting state so we don't break the manual DOM animations
        const resetVisGrid = gridClone.map(row => row.map(n => ({ ...n, isVisited: false })));
        setGrid(resetVisGrid);
    }

    setMetrics({
      steps: visitedNodesInOrder.length,
      pathLength: nodesInShortestPathOrder.length,
      timeMs: (endTime - startTime).toFixed(2)
    });

    animateAlgorithm(visitedNodesInOrder, nodesInShortestPathOrder);
  };

  const generateRandomMaze = () => {
    if (isVisualizingRef.current || gameStatus === 'playing') return;
    const newGrid = getInitialGrid();
    
    for (let r = 0; r < NUM_ROWS; r++) {
      for (let c = 0; c < NUM_COLS; c++) {
        if (Math.random() < 0.3) {
          if ((r !== startPos.row || c !== startPos.col) && (r !== endPos.row || c !== endPos.col) &&
              (r !== playerPos.row || c !== playerPos.col) && (r !== aiPos.row || c !== aiPos.col)) {
            newGrid[r][c].isWall = true;
          }
        }
      }
    }
    
    if (mode === 'visualizer') {
      newGrid[startPos.row][startPos.col].isStart = true;
      newGrid[endPos.row][endPos.col].isEnd = true;
    } else {
      newGrid[endPos.row][endPos.col].isEnd = true;
    }
    setGrid(newGrid);
  };

  // Game Logic
  const startGame = () => {
    if (gameStatus === 'playing') return;
    initializeGrid(true); // reset previous game trails
    setGameStatus('playing');
    setPlayerPos({ row: 10, col: 5 });
    setAiPos({ row: 1, col: 1 });
    
    // Reset enhancements
    setScore(0);
    setLevel(1);
    setCollectedFacts([]);
    setActiveFact(null);
    
    // Spawn first orb
    let r, c;
    while (true) {
      r = Math.floor(Math.random() * NUM_ROWS);
      c = Math.floor(Math.random() * NUM_COLS);
      if (
        (r !== 10 || c !== 5) &&
        (r !== endPos.row || c !== endPos.col) &&
        (r !== 1 || c !== 1)
      ) {
        break;
      }
    }
    setOrbPos({ row: r, col: c });
  };

  const resumeGame = () => {
    setActiveFact(null);
    setGameStatus('playing');
  };

  const handleKeyDown = useCallback((e) => {
    if (gameStatus !== 'playing') return;
    
    let { row, col } = playerPos;
    if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
    if (e.key === 'ArrowDown') row = Math.min(NUM_ROWS - 1, row + 1);
    if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
    if (e.key === 'ArrowRight') col = Math.min(NUM_COLS - 1, col + 1);
    
    if (!grid[row][col].isWall) {
      setPlayerPos({ row, col });
    }
  }, [gameStatus, playerPos, grid]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const playerPosRef = useRef(playerPos);
  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    // Check Win/Loss
    if (playerPos.row === endPos.row && playerPos.col === endPos.col) {
      setScore(s => s + 500);
      setGameStatus('won');
      return;
    }
    if (playerPos.row === aiPos.row && playerPos.col === aiPos.col) {
      setGameStatus('lost');
      return;
    }
  }, [playerPos, aiPos, endPos, gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    // AI Loop
    const baseSpeed = Math.max(100, 1000 - speed * 15);
    const aiSpeed = Math.max(50, baseSpeed - (level * 30));
    
    gameIntervalRef.current = setInterval(() => {
      setAiPos(prevAiPos => {
        const nextMove = getNextAiMove(grid, prevAiPos, playerPosRef.current);
        if (nextMove) return nextMove;
        return prevAiPos;
      });
    }, aiSpeed);

    return () => clearInterval(gameIntervalRef.current);
  }, [gameStatus, grid, speed, level]);

  // Orb Collection Logic
  useEffect(() => {
    if (gameStatus === 'playing' && orbPos && playerPos.row === orbPos.row && playerPos.col === orbPos.col) {
      setScore(s => s + 100 * level);
      setLevel(l => l + 1);
      
      const uncollected = KNOWLEDGE_FACTS.filter(f => !collectedFacts.includes(f));
      if (uncollected.length > 0) {
        const fact = uncollected[Math.floor(Math.random() * uncollected.length)];
        setCollectedFacts(prev => [...prev, fact]);
        setActiveFact(fact);
        setGameStatus('paused');
      }

      // Spawn new orb
      let r, c;
      while (true) {
        r = Math.floor(Math.random() * NUM_ROWS);
        c = Math.floor(Math.random() * NUM_COLS);
        if (!grid[r][c].isWall && 
            !(r === playerPos.row && c === playerPos.col) &&
            !(r === endPos.row && c === endPos.col) &&
            !(r === aiPos.row && c === aiPos.col)) {
          break;
        }
      }
      setOrbPos({ row: r, col: c });
    }
  }, [playerPos, orbPos, gameStatus, grid, level, collectedFacts, endPos, aiPos]);


  const renderGrid = () => {
    return grid.map((row, rowIdx) => {
      return (
        <div key={rowIdx} style={{ display: 'flex' }}>
          {row.map((node, nodeIdx) => {
            const { row, col, isWall, isStart, isEnd, fScore, hScore } = node;
            const isPlayer = mode === 'game' && playerPos.row === row && playerPos.col === col;
            const isAi = mode === 'game' && aiPos.row === row && aiPos.col === col;
            const isOrb = mode === 'game' && orbPos && orbPos.row === row && orbPos.col === col;
            
            return (
              <Node
                key={nodeIdx}
                col={col}
                row={row}
                isStart={mode === 'visualizer' ? isStart : false}
                isEnd={isEnd}
                isWall={isWall}
                isPlayer={isPlayer}
                isAi={isAi}
                isOrb={isOrb}
                fScore={fScore}
                hScore={hScore}
                showHeuristics={showHeuristics && algorithm === 'astar' && mode === 'visualizer'}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                onMouseUp={handleMouseUp}
              />
            );
          })}
        </div>
      );
    });
  };

  // Calculate 3D board transformations to follow player
  const centerCol = (NUM_COLS - 1) / 2;
  const centerRow = (NUM_ROWS - 1) / 2;
  const translateX = is3DView ? (centerCol - (mode === 'game' ? playerPos.col : centerCol)) * 26 : 0;
  const translateY = is3DView ? (centerRow - (mode === 'game' ? playerPos.row : centerRow)) * 26 : 0;

  const boardStyle = is3DView ? {
    transform: `scale(${zoomLevel}) rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg) translateX(${translateX}px) translateY(${translateY}px) translateZ(-50px)`,
    transition: isDraggingCam ? 'none' : 'transform 0.3s ease-out',
    willChange: 'transform'
  } : {
    transform: `scale(${zoomLevel}) rotateX(0deg) rotateZ(0deg) translateX(0px) translateY(0px) translateZ(0px)`,
    transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)',
    willChange: 'transform'
  };

  return (
    <>
    {activeFact && (
      <div className="fact-modal-overlay">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fact-modal glass-panel glass-panel-glow"
        >
          <div className="fact-icon-container">
            <Zap size={32} color="var(--neon-yellow)" />
          </div>
          <h2>KNOWLEDGE ACQUIRED!</h2>
          <p>{activeFact}</p>
          <button className="btn btn-primary" onClick={resumeGame} style={{ marginTop: '20px' }}>
            <Play size={16} /> CONTINUE EVASION
          </button>
        </motion.div>
      </div>
    )}
    <div className="animated-bg"></div>
    <div className="app-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="header glass-panel glass-panel-glow"
      >
        <div>
          <h1 className="heading-glow">NEURAL PATHFINDER</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
            {mode === 'visualizer' ? 'Advanced Algorithm Visualization System' : 'Evasion Protocol: Engage'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${mode === 'visualizer' ? 'btn-active' : ''}`}
            onClick={() => { setMode('visualizer'); setGameStatus('idle'); initializeGrid(); setIs3DView(false); setZoomLevel(1.0); }}
            disabled={isVisualizingRef.current || gameStatus === 'playing'}
          >
            <Layers size={16} /> Visualizer
          </button>
          <button 
            className={`btn ${mode === 'game' ? 'btn-active' : ''}`}
            onClick={() => { setMode('game'); initializeGrid(); setIs3DView(true); setZoomLevel(1.5); }}
            disabled={isVisualizingRef.current || gameStatus === 'playing'}
          >
            <Gamepad2 size={16} /> Game Mode
          </button>
          <a href="/puzzle" style={{ textDecoration: 'none' }}>
            <button className="btn" disabled={isVisualizingRef.current || gameStatus === 'playing'}>
              <Layers size={16} /> 8-Puzzle
            </button>
          </a>
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
            CONTROL PANEL
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ALGORITHM</label>
            <button 
              className={`btn ${algorithm === 'astar' ? 'btn-active' : ''}`}
              onClick={() => setAlgorithm('astar')}
              disabled={isVisualizingRef.current || gameStatus === 'playing'}
            >
              A* Search (Optimal)
            </button>
            <button 
              className={`btn ${algorithm === 'bfs' ? 'btn-active' : ''}`}
              onClick={() => setAlgorithm('bfs')}
              disabled={isVisualizingRef.current || gameStatus === 'playing'}
            >
              Breadth-First Search
            </button>
            <button 
              className={`btn ${algorithm === 'dfs' ? 'btn-active' : ''}`}
              onClick={() => setAlgorithm('dfs')}
              disabled={isVisualizingRef.current || gameStatus === 'playing'}
            >
              Depth-First Search
            </button>
          </div>

          <div className="slider-container" style={{ marginTop: '10px' }}>
            <label>SPEED: {speed}</label>
            <input 
              type="range" 
              min="1" max="50" 
              value={speed} 
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              disabled={isVisualizingRef.current}
            />
          </div>

          {mode === 'visualizer' && algorithm === 'astar' && (
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showHeuristics}
                  onChange={(e) => setShowHeuristics(e.target.checked)}
                  disabled={isVisualizingRef.current}
                  style={{ accentColor: 'var(--neon-cyan)', width: '16px', height: '16px' }}
                />
                Show Heuristics
              </label>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>DRAW MODE</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button 
                className={`btn ${placeMode === 'wall' ? 'btn-active' : ''}`}
                style={{ flex: 1, padding: '8px', justifyContent: 'center' }}
                onClick={() => setPlaceMode('wall')}
                disabled={isVisualizingRef.current || gameStatus === 'playing'}
              >
                Wall
              </button>
              <button 
                className={`btn ${placeMode === 'start' ? 'btn-active' : ''}`}
                style={{ flex: 1, padding: '8px', justifyContent: 'center' }}
                onClick={() => setPlaceMode('start')}
                disabled={isVisualizingRef.current || gameStatus === 'playing' || mode === 'game'}
              >
                Start
              </button>
              <button 
                className={`btn ${placeMode === 'target' ? 'btn-active' : ''}`}
                style={{ flex: 1, padding: '8px', justifyContent: 'center' }}
                onClick={() => setPlaceMode('target')}
                disabled={isVisualizingRef.current || gameStatus === 'playing'}
              >
                Target
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            {mode === 'visualizer' ? (
              <>
                <button className="btn btn-primary" onClick={visualize} disabled={isVisualizingUI}>
                  <Play size={16} /> INITIATE SEARCH
                </button>
                {isVisualizingUI && (
                  <button className="btn" style={{ borderColor: 'var(--neon-yellow)', color: 'var(--neon-yellow)', background: 'rgba(255,0,85,0.1)' }} onClick={cancelSearch}>
                    <Square size={16} fill="currentColor" /> CANCEL SEARCH
                  </button>
                )}
              </>
            ) : (
              <button className="btn btn-primary" onClick={startGame} disabled={gameStatus === 'playing' || gameStatus === 'paused'}>
                <Play size={16} /> START EVASION
              </button>
            )}
            <button className="btn" onClick={generateRandomMaze} disabled={isVisualizingUI || gameStatus === 'playing' || gameStatus === 'paused'}>
              <Crosshair size={16} /> RANDOM MAZE
            </button>
            <button className="btn" onClick={() => initializeGrid(false)} disabled={isVisualizingUI || gameStatus === 'playing' || gameStatus === 'paused'}>
              <RotateCcw size={16} /> CLEAR BOARD
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--grid-line)' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>VIEW CONTROLS</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button className={`btn ${is3DView ? 'btn-active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIs3DView(!is3DView)}>
                {is3DView ? 'Disable 3D' : 'Enable 3D'}
              </button>
              <button className="btn" style={{ padding: '12px 15px' }} onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))}>-</button>
              <button className="btn" style={{ padding: '12px 15px' }} onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.2))}>+</button>
            </div>
          </div>

          {mode === 'game' && (
            <div className="metrics-box" style={{ borderColor: gameStatus === 'won' ? 'var(--neon-teal)' : gameStatus === 'lost' ? 'var(--neon-ai)' : 'var(--neon-yellow)', marginTop: '20px' }}>
              <div style={{ color: gameStatus === 'won' ? 'var(--neon-teal)' : gameStatus === 'lost' ? 'var(--neon-ai)' : 'var(--neon-yellow)', textAlign: 'center', fontWeight: 'bold', marginBottom: '10px' }}>
                {gameStatus === 'idle' ? 'Use Arrow Keys to Move' : gameStatus === 'paused' ? 'GAME PAUSED' : gameStatus === 'playing' ? 'EVADE & COLLECT!' : gameStatus === 'won' ? 'TARGET REACHED!' : 'SYSTEM COMPROMISED'}
              </div>
              <div className="metric-row">
                <span style={{display: 'flex', alignItems: 'center', gap: '5px'}}><Award size={14}/> Score:</span>
                <span className="metric-value">{score}</span>
              </div>
              <div className="metric-row">
                <span style={{display: 'flex', alignItems: 'center', gap: '5px'}}><Zap size={14}/> Level:</span>
                <span className="metric-value">{level}</span>
              </div>
            </div>
          )}
        </motion.aside>

        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`grid-wrapper glass-panel ${is3DView ? 'is-3d' : ''}`}
          onMouseDown={handleWrapperMouseDown}
          onMouseMove={handleWrapperMouseMove}
          style={{ cursor: is3DView ? (isDraggingCam ? 'grabbing' : 'grab') : 'default' }}
        >
          {is3DView && !hasDragged && (
            <div style={{ position: 'absolute', top: 20, left: 20, color: 'var(--neon-teal)', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px' }}>
              DRAG TO ROTATE CAMERA
            </div>
          )}
          <div className={`grid-board ${is3DView ? 'grid-container-3d' : 'grid-container-2d'}`} style={boardStyle}>
            {renderGrid()}
          </div>
        </motion.section>

        <motion.aside 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="sidebar right-sidebar glass-panel"
        >
          {mode === 'visualizer' ? (
            <>
              <h3 style={{ color: 'var(--neon-yellow)', borderBottom: '1px solid var(--grid-line)', paddingBottom: '10px' }}>
                ALGORITHM INFO
              </h3>
              
              <div className="explanation-panel">
                <h4>{algorithmDescriptions[algorithm].title}</h4>
                <p>{algorithmDescriptions[algorithm].description}</p>
              </div>
              
              <div className="metrics-box" style={{ marginTop: '20px' }}>
                <div className="metric-row">
                  <span>Nodes Explored:</span>
                  <span className="metric-value">{metrics.steps}</span>
                </div>
                <div className="metric-row">
                  <span>Path Length:</span>
                  <span className="metric-value">{metrics.pathLength}</span>
                </div>
                <div className="metric-row">
                  <span>Time Taken:</span>
                  <span className="metric-value">{metrics.timeMs} ms</span>
                </div>
              </div>
              
              <div style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                <p><strong>Heuristics Explained:</strong></p>
                <p style={{ marginTop: '5px' }}>H-Score: Estimated distance to target</p>
                <p>G-Score: Distance from start</p>
                <p>F-Score: Total Cost (G + H)</p>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ color: 'var(--neon-green)', borderBottom: '1px solid var(--grid-line)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} /> KNOWLEDGE ARCHIVE
              </h3>
              <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {collectedFacts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                    Collect Knowledge Orbs on the grid to learn facts and boost your score!
                  </p>
                ) : (
                  collectedFacts.map((fact, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="explanation-panel"
                      style={{ borderColor: 'var(--neon-green)', background: 'rgba(0, 255, 170, 0.05)' }}
                    >
                      <p style={{ fontSize: '0.85rem' }}>{fact}</p>
                    </motion.div>
                  ))
                )}
              </div>
            </>
          )}
        </motion.aside>
      </div>
    </div>
    </>
  );
}

import React from 'react';

const Node = ({
  col,
  row,
  isStart,
  isEnd,
  isWall,
  isVisited,
  isPath,
  isPlayer,
  isAi,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  fScore,
  gScore,
  hScore,
  showHeuristics,
  isOrb
}) => {
  const extraClassName = isPlayer
    ? 'node-player'
    : isAi
    ? 'node-ai'
    : isStart
    ? 'node-start'
    : isEnd
    ? 'node-end'
    : isWall
    ? 'node-wall'
    : isOrb
    ? 'node-orb'
    : isPath
    ? 'node-path'
    : isVisited
    ? 'node-visited'
    : '';

  return (
    <div
      id={`node-${row}-${col}`}
      className={`node ${extraClassName}`}
      onMouseDown={() => onMouseDown(row, col)}
      onMouseEnter={() => onMouseEnter(row, col)}
      onMouseUp={() => onMouseUp()}
    >
      {showHeuristics && !isWall && !isStart && !isEnd && !isPlayer && !isAi && !isOrb && (fScore !== Infinity || hScore !== undefined) && (
        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', position: 'absolute' }}>
          {hScore || ''}
        </span>
      )}
    </div>
  );
};

export default React.memo(Node);

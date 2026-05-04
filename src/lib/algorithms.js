// Helper to get neighbors
export const getNeighbors = (node, grid) => {
  const neighbors = [];
  const { row, col } = node;
  const numRows = grid.length;
  const numCols = grid[0].length;

  if (row > 0) neighbors.push(grid[row - 1][col]); // up
  if (row < numRows - 1) neighbors.push(grid[row + 1][col]); // down
  if (col > 0) neighbors.push(grid[row][col - 1]); // left
  if (col < numCols - 1) neighbors.push(grid[row][col + 1]); // right

  return neighbors.filter(n => !n.isWall);
};

// Manhattan distance
export const manhattanDistance = (nodeA, nodeB) => {
  return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
};

// Reconstruct path
export const getNodesInShortestPathOrder = (finishNode) => {
  const nodesInShortestPathOrder = [];
  let currentNode = finishNode;
  while (currentNode !== null && currentNode !== undefined) {
    nodesInShortestPathOrder.unshift(currentNode);
    currentNode = currentNode.previousNode;
  }
  return nodesInShortestPathOrder;
};

// BFS
export const bfs = (grid, startNode, finishNode) => {
  const visitedNodesInOrder = [];
  const queue = [startNode];
  startNode.isVisited = true;

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (currentNode.isWall) continue;
    
    visitedNodesInOrder.push(currentNode);

    if (currentNode === finishNode) return visitedNodesInOrder;

    const neighbors = getNeighbors(currentNode, grid);
    for (const neighbor of neighbors) {
      if (!neighbor.isVisited) {
        neighbor.isVisited = true;
        neighbor.previousNode = currentNode;
        queue.push(neighbor);
      }
    }
  }
  return visitedNodesInOrder;
};

// DFS
export const dfs = (grid, startNode, finishNode) => {
  const visitedNodesInOrder = [];
  const stack = [startNode];
  startNode.isVisited = true;

  while (stack.length > 0) {
    const currentNode = stack.pop();
    if (currentNode.isWall) continue;
    
    // We only add to visited when popped
    visitedNodesInOrder.push(currentNode);

    if (currentNode === finishNode) return visitedNodesInOrder;

    const neighbors = getNeighbors(currentNode, grid);
    // Push neighbors to stack
    for (const neighbor of neighbors) {
      if (!neighbor.isVisited) {
        neighbor.isVisited = true;
        neighbor.previousNode = currentNode;
        stack.push(neighbor);
      }
    }
  }
  return visitedNodesInOrder;
};

// A*
export const astar = (grid, startNode, finishNode) => {
  const visitedNodesInOrder = [];
  const openSet = [startNode];
  
  startNode.gScore = 0;
  startNode.fScore = manhattanDistance(startNode, finishNode);
  
  while (openSet.length > 0) {
    // Sort to get node with lowest fScore
    openSet.sort((a, b) => a.fScore - b.fScore);
    const currentNode = openSet.shift();
    
    if (currentNode.isWall) continue;
    
    currentNode.isVisited = true;
    visitedNodesInOrder.push(currentNode);
    
    if (currentNode === finishNode) return visitedNodesInOrder;
    
    const neighbors = getNeighbors(currentNode, grid);
    for (const neighbor of neighbors) {
      if (neighbor.isVisited) continue;
      
      const tentativeGScore = currentNode.gScore + 1;
      
      let isNewPath = false;
      if (!openSet.includes(neighbor)) {
        isNewPath = true;
        neighbor.hScore = manhattanDistance(neighbor, finishNode);
        openSet.push(neighbor);
      } else if (tentativeGScore < neighbor.gScore) {
        isNewPath = true;
      }
      
      if (isNewPath) {
        neighbor.previousNode = currentNode;
        neighbor.gScore = tentativeGScore;
        neighbor.fScore = neighbor.gScore + neighbor.hScore;
      }
    }
  }
  
  return visitedNodesInOrder;
};

// A* for Game AI (returns next move to get to target)
export const getNextAiMove = (grid, aiPos, targetPos) => {
  // Clone grid for simulation
  const gridClone = grid.map(row => 
    row.map(node => ({ ...node, previousNode: null, gScore: Infinity, fScore: Infinity, isVisited: false }))
  );
  
  const startNode = gridClone[aiPos.row][aiPos.col];
  const finishNode = gridClone[targetPos.row][targetPos.col];
  
  const path = astar(gridClone, startNode, finishNode);
  
  // Reconstruct path
  const fullPath = getNodesInShortestPathOrder(finishNode);
  
  // If path exists and length > 1, the next move is index 1
  if (fullPath.length > 1) {
    return { row: fullPath[1].row, col: fullPath[1].col };
  }
  
  return null;
};

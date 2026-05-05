# Neural Pathfinder & 8-Puzzle Visualizer

This project is a high-end web application that visualizes algorithmic pathfinding on a dynamic 2D/3D grid, and features an interactive **8-Puzzle Game** driven by optimal search algorithms like A*, BFS, and DFS. 

---

## The 8-Puzzle Game: Concept & Algorithm Explanation

The **8-Puzzle** is a sliding puzzle consisting of a 3x3 grid with 8 numbered square tiles and one empty space. The goal is to rearrange the tiles into a target configuration (usually sequentially from 1 to 8, with the empty space at the end) by sliding tiles into the empty space.

While a human might struggle to find the most efficient path, we can solve this programmatically using **Graph Search Algorithms**.

### Why A* (A-Star) is the Best Algorithm for This
To solve the puzzle, we can treat every possible board configuration as a "Node" in a massive graph. Moving a tile creates a connection (edge) to a new "Node". 

- **BFS (Breadth-First Search)**: Explores every possible move level by level. It *guarantees* the shortest path but requires checking hundreds of thousands of states, making it incredibly slow.
- **DFS (Depth-First Search)**: Dives down one random path of moves until it hits a dead end. It is fast but almost never finds the shortest path, leading to hilariously chaotic, 50,000-move solutions for a 20-move puzzle.
- **A* Search**: The sweet spot. A* uses an intelligent "Heuristic" (a highly educated guess) to score how close a board state is to the final goal. It only explores the most promising paths, drastically cutting down computation time while still absolutely guaranteeing the shortest possible path.

### The Magic Heuristic: Manhattan Distance
How does A* know which move is the "most promising"? We use the **Manhattan Distance** heuristic. 

Imagine you are in a city laid out on a grid (like Manhattan). You can't walk diagonally through buildings; you have to walk block by block. For the 8-puzzle, we calculate the Manhattan Distance by looking at every single tile on the board, figuring out its target (goal) destination, and counting exactly how many up/down/left/right shifts it would take for that specific tile to get home if no other tiles were blocking it. 

We sum up the Manhattan Distances for *all* 8 tiles. 
- A high sum = We are very far from the solution.
- A sum of 0 = We have solved the puzzle!

A* combines the **Cost to get to the current state (G)** with the **Estimated Cost to the goal (H)** to get a **Total Score (F = G + H)**. It always explores the state with the lowest `F` score first.

---

## Python Implementation

Here is a clean, simple, and optimal Python implementation of the 8-puzzle solver using the A* algorithm and the Manhattan Distance heuristic.

```python
import heapq

class PuzzleState:
    def __init__(self, board, parent=None, move="", g=0):
        self.board = board       # A tuple representing the 9 tiles
        self.parent = parent     # The previous state (used to trace the path back)
        self.move = move         # The direction the tile moved to get here
        self.g = g               # Cost (number of moves made so far)
        self.h = self.manhattan_distance() # Heuristic (estimated moves to goal)

    def manhattan_distance(self):
        """
        Calculates the total Manhattan Distance for the board.
        It sums the vertical and horizontal distances each tile is from its target.
        """
        distance = 0
        for i in range(9):
            if self.board[i] != 0: # We don't calculate distance for the empty space
                # Goal coordinates (1 is at index 0, 8 is at index 7)
                target_x = (self.board[i] - 1) % 3
                target_y = (self.board[i] - 1) // 3
                
                # Current coordinates
                curr_x = i % 3
                curr_y = i // 3
                
                # Manhattan Distance formula: |x1 - x2| + |y1 - y2|
                distance += abs(target_x - curr_x) + abs(target_y - curr_y)
        return distance

    def __lt__(self, other):
        """
        Overriding the Less-Than operator. This tells Python's priority queue (heapq)
        how to rank the states. It prioritizes states with the lowest F score (G + H).
        """
        return (self.g + self.h) < (other.g + other.h)

    def get_neighbors(self):
        """
        Generates all valid moves (up, down, left, right) from the current state.
        Returns a list of new PuzzleState objects.
        """
        neighbors = []
        empty_idx = self.board.index(0)
        x, y = empty_idx % 3, empty_idx // 3
        
        # Possible directions the empty space can move
        moves = [("Up", 0, -1), ("Down", 0, 1), ("Left", -1, 0), ("Right", 1, 0)]
        
        for move_name, dx, dy in moves:
            nx, ny = x + dx, y + dy
            
            # Check if the move keeps the empty space inside the 3x3 grid boundaries
            if 0 <= nx < 3 and 0 <= ny < 3:
                new_idx = ny * 3 + nx
                new_board = list(self.board)
                
                # Swap the empty space (0) with the target tile
                new_board[empty_idx], new_board[new_idx] = new_board[new_idx], new_board[empty_idx]
                
                # Create the new neighbor state and add it to the list
                # Note: We increment 'g' by 1 because we made 1 move
                neighbors.append(PuzzleState(tuple(new_board), self, move_name, self.g + 1))
        
        return neighbors

def solve_8_puzzle(initial_board):
    """
    The core A* Search algorithm implementation.
    """
    start_state = PuzzleState(tuple(initial_board))
    goal_state = (1, 2, 3, 4, 5, 6, 7, 8, 0)
    
    # open_set acts as a priority queue. It automatically keeps the state with the lowest F score at the front.
    open_set = []
    heapq.heappush(open_set, start_state)
    
    # closed_set keeps track of states we've already visited so we don't go in infinite loops
    closed_set = set()
    
    while open_set:
        # Pop the state with the absolute lowest F score (most promising path)
        current_state = heapq.heappop(open_set)
        
        # If the board matches our goal exactly, we've won!
        if current_state.board == goal_state:
            # Backtrack using the 'parent' pointers to reconstruct the exact moves we took
            path = []
            while current_state.parent:
                path.append(current_state.move)
                current_state = current_state.parent
            return path[::-1] # Reverse the list to get moves from start to finish
            
        # Add the current state to the closed set so we never visit it again
        closed_set.add(current_state.board)
        
        # Generate all possible next moves
        for neighbor in current_state.get_neighbors():
            # Only consider moves we haven't already fully explored
            if neighbor.board not in closed_set:
                heapq.heappush(open_set, neighbor)
                
    return None # If the open_set runs dry, the puzzle is mathematically unsolvable

if __name__ == "__main__":
    # Test the algorithm with an initial shuffled state
    initial_puzzle = [
        3, 1, 2,
        6, 4, 5,
        0, 7, 8
    ]
    
    print("Solving 8-puzzle with A* algorithm...")
    solution = solve_8_puzzle(initial_puzzle)
    
    if solution:
        print(f"Solved completely in {len(solution)} optimal moves!")
        print("Sequence of Moves:", " -> ".join(solution))
    else:
        print("No solution found. (The puzzle parity might be unsolvable)")
```

---

## Running the Web Application Locally

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience the Visualizer.

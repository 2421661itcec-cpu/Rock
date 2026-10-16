/**
 * Game Rules & Decision Engine
 * Implements 5 distinct game modes, 3 AI difficulty strategies,
 * transparent tactical algorithms, and robust round lifecycle state machine.
 */

export const MOVES = ["stone", "paper", "scissors"];

export const MOVE_DETAILS = {
  stone: { label: "STONE", emoji: "✊", beats: "scissors", losesTo: "paper" },
  paper: { label: "PAPER", emoji: "✋", beats: "stone", losesTo: "scissors" },
  scissors: { label: "SCISSORS", emoji: "✌️", beats: "paper", losesTo: "stone" }
};

export const GAME_MODES = {
  quick: {
    id: "quick",
    name: "Quick Match",
    tagline: "First to 2 Wins",
    description: "Fast-paced exhibition round — first player to reach 2 points wins the match.",
    targetWins: 2,
    maxRounds: 3
  },
  best_of_5: {
    id: "best_of_5",
    name: "Best of 5",
    tagline: "Tournament Classic",
    description: "Standard 5-round championship showdown — first to 3 wins or highest after 5 rounds.",
    targetWins: 3,
    maxRounds: 5
  },
  survival: {
    id: "survival",
    name: "Survival Mode",
    tagline: "Endless Streak",
    description: "Keep throwing until you suffer your first defeat! Draws keep you alive. How high can you streak?",
    targetWins: Infinity,
    maxRounds: Infinity
  },
  time_attack: {
    id: "time_attack",
    name: "Time Attack",
    tagline: "60-Second Blitz",
    description: "Score as many round wins as you can before the 60-second arena timer runs out!",
    durationSeconds: 60,
    targetWins: Infinity,
    maxRounds: Infinity
  },
  practice: {
    id: "practice",
    name: "Practice Mode",
    tagline: "Warm-Up & Calibration",
    description: "Free-play with real-time feedback and skeleton landmarks. Zero competitive pressure.",
    targetWins: Infinity,
    maxRounds: Infinity
  }
};

export class GameEngine {
  constructor() {
    this.mode = "best_of_5";
    this.difficulty = "normal"; // "easy", "normal", "hard"

    // Match Scores
    this.playerScore = 0;
    this.aiScore = 0;
    this.draws = 0;
    this.roundNumber = 0;
    this.matchOver = false;

    // Round State
    this.state = "IDLE"; // IDLE, COUNTDOWN, SHOOT, REVEAL, COOLDOWN, PAUSED, MATCH_OVER
    this.currentRoundData = null;
    this.roundHistory = [];

    // Player Move Frequency Tracker (for AI tactical analysis)
    this.playerMoveStats = { stone: 0, paper: 0, scissors: 0 };
    this.lastPlayerMove = null;
    this.lastAiMove = null;
    this.lastRoundWinner = null;

    // Time Attack Mode timer
    this.timeAttackRemaining = 60;
    this.timeAttackInterval = null;

    // Comeback detection
    this.maxDeficit = 0;
  }

  setMode(modeKey) {
    if (GAME_MODES[modeKey]) {
      this.mode = modeKey;
    }
  }

  setDifficulty(diff) {
    if (["easy", "normal", "hard"].includes(diff)) {
      this.difficulty = diff;
    }
  }

  getModeConfig() {
    return GAME_MODES[this.mode] || GAME_MODES.best_of_5;
  }

  resetMatch() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.draws = 0;
    this.roundNumber = 0;
    this.matchOver = false;
    this.state = "IDLE";
    this.currentRoundData = null;
    this.roundHistory = [];
    this.playerMoveStats = { stone: 0, paper: 0, scissors: 0 };
    this.lastPlayerMove = null;
    this.lastAiMove = null;
    this.lastRoundWinner = null;
    this.maxDeficit = 0;

    if (this.timeAttackInterval) {
      clearInterval(this.timeAttackInterval);
      this.timeAttackInterval = null;
    }
    this.timeAttackRemaining = 60;
  }

  /**
   * Transparent AI Move Decision Engine
   * Easy: Uniform random
   * Normal: Psychological win-stay / lose-shift prediction (60%) + random (40%)
   * Hard: Frequency weighted counter & streak counter (70%) + random (30%)
   */
  decideAiMove() {
    const randomPick = () => MOVES[Math.floor(Math.random() * MOVES.length)];

    // EASY DIFFICULTY: Purely random
    if (this.difficulty === "easy") {
      return { move: randomPick(), strategy: "Random selection (Beginner)" };
    }

    // NORMAL DIFFICULTY: Win-Stay, Lose-Shift Heuristic
    if (this.difficulty === "normal") {
      // 40% pure random to stay unpredictable
      if (Math.random() < 0.40 || !this.lastPlayerMove || !this.lastRoundWinner) {
        return { move: randomPick(), strategy: "Balanced random baseline" };
      }

      // If human won last round, humans statistically tend to repeat the winning move
      if (this.lastRoundWinner === "player") {
        const expectedRepeat = this.lastPlayerMove;
        const counterMove = MOVE_DETAILS[expectedRepeat].losesTo;
        return { move: counterMove, strategy: "Tactical counter to win-stay tendency" };
      }

      // If human lost last round, humans statistically tend to shift to what would have beaten AI's move
      if (this.lastRoundWinner === "ai" && this.lastAiMove) {
        const expectedShift = MOVE_DETAILS[this.lastAiMove].losesTo;
        const counterMove = MOVE_DETAILS[expectedShift].losesTo;
        return { move: counterMove, strategy: "Predictive counter to lose-shift tendency" };
      }

      return { move: randomPick(), strategy: "Adaptive move" };
    }

    // HARD DIFFICULTY: Multi-round Frequency Analysis & Pattern Countering
    if (this.difficulty === "hard") {
      // 30% random to prevent the player from exploiting the AI
      if (Math.random() < 0.30 || this.roundNumber < 1) {
        return { move: randomPick(), strategy: "Chaos randomization" };
      }

      // Find player's most frequent move so far
      const totalMoves = this.playerMoveStats.stone + this.playerMoveStats.paper + this.playerMoveStats.scissors;
      if (totalMoves >= 2) {
        const counts = this.playerMoveStats;
        let favoriteMove = "stone";
        if (counts.paper > counts[favoriteMove]) favoriteMove = "paper";
        if (counts.scissors > counts[favoriteMove]) favoriteMove = "scissors";

        // If player has a distinct favorite (thrown >= 40% of the time)
        if (counts[favoriteMove] / totalMoves >= 0.38) {
          const hardCounter = MOVE_DETAILS[favoriteMove].losesTo;
          return { move: hardCounter, strategy: `Exploiting ${favoriteMove} frequency pattern` };
        }
      }

      // If player repeated the same move twice in a row
      const len = this.roundHistory.length;
      if (len >= 2 && this.roundHistory[len - 1].playerMove === this.roundHistory[len - 2].playerMove) {
        const repeated = this.roundHistory[len - 1].playerMove;
        // Counter the repeat
        return { move: MOVE_DETAILS[repeated].losesTo, strategy: "Double-repetition counter" };
      }

      // Default hard response: counter last player move
      if (this.lastPlayerMove) {
        return { move: MOVE_DETAILS[this.lastPlayerMove].losesTo, strategy: "Direct tempo shift" };
      }

      return { move: randomPick(), strategy: "Neural heuristic baseline" };
    }

    return { move: randomPick(), strategy: "Default fallback" };
  }

  evaluateWinner(pMove, aMove) {
    if (pMove === aMove) return "draw";
    if (MOVE_DETAILS[pMove].beats === aMove) return "player";
    return "ai";
  }

  recordRoundResult(playerMove, aiDecision) {
    const aiMove = aiDecision.move;
    const outcome = this.evaluateWinner(playerMove, aiMove);

    this.roundNumber++;
    this.lastPlayerMove = playerMove;
    this.lastAiMove = aiMove;
    this.lastRoundWinner = outcome;

    // Update player move tracking
    if (this.playerMoveStats[playerMove] !== undefined) {
      this.playerMoveStats[playerMove]++;
    }

    if (outcome === "player") {
      this.playerScore++;
    } else if (outcome === "ai") {
      this.aiScore++;
    } else {
      this.draws++;
    }

    // Track deficit for comeback achievement
    const deficit = this.aiScore - this.playerScore;
    if (deficit > this.maxDeficit) {
      this.maxDeficit = deficit;
    }

    const roundData = {
      round: this.roundNumber,
      playerMove,
      aiMove,
      outcome,
      strategy: aiDecision.strategy,
      playerScore: this.playerScore,
      aiScore: this.aiScore,
      draws: this.draws
    };

    this.roundHistory.push(roundData);
    this.currentRoundData = roundData;

    // Check if match has ended
    this.matchOver = this.checkIfMatchEnded();

    return roundData;
  }

  checkIfMatchEnded() {
    const config = this.getModeConfig();

    if (this.mode === "practice") {
      return false; // Never auto-ends
    }

    if (this.mode === "survival") {
      // In survival mode, any round loss immediately ends the match!
      return this.lastRoundWinner === "ai";
    }

    if (this.mode === "time_attack") {
      return this.timeAttackRemaining <= 0;
    }

    if (this.mode === "quick") {
      // First to 2 wins, or max 3 rounds
      if (this.playerScore >= 2 || this.aiScore >= 2) return true;
      if (this.roundNumber >= 3) return true;
      return false;
    }

    if (this.mode === "best_of_5") {
      // First to 3 wins, or max 5 rounds
      if (this.playerScore >= 3 || this.aiScore >= 3) return true;
      if (this.roundNumber >= 5) return true;
      return false;
    }

    return false;
  }

  getMatchSummary() {
    const won = this.playerScore > this.aiScore;
    const tied = this.playerScore === this.aiScore;
    const wasComeback = won && this.maxDeficit >= 2;

    // Calculate XP reward
    let xpEarned = 0;
    if (this.mode !== "practice") {
      xpEarned += this.playerScore * 50;
      xpEarned += this.draws * 20;
      xpEarned += this.aiScore * 10;
      if (won) xpEarned += 100;
      if (this.difficulty === "normal") xpEarned += 25;
      if (this.difficulty === "hard") xpEarned += 50;
      if (wasComeback) xpEarned += 75;
    }

    return {
      mode: this.mode,
      difficulty: this.difficulty,
      playerWins: this.playerScore,
      aiWins: this.aiScore,
      draws: this.draws,
      roundsPlayed: this.roundNumber,
      won,
      tied,
      wasComeback,
      streak: this.mode === "survival" ? this.playerScore : 0,
      xpEarned,
      history: this.roundHistory
    };
  }
}

/**
 * AI Stone Paper Scissors — College Career Fest Edition
 * Main Application Controller & UI State Orchestrator
 */

import { GestureDetector } from "./gestureDetector.js";
import { AudioService } from "./audioService.js";
import { StorageService, ACHIEVEMENTS_LIST } from "./storageService.js";
import { GameEngine, MOVE_DETAILS, GAME_MODES } from "./gameEngine.js";
import { QRCodeGenerator } from "./qrService.js";

// DOM Selector Helper
const $ = (id) => document.getElementById(id);

class App {
  constructor() {
    // Services
    this.audio = new AudioService();
    this.storage = new StorageService();
    this.game = new GameEngine();

    // DOM Elements
    this.video = $("video");
    this.canvas = $("landmarksCanvas");
    this.detector = new GestureDetector(this.video, this.canvas);

    // Kiosk & Inactivity Timer
    this.idleTimer = null;
    this.isAttractMode = false;
    this.demoInterval = null;

    // Countdown / Round timer
    this.roundTimeout = null;
    this.isRoundRunning = false;
    this.timeAttackInterval = null;

    // Temporary gesture override (from manual buttons)
    this.manualMoveOverride = null;

    this.init();
  }

  async init() {
    this.applySettingsToUI();
    this.updateProfileUI();
    this.updateScoreboardUI();
    this.updateLeaderboardUI();
    this.updateAchievementsUI();
    this.bindEvents();
    this.resetIdleTimer();

    // Setup Gesture Frame Callback
    this.detector.onFrameCallback = (data) => this.onGestureFrame(data);

    // Update QR Code on startup
    this.renderExhibitionQR();
  }

  // --- Settings & UI Synchronization ---
  applySettingsToUI() {
    const s = this.storage.settings;
    this.audio.setSoundEnabled(s.soundEnabled);
    this.audio.setVoiceEnabled(s.voiceEnabled);
    this.audio.setVolume(s.volume);
    this.detector.showLandmarks = s.showLandmarks;

    if (s.reducedMotion) {
      document.body.classList.add("reduced-motion");
    } else {
      document.body.classList.remove("reduced-motion");
    }

    // Toggle button texts
    $("soundToggleBtn").textContent = s.soundEnabled ? "♫ SFX: ON" : "♫ SFX: OFF";
    $("voiceToggleBtn").textContent = s.voiceEnabled ? "🗣 VOICE: ON" : "🗣 VOICE: OFF";

    // Exhibition Branding
    $("headerEventSub").textContent = s.exhibition.eventName || "CAREER FEST 2026";
    $("footerEventText").textContent = `${s.exhibition.collegeName} • ${s.exhibition.eventName}`;
    $("footerTeamText").textContent = `${s.exhibition.department} • ${s.exhibition.teamName}`;

    // Difficulty Pill
    this.updateDifficultyDisplay(s.difficulty);
    this.game.setDifficulty(s.difficulty);
  }

  updateDifficultyDisplay(diff) {
    const pill = $("currentDifficultyPill");
    pill.className = `difficulty-pill ${diff}`;
    const labels = {
      easy: "EASY AI",
      normal: "NORMAL AI",
      hard: "BOSS AI (HARD)"
    };
    pill.textContent = labels[diff] || "NORMAL AI";

    // Update Robot Card appearance for Boss Mode
    const robotCard = $("robotCard");
    if (diff === "hard") {
      robotCard.classList.add("boss-mode");
      $("robotCardName").textContent = "CYBER OVERLORD";
      $("robotVersionTag").textContent = "BOSS ENGINE v3.0";
    } else {
      robotCard.classList.remove("boss-mode");
      $("robotCardName").textContent = "CYBER BOT";
      $("robotVersionTag").textContent = diff === "easy" ? "CYBER-TRAINEE" : "CYBER-TACTICIAN";
    }
  }

  updateProfileUI() {
    const profile = this.storage.profile;
    const lvlInfo = this.storage.getLevelInfo();

    $("topPlayerName").textContent = profile.nickname;
    $("topPlayerLevel").textContent = `LVL ${lvlInfo.level}`;
    $("topXpFill").style.width = `${lvlInfo.progressPercent}%`;

    $("scoreboardPlayerName").textContent = profile.nickname.toUpperCase();
    $("playerCardName").textContent = profile.nickname.toUpperCase();

    // Welcome nickname input sync
    if ($("welcomeNickname")) {
      $("welcomeNickname").value = profile.nickname;
    }
    if ($("editNicknameInput")) {
      $("editNicknameInput").value = profile.nickname;
    }
  }

  updateScoreboardUI() {
    $("playerScore").textContent = this.game.playerScore;
    $("aiScore").textContent = this.game.aiScore;
    $("drawScore").textContent = this.game.draws;

    const streak = this.storage.stats.currentStreak;
    const best = this.storage.stats.bestStreak;
    $("streakCount").textContent = streak;
    $("bestStreakCount").textContent = best;

    // Update mode badge
    const modeConfig = this.game.getModeConfig();
    $("currentModeBadge").textContent = modeConfig.name.toUpperCase();

    if (this.game.mode === "time_attack") {
      $("roundLabel").textContent = `TIME: ${this.game.timeAttackRemaining}s`;
    } else if (this.game.mode === "survival") {
      $("roundLabel").textContent = `SURVIVAL RUN: ${this.game.playerScore} WINS`;
    } else if (this.game.mode === "practice") {
      $("roundLabel").textContent = `PRACTICE ROUND ${this.game.roundNumber + 1}`;
    } else {
      $("roundLabel").textContent = `ROUND ${Math.min(this.game.roundNumber + 1, modeConfig.maxRounds)} / ${modeConfig.maxRounds}`;
    }
  }

  // --- Real-Time Gesture Frame Handler ---
  onGestureFrame(data) {
    if (this.isAttractMode) return;

    // Calibration feedback in Tutorial Modal
    if (!$("tutorialOverlay").classList.contains("hidden")) {
      this.updateCalibrationUI(data);
    }

    // Active gameplay hand feedback
    if (data.hasHand) {
      $("camStatus").textContent = "● HAND DETECTED";
      $("camStatus").style.color = "var(--green)";
      $("camStatus").style.borderColor = "rgba(0, 255, 157, 0.4)";
    } else {
      $("camStatus").textContent = "● CAMERA LIVE";
      $("camStatus").style.color = "var(--cyan)";
      $("camStatus").style.borderColor = "rgba(0, 240, 255, 0.4)";
    }

    if (data.gesture && !this.isRoundRunning) {
      const details = MOVE_DETAILS[data.gesture];
      if (details) {
        $("playerGesture").textContent = details.emoji;
        $("playerMoveLabel").textContent = details.label;
        $("handStatus").textContent = `Hold pose (${data.stability >= 2 ? "Stable" : "Detecting..."})`;
      }
    } else if (!data.hasHand && !this.isRoundRunning) {
      $("handStatus").textContent = "Position your hand in frame";
    }
  }

  updateCalibrationUI(data) {
    const lightEl = $("calibLightStatus");
    const distEl = $("calibDistanceStatus");
    const gestEl = $("calibGestureName");

    if (data.lightingStatus === "good") {
      lightEl.textContent = "Optimal Lighting";
      lightEl.className = "status-badge good";
    } else if (data.lightingStatus === "low_light") {
      lightEl.textContent = "Low Light Warning";
      lightEl.className = "status-badge warning";
    } else {
      lightEl.textContent = "Glare Warning";
      lightEl.className = "status-badge alert";
    }

    const distMap = {
      no_hand: { text: "No Hand In Frame", cls: "status-badge alert" },
      too_far: { text: "Move Hand Closer", cls: "status-badge warning" },
      too_close: { text: "Move Hand Back", cls: "status-badge warning" },
      edge: { text: "Center Hand In Frame", cls: "status-badge warning" },
      good: { text: "Good Position & Distance", cls: "status-badge good" }
    };
    const dist = distMap[data.distanceStatus] || distMap.no_hand;
    distEl.textContent = dist.text;
    distEl.className = dist.cls;

    if (data.gesture) {
      const details = MOVE_DETAILS[data.gesture];
      gestEl.textContent = `${details.emoji} ${details.label}`;
    } else {
      gestEl.textContent = data.hasHand ? "Recognizing..." : "None";
    }
  }

  // --- Match & Round Lifecycle ---
  async startMatch() {
    this.hideOverlay("welcomeOverlay");
    this.hideOverlay("endMatchOverlay");
    this.hideOverlay("cameraErrorOverlay");

    try {
      $("startBtn").disabled = true;
      $("startBtn").textContent = "CONNECTING…";

      // Initialize Audio Context on user click
      this.audio.initAudioContext();

      // Start webcam & load MediaPipe model
      if (!this.detector.isModelLoaded) {
        $("placeholderText").textContent = "Loading MediaPipe hand-tracking AI…";
        await this.detector.loadModel();
      }
      if (!this.detector.isRunning) {
        await this.detector.startCamera();
        $("video").classList.remove("hidden");
        $("cameraPlaceholder").classList.add("hidden");
      }

      this.game.resetMatch();
      this.updateScoreboardUI();

      $("startBtn").classList.add("hidden");
      $("nextBtn").classList.remove("hidden");
      $("nextBtn").disabled = true;
      $("pauseBtn").classList.remove("hidden");

      $("resultBanner").textContent = "MATCH COMMENCED! GET READY FOR ROUND 1";
      $("resultBanner").className = "result-banner";

      // If Time Attack Mode, start countdown timer
      if (this.game.mode === "time_attack") {
        this.startTimeAttackClock();
      }

      this.beginRound();
    } catch (err) {
      console.error("Camera startup error:", err);
      $("cameraErrorMessage").textContent = err.message || "Camera access failed.";
      this.showOverlay("cameraErrorOverlay");
      $("startBtn").disabled = false;
      $("startBtn").textContent = "▶ START MATCH";
    }
  }

  beginRound() {
    if (this.isRoundRunning || this.game.matchOver) return;

    this.isRoundRunning = true;
    this.manualMoveOverride = null;
    $("nextBtn").disabled = true;

    // Reset visual cues
    $("countdownBox").textContent = "READY?";
    $("countdownBox").classList.remove("shoot");
    $("playerGesture").textContent = "🤚";
    $("playerMoveLabel").textContent = "YOUR MOVE";
    $("handStatus").textContent = "Hold pose facing camera";
    $("aiGesture").textContent = "🤖";
    $("aiMoveLabel").textContent = "THINKING…";
    $("aiStatus").textContent = "Analyzing tactics...";

    $("resultBanner").textContent = "GET READY… PREPARE YOUR MOVE!";
    $("resultBanner").className = "result-banner";

    // Voice announcement
    this.audio.announceRound(this.game.roundNumber + 1);

    let count = 3;
    const tick = () => {
      if (count > 0) {
        $("countdownBox").textContent = String(count);
        this.audio.playCountdown(count);
        this.audio.announceCountdown(count);
        count--;
        this.roundTimeout = setTimeout(tick, 850);
      } else {
        // SHOOT! Moment
        $("countdownBox").textContent = "SHOOT!";
        $("countdownBox").classList.add("shoot");
        this.audio.playShoot();
        this.audio.announceCountdown(0);
        this.roundTimeout = setTimeout(() => this.captureRoundOutcome(), 600);
      }
    };

    this.roundTimeout = setTimeout(tick, 200);
  }

  captureRoundOutcome() {
    // 1. Identify player move: Either manual button override OR stable webcam gesture
    let chosenMove = this.manualMoveOverride;
    if (!chosenMove && this.detector.lastDetectedGesture && this.detector.gestureStability >= 1) {
      chosenMove = this.detector.lastDetectedGesture;
    }

    if (!chosenMove) {
      // Failed to catch hand gesture
      this.isRoundRunning = false;
      $("countdownBox").textContent = "TRY AGAIN";
      $("countdownBox").classList.remove("shoot");
      $("resultBanner").textContent = "⚠️ HAND NOT DETECTED! HOLD A CLEAR POSE & RETRY.";
      $("resultBanner").className = "result-banner draw";
      $("hintText").textContent = "Make a clear ✊ Stone, ✋ Paper, or ✌️ Scissors pose and press NEXT ROUND.";
      $("nextBtn").disabled = false;
      this.audio.playTone(220, 0.25, "triangle");
      return;
    }

    // 2. AI decides tactical move
    const aiDecision = this.game.decideAiMove();

    // 3. Evaluate outcome
    const roundData = this.game.recordRoundResult(chosenMove, aiDecision);
    const playerDetail = MOVE_DETAILS[chosenMove];
    const aiDetail = MOVE_DETAILS[aiDecision.move];

    // Reveal moves
    $("playerGesture").textContent = playerDetail.emoji;
    $("playerMoveLabel").textContent = playerDetail.label;
    $("handStatus").textContent = "Move Locked In!";

    $("aiGesture").textContent = aiDetail.emoji;
    $("aiMoveLabel").textContent = aiDetail.label;
    $("aiStatus").textContent = aiDecision.strategy;

    // Process outcome & animations
    const recordResult = this.storage.recordRound(roundData.outcome, chosenMove);
    this.updateScoreboardUI();

    if (roundData.outcome === "player") {
      $("resultBanner").textContent = `⚡ YOU WIN! ${playerDetail.label} BEATS ${aiDetail.label}`;
      $("resultBanner").className = "result-banner win";
      this.audio.playWin();
      this.audio.announceRoundResult("win");
      this.triggerConfetti(60);
      if (recordResult.currentStreak >= 3) {
        this.audio.announceStreak(recordResult.currentStreak);
      }
    } else if (roundData.outcome === "ai") {
      $("resultBanner").textContent = `🤖 CYBER BOT WINS! ${aiDetail.label} BEATS ${playerDetail.label}`;
      $("resultBanner").className = "result-banner lose";
      this.audio.playLose();
      this.audio.announceRoundResult("lose");
    } else {
      $("resultBanner").textContent = `🤝 DRAW! BOTH THREW ${playerDetail.label}`;
      $("resultBanner").className = "result-banner draw";
      this.audio.playDraw();
      this.audio.announceRoundResult("draw");
    }

    // Check newly unlocked achievements
    if (recordResult.newlyUnlocked && recordResult.newlyUnlocked.length > 0) {
      recordResult.newlyUnlocked.forEach(ach => this.showAchievementToast(ach));
    }

    this.isRoundRunning = false;
    $("nextBtn").disabled = false;

    // Check if Match has Concluded
    if (this.game.matchOver) {
      $("nextBtn").textContent = "VIEW FINAL RESULTS →";
      $("hintText").textContent = "Match concluded! Click to view your champion breakdown.";
    } else {
      // In Time Attack mode, auto advance after 1.4s
      if (this.game.mode === "time_attack" && this.game.timeAttackRemaining > 2) {
        setTimeout(() => this.beginRound(), 1400);
      } else {
        $("hintText").textContent = `Round ${this.game.roundNumber} complete. Click NEXT ROUND when ready!`;
      }
    }
  }

  finishMatch() {
    if (this.timeAttackInterval) {
      clearInterval(this.timeAttackInterval);
      this.timeAttackInterval = null;
    }

    const summary = this.game.getMatchSummary();

    // Award XP
    const xpResult = this.storage.addXP(summary.xpEarned);
    this.updateProfileUI();

    // Check match-end achievements
    const matchAchievements = this.storage.recordMatchEnd(summary);
    if (matchAchievements && matchAchievements.length > 0) {
      matchAchievements.forEach(ach => this.showAchievementToast(ach));
    }

    // Add to Local Leaderboard
    if (this.game.mode !== "practice") {
      const score = this.game.mode === "survival" ? summary.playerWins : summary.playerWins;
      this.storage.addLeaderboardEntry({
        nickname: this.storage.profile.nickname,
        mode: this.game.mode,
        score,
        streak: summary.streak,
        winRate: this.storage.getWinRate()
      });
      this.updateLeaderboardUI();
    }

    // Configure End Match Modal
    const won = summary.won;
    const tied = summary.tied;

    if (won) {
      $("endMatchIcon").textContent = "🏆";
      $("endMatchTitle").textContent = "YOU'RE THE FEST CHAMPION!";
      $("endMatchDesc").textContent = `Outstanding! You defeated the AI ${summary.playerWins}–${summary.aiWins} (${summary.draws} draw${summary.draws === 1 ? '' : 's'})!`;
      this.audio.playMatchVictory();
      this.audio.announceMatchResult(true);
      this.triggerConfetti(140);
    } else if (tied) {
      $("endMatchIcon").textContent = "🤝";
      $("endMatchTitle").textContent = "HONORABLE DRAW!";
      $("endMatchDesc").textContent = `Evenly matched! Final score: ${summary.playerWins}–${summary.aiWins}.`;
      this.audio.playDraw();
    } else {
      $("endMatchIcon").textContent = "🤖";
      $("endMatchTitle").textContent = "CYBER BOT CLAIMS VICTORY";
      $("endMatchDesc").textContent = `The AI took the match ${summary.aiWins}–${summary.playerWins}. Rematch to reclaim the arena!`;
      this.audio.playMatchDefeat();
      this.audio.announceMatchResult(false);
    }

    $("endMatchXpVal").textContent = `+${summary.xpEarned} XP`;
    if (xpResult.leveledUp) {
      $("endMatchLevelUpNotice").classList.remove("hidden");
      this.audio.playLevelUp();
    } else {
      $("endMatchLevelUpNotice").classList.add("hidden");
    }

    // Populate round-by-round history table
    const tbody = $("endMatchHistoryTable").querySelector("tbody");
    tbody.innerHTML = "";
    summary.history.forEach((h) => {
      const tr = document.createElement("tr");
      const pDetail = MOVE_DETAILS[h.playerMove];
      const aDetail = MOVE_DETAILS[h.aiMove];
      const outcomeText = h.outcome === "player" ? "WIN" : h.outcome === "ai" ? "LOSE" : "DRAW";
      const outcomeColor = h.outcome === "player" ? "var(--green)" : h.outcome === "ai" ? "var(--red)" : "#c9b4f7";

      tr.innerHTML = `
        <td>Round ${h.round}</td>
        <td>${pDetail ? pDetail.emoji + ' ' + pDetail.label : h.playerMove}</td>
        <td>${aDetail ? aDetail.emoji + ' ' + aDetail.label : h.aiMove}</td>
        <td style="color: ${outcomeColor}; font-weight: 700;">${outcomeText}</td>
      `;
      tbody.appendChild(tr);
    });

    this.showOverlay("endMatchOverlay");
  }

  startTimeAttackClock() {
    this.game.timeAttackRemaining = 60;
    this.timeAttackInterval = setInterval(() => {
      this.game.timeAttackRemaining--;
      $("roundLabel").textContent = `TIME: ${this.game.timeAttackRemaining}s`;

      if (this.game.timeAttackRemaining <= 0) {
        clearInterval(this.timeAttackInterval);
        this.timeAttackInterval = null;
        this.game.matchOver = true;
        this.finishMatch();
      }
    }, 1000);
  }

  // --- Confetti & Achievement Toast Effects ---
  triggerConfetti(amount = 70) {
    if (this.storage.settings.reducedMotion) return;
    const colors = ["#00f0ff", "#a855f7", "#ff2a85", "#00ff9d", "#ffd700", "#ffffff"];
    for (let i = 0; i < amount; i++) {
      const el = document.createElement("div");
      el.className = "confetti";
      el.style.left = Math.random() * 100 + "vw";
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = 2 + Math.random() * 2.5 + "s";
      el.style.animationDelay = Math.random() * 0.5 + "s";
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  }

  showAchievementToast(achievement) {
    this.audio.playAchievement();
    const container = $("toastContainer");
    const toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.innerHTML = `
      <div class="toast-icon">${achievement.icon}</div>
      <div class="toast-text">
        <strong>ACHIEVEMENT UNLOCKED!</strong>
        <span>${achievement.name}</span>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(120%)";
      toast.style.transition = "all 0.5s ease";
      setTimeout(() => toast.remove(), 500);
    }, 3800);
  }

  // --- Exhibition QR Code Generator ---
  renderExhibitionQR() {
    const configuredUrl = this.storage.settings.exhibition.publicUrl;
    const targetUrl = configuredUrl && configuredUrl.trim().length > 0
      ? configuredUrl.trim()
      : window.location.href;

    const qrSvg = QRCodeGenerator.generateSVG(targetUrl, {
      size: 210,
      color: "#00f0ff",
      background: "#080c1e"
    });

    $("qrCodeContainer").innerHTML = qrSvg;
    $("publicUrlInput").value = targetUrl;
  }

  // --- Leaderboard & Stats Updates ---
  updateLeaderboardUI() {
    const list = this.storage.leaderboard;
    const tbody = $("leaderboardBody");
    tbody.innerHTML = "";

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 18px;">No records yet. Be the first to claim victory!</td></tr>`;
      return;
    }

    list.slice(0, 10).forEach((entry, idx) => {
      const tr = document.createElement("tr");
      const rankCls = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "";
      const rankBadge = idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`;

      tr.innerHTML = `
        <td class="${rankCls}">${rankBadge}</td>
        <td><b>${entry.nickname}</b></td>
        <td style="text-transform: capitalize;">${entry.mode.replace("_", " ")}</td>
        <td style="color: var(--cyan); font-weight: 800;">${entry.score}</td>
        <td style="color: var(--gold);">${entry.streak}</td>
        <td>LVL ${entry.level}</td>
        <td style="color: var(--text-dim); font-size: 11px;">${entry.date}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  updateAchievementsUI() {
    const container = $("achievementsGrid");
    container.innerHTML = "";

    ACHIEVEMENTS_LIST.forEach(item => {
      const status = this.storage.achievements[item.id] || { unlocked: false };
      const card = document.createElement("div");
      card.className = `achieve-card ${status.unlocked ? "unlocked" : "locked"}`;
      card.innerHTML = `
        <div class="achieve-icon">${item.icon}</div>
        <div class="achieve-title">${item.name}</div>
        <div class="achieve-desc">${item.desc}</div>
        ${status.unlocked ? '<div style="font-size: 9px; color: var(--green); font-weight: 800; margin-top: auto;">✓ UNLOCKED</div>' : '<div style="font-size: 9px; color: var(--text-dim); margin-top: auto;">🔒 LOCKED</div>'}
      `;
      container.appendChild(card);
    });

    // Overview Stats
    const stats = this.storage.stats;
    $("statTotalMatches").textContent = stats.totalMatches;
    $("statTotalWins").textContent = stats.wins;
    $("statWinRate").textContent = `${this.storage.getWinRate()}%`;
    $("statBestStreak").textContent = stats.bestStreak;
    $("statStoneCount").textContent = stats.gestureCounts.stone;
    $("statPaperCount").textContent = stats.gestureCounts.paper;
    $("statScissorsCount").textContent = stats.gestureCounts.scissors;
  }

  // --- Kiosk Attract Mode Screensaver ---
  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const timeoutSeconds = this.storage.settings.attractTimeout || 45;
    if (timeoutSeconds <= 0) return; // Disabled

    this.idleTimer = setTimeout(() => {
      // Only enter attract mode if not in an active countdown or match round
      if (!this.isRoundRunning && !this.isAttractMode) {
        this.enterAttractMode();
      }
    }, timeoutSeconds * 1000);
  }

  enterAttractMode() {
    this.isAttractMode = true;
    $("attractScreen").classList.remove("hidden");

    // Simulated Replay Loop
    const demoPairs = [
      { human: "✊", ai: "✌️" },
      { human: "✋", ai: "✊" },
      { human: "✌️", ai: "✋" },
      { human: "✊", ai: "✋" }
    ];
    let demoIdx = 0;
    this.demoInterval = setInterval(() => {
      demoIdx = (demoIdx + 1) % demoPairs.length;
      $("demoHumanMove").textContent = demoPairs[demoIdx].human;
      $("demoAiMove").textContent = demoPairs[demoIdx].ai;
    }, 2000);
  }

  exitAttractMode() {
    if (!this.isAttractMode) return;
    this.isAttractMode = false;
    $("attractScreen").classList.add("hidden");
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.resetIdleTimer();
  }

  // --- Modal Helpers ---
  showOverlay(id) {
    $(id).classList.remove("hidden");
  }

  hideOverlay(id) {
    $(id).classList.add("hidden");
  }

  // --- Event Bindings ---
  bindEvents() {
    // Topbar Actions
    $("tutorialNavBtn").addEventListener("click", () => {
      this.audio.playClick();
      this.showOverlay("tutorialOverlay");
    });
    $("leaderboardNavBtn").addEventListener("click", () => {
      this.audio.playClick();
      this.updateLeaderboardUI();
      this.showOverlay("leaderboardOverlay");
    });
    $("statsNavBtn").addEventListener("click", () => {
      this.audio.playClick();
      this.updateAchievementsUI();
      this.showOverlay("statsOverlay");
    });
    $("exhibitionNavBtn").addEventListener("click", () => {
      this.audio.playClick();
      this.renderExhibitionQR();
      this.showOverlay("exhibitionOverlay");
    });
    $("settingsNavBtn").addEventListener("click", () => {
      this.audio.playClick();
      this.showOverlay("settingsOverlay");
    });
    $("playerProfileBtn").addEventListener("click", () => {
      this.audio.playClick();
      this.updateAchievementsUI();
      this.showOverlay("statsOverlay");
    });

    // Fullscreen Toggle
    $("fullscreenNavBtn").addEventListener("click", () => {
      this.audio.playClick();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Start / Welcome Buttons
    $("welcomeStartBtn").addEventListener("click", () => {
      const nick = $("welcomeNickname").value.trim();
      if (nick) this.storage.setNickname(nick);
      this.updateProfileUI();
      this.startMatch();
    });
    $("startBtn").addEventListener("click", () => this.startMatch());
    $("nextBtn").addEventListener("click", () => {
      this.audio.playClick();
      if (this.game.matchOver) {
        this.finishMatch();
      } else {
        this.beginRound();
      }
    });
    $("restartBtn").addEventListener("click", () => {
      this.audio.playClick();
      if (confirm("Restart current match?")) {
        this.detector.stop();
        this.game.resetMatch();
        this.updateScoreboardUI();
        $("startBtn").classList.remove("hidden");
        $("startBtn").disabled = false;
        $("startBtn").textContent = "▶ START MATCH";
        $("nextBtn").classList.add("hidden");
        $("pauseBtn").classList.add("hidden");
        $("video").classList.add("hidden");
        $("cameraPlaceholder").classList.remove("hidden");
        this.showOverlay("welcomeOverlay");
      }
    });

    // Pause button
    $("pauseBtn").addEventListener("click", () => {
      this.audio.playClick();
      alert("Match Paused. Press OK to resume.");
    });

    // Audio Toggles
    $("soundToggleBtn").addEventListener("click", () => {
      const next = !this.audio.soundEnabled;
      this.audio.setSoundEnabled(next);
      this.storage.updateSettings({ soundEnabled: next });
      $("soundToggleBtn").textContent = next ? "♫ SFX: ON" : "♫ SFX: OFF";
      if (next) this.audio.playTone(700, 0.1);
    });

    $("voiceToggleBtn").addEventListener("click", () => {
      const next = !this.audio.voiceEnabled;
      this.audio.setVoiceEnabled(next);
      this.storage.updateSettings({ voiceEnabled: next });
      $("voiceToggleBtn").textContent = next ? "🗣 VOICE: ON" : "🗣 VOICE: OFF";
      if (next) this.audio.speak("Voice announcer enabled");
    });

    // Skeleton Overlay Toggle
    $("toggleOverlayBtn").addEventListener("click", () => {
      this.detector.showLandmarks = !this.detector.showLandmarks;
      this.storage.updateSettings({ showLandmarks: this.detector.showLandmarks });
      $("toggleOverlayBtn").textContent = this.detector.showLandmarks ? "🦴 Skeleton: ON" : "🦴 Skeleton: OFF";
    });

    // Fallback Manual Gesture Buttons
    document.querySelectorAll(".gesture-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const move = e.currentTarget.getAttribute("data-move");
        this.manualMoveOverride = move;
        this.audio.playClick();
        const details = MOVE_DETAILS[move];
        if (details) {
          $("playerGesture").textContent = details.emoji;
          $("playerMoveLabel").textContent = details.label + " (MANUAL)";
          $("handStatus").textContent = "Manual move armed!";
        }
      });
    });

    // Close Modal Buttons
    $("closeTutorialBtn").addEventListener("click", () => this.hideOverlay("tutorialOverlay"));
    $("tutorialDoneBtn").addEventListener("click", () => this.hideOverlay("tutorialOverlay"));
    $("closeLeaderboardBtn").addEventListener("click", () => this.hideOverlay("leaderboardOverlay"));
    $("leaderboardOkBtn").addEventListener("click", () => this.hideOverlay("leaderboardOverlay"));
    $("closeStatsBtn").addEventListener("click", () => this.hideOverlay("statsOverlay"));
    $("closeSettingsBtn").addEventListener("click", () => this.hideOverlay("settingsOverlay"));
    $("closeExhibitionBtn").addEventListener("click", () => this.hideOverlay("exhibitionOverlay"));
    $("closeExhibitionDoneBtn").addEventListener("click", () => this.hideOverlay("exhibitionOverlay"));

    // Modal Tabs
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const parent = e.target.closest(".modal-card");
        const targetTab = e.target.getAttribute("data-tab");
        parent.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        parent.querySelectorAll(".tab-content").forEach(tc => tc.classList.add("hidden"));
        e.target.classList.add("active");
        const content = $(targetTab);
        if (content) content.classList.remove("hidden");
      });
    });

    // Welcome Screen Mode Selection
    document.querySelectorAll(".mode-select-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".mode-select-btn").forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
        const mode = e.currentTarget.getAttribute("data-mode");
        this.game.setMode(mode);
        this.updateScoreboardUI();
      });
    });

    // Welcome Screen Difficulty Selection
    document.querySelectorAll(".diff-select-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".diff-select-btn").forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
        const diff = e.currentTarget.getAttribute("data-diff");
        this.storage.updateSettings({ difficulty: diff });
        this.game.setDifficulty(diff);
        this.updateDifficultyDisplay(diff);
      });
    });

    // Rematch & Play Again
    $("playAgainBtn").addEventListener("click", () => {
      this.hideOverlay("endMatchOverlay");
      this.startMatch();
    });
    $("changeModeBtn").addEventListener("click", () => {
      this.hideOverlay("endMatchOverlay");
      this.showOverlay("welcomeOverlay");
    });

    // Save Profile & Reset Stats
    $("saveProfileBtn").addEventListener("click", () => {
      const name = $("editNicknameInput").value.trim();
      if (name) {
        this.storage.setNickname(name);
        this.updateProfileUI();
        alert("Nickname saved successfully!");
      }
    });

    $("resetStatsBtn").addEventListener("click", () => {
      if (confirm("Reset all competitive gameplay statistics to zero? (Your Level and XP will be preserved).")) {
        this.storage.resetStats();
        this.updateScoreboardUI();
        this.updateAchievementsUI();
      }
    });

    $("clearLeaderboardBtn").addEventListener("click", () => {
      if (confirm("Clear all leaderboard records on this device?")) {
        this.storage.clearLeaderboard();
        this.updateLeaderboardUI();
      }
    });

    // Settings Modal Inputs
    $("settingSoundToggle").addEventListener("change", (e) => {
      this.storage.updateSettings({ soundEnabled: e.target.checked });
      this.audio.setSoundEnabled(e.target.checked);
      $("soundToggleBtn").textContent = e.target.checked ? "♫ SFX: ON" : "♫ SFX: OFF";
    });

    $("settingVoiceToggle").addEventListener("change", (e) => {
      this.storage.updateSettings({ voiceEnabled: e.target.checked });
      this.audio.setVoiceEnabled(e.target.checked);
      $("voiceToggleBtn").textContent = e.target.checked ? "🗣 VOICE: ON" : "🗣 VOICE: OFF";
    });

    $("settingVolumeSlider").addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.storage.updateSettings({ volume: val });
      this.audio.setVolume(val);
    });

    $("settingOverlayToggle").addEventListener("change", (e) => {
      this.storage.updateSettings({ showLandmarks: e.target.checked });
      this.detector.showLandmarks = e.target.checked;
    });

    $("settingReducedMotionToggle").addEventListener("change", (e) => {
      this.storage.updateSettings({ reducedMotion: e.target.checked });
      if (e.target.checked) document.body.classList.add("reduced-motion");
      else document.body.classList.remove("reduced-motion");
    });

    $("settingAttractSelect").addEventListener("change", (e) => {
      const val = parseInt(e.target.value, 10);
      this.storage.updateSettings({ attractTimeout: val });
      this.resetIdleTimer();
    });

    $("saveSettingsBtn").addEventListener("click", () => {
      const college = $("settingCollegeName").value.trim();
      const eventName = $("settingEventName").value.trim();
      if (college || eventName) {
        this.storage.updateSettings({
          exhibition: {
            collegeName: college || this.storage.settings.exhibition.collegeName,
            eventName: eventName || this.storage.settings.exhibition.eventName
          }
        });
        this.applySettingsToUI();
      }
      this.hideOverlay("settingsOverlay");
    });

    // Exhibition URL & QR copy
    $("publicUrlInput").addEventListener("input", (e) => {
      const url = e.target.value.trim();
      this.storage.updateSettings({ exhibition: { publicUrl: url } });
      this.renderExhibitionQR();
    });

    $("copyUrlBtn").addEventListener("click", () => {
      const val = $("publicUrlInput").value;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).then(() => {
          $("copyUrlBtn").textContent = "✓ COPIED!";
          setTimeout(() => $("copyUrlBtn").textContent = "📋 COPY", 2000);
        });
      } else {
        alert("URL copied: " + val);
      }
    });

    // Camera Error Dialog Fallback buttons
    $("retryCameraBtn").addEventListener("click", () => this.startMatch());
    $("useManualControlsBtn").addEventListener("click", () => {
      this.hideOverlay("cameraErrorOverlay");
      $("startBtn").classList.add("hidden");
      $("nextBtn").classList.remove("hidden");
      $("nextBtn").disabled = false;
      this.game.resetMatch();
      this.updateScoreboardUI();
      this.beginRound();
    });

    // Attract Screen Exit
    $("attractScreen").addEventListener("click", () => this.exitAttractMode());
    $("exitAttractBtn").addEventListener("click", () => this.exitAttractMode());

    // User activity listeners to reset idle timer
    ["pointermove", "touchstart", "keydown", "click"].forEach(evt => {
      window.addEventListener(evt, () => {
        if (this.isAttractMode) {
          this.exitAttractMode();
        } else {
          this.resetIdleTimer();
        }
      }, { passive: true });
    });

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".overlay").forEach(o => {
          if (o.id !== "welcomeOverlay" && o.id !== "cameraErrorOverlay") {
            o.classList.add("hidden");
          }
        });
        return;
      }

      // Space or Enter advances round
      if (e.code === "Space" || e.code === "Enter") {
        if (!$("nextBtn").classList.contains("hidden") && !$("nextBtn").disabled) {
          $("nextBtn").click();
          e.preventDefault();
        }
      }

      // Number keys 1, 2, 3 for manual moves
      if (e.key === "1") {
        document.querySelector('.gesture-btn[data-move="stone"]')?.click();
      } else if (e.key === "2") {
        document.querySelector('.gesture-btn[data-move="paper"]')?.click();
      } else if (e.key === "3") {
        document.querySelector('.gesture-btn[data-move="scissors"]')?.click();
      } else if (e.key.toLowerCase() === "m") {
        $("soundToggleBtn").click();
      } else if (e.key.toLowerCase() === "v") {
        $("voiceToggleBtn").click();
      } else if (e.key.toLowerCase() === "f") {
        $("fullscreenNavBtn").click();
      } else if (e.key.toLowerCase() === "t") {
        $("tutorialNavBtn").click();
      }
    });

    // Cleanup on window unload
    window.addEventListener("pagehide", () => {
      this.detector.stop();
    });
  }
}

// Instantiate application on DOM ready
window.addEventListener("DOMContentLoaded", () => {
  window.appInstance = new App();
});

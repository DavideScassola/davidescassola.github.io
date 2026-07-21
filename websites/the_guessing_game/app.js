const API_BASE = "https://guess-ai.onrender.com";

const RANDOM_WORDS = [
  "cuttlefish",
  "umbrella",
  "volcano",
  "guitar",
  "penguin",
  "lighthouse",
  "comet",
  "waterfall",
  "dragon",
  "telescope",
  "sandwich",
  "kangaroo",
  "glacier",
  "trumpet",
  "cactus",
  "astronaut",
  "lantern",
  "tornado",
  "violin",
  "alluminum",
  "cinnamon",
  "eclipse",
  "firefly",
  "geyser",
  "hydrogen",
  "Julius Caesar",
  "Egypt",
  "seven",
  "European Union",
  "Nepal",
  "eel",
  "sofa",
  "thermometer",
  "saxophone",
  "pyramid",
  "sphinx",
  "tiger",
  "octopus",
  "jellyfish",
  "risotto",
  "exagon",
  "oak",
  "blood",
  "fear",
  "bra",
  "socks",
  "pilot",
  "Barack Obama",
  "salt",
  "Valencia",
  "Picasso",
  "toe",
  "parrot",
  "spleen",
  "Bitcoin",
];

const state = {
  secretWord: "",
  additionalInfo: "",
  questionsLimit: 0,
  guessesLimit: 0,
  questionsCount: 0,
  guessesCount: 0,
  history: [],
  guessHistory: [],
  isLoading: false,
  isGameOver: false,
};

let isCustomWordMode = false;

// Setup screen elements
const setupScreen = document.getElementById("setupScreen");
const setupDefault = document.getElementById("setupDefault");
const setupShared = document.getElementById("setupShared");
const toggleCustomWordButton = document.getElementById("toggleCustomWordButton");
const customWordContainer = document.getElementById("customWordContainer");
const secretWordSetupInput = document.getElementById("secretWordSetup");
const additionalInfoSetupInput = document.getElementById("additionalInfoSetup");
const questionsLimitSetup = document.getElementById("questionsLimitSetup");
const guessesLimitSetup = document.getElementById("guessesLimitSetup");
const startButton = document.getElementById("startButton");
const startSharedButton = document.getElementById("startSharedButton");

// Game screen elements
const gameScreen = document.getElementById("gameScreen");
const askSection = document.getElementById("askSection");
const guessSection = document.getElementById("guessSection");
const gameOverSection = document.getElementById("gameOverSection");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverMessage = document.getElementById("gameOverMessage");
const revealedWord = document.getElementById("revealedWord");
const statsDisplay = document.getElementById("statsDisplay");

const questionsLeftText = document.getElementById("questionsLeftText");
const guessesLeftText = document.getElementById("guessesLeftText");

const latestResultArea = document.getElementById("latestResultArea");
const lastQuestionText = document.getElementById("lastQuestionText");
const lastAnswerText = document.getElementById("lastAnswerText");
const resultExplanation = document.getElementById("resultExplanation");

const questionInput = document.getElementById("questionInput");
const askButton = document.getElementById("askButton");
const historyList = document.getElementById("historyList");
const guessHistoryList = document.getElementById("guessHistoryList");

const guessInput = document.getElementById("guessInput");
const guessButton = document.getElementById("guessButton");
const giveUpButton = document.getElementById("giveUpButton");
const guessMessage = document.getElementById("guessMessage");
const shareButton = document.getElementById("shareButton");
const restartButton = document.getElementById("restartButton");

function normalizeQuestion(question) {
  const trimmed = question.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
}

function pickRandomWord() {
  const index = Math.floor(Math.random() * RANDOM_WORDS.length);
  return RANDOM_WORDS[index];
}

const CIPHER_SHIFT = 7;
function shiftLetters(str, shift) {
  return str.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    const rotated = (((char.charCodeAt(0) - base + shift) % 26) + 26) % 26;
    return String.fromCharCode(rotated + base);
  });
}

function encodeSecretWord(word) {
  return btoa(shiftLetters(word, CIPHER_SHIFT));
}

function decodeSecretWord(encoded) {
  try {
    return shiftLetters(atob(encoded), -CIPHER_SHIFT);
  } catch (_err) {
    return "";
  }
}

function getSharedWordFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("w");
  return encoded ? decodeSecretWord(encoded) : "";
}

function buildShareUrl(word) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("w", encodeSecretWord(word));
  return url.toString();
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  askButton.disabled = isLoading;
  askButton.textContent = isLoading ? "Thinking..." : "Ask";
}

function updateLimitsDisplay() {
  statsDisplay.textContent = `Questions: ${state.questionsCount} | Guesses: ${state.guessesCount}`;

  if (state.questionsLimit > 0) {
    const qLeft = Math.max(0, state.questionsLimit - state.questionsCount);
    questionsLeftText.textContent = `(${qLeft} left)`;
  } else {
    questionsLeftText.textContent = "";
  }

  if (state.guessesLimit > 0) {
    const gLeft = Math.max(0, state.guessesLimit - state.guessesCount);
    guessesLeftText.textContent = `(${gLeft} left)`;
  } else {
    guessesLeftText.textContent = "";
  }
}

async function askModel(question, secretWord, additionalInfo) {
  const url = new URL(`${API_BASE}/ask`);
  url.searchParams.set("question", question);

  const apiWord = additionalInfo ? `${secretWord} (${additionalInfo})` : secretWord;
  url.searchParams.set("secret_word", apiWord);

  const response = await fetch(url.toString(), { method: "POST" });
  let data = {};
  try {
    data = await response.json();
  } catch (_err) {}

  if (response.status === 429) {
    throw new Error("Too many questions at once. Wait a moment and try again.");
  }
  if (!response.ok) {
    throw new Error(data.error || "Model request failed.");
  }
  return data;
}

function renderResult(question, yesProb) {
  latestResultArea.classList.remove("hidden");
  lastQuestionText.textContent = question;

  const pct = `${Math.round(yesProb * 100)}%`;
  const isYes = yesProb >= 0.5;

  lastAnswerText.textContent = isYes ? `Yes (${pct})` : `No (${pct})`;
  lastAnswerText.className = `value probability-small ${isYes ? "is-yes" : "is-no"}`;
  resultExplanation.textContent = "";
}

function renderHistory() {
  historyList.innerHTML = "";
  if (state.history.length === 0) {
    historyList.innerHTML = `<li class="history-item">No questions asked yet.</li>`;
    return;
  }
  for (const entry of state.history.slice().reverse()) {
    const li = document.createElement("li");
    li.className = "history-item-flex";

    const question = document.createElement("p");
    question.className = "history-question";
    question.textContent = entry.question;

    const pct = `${Math.round(entry.yesProb * 100)}%`;
    const meta = document.createElement("p");
    meta.className = `history-meta ${entry.yesProb >= 0.5 ? "text-ok" : "text-bad"}`;
    meta.textContent = entry.yesProb >= 0.5 ? `Yes (${pct})` : `No (${pct})`;

    li.append(question, meta);
    historyList.appendChild(li);
  }
}

function renderGuessHistory() {
  guessHistoryList.innerHTML = "";
  if (state.guessHistory.length === 0) {
    guessHistoryList.innerHTML = `<li class="history-item">No guesses made yet.</li>`;
    return;
  }
  for (const guessText of state.guessHistory.slice().reverse()) {
    const li = document.createElement("li");
    li.className = "history-item-flex";

    const guess = document.createElement("p");
    guess.className = "history-question";
    guess.textContent = guessText;

    const meta = document.createElement("p");
    meta.className = "history-meta text-bad";
    meta.textContent = "Incorrect";

    li.append(guess, meta);
    guessHistoryList.appendChild(li);
  }
}

function endGame(won, message) {
  state.isGameOver = true;
  askSection.classList.add("hidden");
  guessSection.classList.add("hidden");
  giveUpButton.classList.add("hidden");
  gameOverSection.classList.remove("hidden");

  gameOverTitle.textContent = won ? "You Won!" : "Game Over";
  gameOverMessage.textContent = message;
  revealedWord.textContent = state.secretWord;
}

async function askQuestion() {
  if (state.isLoading || state.isGameOver) return;
  if (state.questionsLimit > 0 && state.questionsCount >= state.questionsLimit) {
    resultExplanation.textContent = "Question limit reached!";
    return;
  }

  const normalizedQuestion = normalizeQuestion(questionInput.value);
  if (!normalizedQuestion) {
    resultExplanation.textContent = "Please type a yes/no question.";
    latestResultArea.classList.remove("hidden");
    return;
  }

  setLoading(true);
  latestResultArea.classList.remove("hidden");
  resultExplanation.textContent = "Running model inference...";

  try {
    const data = await askModel(normalizedQuestion, state.secretWord, state.additionalInfo);
    const yesProb = Number(data.probability);

    state.questionsCount++;
    state.history.push({ question: normalizedQuestion, yesProb });

    updateLimitsDisplay();
    renderResult(normalizedQuestion, yesProb);
    renderHistory();

    questionInput.value = "";

    if (state.questionsLimit > 0 && state.questionsCount >= state.questionsLimit) {
      questionInput.disabled = true;
      questionInput.placeholder = "Question limit reached.";
      askButton.disabled = true;
    } else {
      questionInput.focus();
    }
  } catch (error) {
    lastAnswerText.textContent = "-";
    resultExplanation.textContent = `Error: ${error.message}`;
  } finally {
    setLoading(false);
  }
}

function submitGuess() {
  if (state.isGameOver) return;

  const guess = guessInput.value.trim();
  if (!guess) {
    guessMessage.textContent = "Type a word to guess.";
    guessMessage.classList.remove("correct", "incorrect");
    return;
  }

  state.guessesCount++;
  updateLimitsDisplay();

  const isCorrect = guess.toLowerCase() === state.secretWord.toLowerCase();

  if (isCorrect) {
    endGame(true, "Correct! The secret word was:");
  } else {
    state.guessHistory.push(guess);
    renderGuessHistory();

    if (state.guessesLimit > 0 && state.guessesCount >= state.guessesLimit) {
      endGame(false, "Guess limit reached! The secret word was:");
    } else {
      guessMessage.textContent = `Not quite. "${guess}" is wrong, keep asking questions.`;
      guessMessage.classList.add("incorrect");
      guessMessage.classList.remove("correct");
      guessInput.value = "";
      guessInput.focus();
    }
  }
}

async function shareGame() {
  const shareUrl = buildShareUrl(state.secretWord);
  try {
    await navigator.clipboard.writeText(shareUrl);
    shareButton.textContent = "Link copied!";
  } catch (_err) {
    shareButton.textContent = "Copy failed";
  }
  setTimeout(() => {
    shareButton.textContent = "Share this game";
  }, 2000);
}

function resetGameState() {
  state.history = [];
  state.guessHistory = [];
  state.questionsCount = 0;
  state.guessesCount = 0;
  state.isGameOver = false;

  askButton.disabled = false;
  guessButton.disabled = false;
  questionInput.disabled = false;
  questionInput.placeholder = "Example: Is it a living thing?";

  latestResultArea.classList.add("hidden");
  lastQuestionText.textContent = "";
  lastAnswerText.textContent = "-";
  resultExplanation.textContent = "";

  guessMessage.textContent = "";
  guessMessage.classList.remove("correct", "incorrect");

  questionInput.value = "";
  guessInput.value = "";

  askSection.classList.remove("hidden");
  guessSection.classList.remove("hidden");
  gameOverSection.classList.add("hidden");
  giveUpButton.classList.remove("hidden");

  updateLimitsDisplay();
  renderHistory();
  renderGuessHistory();
}

function startGame(word) {
  state.secretWord = word.trim();
  state.additionalInfo = additionalInfoSetupInput.value.trim();
  state.questionsLimit = parseInt(questionsLimitSetup.value) || 0;
  state.guessesLimit = parseInt(guessesLimitSetup.value) || 0;

  resetGameState();
  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  questionInput.focus();
}

function showSetupScreen() {
  gameScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");

  const sharedWord = getSharedWordFromUrl();
  if (sharedWord) {
    setupDefault.classList.add("hidden");
    setupShared.classList.remove("hidden");
    state.secretWord = sharedWord;
  } else {
    setupShared.classList.add("hidden");
    setupDefault.classList.remove("hidden");
    isCustomWordMode = false;
    customWordContainer.classList.add("hidden");
    toggleCustomWordButton.textContent = "Use Custom Secret Word";
    secretWordSetupInput.value = "";
    additionalInfoSetupInput.value = "";
    questionsLimitSetup.value = 0;
    guessesLimitSetup.value = 0;
  }
}

// Event Listeners
toggleCustomWordButton.addEventListener("click", () => {
  isCustomWordMode = !isCustomWordMode;
  if (isCustomWordMode) {
    customWordContainer.classList.remove("hidden");
    toggleCustomWordButton.textContent = "Use Random Secret Word";
    secretWordSetupInput.focus();
  } else {
    customWordContainer.classList.add("hidden");
    toggleCustomWordButton.textContent = "Use Custom Secret Word";
    secretWordSetupInput.value = "";
  }
});

askButton.addEventListener("click", askQuestion);
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") askQuestion();
});

guessButton.addEventListener("click", submitGuess);
guessInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitGuess();
});

giveUpButton.addEventListener("click", () => {
  endGame(false, "You gave up! The secret word was:");
});

shareButton.addEventListener("click", shareGame);
restartButton.addEventListener("click", () => {
  window.history.replaceState({}, "", window.location.pathname);
  showSetupScreen();
});

startButton.addEventListener("click", () => {
  let word;
  if (isCustomWordMode) {
    word = secretWordSetupInput.value.trim();
    if (!word) {
      secretWordSetupInput.focus();
      return;
    }
  } else {
    word = pickRandomWord();
  }
  startGame(word);
});

startSharedButton.addEventListener("click", () => {
  startGame(state.secretWord);
});

secretWordSetupInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startButton.click();
});

showSetupScreen();

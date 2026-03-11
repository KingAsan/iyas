const BOARD_SIZE = 8;

const OBSTACLES = new Set([
  "3,1",
  "4,1",
  "2,3",
  "5,3",
  "6,4",
  "1,5",
  "3,5"
]);

const initialUnits = [
  {
    id: "dev_lead",
    team: "dev",
    name: "Техлид",
    shortName: "Lead",
    hp: 18,
    maxHp: 18,
    move: 3,
    range: 1,
    damage: 6,
    x: 0,
    y: 0,
    acted: false
  },
  {
    id: "dev_front",
    team: "dev",
    name: "Frontend",
    shortName: "FE",
    hp: 14,
    maxHp: 14,
    move: 3,
    range: 2,
    damage: 5,
    x: 1,
    y: 0,
    acted: false
  },
  {
    id: "dev_qa",
    team: "dev",
    name: "QA инженер",
    shortName: "QA",
    hp: 12,
    maxHp: 12,
    move: 3,
    range: 3,
    damage: 4,
    x: 0,
    y: 1,
    acted: false
  },
  {
    id: "bug_swarm",
    team: "bug",
    name: "Баг-рой",
    shortName: "Bugs",
    hp: 10,
    maxHp: 10,
    move: 3,
    range: 1,
    damage: 4,
    x: 7,
    y: 7,
    acted: false
  },
  {
    id: "bug_legacy",
    team: "bug",
    name: "Legacy код",
    shortName: "Legacy",
    hp: 14,
    maxHp: 14,
    move: 2,
    range: 2,
    damage: 5,
    x: 6,
    y: 7,
    acted: false
  },
  {
    id: "bug_deadline",
    team: "bug",
    name: "Дедлайн",
    shortName: "DDL",
    hp: 18,
    maxHp: 18,
    move: 2,
    range: 1,
    damage: 6,
    x: 7,
    y: 6,
    acted: false
  }
];

const state = {
  turn: 1,
  team: "dev",
  lockInput: false,
  gameOver: false,
  selectedUnitId: null,
  units: [],
  log: []
};

const boardEl = document.getElementById("board");
const turnLabelEl = document.getElementById("turnLabel");
const teamLabelEl = document.getElementById("teamLabel");
const selectedInfoEl = document.getElementById("selectedInfo");
const devListEl = document.getElementById("devList");
const bugListEl = document.getElementById("bugList");
const battleLogEl = document.getElementById("battleLog");
const endTurnBtn = document.getElementById("endTurnBtn");
const restartBtn = document.getElementById("restartBtn");

function cellKey(x, y) {
  return `${x},${y}`;
}

function isInside(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function isObstacle(x, y) {
  return OBSTACLES.has(cellKey(x, y));
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAlive(unit) {
  return unit.hp > 0;
}

function getUnitById(id) {
  return state.units.find((unit) => unit.id === id) || null;
}

function getUnitAt(x, y) {
  return state.units.find((unit) => isAlive(unit) && unit.x === x && unit.y === y) || null;
}

function getLivingUnits(team) {
  return state.units.filter((unit) => unit.team === team && isAlive(unit));
}

function getSelectedDevUnit() {
  if (!state.selectedUnitId) {
    return null;
  }

  const unit = getUnitById(state.selectedUnitId);
  if (!unit || unit.team !== "dev" || unit.acted || !isAlive(unit)) {
    return null;
  }

  return unit;
}

function addLog(text, type = "") {
  state.log.unshift({
    id: `${Date.now()}-${Math.random()}`,
    text,
    type
  });

  if (state.log.length > 24) {
    state.log = state.log.slice(0, 24);
  }
}

function createUnits() {
  return initialUnits.map((unit) => ({ ...unit }));
}

function getReachableCells(unit) {
  if (!isAlive(unit)) {
    return [];
  }

  const queue = [{ x: unit.x, y: unit.y, dist: 0 }];
  const visited = new Set([cellKey(unit.x, unit.y)]);
  const reachable = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.dist >= unit.move) {
      continue;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const next of neighbors) {
      if (!isInside(next.x, next.y) || isObstacle(next.x, next.y)) {
        continue;
      }

      const key = cellKey(next.x, next.y);
      if (visited.has(key)) {
        continue;
      }

      if (getUnitAt(next.x, next.y)) {
        continue;
      }

      visited.add(key);
      queue.push({ x: next.x, y: next.y, dist: current.dist + 1 });
      reachable.push({ x: next.x, y: next.y });
    }
  }

  return reachable;
}

function getAttackableTargets(unit) {
  const targetTeam = unit.team === "dev" ? "bug" : "dev";
  return getLivingUnits(targetTeam).filter((target) => manhattan(unit, target) <= unit.range);
}

function pickBestTarget(attacker, targets) {
  return [...targets].sort((a, b) => {
    if (a.hp !== b.hp) {
      return a.hp - b.hp;
    }
    return manhattan(attacker, a) - manhattan(attacker, b);
  })[0];
}

function moveUnit(unit, x, y, isEnemyMove = false) {
  unit.x = x;
  unit.y = y;
  if (isEnemyMove) {
    addLog(`${unit.name} занимает новую позицию.`);
  }
}

function performAttack(attacker, target) {
  const damage = attacker.damage;
  target.hp = Math.max(0, target.hp - damage);
  addLog(`${attacker.name} атакует ${target.name}: -${damage} HP.`);

  if (target.hp === 0) {
    addLog(`${target.name} выведен из боя.`, "warn");
  }
}

function chooseEnemyMove(enemy) {
  const targets = getLivingUnits("dev");
  if (targets.length === 0) {
    return null;
  }

  const reachable = getReachableCells(enemy);
  const candidates = [{ x: enemy.x, y: enemy.y }, ...reachable];

  let bestCell = candidates[0];
  let bestScore = Math.min(...targets.map((target) => Math.abs(bestCell.x - target.x) + Math.abs(bestCell.y - target.y)));

  for (const cell of candidates.slice(1)) {
    const score = Math.min(...targets.map((target) => Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y)));

    const bestIsCurrent = bestCell.x === enemy.x && bestCell.y === enemy.y;
    if (score < bestScore || (score === bestScore && bestIsCurrent)) {
      bestScore = score;
      bestCell = cell;
    }
  }

  if (bestCell.x === enemy.x && bestCell.y === enemy.y) {
    return null;
  }

  return bestCell;
}

function checkGameOver() {
  if (state.gameOver) {
    return true;
  }

  if (getLivingUnits("bug").length === 0) {
    state.gameOver = true;
    addLog("Релиз спасен. Команда разработки победила!", "win");
    return true;
  }

  if (getLivingUnits("dev").length === 0) {
    state.gameOver = true;
    addLog("Проект сорван. Угрозы оказались сильнее.", "lose");
    return true;
  }

  return false;
}

function completeDevAction(unit) {
  unit.acted = true;
  state.selectedUnitId = null;

  if (checkGameOver()) {
    render();
    return;
  }

  const allActed = getLivingUnits("dev").every((devUnit) => devUnit.acted);
  render();

  if (allActed) {
    startEnemyTurn();
  }
}

async function startEnemyTurn() {
  if (state.lockInput || state.gameOver || state.team !== "dev") {
    return;
  }

  state.team = "bug";
  state.lockInput = true;
  state.selectedUnitId = null;
  addLog("Ход угроз.", "warn");
  render();

  const enemies = getLivingUnits("bug");

  for (const enemy of enemies) {
    if (state.gameOver) {
      break;
    }

    await wait(420);
    enemyAct(enemy);
    checkGameOver();
    render();
  }

  if (state.gameOver) {
    state.lockInput = false;
    render();
    return;
  }

  startDevTurn();
}

function enemyAct(enemy) {
  if (!isAlive(enemy)) {
    return;
  }

  let attackable = getAttackableTargets(enemy);
  if (attackable.length > 0) {
    performAttack(enemy, pickBestTarget(enemy, attackable));
    return;
  }

  const nextCell = chooseEnemyMove(enemy);
  if (nextCell) {
    moveUnit(enemy, nextCell.x, nextCell.y, true);
  }

  attackable = getAttackableTargets(enemy);
  if (attackable.length > 0) {
    performAttack(enemy, pickBestTarget(enemy, attackable));
  }
}

function startDevTurn() {
  state.turn += 1;
  state.team = "dev";
  state.lockInput = false;

  for (const unit of getLivingUnits("dev")) {
    unit.acted = false;
  }

  addLog(`Ход ${state.turn}: команда разработки действует.`);
  render();
}

function onTileClick(x, y) {
  if (state.gameOver || state.lockInput || state.team !== "dev") {
    return;
  }

  const clickedUnit = getUnitAt(x, y);
  const selected = getSelectedDevUnit();

  if (selected) {
    if (clickedUnit && clickedUnit.team === "dev" && !clickedUnit.acted) {
      state.selectedUnitId = clickedUnit.id;
      render();
      return;
    }

    if (clickedUnit && clickedUnit.team === "bug") {
      const attackable = getAttackableTargets(selected);
      const canAttack = attackable.some((target) => target.id === clickedUnit.id);
      if (canAttack) {
        performAttack(selected, clickedUnit);
        completeDevAction(selected);
      }
      return;
    }

    if (!clickedUnit) {
      const canMove = getReachableCells(selected).some((cell) => cell.x === x && cell.y === y);
      if (canMove) {
        moveUnit(selected, x, y);
        addLog(`${selected.name} перемещается.`);
        completeDevAction(selected);
      }
      return;
    }

    return;
  }

  if (clickedUnit && clickedUnit.team === "dev" && !clickedUnit.acted) {
    state.selectedUnitId = clickedUnit.id;
    render();
  }
}

function renderSelectedCard(selectedUnit) {
  if (!selectedUnit) {
    selectedInfoEl.textContent = "Выберите героя команды разработки.";
    return;
  }

  selectedInfoEl.textContent = `${selectedUnit.name}: HP ${selectedUnit.hp}/${selectedUnit.maxHp}, ход ${selectedUnit.move}, дальность ${selectedUnit.range}, урон ${selectedUnit.damage}.`;
}

function renderUnitLists() {
  const devUnits = state.units.filter((unit) => unit.team === "dev");
  const bugUnits = state.units.filter((unit) => unit.team === "bug");

  devListEl.innerHTML = "";
  bugListEl.innerHTML = "";

  for (const unit of devUnits) {
    const item = document.createElement("li");
    item.textContent = `${unit.name} (${unit.hp}/${unit.maxHp} HP${unit.acted && isAlive(unit) ? ", ход выполнен" : ""})`;
    if (!isAlive(unit)) {
      item.classList.add("dead");
    }
    devListEl.appendChild(item);
  }

  for (const unit of bugUnits) {
    const item = document.createElement("li");
    item.textContent = `${unit.name} (${unit.hp}/${unit.maxHp} HP)`;
    if (!isAlive(unit)) {
      item.classList.add("dead");
    }
    bugListEl.appendChild(item);
  }
}

function renderLog() {
  battleLogEl.innerHTML = "";

  for (const entry of state.log) {
    const item = document.createElement("li");
    item.textContent = entry.text;
    if (entry.type) {
      item.classList.add(entry.type);
    }
    battleLogEl.appendChild(item);
  }
}

function renderBoard(selectedUnit) {
  const reachableCells = selectedUnit ? getReachableCells(selectedUnit) : [];
  const attackableTargets = selectedUnit ? getAttackableTargets(selectedUnit) : [];

  const reachableSet = new Set(reachableCells.map((cell) => cellKey(cell.x, cell.y)));
  const attackableSet = new Set(attackableTargets.map((unit) => cellKey(unit.x, unit.y)));

  boardEl.innerHTML = "";

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.dataset.x = String(x);
      tile.dataset.y = String(y);

      const key = cellKey(x, y);
      const unit = getUnitAt(x, y);

      if (isObstacle(x, y)) {
        tile.classList.add("obstacle");
      }

      if (selectedUnit && x === selectedUnit.x && y === selectedUnit.y) {
        tile.classList.add("selected");
      }

      if (!unit && reachableSet.has(key)) {
        tile.classList.add("reachable");
      }

      if (attackableSet.has(key)) {
        tile.classList.add("attackable");
      }

      if (unit) {
        const unitEl = document.createElement("div");
        unitEl.className = `unit ${unit.team}`;

        if (unit.team === "dev" && unit.acted) {
          unitEl.classList.add("acted");
        }

        const nameEl = document.createElement("span");
        nameEl.className = "unit-name";
        nameEl.textContent = unit.shortName;

        const hpEl = document.createElement("span");
        hpEl.className = "unit-hp";
        hpEl.textContent = `${unit.hp}/${unit.maxHp}`;

        unitEl.appendChild(nameEl);
        unitEl.appendChild(hpEl);
        tile.appendChild(unitEl);
      } else if (isObstacle(x, y)) {
        const icon = document.createElement("span");
        icon.className = "obstacle-icon";
        icon.textContent = "▩";
        tile.appendChild(icon);
      }

      boardEl.appendChild(tile);
    }
  }
}

function render() {
  const selectedUnit = getSelectedDevUnit();

  turnLabelEl.textContent = `Ход ${state.turn}`;
  if (state.gameOver) {
    teamLabelEl.textContent = getLivingUnits("dev").length > 0 ? "Победа команды" : "Поражение команды";
  } else {
    teamLabelEl.textContent = state.team === "dev" ? "Команда разработки" : "Фаза угроз";
  }

  renderSelectedCard(selectedUnit);
  renderUnitLists();
  renderLog();
  renderBoard(selectedUnit);

  endTurnBtn.disabled = state.gameOver || state.lockInput || state.team !== "dev";
}

function resetGame() {
  state.turn = 1;
  state.team = "dev";
  state.lockInput = false;
  state.gameOver = false;
  state.selectedUnitId = null;
  state.units = createUnits();
  state.log = [];

  addLog("Спринт начинается. Соберите команду и разберите угрозы!");
  addLog("Ход 1: команда разработки действует.");
  render();
}

boardEl.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");
  if (!tile) {
    return;
  }

  onTileClick(Number(tile.dataset.x), Number(tile.dataset.y));
});

endTurnBtn.addEventListener("click", () => {
  if (state.gameOver || state.lockInput || state.team !== "dev") {
    return;
  }

  for (const unit of getLivingUnits("dev")) {
    unit.acted = true;
  }

  state.selectedUnitId = null;
  startEnemyTurn();
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

resetGame();

/* Guided first session. Loaded only by the browser training build. */
(() => {
  "use strict";
  const training = window.DuoTraining;
  if (!training) return;
  const storageKey = "integrals-clicker-duo-tutorial-v1";
  const completedKey = "trainingGuideComplete";
  const firstStep = "firstTap";
  const steps = [
    firstStep, "score", "firstFunds", "bit", "passiveIntro", "passiveWatch",
    "passiveResult", "earn", "upgrade", "testUpgrade", "school", "map", "schoolTask",
    "prepareQuiz", "timer", "quiz", "reward", "cooldown", "team", "honors",
    "honorsSeen", "gallery", "applyTheme", "home", "complete", "done"
  ];
  function loadLesson() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && steps.includes(saved.phase)) return saved;
    } catch (_) {}
    return null;
  }
  const savedLesson = loadLesson();
  const lesson = savedLesson || {phase: firstStep, upgradeTaught: false, questDone: false};
  training.currentStep = () => lesson.phase;
  const el = selector => document.querySelector(selector);
  const tab = name => '#tabs [data-route="' + name + '"]';
  const control = (name, key) => '[data-page-action="' + name + '"][data-key="' + CSS.escape(key) + '"]';
  const tapButton = "#integral-button";
  const schoolOnMap = '.wm-target[data-index="0"]';
  const schoolInList = '.pg-place[data-key="0"]';
  const districtTask = control("quests", "school");
  const availableThemes = '.ap-card[data-state="open"], .ap-card[data-state="spark"]';
  const number = value => IntegralNumbers.exact(value);
  let requested = false;
  let paused, interval, ready = false;

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(lesson)); } catch (_) {}
  }
  function updateSoon() {
    if (!ready || requested || lesson.phase === "done") return;
    requested = true;
    requestAnimationFrame(() => {
      requested = false;
      if (lesson.phase !== "done") render();
    });
  }
  function go(phase, changes) {
    Object.assign(lesson, changes, {phase});
    save();
    updateSoon();
  }
  function stopTime(value) {
    if (paused === value) return;
    paused = value;
    Economy.setTrainingPaused(value);
    Quests.setTrainingPaused(value);
    App.sync();
  }
  function leaveTraining() {
    window.Honors.releaseTrainingRewards();
    if (!Economy.progress(completedKey)) Economy.updateProgress(completedKey, true);
    lesson.phase = "done";
    save();
    clearInterval(interval);
    window.TrainingView.hide();
    Quests.setTrainingQuiz(false);
    stopTime(false);
    document.body.classList.remove("duo-training-active");
  }
  function finish() {
    if (lesson.phase === "complete") leaveTraining();
  }
  function hasPrestige(s = Economy.snapshot()) {
    return s.prestigeLevel > 0 || s.highestPrestige > 0 || s.cosmicAscensions > 0;
  }
  function show(id, target, title, text, options = {}) {
    const frozen = options.paused !== false;
    stopTime(frozen);
    window.TrainingView.show({id, target, title, text, paused: frozen, ...options});
  }
  function explain(id, target, title, text, actionLabel, onAction) {
    show(id, target, title, text, {lockTarget: true, actionLabel, onAction});
  }
  function navigate(route, title, text) {
    if (App.activeRoute === route && !App.sheet) return false;
    show(lesson.phase + "-nav-" + route, tab(route), title, text);
    return true;
  }
  function screenHome(title, text) { return navigate("home", title, text); }
  function highlightSchool(title, text) {
    show(lesson.phase + "-building", schoolOnMap, title, text);
  }
  function earnedUpgrade() {
    if (lesson.upgradeTaught || Economy.hud().balance < 100) return null;
    return Economy.snapshot().research.find(item => item.canBuy);
  }
  function activeUpgrade() {
    return Economy.snapshot().research.find(item => item.id === lesson.upgradeId);
  }
  function firstIncome() {
    return window.LiveCounters.balance() - lesson.incomeStart;
  }

  function render() {
    if (!ready || document.hidden) return;
    if (hasPrestige()) return leaveTraining();
    // A gift becomes available on the next calendar day, including after a
    // refresh of a practice tab. Keep it available for free play afterwards.
    if (App.sheet === "daily") App.closeSheet();
    const phase = lesson.phase;
    switch (phase) {
      case "firstTap":
        if (Economy.hud().clicks > 0) return go("score");
        show("first-tap", tapButton, "Первый интеграл", "Добро пожаловать в лабораторию! Нажми на большой знак ∫.");
        return;
      case "score":
        explain("score", "#balance", "Счёт пополнился", "Каждое нажатие приносит интегралы. Накопи 15 ∫, и сможешь купить первый ресурс.", "Начать копить", () => go("firstFunds"));
        return;
      case "firstFunds":
        if (Economy.hud().balance >= 15) return go("bit");
        show("first-funds", tapButton, "Накопи 15 ∫", "Нажимай на интеграл.", {paused: false, compact: true});
        return;
      case "bit":
        if (Economy.owned("autoclick") > 0) return go("passiveIntro");
        if (navigate("resources", "Первый ресурс доступен", "Ты накопил 15 ∫. Открой «Ресурсы» внизу.")) return;
        show("buy-bit", control("buy", "autoclick"), "Бит информации", "Нажми на цену, чтобы купить бит. Он начнёт зарабатывать интегралы сам.");
        return;
      case "passiveIntro":
        if (screenHome("Посмотрим на доход", "Вернись к интегралу. Теперь счёт может расти без нажатий.")) return;
        explain("income-intro", ".meter .income", "Бит уже работает", "Он приносит 0,25 ∫ в секунду, пока игра открыта. Убери палец и понаблюдай за счётом.", "Посмотреть", () => go("passiveWatch", {incomeStart: window.LiveCounters.balance()}));
        return;
      case "passiveWatch":
        if (firstIncome() >= 1) return go("passiveResult");
        show("income-watch", "#balance", "Счёт растёт сам", "За четыре секунды бит заработает целый интеграл.", {paused: false, compact: true, lockTarget: true});
        return;
      case "passiveResult":
        explain("income-result", "#balance", "Ещё один ∫ без нажатий", "Ресурсы зарабатывают сами. Нажимай на интеграл, чтобы быстрее накопить на следующую покупку.", "Продолжить", () => go("earn"));
        return;
      case "earn": {
        const upgrade = earnedUpgrade();
        if (upgrade) return go("upgrade", {upgradeId: upgrade.id});
        if (!Economy.owned("abacus") && Economy.hud().balance >= 125) return go("school");
        if (lesson.questDone && lesson.upgradeTaught) return go("team");
        if (screenHome("Продолжим копить", "Вернись к интегралу.")) return;
        const pencilNext = !lesson.upgradeTaught && Economy.hud().clicks >= 25;
        const title = lesson.questDone || pencilNext ? "Следующая цель — улучшение" : "Копим на следующую покупку";
        const text = lesson.questDone || pencilNext ? "Нажимай на ∫. Для «Острого карандаша» нужно 100 ∫ и 25 нажатий." :
          lesson.upgradeTaught ? "Нажимай на ∫ или дождись автодохода. Для школьника нужно 125 ∫." :
          "Нажимай на ∫. Когда хватит на покупку, игра остановится.";
        show("earn-" + Number(lesson.upgradeTaught) + "-" + Number(pencilNext), tapButton, title, text, {paused: false, compact: true});
        return;
      }
      case "upgrade": {
        const upgrade = activeUpgrade();
        if (!upgrade || (!upgrade.studied && !upgrade.canBuy)) return go("earn");
        if (upgrade.studied) return go("testUpgrade", {testClicks: Economy.hud().clicks});
        if (navigate("research", "Улучшение доступно", "Открой «Улучшения». Покупка сделает каждое нажатие сильнее.")) return;
        const buy = control("study", upgrade.id);
        if (el(buy)) {
          show("buy-upgrade", buy, upgrade.name, "Нажми на кнопку покупки. После этого проверим новый клик.");
        } else {
          show("inspect-upgrade", control("research", upgrade.id), upgrade.name, "Открой карточку доступного улучшения.");
        }
        return;
      }
      case "testUpgrade":
        if (screenHome("Проверим улучшение", "Вернись на главную и посмотри, сколько теперь приносит одно нажатие.")) return;
        if (Economy.hud().clicks > lesson.testClicks) return go(lesson.questDone ? "team" : "earn", {upgradeTaught: true});
        show("upgraded-tap", tapButton, "Попробуй усиленный клик", "Нажми один раз и посмотри на число над интегралом.");
        return;
      case "school":
        if (Economy.owned("abacus")) return go("map");
        if (navigate("resources", "Пора пригласить школьника", "На счёте есть 125 ∫. Открой «Ресурсы».")) return;
        show("buy-schoolchild", control("buy", "abacus"), "Первый житель", "Пригласи школьника. С ним в научном городе откроется школа.");
        return;
      case "map":
        if (navigate("world", "В городе появилась школа", "Открой «Мир», чтобы найти своего первого жителя.")) return;
        if (el(districtTask)) return go("schoolTask");
        highlightSchool("Найди школу", "Нажми на подсвеченное здание на карте.");
        return;
      case "schoolTask":
        if (App.sheet === "challenges") return go("prepareQuiz");
        if (!el(districtTask)) return go("map");
        Quests.setTrainingQuiz(true);
        show("school-task", districtTask, "Школьник приготовил задание", "Нажми «Домашнее задание», чтобы узнать условия.");
        return;
      case "prepareQuiz":
        Quests.setTrainingQuiz(true);
        if (App.sheet !== "challenges") return go("schoolTask");
        if (Quests.active()) return go("timer");
        if (!el(".qc-prep")) {
          show("select-quiz", '.qc-listing[data-quest="school"]', "Домашнее задание", "Открой своё первое испытание.");
        } else {
          show("start-quiz", ".qc-foot button", "Три вопроса, одна награда", "Начни учебную попытку. Можно ошибаться и пробовать снова — интегралы останутся у тебя.");
        }
        return;
      case "timer":
        if (!Quests.active()) return go("prepareQuiz");
        explain("quiz-clock", ".qc-clock", "Минута на вопрос", "Пока ты читаешь, таймер стоит. После старта выбери ответ и подтверди его. Если потребуется, появится подсказка.", "Поехали", () => go("quiz"));
        return;
      case "quiz": {
        const run = Quests.active();
        if (!run) {
          const result = Quests.trainingState().result;
          if (result?.won) return go("reward", {prize: result.actual});
          return go("prepareQuiz");
        }
        if (el(".qc-training-retry")) {
          show("quiz-retry", ".qc-training-retry", "Попробуй ещё раз", "Прочитай разбор в задании и вернись к вопросу. За эту попытку штрафа нет.");
        } else if (run.review) {
          show("quiz-review-" + run.index, ".qc-foot button", "Верный ответ", "Когда будешь готов, переходи к следующему вопросу.", {compact: true});
        } else {
          show("quiz-play-" + run.index, null, "Учебное испытание", "", {
            paused: false, compact: true, allowed: [".qc-options", ".qc-foot button"], placement: "top-right"
          });
        }
        return;
      }
      case "reward":
        if (App.sheet !== "challenges") return go("cooldown", {questDone: true});
        show("quiz-reward", ".qc-return", "Награда уже на счёте", "Все три ответа верны! Ты получил " + number(lesson.prize) + " ∫. Вернись на карту.");
        return;
      case "cooldown":
        if (navigate("world", "Школа на перерыве", "Открой карту мира.")) return;
        if (!el(districtTask)) {
          highlightSchool("Когда вернётся задание?", "Нажми на школу и посмотри, когда откроется следующая попытка.");
          return;
        }
        explain("school-cooldown", districtTask + " .pg-challenge-status", "Следующая попытка — через 30 минут", "У других заданий свои награды и время ожидания. В обычном испытании за ошибку или истёкшее время списывается половина приза.", "Понятно", () => {
          Quests.setTrainingQuiz(false);
          go(lesson.upgradeTaught ? "team" : "earn");
        });
        return;
      case "team":
        if (navigate("research", "А как усилить всю команду?", "Открой «Улучшения» ещё раз.")) return;
        explain("team", ".pg-research .pg-head h2", "Командные улучшения", "Когда помощников станет больше, откроются командные улучшения. Они увеличивают доход всей лаборатории.", "Дальше", () => go("honors"));
        return;
      case "honors":
        if (App.sheet === "honors") {
          const before = Economy.hud().balance;
          window.Honors.releaseTrainingRewards();
          return go("honorsSeen", {honorReward: Math.max(0, Economy.hud().balance - before)});
        }
        show("honors", "#honors-btn", "Твои достижения", "Нажми на медаль в верхней панели.");
        return;
      case "honorsSeen":
        if (App.sheet !== "honors") return go("gallery");
        show("honors-close", "#close-sheet", "Награды приходят сами",
          (lesson.honorReward > 0 ? "За первые достижения тебе начислено " + number(lesson.honorReward) + " ∫. " : "Здесь видны твои достижения. ") +
          "Достижения также открывают оформления. Закрой список, чтобы выбрать фон.");
        return;
      case "gallery": {
        if (navigate("appearance", "Выбери свой фон", "Открой «Оформления» в нижнем меню.")) return;
        const picked = el('.ap-card[aria-pressed="true"]:is([data-state="open"],[data-state="spark"])');
        if (picked && el(".ap-use:not(:disabled)")) return go("applyTheme", {themeId: picked.dataset.id});
        const choices = [...document.querySelectorAll(availableThemes)];
        if (!choices.length) {
          explain("no-theme", ".ap-tabs", "Новые оформления", "Другие фоны откроются вместе с достижениями.", "На главную", () => go("home"));
        } else {
          show("choose-theme", choices[0], "Попробуем новый фон", "Нажми на выделенную плитку, чтобы посмотреть оформление крупнее.");
        }
        return;
      }
      case "applyTheme":
        if (Appearance.selection().themes === lesson.themeId) return go("home");
        if (!el(".ap-use:not(:disabled)")) return go("gallery");
        show("apply-theme", ".ap-use", "Примерь оформление", "Нажми «Применить». Выбранный фон появится и на других вкладках.");
        return;
      case "home":
        if (screenHome("Посмотрим, как получилось", "Вернись на главный экран.")) return;
        go("complete");
        return;
      case "complete":
        explain("completed", "#balance", "Теперь лаборатория твоя", "У тебя есть автодоход, школа и первое пройденное испытание. Город будет расти с каждым новым жителем.", "Играть самостоятельно", finish);
        return;
    }
  }

  // Navigation is UI-only; rebuild it from the saved lesson after a refresh.
  function restoreScreen() {
    const p = lesson.phase;
    if (p === "upgrade") App.route("research");
    if (p === "bit" || p === "school") App.route("resources");
    if (["map", "schoolTask", "prepareQuiz", "timer", "quiz", "reward", "cooldown"].includes(p)) {
      App.route("world");
      if (p !== "map") el(schoolInList)?.click();
      if (["prepareQuiz", "timer", "quiz", "reward"].includes(p)) {
        Quests.setTrainingQuiz(true);
        App.openSheet("challenges", {districtID: "school"});
      }
    }
    if (p === "honorsSeen") App.openSheet("honors");
    if (p === "gallery" || p === "applyTheme") {
      App.route("appearance");
      if (p === "applyTheme" && lesson.themeId) el('.ap-card[data-id="' + CSS.escape(lesson.themeId) + '"]')?.click();
    }
  }
  function boot() {
    if (ready || !window.App || !window.TrainingView) return;
    ready = true;
    // The receipt belongs to this game across all its prestige resets.
    const game = Economy.snapshot();
    const existingGame = !savedLesson && (game.clicks > 0 || game.totalEarned > 0 || game.totalPurchased > 0 || game.researchCount > 0);
    if (lesson.phase === "done" || Economy.progress(completedKey) || hasPrestige(game) || existingGame) {
      leaveTraining();
      return;
    }
    // A refresh immediately after the first tap must resume an unfinished lesson.
    if (!savedLesson) save();
    document.body.classList.add("duo-training-active");
    const live = ["earn","firstFunds","passiveWatch","quiz"].includes(lesson.phase);
    stopTime(!live);
    restoreScreen();
    for (const event of ["duotap","duonavigation","duocounterview","duotrainingquest","duoappearancechange","duoprestige","pageshow"]) {
      window.addEventListener(event, updateSoon);
    }
    for (const event of ["click","pointerup","visibilitychange"]) document.addEventListener(event, updateSoon, true);
    // Income may cross the next threshold while the player is watching without input.
    interval = setInterval(() => {
      if (["passiveWatch","firstFunds","earn"].includes(lesson.phase)) updateSoon();
    }, 160);
    updateSoon();
  }
  window.addEventListener("duolaunchcomplete", boot, {once:true});
  if (!document.body.classList.contains("duo-launching")) boot();
})();

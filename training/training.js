/* Guided first session. Existing and completed games keep their ordinary controls. */
(() => {
  "use strict";
  const training = window.DuoTraining;
  if (!training || training.currentStep) return;
  const storageKey = "integrals-clicker-duo-tutorial-v1";
  const completedKey = "trainingGuideComplete";
  const firstStep = "firstTap";
  const steps = [
    firstStep, "score", "firstFunds", "bit", "passiveIntro", "passiveWatch",
    "passiveResult", "earn", "upgrade", "testUpgrade", "upgradeResult", "school", "map", "schoolTask",
    "prepareQuiz", "timer", "quiz", "reward", "cooldown", "honors",
    "honorsSeen", "gallery", "applyTheme", "home", "complete", "done"
  ];
  function loadLesson() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      // Earlier versions sent players back to research after their first test.
      if (saved?.phase === "team") return {...saved, phase: "honors"};
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
  const meter = "#home .meter";
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
    window.TrainingView.show({id, target, title, text, paused: frozen, point: !!lesson.questDone, ...options});
  }
  function explain(id, target, title, text, actionLabel, onAction, options = {}) {
    show(id, target, title, text, {lockTarget: true, actionLabel, onAction, ...options});
  }
  function navigate(route, title, text) {
    if (App.activeRoute === route && !App.sheet) return false;
    const funded = App.activeRoute === "home" && ["bit","upgrade","school"].includes(lesson.phase);
    show(lesson.phase + "-nav-" + route, tab(route), title, text, {point: true, context: funded ? meter : null});
    return true;
  }
  function screenHome(title, text) { return navigate("home", title, text); }
  function highlightSchool(title, text) {
    show(lesson.phase + "-building", schoolOnMap, title, text, {point: true});
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
  function recordUpgradeTap(gain) {
    const balance = Economy.hud().balance;
    go("upgradeResult", {tapGain: gain, tapStart: balance - gain, tapBalance: balance, upgradeTaught: true});
    render();
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
        explain("score", "#balance", "Счёт пополнился", "Каждое нажатие приносит интегралы. Накопи 15 ∫, и сможешь купить первый ресурс.", "Начать копить", () => go("firstFunds"), {point: true});
        return;
      case "firstFunds":
        if (Economy.hud().balance >= 15) return go("bit");
        show("first-funds", tapButton, "Накопи 15 ∫", "Нажимай на интеграл и следи за счётом.", {paused: false, compact: true, context: meter});
        return;
      case "bit":
        if (Economy.owned("autoclick") > 0) return go("passiveIntro");
        if (navigate("resources", "Первый ресурс доступен", "Ты накопил 15 ∫. Открой «Ресурсы» внизу.")) return;
        show("buy-bit", control("buy", "autoclick"), "Бит информации", "Нажми на цену, чтобы купить бит. Он начнёт зарабатывать интегралы сам.", {highlight: '.pg-resource[data-row="autoclick"]'});
        return;
      case "passiveIntro":
        if (screenHome("Посмотрим на доход", "Вернись к интегралу. Теперь счёт может расти без нажатий.")) return;
        explain("income-intro", meter, "Бит уже работает", "Он приносит 0,25 ∫ в секунду, пока игра открыта. Убери палец и понаблюдай за счётом.", "Посмотреть", () => go("passiveWatch", {incomeStart: window.LiveCounters.balance()}), {point: true, pointAt: "#rate"});
        return;
      case "passiveWatch":
        if (firstIncome() >= 1) return go("passiveResult");
        show("income-watch", meter, "Счёт растёт сам", "За четыре секунды бит заработает целый интеграл.", {paused: false, compact: true, lockTarget: true, point: true, pointAt: "#balance"});
        return;
      case "passiveResult":
        explain("income-result", meter, "Ещё один ∫ без нажатий", "Ресурсы зарабатывают сами. Нажимай на интеграл, чтобы быстрее накопить на следующую покупку.", "Продолжить", () => go("earn"), {point: true, pointAt: "#balance"});
        return;
      case "earn": {
        const upgrade = earnedUpgrade();
        if (upgrade) return go("upgrade", {upgradeId: upgrade.id});
        if (!Economy.owned("abacus") && Economy.hud().balance >= 125) return go("school");
        if (lesson.questDone && lesson.upgradeTaught) return go("honors");
        if (screenHome("Продолжим копить", "Вернись к интегралу.")) return;
        const pencilNext = !lesson.upgradeTaught && Economy.hud().clicks >= 25;
        const title = lesson.questDone || pencilNext ? "Следующая цель — улучшение" : "Копим на следующую покупку";
        const text = lesson.questDone || pencilNext ? "Накопи 100 ∫ на «Острый карандаш»." :
          lesson.upgradeTaught ? "Нажимай на ∫ или дождись автодохода. Для школьника нужно 125 ∫." :
          "Нажимай на ∫. Когда хватит на следующую покупку, ты увидишь, что можно купить.";
        show("earn-" + Number(lesson.upgradeTaught) + "-" + Number(pencilNext), tapButton, title, text, {paused: false, compact: true, context: meter});
        return;
      }
      case "upgrade": {
        const upgrade = activeUpgrade();
        if (!upgrade || (!upgrade.studied && !upgrade.canBuy)) return go("earn");
        if (upgrade.studied) return go("testUpgrade", {testClicks: Economy.hud().clicks});
        if (navigate("research", "Улучшение доступно", "Открой «Улучшения». Покупка сделает каждое нажатие сильнее.")) return;
        const buy = control("study", upgrade.id);
        if (el(buy)) {
          show("buy-upgrade", buy, upgrade.name, "Купи карандаш, чтобы усилить клик. Позже здесь откроется «Командная работа». Чем больше помощников одного вида в команде, тем выше доход всей лаборатории.", {point: true});
        } else {
          show("inspect-upgrade", control("research", upgrade.id), upgrade.name, "Открой карточку доступного улучшения.");
        }
        return;
      }
      case "testUpgrade":
        if (screenHome("Проверим улучшение", "Вернись на главную и посмотри, сколько теперь приносит одно нажатие.")) return;
        if (Economy.hud().clicks > lesson.testClicks) return recordUpgradeTap(Economy.hud().clickPower);
        show("upgraded-tap", tapButton, "Попробуй усиленный клик", "Нажми на ∫ один раз и посмотри, как изменится счёт.", {context: meter});
        return;
      case "upgradeResult": {
        const gain = lesson.tapGain, after = lesson.tapBalance;
        show("upgraded-result", meter, "Усиленный клик в действии",
          "На счёте было " + number(lesson.tapStart ?? after - gain) + " ∫, а теперь " + number(after) + " ∫.",
          {point: true, pointAt: "#balance", gainLabel: "+" + number(gain) + " ∫", lockTarget: true, actionLabel: "Продолжить",
           onAction: () => go(lesson.questDone ? "honors" : "earn")});
        return;
      }
      case "school":
        if (Economy.owned("abacus")) return go("map");
        if (navigate("resources", "Пора пригласить школьника", "На счёте есть 125 ∫. Открой «Ресурсы».")) return;
        show("buy-schoolchild", control("buy", "abacus"), "Первый житель", "Нажми на цену, чтобы пригласить школьника. С ним в научном городе откроется школа.", {highlight: '.pg-resource[data-row="abacus"]'});
        return;
      case "map":
        if (navigate("world", "В городе появилась школа", "Открой «Мир», чтобы найти своего первого жителя.")) return;
        if (el(districtTask)) return go("schoolTask", {mapZoomSeen: true});
        if (!lesson.mapZoomSeen) {
          show("map-zoom", ".pg-map-overview", "Рассмотри ресурсы на карте",
            "Разведи два пальца, чтобы приблизить карту. Сведи их, чтобы отдалить. Кнопка со стрелками вернёт общий вид.",
            {point: true, allowed: [".wm-surface"], actionLabel: "Найти школу", onAction: () => {
              Pages.showWorldOverview(false);
              go("map", {mapZoomSeen: true});
            }});
          return;
        }
        highlightSchool("Найди школу", "Стрелка указывает на школу. Нажми на неё, чтобы посмотреть задание.");
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
          show("start-quiz", ".qc-foot button", "Три вопроса, одна награда", "Ответь верно на три вопроса, чтобы получить приз. В этой учебной попытке после ошибки можно попробовать ещё раз без потери интегралов.", {point: true});
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
          show("quiz-retry", ".qc-training-retry", "Можно попробовать ещё раз", "Твой счёт сохранён. В обычном задании после ошибки со счёта спишут половину приза или весь остаток, если его меньше. Прочитай разбор и попробуй снова.", {point: true});
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
        show("quiz-reward", ".qc-return", "Награда уже на счёте", "За три верных ответа ты получил " + number(lesson.prize) + " ∫. Вернись на карту.", {point: true});
        return;
      case "cooldown":
        if (navigate("world", "Школа на перерыве", "Открой карту мира.")) return;
        if (!el(districtTask)) {
          highlightSchool("Когда вернётся задание?", "Нажми на школу и посмотри, когда откроется следующая попытка.");
          return;
        }
        explain("school-cooldown", districtTask + " .pg-challenge-status", "Школа откроется через 30 минут", "В обычном задании ошибка, выход или конец времени завершают попытку. Ты теряешь со счёта половину приза, максимум — свой остаток. У каждого задания свой таймер.", "Понятно", () => {
          Quests.setTrainingQuiz(false);
          go(lesson.upgradeTaught ? "honors" : "earn");
        }, {point: true});
        return;
      case "honors":
        if (App.sheet === "honors") {
          const before = Economy.hud().balance;
          window.Honors.releaseTrainingRewards();
          return go("honorsSeen", {honorReward: Math.max(0, Economy.hud().balance - before)});
        }
        show("honors", "#honors-btn", "Твои достижения", "Медаль вверху открывает список достижений. Нажми на неё.", {point: true});
        return;
      case "honorsSeen":
        if (App.sheet !== "honors") return go("gallery");
        show("honors-close", "#close-sheet", "Награды приходят сами",
          (lesson.honorReward > 0 ? "За первые достижения тебе начислено " + number(lesson.honorReward) + " ∫. " : "Здесь видны твои достижения. ") +
          "Закрой список, чтобы выбрать фон.", {point: true});
        return;
      case "gallery": {
        if (navigate("appearance", "Выбери свой фон", "Открой «Оформления» в нижнем меню.")) return;
        const choices = [...document.querySelectorAll(availableThemes)];
        const picked = choices.find(card => card.getAttribute("aria-pressed") === "true");
        if (picked && el(".ap-use:not(:disabled)")) return go("applyTheme", {themeId: picked.dataset.id, originalTheme: Appearance.selection().themes});
        if (!choices.length) {
          explain("no-theme", ".ap-tabs", "Новые оформления", "Другие фоны откроются вместе с достижениями.", "На главную", () => go("home"));
        } else {
          show("choose-theme", choices[0], "Выбери фон", "Коснись любого понравившегося открытого фона.", {point: true, allowed: choices});
        }
        return;
      }
      case "applyTheme": {
        const current = Appearance.selection().themes;
        if ((lesson.originalTheme && current !== lesson.originalTheme) ||
            (!lesson.originalTheme && current === lesson.themeId)) {
          return go("home", {themeId: current});
        }
        if (!el(".ap-use:not(:disabled)")) return go("gallery");
        const selected = el('.ap-card[aria-pressed="true"]')?.dataset.id;
        if (selected && selected !== lesson.themeId) {
          lesson.themeId = selected;
          save();
        }
        show("apply-theme", ".ap-use", "Примерь оформление", "Нажми «Применить» или посмотри другой открытый фон.", {point: true, allowed: [...document.querySelectorAll(availableThemes)]});
        return;
      }
      case "home": {
        if (App.activeRoute !== "home" || App.sheet) App.route("home");
        const current = Appearance.selection().themes;
        const changed = lesson.originalTheme ? current !== lesson.originalTheme : current === lesson.themeId;
        if (!changed && lesson.themeId) return go("gallery", {themeId: null});
        const theme = Honors.catalog("themes").find(item => item.id === current);
        const caption = theme ? "Фон «" + theme.name + "» виден и на других вкладках." : "Этот фон виден и на других вкладках.";
        explain("theme-reveal", null, changed ? "Во, смотри, ты поменял оформление!" : "Твой фон лаборатории",
          caption, "Дальше", () => go("complete", {themeAcknowledged: true}), {point: true});
        return;
      }
      case "complete":
        // An unfinished save from before the reveal should still show its chosen theme.
        if (!lesson.themeAcknowledged) return go("home");
        explain("completed", null, "Обучение пройдено",
          "Школа открыта, а бит уже приносит интегралы. Приглашай новых жителей, чтобы город рос.",
          "Играть самостоятельно", finish, {point: true});
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
    window.addEventListener("duotap", event => {
      if (lesson.phase === "testUpgrade" && event.detail?.earned > 0) recordUpgradeTap(event.detail.earned);
    });
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

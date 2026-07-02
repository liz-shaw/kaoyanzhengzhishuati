const state = {
  bankFile: "",
  bankData: null,
  currentQuestion: null,
  banks: [],
  favorites: [],
  highlightRules: [],
  progress: null,
  stats: {},
  progressTimer: null,
  returnLocation: null,
  selectedHighlightText: "",
  submitted: false,
};

const LEGACY_FAVORITE_KEY = "kaoyan-politics-favorites";
const DEFAULT_HIGHLIGHT_RULES = [
  { label: "依法治国", keywords: ["全面依法治国", "依法治国", "法治国家", "法治政府", "法治社会"] },
  { label: "宪法法律", keywords: ["宪法", "法律", "立法", "司法", "行政保障", "司法保障", "权利保障"] },
  { label: "人民立场", keywords: ["人民立场", "人民至上", "以人民为中心", "全过程人民民主"] },
  { label: "党的领导", keywords: ["中国共产党的领导", "党的领导", "全面从严治党", "自我革命"] },
  { label: "马克思主义", keywords: ["马克思主义", "实践观点", "人民性", "科学性", "实践性", "发展性"] },
  { label: "新发展理念", keywords: ["新发展理念", "高质量发展", "新发展格局", "共同富裕", "国家安全"] },
  { label: "核心价值观", keywords: ["社会主义核心价值观", "爱国", "敬业", "诚信", "友善"] },
  { label: "历史纲要", keywords: ["新民主主义革命", "五四运动", "辛亥革命", "抗日战争", "改革开放"] },
];

const el = {
  bankSelect: document.querySelector("#bankSelect"),
  partSelect: document.querySelector("#partSelect"),
  sectionSelect: document.querySelector("#sectionSelect"),
  numberSelect: document.querySelector("#numberSelect"),
  returnBtn: document.querySelector("#returnBtn"),
  mobileReturnBtn: document.querySelector("#mobileReturnBtn"),
  favoriteBtn: document.querySelector("#favoriteBtn"),
  collectHighlightBtn: document.querySelector("#collectHighlightBtn"),
  favoriteCount: document.querySelector("#favoriteCount"),
  favoriteList: document.querySelector("#favoriteList"),
  highlightRuleCount: document.querySelector("#highlightRuleCount"),
  highlightRuleList: document.querySelector("#highlightRuleList"),
  bankTitle: document.querySelector("#bankTitle"),
  sectionTitle: document.querySelector("#sectionTitle"),
  questionType: document.querySelector("#questionType"),
  answerState: document.querySelector("#answerState"),
  questionText: document.querySelector("#questionText"),
  options: document.querySelector("#options"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTitle: document.querySelector("#resultTitle"),
  rightAnswer: document.querySelector("#rightAnswer"),
  highlightLibrary: document.querySelector("#highlightLibrary"),
  inlineCollectHighlightBtn: document.querySelector("#inlineCollectHighlightBtn"),
  selectionPreview: document.querySelector("#selectionPreview"),
  explanation: document.querySelector("#explanation"),
  currentNumber: document.querySelector("#currentNumber"),
  totalNumber: document.querySelector("#totalNumber"),
  completedNumber: document.querySelector("#completedNumber"),
  correctRate: document.querySelector("#correctRate"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  mobilePrevBtn: document.querySelector("#mobilePrevBtn"),
  mobileNextBtn: document.querySelector("#mobileNextBtn"),
  submitBtn: document.querySelector("#submitBtn"),
  answerBtn: document.querySelector("#answerBtn"),
  highlightDialog: document.querySelector("#highlightDialog"),
  selectedHighlightText: document.querySelector("#selectedHighlightText"),
  highlightLabelSelect: document.querySelector("#highlightLabelSelect"),
  highlightLabelInput: document.querySelector("#highlightLabelInput"),
  cancelHighlightBtn: document.querySelector("#cancelHighlightBtn"),
  saveHighlightBtn: document.querySelector("#saveHighlightBtn"),
};

function option(select, value, text) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = text;
  select.appendChild(item);
}

function fillSelect(select, items) {
  select.innerHTML = "";
  items.forEach((item) => option(select, item.value, item.text));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textFromHtml(value) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value || "";
  return wrapper.textContent || wrapper.innerText || "";
}

function selectedAnswers() {
  return Array.from(el.options.querySelectorAll("input:checked")).map((input) => input.value);
}

function sameAnswers(a, b) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function currentKeys() {
  return {
    part: el.partSelect.value,
    section: el.sectionSelect.value,
    number: el.numberSelect.value,
  };
}

function currentFavoriteId() {
  const { part, section, number } = currentKeys();
  return [state.bankFile, part, section, number].join("::");
}

function currentQuestionId() {
  return currentFavoriteId();
}

function currentProgressPayload() {
  const { part, section, number } = currentKeys();
  return {
    bankFile: state.bankFile,
    bankTitle: state.bankData?.title || state.bankFile,
    part,
    section,
    number,
    updatedAt: Date.now(),
  };
}

function sameLocation(a, b) {
  return Boolean(
    a &&
    b &&
    a.bankFile === b.bankFile &&
    a.part === b.part &&
    a.section === b.section &&
    a.number === b.number
  );
}

function setReturnLocation(location) {
  state.returnLocation = location;
  const visible = Boolean(location);
  el.returnBtn.hidden = !visible;
  el.mobileReturnBtn.hidden = !visible;
}

async function loadProgress() {
  const response = await fetch("/api/progress");
  state.progress = await response.json();
}

async function loadStats() {
  const response = await fetch("/api/stats");
  state.stats = await response.json();
}

async function recordAttempt(correct) {
  const response = await fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: currentQuestionId(),
      correct,
      updatedAt: Date.now(),
    }),
  });
  state.stats = await response.json();
  renderSectionStats();
}

function renderSectionStats() {
  const { part, section } = currentKeys();
  const prefix = [state.bankFile, part, section, ""].join("::");
  const sectionRecords = Object.entries(state.stats).filter(([id]) => id.startsWith(prefix));
  const completed = sectionRecords.length;
  const totals = sectionRecords.reduce(
    (acc, [, record]) => {
      acc.attempts += Number(record.attempts || 0);
      acc.correct += Number(record.correct || 0);
      return acc;
    },
    { attempts: 0, correct: 0 }
  );
  const rate = totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0;
  el.completedNumber.textContent = completed;
  el.correctRate.textContent = `${rate}%`;
}

function saveProgressSoon() {
  if (!state.currentQuestion || !state.bankFile) {
    return;
  }

  clearTimeout(state.progressTimer);
  state.progressTimer = setTimeout(async () => {
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentProgressPayload()),
      });
    } catch (error) {
      console.warn("保存进度失败", error);
    }
  }, 250);
}

async function loadFavorites() {
  const response = await fetch("/api/favorites");
  state.favorites = await response.json();
  await migrateLocalFavorites();
  renderFavorites();
}

async function migrateLocalFavorites() {
  let localFavorites = [];
  try {
    localFavorites = JSON.parse(localStorage.getItem(LEGACY_FAVORITE_KEY) || "[]");
  } catch (error) {
    localFavorites = [];
  }

  if (!localFavorites.length) {
    return;
  }

  for (const favorite of localFavorites) {
    if (!state.favorites.some((item) => item.id === favorite.id)) {
      await addFavorite(favorite);
    }
  }
  localStorage.removeItem(LEGACY_FAVORITE_KEY);
}

async function addFavorite(favorite) {
  const response = await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(favorite),
  });
  state.favorites = await response.json();
  renderFavorites();
}

async function removeFavorite(id) {
  const response = await fetch(`/api/favorites?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  state.favorites = await response.json();
  renderFavorites();
}

function syncFavoriteButton() {
  const isFavorite = state.favorites.some((item) => item.id === currentFavoriteId());
  el.favoriteBtn.textContent = isFavorite ? "已收藏" : "收藏";
  el.favoriteBtn.classList.toggle("primary", isFavorite);
}

function favoritePayload() {
  const { part, section, number } = currentKeys();
  return {
    id: currentFavoriteId(),
    bankFile: state.bankFile,
    bankTitle: state.bankData?.title || state.bankFile,
    part,
    section,
    number,
    type: state.currentQuestion?.type || "",
    title: textFromHtml(state.currentQuestion?.title || "").slice(0, 70),
    createdAt: Date.now(),
  };
}

async function toggleFavorite() {
  const id = currentFavoriteId();
  const index = state.favorites.findIndex((item) => item.id === id);
  if (index >= 0) {
    await removeFavorite(id);
  } else {
    await addFavorite(favoritePayload());
  }
  syncFavoriteButton();
}

function renderFavorites() {
  el.favoriteCount.textContent = state.favorites.length;
  el.favoriteList.innerHTML = "";

  if (!state.favorites.length) {
    const empty = document.createElement("div");
    empty.className = "favorite-empty";
    empty.textContent = "收藏题目后，会在这里保留题库、章节和题号。";
    el.favoriteList.appendChild(empty);
    return;
  }

  state.favorites.forEach((favorite) => {
    const item = document.createElement("div");
    item.className = "favorite-item";

    const main = document.createElement("div");
    main.className = "favorite-main";
    main.innerHTML = `
      <div class="favorite-title"></div>
      <div class="favorite-meta"></div>
    `;
    main.querySelector(".favorite-title").textContent = `${favorite.number}. ${favorite.title}`;
    main.querySelector(".favorite-meta").textContent = `${favorite.bankTitle} / ${favorite.part} / ${favorite.section}`;
    main.addEventListener("click", () => goToFavorite(favorite));

    const remove = document.createElement("button");
    remove.className = "favorite-remove";
    remove.type = "button";
    remove.textContent = "删";
    remove.title = "移出收藏";
    remove.addEventListener("click", async () => {
      await removeFavorite(favorite.id);
      syncFavoriteButton();
    });

    item.append(main, remove);
    el.favoriteList.appendChild(item);
  });
}

async function goToFavorite(favorite) {
  const current = currentProgressPayload();
  if (!sameLocation(current, favorite)) {
    setReturnLocation(current);
  }

  if (state.bankFile !== favorite.bankFile) {
    el.bankSelect.value = favorite.bankFile;
    await loadBank(favorite.bankFile, favorite);
    return;
  }

  el.partSelect.value = favorite.part;
  fillSections(favorite);
  el.sectionSelect.value = favorite.section;
  fillNumbers(favorite);
  el.numberSelect.value = favorite.number;
  showQuestion();
}

async function goToLocation(location, options = {}) {
  if (!location) {
    return;
  }

  if (state.bankFile !== location.bankFile) {
    el.bankSelect.value = location.bankFile;
    await loadBank(location.bankFile, location);
  } else {
    el.partSelect.value = location.part;
    fillSections(location);
    el.sectionSelect.value = location.section;
    fillNumbers(location);
    el.numberSelect.value = location.number;
    showQuestion();
  }

  if (options.clearReturn) {
    setReturnLocation(null);
  }
}

function returnToPreviousLocation() {
  goToLocation(state.returnLocation, { clearReturn: true });
}

async function loadBanks() {
  const response = await fetch("/api/banks");
  const banks = await response.json();
  state.banks = banks;
  fillSelect(el.bankSelect, banks.map((bank) => ({ value: bank.file, text: bank.title })));
  if (banks.length) {
    const saved = state.progress || {};
    const startFile = banks.some((bank) => bank.file === saved.bankFile) ? saved.bankFile : banks[0].file;
    el.bankSelect.value = startFile;
    await loadBank(startFile, saved);
  }
}

async function loadBank(file, restore = {}) {
  state.bankFile = file;
  const response = await fetch(`/api/banks/${encodeURIComponent(file)}`);
  state.bankData = await response.json();
  el.bankTitle.textContent = state.bankData.title || "考研政治刷题";

  const parts = Object.keys(state.bankData).filter((key) => key !== "title");
  fillSelect(el.partSelect, parts.map((key) => ({ value: key, text: key })));
  if (parts.includes(restore.part)) {
    el.partSelect.value = restore.part;
  }
  fillSections(restore);
}

function fillSections(restore = {}) {
  const part = el.partSelect.value;
  const sections = Object.keys(state.bankData?.[part] || {});
  fillSelect(el.sectionSelect, sections.map((key) => ({ value: key, text: key })));
  if (sections.includes(restore.section)) {
    el.sectionSelect.value = restore.section;
  }
  fillNumbers(restore);
}

function fillNumbers(restore = {}) {
  const { part, section } = currentKeys();
  const numbers = Object.keys(state.bankData?.[part]?.[section] || {}).sort((a, b) => Number(a) - Number(b));
  fillSelect(el.numberSelect, numbers.map((key) => ({ value: key, text: key })));
  if (numbers.includes(restore.number)) {
    el.numberSelect.value = restore.number;
  }
  showQuestion();
}

function showQuestion() {
  const { part, section, number } = currentKeys();
  const question = state.bankData?.[part]?.[section]?.[number];
  if (!question) {
    return;
  }

  state.currentQuestion = question;
  state.submitted = false;
  state.selectedHighlightText = "";
  el.resultPanel.hidden = true;
  el.collectHighlightBtn.disabled = true;
  el.collectHighlightBtn.textContent = "收集高亮";
  el.inlineCollectHighlightBtn.disabled = true;
  el.inlineCollectHighlightBtn.textContent = "收集选中文字";
  el.selectionPreview.textContent = "选中解析里的文字后，这里会显示待收集内容。";
  el.sectionTitle.textContent = `${part} / ${section}`;
  el.questionType.textContent = question.type || "题目";
  el.answerState.textContent = "未作答";
  el.answerState.className = "";
  el.questionText.textContent = textFromHtml(question.title || "");
  el.currentNumber.textContent = number;
  el.totalNumber.textContent = el.numberSelect.options.length;
  renderSectionStats();
  syncFavoriteButton();
  saveProgressSoon();

  const inputType = question.type === "单选" ? "radio" : "checkbox";
  el.options.innerHTML = "";
  (question.xuanxiang || []).forEach((content) => {
    const answer = String(content).trim().slice(0, 1).toUpperCase();
    const label = document.createElement("label");
    label.className = "option";
    label.innerHTML = `<input type="${inputType}" name="answer" value="${answer}"><span></span>`;
    label.querySelector("span").textContent = textFromHtml(content);
    label.querySelector("input").addEventListener("change", () => {
      document.querySelectorAll(".option").forEach((item) => item.classList.toggle("selected", item.querySelector("input").checked));
    });
    el.options.appendChild(label);
  });
}

function matchedHighlightRules(html) {
  const text = textFromHtml(html);
  return state.highlightRules.filter((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
}

function renderHighlightLibrary(matches) {
  el.highlightLibrary.innerHTML = "";
  if (!matches.length) {
    const chip = document.createElement("span");
    chip.className = "highlight-chip";
    chip.textContent = "暂无命中条例库";
    el.highlightLibrary.appendChild(chip);
    return;
  }

  matches.forEach((rule) => {
    const chip = document.createElement("span");
    chip.className = "highlight-chip";
    chip.textContent = rule.label;
    chip.title = rule.keywords.join("、");
    el.highlightLibrary.appendChild(chip);
  });
}

function renderHighlightLabelOptions() {
  fillSelect(el.highlightLabelSelect, state.highlightRules.map((rule) => ({ value: rule.label, text: rule.label })));
}

function renderHighlightRuleList() {
  el.highlightRuleCount.textContent = state.highlightRules.length;
  el.highlightRuleList.innerHTML = "";

  if (!state.highlightRules.length) {
    const empty = document.createElement("div");
    empty.className = "favorite-empty";
    empty.textContent = "解析中收集的高亮词会显示在这里。";
    el.highlightRuleList.appendChild(empty);
    return;
  }

  state.highlightRules.forEach((rule) => {
    const item = document.createElement("div");
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
    item.className = "highlight-rule-item";
    item.innerHTML = `
      <div class="highlight-rule-title"></div>
      <div class="highlight-rule-keywords"></div>
    `;
    item.querySelector(".highlight-rule-title").textContent = rule.label;
    item.querySelector(".highlight-rule-keywords").textContent = keywords.slice(0, 6).join("、") || "暂无关键词";
    el.highlightRuleList.appendChild(item);
  });
}

function highlightTextNodes(root, keywords) {
  const words = [...new Set(keywords)].sort((a, b) => b.length - a.length);
  if (!words.length) {
    return;
  }

  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "g");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach((node) => {
    if (!pattern.test(node.nodeValue)) {
      pattern.lastIndex = 0;
      return;
    }

    pattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    node.nodeValue.split(pattern).forEach((part) => {
      if (words.includes(part)) {
        const mark = document.createElement("mark");
        mark.className = "law-highlight";
        mark.textContent = part;
        fragment.appendChild(mark);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });
    node.parentNode.replaceChild(fragment, node);
  });
}

function revealResult(markChoice = false) {
  const question = state.currentQuestion;
  const right = question.right_value || [];
  const chosen = selectedAnswers();
  if (markChoice && !chosen.length) {
    alert("请先选择答案再提交。");
    return;
  }
  const correct = sameAnswers(chosen, right);

  el.resultPanel.hidden = false;
  el.collectHighlightBtn.disabled = false;
  el.inlineCollectHighlightBtn.disabled = false;
  el.rightAnswer.textContent = `正确答案：${right.join("")}`;
  el.explanation.innerHTML = question.jiexi || "暂无解析";
  const matches = matchedHighlightRules(question.jiexi || "");
  renderHighlightLibrary(matches);
  highlightTextNodes(el.explanation, matches.flatMap((rule) => rule.keywords));

  if (markChoice) {
    recordAttempt(correct);
    el.answerState.textContent = correct ? "回答正确" : "再想一下";
    el.answerState.className = correct ? "is-good" : "is-bad";
  } else {
    el.answerState.textContent = "已查看解析";
    el.answerState.className = "";
  }

  document.querySelectorAll(".option").forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("correct", right.includes(input.value));
    label.classList.toggle("wrong", markChoice && input.checked && !right.includes(input.value));
  });
}

function selectedTextInsideExplanation() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return "";
  }

  const range = selection.getRangeAt(0);
  if (!el.explanation.contains(range.startContainer) || !el.explanation.contains(range.endContainer)) {
    return "";
  }
  return selection.toString().replace(/\s+/g, " ").trim();
}

function cacheSelectedHighlightText() {
  const text = selectedTextInsideExplanation();
  if (!text) {
    return;
  }

  state.selectedHighlightText = text.slice(0, 120);
  el.collectHighlightBtn.disabled = false;
  el.collectHighlightBtn.textContent = "收集已选文字";
  el.inlineCollectHighlightBtn.disabled = false;
  el.inlineCollectHighlightBtn.textContent = "收集已选文字";
  el.selectionPreview.textContent = state.selectedHighlightText;
}

function openHighlightDialog() {
  cacheSelectedHighlightText();
  const text = state.selectedHighlightText;
  if (!text) {
    alert("请先在解析文字里选中要高亮收集的内容。");
    return;
  }

  el.selectedHighlightText.textContent = state.selectedHighlightText;
  el.highlightLabelInput.value = "";
  renderHighlightLabelOptions();
  if (el.highlightDialog.showModal) {
    el.highlightDialog.showModal();
  } else {
    const label = prompt("输入条例库分类：", el.highlightLabelSelect.value || "重点");
    if (label) {
      saveSelectedHighlight(label);
    }
  }
}

async function saveSelectedHighlight(labelOverride = "") {
  const label = (labelOverride || el.highlightLabelInput.value || el.highlightLabelSelect.value || "").trim();
  if (!label || !state.selectedHighlightText) {
    return;
  }

  const response = await fetch("/api/highlight-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, keyword: state.selectedHighlightText }),
  });
  state.highlightRules = await response.json();
  renderHighlightRuleList();
  if (el.highlightDialog.open) {
    el.highlightDialog.close();
  }
  state.selectedHighlightText = "";
  el.collectHighlightBtn.textContent = "收集高亮";
  el.inlineCollectHighlightBtn.textContent = "收集选中文字";
  el.selectionPreview.textContent = "已保存到条例库。";
  revealResult(false);
}

function moveQuestion(offset) {
  const index = el.numberSelect.selectedIndex + offset;
  if (index >= 0 && index < el.numberSelect.options.length) {
    el.numberSelect.selectedIndex = index;
    showQuestion();
  }
}

el.bankSelect.addEventListener("change", () => loadBank(el.bankSelect.value));
el.partSelect.addEventListener("change", fillSections);
el.sectionSelect.addEventListener("change", fillNumbers);
el.numberSelect.addEventListener("change", showQuestion);
el.favoriteBtn.addEventListener("click", () => toggleFavorite());
el.returnBtn.addEventListener("click", returnToPreviousLocation);
el.mobileReturnBtn.addEventListener("click", returnToPreviousLocation);
el.prevBtn.addEventListener("click", () => moveQuestion(-1));
el.nextBtn.addEventListener("click", () => moveQuestion(1));
el.mobilePrevBtn.addEventListener("click", () => moveQuestion(-1));
el.mobileNextBtn.addEventListener("click", () => moveQuestion(1));
el.answerBtn.addEventListener("click", () => revealResult(false));
el.submitBtn.addEventListener("click", () => revealResult(true));
el.collectHighlightBtn.addEventListener("click", openHighlightDialog);
el.inlineCollectHighlightBtn.addEventListener("click", openHighlightDialog);
el.cancelHighlightBtn.addEventListener("click", () => el.highlightDialog.close());
el.saveHighlightBtn.addEventListener("click", () => saveSelectedHighlight());
document.addEventListener("selectionchange", cacheSelectedHighlightText);
el.explanation.addEventListener("mouseup", cacheSelectedHighlightText);
el.explanation.addEventListener("touchend", () => setTimeout(cacheSelectedHighlightText, 120));

async function loadHighlightRules() {
  try {
    const response = await fetch("/api/highlight-rules");
    state.highlightRules = await response.json();
  } catch (error) {
    state.highlightRules = DEFAULT_HIGHLIGHT_RULES;
  }
  renderHighlightRuleList();
}

async function boot() {
  await loadHighlightRules();
  await loadFavorites();
  await loadProgress();
  await loadStats();
  await loadBanks();
}

boot().catch((error) => {
  el.questionText.textContent = `加载失败：${error.message}`;
});

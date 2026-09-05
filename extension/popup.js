/* global chrome */

const DEFAULT_ENDPOINT = "http://localhost:3000";
const SUPPORTED_API_VERSION = 1;
const DRAFT_KEY = "applylyCaptureDraft";
const STORAGE_KEYS = ["applylyEndpoint", "applylyPairingToken", DRAFT_KEY];

const elements = {
  badge: document.querySelector("#connectionBadge"),
  notice: document.querySelector("#notice"),
  guideButton: document.querySelector("#guideButton"),
  guideSite: document.querySelector("#guideSite"),
  guideState: document.querySelector("#guideState"),
  scanButton: document.querySelector("#scanButton"),
  matchForm: document.querySelector("#matchForm"),
  companyInput: document.querySelector("#companyInput"),
  roleInput: document.querySelector("#roleInput"),
  urlInput: document.querySelector("#urlInput"),
  candidateSelect: document.querySelector("#candidateSelect"),
  keepDraftButton: document.querySelector("#keepDraftButton"),
  discardDraftButton: document.querySelector("#discardDraftButton"),
  pageSummary: document.querySelector("#pageSummary"),
  resultsSection: document.querySelector("#resultsSection"),
  resultsList: document.querySelector("#resultsList"),
  matchCount: document.querySelector("#matchCount"),
  reviewCaptureButton: document.querySelector("#reviewCaptureButton"),
  connectionPanel: document.querySelector("#connectionPanel"),
  connectionForm: document.querySelector("#connectionForm"),
  endpointInput: document.querySelector("#endpointInput"),
  tokenInput: document.querySelector("#tokenInput"),
  forgetButton: document.querySelector("#forgetButton"),
  openApplylyButton: document.querySelector("#openApplylyButton"),
};

let config = { endpoint: DEFAULT_ENDPOINT, token: "" };
let pageContext = null;
let latestMatches = [];
let latestCandidateMatches = [];
let guideTabId = null;
let guidePattern = "";
let guideEnabled = false;
let matchRevision = 0;

function setNotice(message, kind = "info") {
  elements.notice.textContent = message;
  elements.notice.dataset.kind = kind;
  elements.notice.hidden = !message;
}

function setBadge(label, state = "idle") {
  elements.badge.textContent = label;
  elements.badge.dataset.state = state;
}

function normalizeEndpoint(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid Applyly address.");
  }
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Applyly must use a local http://localhost or http://127.0.0.1 address.");
  }
  return url.origin;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(normalizeEndpoint(config.endpoint) + path, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error("Pairing token rejected. Create a new token in Applyly Settings.");
      throw new Error(data.error || "Applyly returned an unexpected error.");
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Applyly did not respond. Make sure npm run dev is running.");
    }
    if (error instanceof TypeError) {
      throw new Error("Could not reach local Applyly. Make sure npm run dev is running.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHealth() {
  setBadge("Checking...");
  const health = await request("/api/health");
  if (health.apiVersion !== SUPPORTED_API_VERSION) {
    throw new Error(`This extension supports Applyly API v${SUPPORTED_API_VERSION}; the local app reports v${health.apiVersion ?? "unknown"}.`);
  }
  if (!health.extension?.supported || !health.extension.features?.includes("page-match")) {
    throw new Error("This Applyly build does not advertise page and URL matching.");
  }
  if (!health.extension.paired) {
    setBadge("Pairing needed", "error");
    throw new Error("Create a browser-extension pairing token in Applyly Settings, then paste it below.");
  }
  if (!config.token) {
    setBadge("Token needed", "error");
    throw new Error("Applyly is ready. Paste its pairing token in Connection settings.");
  }
  await request("/api/extension/page-match", {
    method: "POST",
    headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
    body: JSON.stringify({ candidates: [{ url: "https://connection-check.invalid/job" }] }),
  });
  setBadge("Local - connected", "connected");
  return health;
}

function patternForPage(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Guidance is unavailable on this page.");
  return url.protocol + "//" + url.hostname + "/*";
}

function renderGuideControl() {
  elements.guideState.textContent = guideEnabled ? "On" : "Off";
  elements.guideState.dataset.state = guideEnabled ? "on" : "off";
  elements.guideButton.textContent = guideEnabled ? "Disable" : "Enable";
  elements.guideButton.disabled = !guideTabId || !guidePattern;
}

async function extensionMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "The extension background service did not respond.");
  return response;
}

async function loadGuideState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("No supported page is active.");
    guideTabId = tab.id;
    guidePattern = patternForPage(tab.url);
    elements.guideSite.textContent = new URL(tab.url).hostname;
    const state = await extensionMessage({ type: "applyly-guide-state", tabId: tab.id });
    guideEnabled = Boolean(state.enabled);
  } catch {
    guideTabId = null;
    guidePattern = "";
    guideEnabled = false;
    elements.guideSite.textContent = "Unavailable on this page";
  }
  renderGuideControl();
}

async function toggleGuide() {
  if (!guideTabId || !guidePattern) return;
  elements.guideButton.disabled = true;
  setNotice("");
  try {
    if (guideEnabled) {
      await extensionMessage({ type: "applyly-guide-disable", tabId: guideTabId });
      guideEnabled = false;
      const removed = await chrome.permissions.remove({ origins: [guidePattern] });
      if (!removed) throw new Error("Guidance is off, but Chrome kept the saved site permission. Remove it from the extension's site-access settings.");
      setNotice("Automatic guidance was disabled and site access was removed.", "success");
    } else {
      const granted = await chrome.permissions.request({ origins: [guidePattern] });
      if (!granted) throw new Error("Site access was not granted.");
      try {
        await extensionMessage({ type: "applyly-guide-enable", tabId: guideTabId });
      } catch (error) {
        await chrome.permissions.remove({ origins: [guidePattern] });
        throw error;
      }
      guideEnabled = true;
      setNotice("Applyly guidance is active on this site and will survive refreshes.", "success");
    }
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    renderGuideControl();
  }
}
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
    throw new Error("Open a regular http or https job page before scanning.");
  }
  return tab;
}

function clearMatches() {
  matchRevision += 1;
  latestMatches = [];
  latestCandidateMatches = [];
  elements.resultsList.replaceChildren();
  elements.resultsSection.hidden = true;
}

function selectCandidate() {
  const candidate = pageContext?.candidates?.[Number(elements.candidateSelect.value)] || {};
  elements.companyInput.value = candidate.company || "";
  elements.roleInput.value = candidate.role || "";
  elements.urlInput.value = candidate.url || "";
  clearMatches();
}

function editedCandidate() {
  const company = elements.companyInput.value.trim().slice(0, 300);
  const role = elements.roleInput.value.trim().slice(0, 500);
  const rawUrl = elements.urlInput.value.trim();
  let url = "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || rawUrl.length > 2000) throw new Error();
      url = parsed.href;
    } catch {
      throw new Error("Enter a valid http or https job URL (up to 2,000 characters).");
    }
  }
  if (!company && !role && !url) throw new Error("Enter a company, role, or job URL first.");
  return { company, role, url };
}

async function scanPage() {
  setNotice("");
  clearMatches();
  pageContext = null;
  elements.matchForm.hidden = true;
  elements.reviewCaptureButton.hidden = true;
  elements.pageSummary.hidden = true;
  elements.scanButton.disabled = true;
  elements.scanButton.textContent = "Reading...";
  try {
    const tab = await getActiveTab();
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["page-reader-core.js", "page-context.js"],
    });
    pageContext = injection?.result;
    if (!pageContext || !Array.isArray(pageContext.candidates)) throw new Error("The page reader did not respond. Refresh the job page and try again.");
    if (!pageContext.candidates.length) {
      pageContext.candidates = [{ company: "", role: "", url: tab.url }];
      setNotice("No job details were detected. The page URL is ready; enter the company and role manually.");
    } else {
      setNotice("Review the detected details. Reading a page does not save an application.");
    }
    showDetectedContext();
  } catch (error) {
    pageContext = null;
    setNotice(error.message, "error");
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "Scan page";
  }
}

function showDetectedContext() {
  const candidates = pageContext?.candidates || [];
  elements.candidateSelect.replaceChildren();
  candidates.forEach((candidate, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = [candidate.role || "Untitled job", candidate.company || candidate.url].filter(Boolean).join(" — ");
    elements.candidateSelect.append(option);
  });
  elements.candidateSelect.value = "0";
  elements.matchForm.hidden = !candidates.length;
  elements.reviewCaptureButton.hidden = !candidates.length;
  elements.pageSummary.hidden = false;
  elements.pageSummary.textContent = candidates.length > 1
    ? candidates.length + " jobs detected. Choose one to review, including jobs with no application history."
    : "Correct the details below. Check history if paired, or open a draft in Applyly.";
  selectCandidate();
}

async function keepDraft() {
  const candidate = editedCandidate();
  await chrome.storage.local.set({ [DRAFT_KEY]: candidate });
  elements.discardDraftButton.hidden = false;
  setNotice("Draft kept in this browser. It will be restored when you reopen the popup. Keeping another draft replaces it.", "success");
}

async function discardDraft() {
  await chrome.storage.local.remove(DRAFT_KEY);
  elements.discardDraftButton.hidden = true;
  setNotice("Saved browser draft removed. Your Applyly applications are unchanged.");
}

async function runPageMatch(candidates, revision = matchRevision) {
  const data = await request("/api/extension/page-match", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + config.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pageUrl: pageContext?.pageUrl || undefined,
      candidates,
    }),
  });
  if (revision !== matchRevision) return;
  latestMatches = Array.isArray(data.matches) ? data.matches : [];
  latestCandidateMatches = Array.isArray(data.candidateMatches) ? data.candidateMatches : [];
  const matchedCandidates = Number(data.matchedCandidates)
    || latestCandidateMatches.filter(result => Number(result.matchCount) > 0).length;
  renderMatches(latestMatches, Number(data.scannedCandidates) || candidates.length, latestCandidateMatches);
  elements.reviewCaptureButton.hidden = false;
  setNotice(matchedCandidates
    ? "Found local history for " + matchedCandidates + " detected job" + (matchedCandidates === 1 ? "" : "s") + "."
    : "No Applyly history matched the detected jobs.",
  matchedCandidates ? "success" : "info");
}

async function matchCurrentCompany() {
  const submit = elements.matchForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  clearMatches();
  const revision = matchRevision;
  try {
    const candidate = editedCandidate();
    if (!candidate.company && !candidate.url) throw new Error("Add a company or job URL to check history.");
    await checkHealth();
    if (revision !== matchRevision) return;
    await runPageMatch([candidate], revision);
  } catch (error) {
    if (revision !== matchRevision) return;
    setBadge("History unavailable", "error");
    setNotice(error.message + " You can still keep this draft or review it in Applyly.", "error");
  } finally {
    submit.disabled = false;
  }
}

function formatAppliedDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return value || "Date unavailable";
  return new Intl.DateTimeFormat(navigator.language, { dateStyle: "medium" })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function matchDescription(matches) {
  if (matches.some(match => match.matchKind === "exact-job" || match.reasons?.includes("application-url"))) return "Exact tracked job";
  if (matches.some(match => match.matchKind === "similar-role" || Number(match.roleScore) >= 60)) return "Related role history";
  return "Company application history";
}

function renderMatches(matches, scannedCandidates, candidateMatches = []) {
  elements.resultsList.replaceChildren();
  elements.resultsSection.hidden = false;
  const matchedGroups = candidateMatches.filter(result => Number(result.matchCount) > 0 && Array.isArray(result.matches));
  elements.matchCount.textContent = scannedCandidates > 1
    ? matchedGroups.length + "/" + scannedCandidates
    : String(matches.length);

  if (!matches.length && !matchedGroups.length) {
    const empty = document.createElement("p");
    empty.className = "empty-results";
    empty.textContent = scannedCandidates > 1
      ? "No history among " + scannedCandidates + " detected jobs."
      : "No matching application was found.";
    elements.resultsList.append(empty);
    return;
  }

  if (scannedCandidates > 1 && matchedGroups.length) {
    for (const result of matchedGroups.slice(0, 12)) {
      const candidate = pageContext?.candidates?.[Number(result.candidateIndex)] ?? {};
      const groupMatches = result.matches;
      const item = document.createElement("article");
      item.className = "result-item";
      const title = document.createElement("p");
      title.className = "result-title";
      title.textContent = candidate.role || groupMatches[0]?.role || "Detected job";
      const count = document.createElement("span");
      count.className = "status-pill";
      count.textContent = result.matchCount + " tracked";
      const company = document.createElement("p");
      company.className = "result-company";
      company.textContent = candidate.company || groupMatches[0]?.company || "Company unavailable";
      const reason = document.createElement("p");
      reason.className = "match-reason";
      reason.textContent = matchDescription(groupMatches);
      const meta = document.createElement("p");
      meta.className = "result-meta";
      meta.textContent = [...new Set(groupMatches.map(match => match.status))].join(" · ");
      item.append(title, count, company, reason, meta);
      elements.resultsList.append(item);
    }
    if (matchedGroups.length > 12) {
      const more = document.createElement("p");
      more.className = "empty-results";
      more.textContent = "+" + (matchedGroups.length - 12) + " more familiar jobs are marked directly on the page when guidance is enabled.";
      elements.resultsList.append(more);
    }
    return;
  }

  for (const match of matches) {
    const item = document.createElement("article");
    item.className = "result-item";

    const title = document.createElement("p");
    title.className = "result-title";
    title.textContent = match.role;

    const status = document.createElement("span");
    status.className = "status-pill";
    status.dataset.status = match.status;
    status.textContent = match.status;

    const companyLine = document.createElement("p");
    companyLine.className = "result-company";
    companyLine.textContent = match.company;

    const reason = document.createElement("p");
    reason.className = "match-reason";
    reason.textContent = matchDescription([match]);

    const meta = document.createElement("p");
    meta.className = "result-meta";
    meta.textContent = [formatAppliedDate(match.appliedDate), match.source, match.location]
      .filter(Boolean)
      .join(" · ");

    item.append(title, status, companyLine, reason, meta);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "text-button";
    open.textContent = "Open application";
    open.addEventListener("click", () => {
      const url = new URL(normalizeEndpoint(config.endpoint));
      url.searchParams.set("view", "applications");
      url.searchParams.set("application", String(match.id));
      chrome.tabs.create({ url: url.href }).catch(error => setNotice(error.message, "error"));
    });
    item.append(open);
    elements.resultsList.append(item);
  }
}
function sourceFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLocaleLowerCase("en-US");
    if (hostname.endsWith("linkedin.com")) return "LinkedIn";
    if (hostname.endsWith("indeed.com")) return "Indeed";
    if (hostname.endsWith("glassdoor.com")) return "Glassdoor";
    if (hostname.endsWith("wellfound.com") || hostname.endsWith("angel.co")) return "Wellfound";
    if (hostname === "hiring.cafe" || hostname.endsWith(".hiring.cafe")) return "HiringCafe";
    if (hostname.endsWith("ycombinator.com")) return "Y Combinator Jobs";
    if (hostname.endsWith("otta.com")) return "Otta";
    if (hostname.endsWith("builtin.com")) return "Built In";
  } catch {
    // Source is optional; an invalid page URL should not block review.
  }
  return "";
}

async function reviewCapturedJob() {
  const candidate = editedCandidate();
  const endpoint = normalizeEndpoint(elements.endpointInput.value || config.endpoint);
  const parameters = new URLSearchParams({ capture: "extension" });
  for (const [key, value] of Object.entries(candidate)) if (value) parameters.set(key, value);
  const source = sourceFromUrl(candidate.url);
  if (source) parameters.set("source", source);
  // Retain the draft until explicitly discarded: opening a tab is not a confirmed save.
  await chrome.storage.local.set({ [DRAFT_KEY]: candidate, applylyEndpoint: endpoint });
  elements.discardDraftButton.hidden = false;
  await chrome.tabs.create({ url: endpoint + "/?" + parameters.toString() });
  window.close();
}
async function saveConnection(event) {
  event.preventDefault();
  setNotice("");
  try {
    config = {
      endpoint: normalizeEndpoint(elements.endpointInput.value),
      token: elements.tokenInput.value.trim(),
    };
    await chrome.storage.local.set({
      applylyEndpoint: config.endpoint,
      applylyPairingToken: config.token,
    });
    if (!config.token) {
      setBadge("Capture ready");
      setNotice("Local address saved. Pairing is optional and only needed for history checks.", "success");
      elements.connectionPanel.open = false;
      return;
    }
    await checkHealth();
    elements.connectionPanel.open = false;
    setNotice("Connected to local Applyly.", "success");
  } catch (error) {
    setBadge("Connection failed", "error");
    setNotice(error.message, "error");
  }
}

async function forgetConnection() {
  await chrome.storage.local.remove("applylyPairingToken");
  config.token = "";
  elements.tokenInput.value = "";
  clearMatches();
  setBadge("Token needed", "error");
  setNotice("The pairing token was removed from this browser profile.");
  elements.connectionPanel.open = true;
}

async function openApplyly() {
  let endpoint = DEFAULT_ENDPOINT;
  try { endpoint = normalizeEndpoint(elements.endpointInput.value || config.endpoint); } catch { /* Use default. */ }
  await chrome.tabs.create({ url: endpoint });
}

async function initialize() {
  await loadGuideState();
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  config = {
    endpoint: stored.applylyEndpoint || DEFAULT_ENDPOINT,
    token: stored.applylyPairingToken || "",
  };
  elements.endpointInput.value = config.endpoint;
  elements.tokenInput.value = config.token;
  if (stored[DRAFT_KEY] && typeof stored[DRAFT_KEY] === "object") {
    pageContext = { mode: "detail", candidates: [stored[DRAFT_KEY]] };
    showDetectedContext();
    elements.discardDraftButton.hidden = false;
    setNotice("Restored your saved browser draft. It may be from a different page. Scan page to read the current tab.");
  }
  if (!config.token) {
    setBadge("Capture ready");
    return;
  }
  try {
    await checkHealth();
  } catch (error) {
    setBadge("History unavailable", "error");
    setNotice(error.message + " Capture still works.", "error");
  }
}

elements.candidateSelect.addEventListener("change", selectCandidate);
for (const field of [elements.companyInput, elements.roleInput, elements.urlInput]) field.addEventListener("input", clearMatches);
elements.keepDraftButton.addEventListener("click", () => keepDraft().catch(error => setNotice(error.message, "error")));
elements.discardDraftButton.addEventListener("click", () => discardDraft().catch(error => setNotice(error.message, "error")));
elements.guideButton.addEventListener("click", () => toggleGuide().catch(error => setNotice(error.message, "error")));
elements.scanButton.addEventListener("click", scanPage);
elements.matchForm.addEventListener("submit", event => {
  event.preventDefault();
  matchCurrentCompany().catch(error => setNotice(error.message, "error"));
});
elements.connectionForm.addEventListener("submit", saveConnection);
elements.forgetButton.addEventListener("click", forgetConnection);
elements.openApplylyButton.addEventListener("click", openApplyly);
elements.reviewCaptureButton.addEventListener("click", () => reviewCapturedJob().catch(error => setNotice(error.message, "error")));

initialize().catch(error => setNotice(error.message, "error"));

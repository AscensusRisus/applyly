/* global chrome */

const GUIDED_ORIGINS_KEY = "applylyGuidedOrigins";
const ENDPOINT_KEY = "applylyEndpoint";
const TOKEN_KEY = "applylyPairingToken";
const DEFAULT_ENDPOINT = "http://localhost:3000";
const scanCache = new Map();
const scanControllers = new Map();

function originPattern(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Guidance is available only on regular web pages.");
  return url.protocol + "//" + url.hostname + "/*";
}

function registrationId(pattern) {
  let hash = 5381;
  for (const character of pattern) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return "applyly-guide-" + (hash >>> 0).toString(36);
}

async function storedGuidedOrigins() {
  const stored = await chrome.storage.local.get(GUIDED_ORIGINS_KEY);
  return Array.isArray(stored[GUIDED_ORIGINS_KEY]) ? stored[GUIDED_ORIGINS_KEY].filter(value => typeof value === "string") : [];
}

async function storeGuidedOrigins(patterns) {
  await chrome.storage.local.set({ [GUIDED_ORIGINS_KEY]: [...new Set(patterns)].sort() });
}

async function hasOriginPermission(pattern) {
  return await chrome.permissions.contains({ origins: [pattern] });
}

async function registerPattern(pattern) {
  if (!(await hasOriginPermission(pattern))) return false;
  const id = registrationId(pattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (!existing.length) {
    await chrome.scripting.registerContentScripts([{
      id,
      matches: [pattern],
      js: ["guide-content.js"],
      runAt: "document_idle",
      persistAcrossSessions: true,
      world: "ISOLATED",
    }]);
  } else {
    await chrome.scripting.updateContentScripts([{
      id,
      matches: [pattern],
      js: ["guide-content.js"],
      runAt: "document_idle",
      persistAcrossSessions: true,
      world: "ISOLATED",
    }]);
  }
  return true;
}

async function unregisterPattern(pattern) {
  const id = registrationId(pattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
}

async function restoreGuidance() {
  const patterns = await storedGuidedOrigins();
  const permitted = [];
  for (const pattern of patterns) {
    if (await registerPattern(pattern)) permitted.push(pattern);
  }
  if (permitted.length !== patterns.length) await storeGuidedOrigins(permitted);
}

async function enableGuidance(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) throw new Error("The current tab has no readable address.");
  const pattern = originPattern(tab.url);
  if (!(await hasOriginPermission(pattern))) throw new Error("Site permission was not granted.");
  const patterns = await storedGuidedOrigins();
  await storeGuidedOrigins([...patterns, pattern]);
  await registerPattern(pattern);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["guide-content.js"] });
  } catch {
    // Restricted pages may grant a pattern but still reject script injection.
  }
  return { pattern };
}

async function disableGuidance(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) throw new Error("The current tab has no readable address.");
  const pattern = originPattern(tab.url);
  const patterns = await storedGuidedOrigins();
  await storeGuidedOrigins(patterns.filter(value => value !== pattern));
  await unregisterPattern(pattern);
  scanCache.delete(tabId);
  scanControllers.get(tabId)?.abort();
  scanControllers.delete(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: "applyly-guide-remove" });
  } catch {
    // The content script may not be active on the current document.
  }
  return { pattern };
}

async function connectionConfig(requireToken = true) {
  const stored = await chrome.storage.local.get([ENDPOINT_KEY, TOKEN_KEY]);
  const address = new URL(stored[ENDPOINT_KEY] || DEFAULT_ENDPOINT);
  if (address.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(address.hostname) || address.username || address.password) {
    throw new Error("Applyly must use a local http://localhost or http://127.0.0.1 address.");
  }
  const endpoint = address.origin;
  const token = stored[TOKEN_KEY] || "";
  if (requireToken && !token) throw new Error("Add the Applyly pairing token in the extension popup.");
  return { endpoint, token };
}

async function localRequest(path, options, externalSignal) {
  const { endpoint, token } = await connectionConfig();
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort("superseded");
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const timeout = setTimeout(() => controller.abort("timeout"), 6_000);
  try {
    const response = await fetch(endpoint + path, {
      ...options,
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error("Applyly pairing expired. Create and paste a new token.");
      throw new Error(data.error || "Local Applyly rejected the guidance request.");
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (externalSignal?.aborted) throw new Error("A newer page scan replaced this one.");
      throw new Error("Local Applyly did not respond.");
    }
    if (error instanceof TypeError) throw new Error("Local Applyly is offline. Start npm run dev.");
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
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
    // Source is optional.
  }
  return "";
}

async function openApplyly(parameters = {}) {
  const { endpoint } = await connectionConfig(false);
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.set(key, String(value));
  }
  await chrome.tabs.create({ url: url.href });
}

function contextFingerprint(context) {
  return JSON.stringify((context?.candidates || []).map(candidate => [
    candidate.company || "",
    candidate.role || "",
    candidate.url || "",
  ]));
}

async function scanGuidedTab(tabId) {
  scanControllers.get(tabId)?.abort();
  const scanController = new AbortController();
  scanControllers.set(tabId, scanController);
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["page-reader-core.js", "page-context.js"],
    });
    const context = injection?.result;
    if (!context || !Array.isArray(context.candidates)) throw new Error("The page reader did not return job candidates.");

    const fingerprint = contextFingerprint(context);
    const cached = scanCache.get(tabId);
    if (cached && cached.fingerprint === fingerprint && Date.now() - cached.createdAt < 15_000) {
      return { context, ...cached.result, cached: true };
    }
    if (!context.candidates.length) {
      const result = { matches: [], matchedCandidates: 0, candidateMatches: [] };
      scanCache.set(tabId, { fingerprint, result, createdAt: Date.now() });
      return { context, ...result, cached: false };
    }

    const data = await localRequest("/api/extension/page-match", {
      method: "POST",
      body: JSON.stringify({ pageUrl: context.pageUrl, candidates: context.candidates }),
    }, scanController.signal);
    const result = {
      matches: Array.isArray(data.matches) ? data.matches : [],
      matchedCandidates: Number(data.matchedCandidates) || 0,
      candidateMatches: Array.isArray(data.candidateMatches) ? data.candidateMatches : [],
    };
    scanCache.set(tabId, { fingerprint, result, createdAt: Date.now() });
    return { context, ...result, cached: false };
  } finally {
    if (scanControllers.get(tabId) === scanController) scanControllers.delete(tabId);
  }
}

async function handleMessage(message, sender) {
  if (!message || typeof message !== "object") throw new Error("Invalid extension message.");

  if (message.type === "applyly-guide-enable") {
    if (!Number.isInteger(message.tabId)) throw new Error("A valid tab is required.");
    return await enableGuidance(message.tabId);
  }
  if (message.type === "applyly-guide-disable") {
    if (!Number.isInteger(message.tabId)) throw new Error("A valid tab is required.");
    return await disableGuidance(message.tabId);
  }
  if (message.type === "applyly-guide-state") {
    if (!Number.isInteger(message.tabId)) throw new Error("A valid tab is required.");
    const tab = await chrome.tabs.get(message.tabId);
    const pattern = originPattern(tab.url || "");
    const patterns = await storedGuidedOrigins();
    return { pattern, enabled: patterns.includes(pattern) && await hasOriginPermission(pattern) };
  }
  if (message.type === "applyly-guide-scan") {
    if (!sender.tab?.id) throw new Error("Guidance scans must originate from an enabled tab.");
    const pattern = originPattern(sender.tab.url || "");
    const patterns = await storedGuidedOrigins();
    if (!patterns.includes(pattern) || !(await hasOriginPermission(pattern))) {
      throw new Error("Guidance is not enabled for this site.");
    }
    return await scanGuidedTab(sender.tab.id);
  }
  if (message.type === "applyly-open") {
    const applicationId = Number(message.applicationId);
    await openApplyly(Number.isInteger(applicationId) && applicationId > 0
      ? { view: "applications", application: applicationId }
      : {});
    return { opened: true };
  }
  if (message.type === "applyly-capture") {
    const candidate = message.candidate && typeof message.candidate === "object" ? message.candidate : {};
    const company = typeof candidate.company === "string" ? candidate.company.trim().slice(0, 300) : "";
    const role = typeof candidate.role === "string" ? candidate.role.trim().slice(0, 500) : "";
    const rawUrl = typeof candidate.url === "string" ? candidate.url.trim().slice(0, 2_000) : "";
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
    if (!company && !role && !url) throw new Error("No readable job details were found.");
    await openApplyly({
      capture: "extension",
      company,
      role,
      url,
      source: sourceFromUrl(url || sender.tab?.url || ""),
    });
    return { opened: true };
  }
  throw new Error("Unknown extension message.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  handleMessage(message, sender)
    .then(data => sendResponse({ ok: true, ...data }))
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  restoreGuidance().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  restoreGuidance().catch(() => {});
});
chrome.permissions.onRemoved.addListener(permissions => {
  if (!permissions.origins?.length) return;
  Promise.all(permissions.origins.map(unregisterPattern))
    .then(() => storedGuidedOrigins())
    .then(patterns => storeGuidedOrigins(patterns.filter(pattern => !permissions.origins.includes(pattern))))
    .then(() => {
      scanCache.clear();
      return restoreGuidance();
    })
    .catch(() => {});
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes[ENDPOINT_KEY] || changes[TOKEN_KEY])) scanCache.clear();
});
chrome.tabs.onRemoved.addListener(tabId => {
  scanCache.delete(tabId);
  scanControllers.get(tabId)?.abort();
  scanControllers.delete(tabId);
});

restoreGuidance().catch(() => {});

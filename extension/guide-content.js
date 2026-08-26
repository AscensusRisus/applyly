/* global chrome */

if (!globalThis.__applylyGuideLoaded) {
  globalThis.__applylyGuideLoaded = true;

  const GUIDE_ATTRIBUTE = "data-applyly-guide";
  const CANDIDATE_ATTRIBUTE = "data-applyly-candidate-index";
  const decoratedTargets = new Map();
  let scanTimer = null;
  let scanSequence = 0;
  let lastLocation = location.href;
  let stopped = false;
  let summaryDismissed = false;

  const statusColors = {
    "Applied": ["#5c4ec0", "#ebe7ff"],
    "Contact": ["#9a622b", "#fff0df"],
    "Phone screen": ["#2875b9", "#e5f2ff"],
    "Assessment": ["#9851aa", "#f6e7fb"],
    "Interview": ["#94610f", "#fff1cf"],
    "Offer": ["#28744d", "#def4e7"],
    "Rejected": ["#a84848", "#fbe5e5"],
    "Withdrawn": ["#58615d", "#e6eae7"],
  };

  function removeGuidance() {
    document.querySelectorAll("[" + GUIDE_ATTRIBUTE + "]").forEach(element => element.remove());
    for (const [target, decoration] of decoratedTargets) {
      if (!target.isConnected || !decoration.changed || target.style.position !== "relative") continue;
      if (decoration.originalPosition) target.style.position = decoration.originalPosition;
      else target.style.removeProperty("position");
    }
    decoratedTargets.clear();
  }

  const normalizeRole = value => String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const roleSimilarity = (left, right) => {
    const normalizedLeft = normalizeRole(left);
    const normalizedRight = normalizeRole(right);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 0.9;
    const leftWords = new Set(normalizedLeft.split(" "));
    const rightWords = new Set(normalizedRight.split(" "));
    const shared = [...leftWords].filter(word => rightWords.has(word)).length;
    return shared / new Set([...leftWords, ...rightWords]).size;
  };

  function matchKind(candidate, matches) {
    if (matches.some(match => match.matchKind === "exact-job" || match.reasons?.includes("application-url"))) return "exact-job";
    if (matches.some(match => match.matchKind === "similar-role" || Number(match.roleScore) >= 60
      || roleSimilarity(candidate?.role, match.role) >= 0.72)) return "similar-role";
    return "company-history";
  }

  function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return String(value || "");
    return new Intl.DateTimeFormat(navigator.language, { dateStyle: "medium" })
      .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function badgeLabel(kind, matches) {
    const exact = matches.find(match => match.matchKind === "exact-job" || match.reasons?.includes("application-url"));
    if (kind === "exact-job") return "Tracked · " + (exact?.status || "Applied");
    if (kind === "similar-role") return matches.length === 1 ? "Similar application" : matches.length + " similar applications";
    return matches.length === 1 ? "Company history" : matches.length + " past applications";
  }

  function sendAction(button, message) {
    const original = button.textContent;
    button.disabled = true;
    chrome.runtime.sendMessage(message)
      .then(response => {
        if (!response?.ok) throw new Error(response?.error || "Applyly could not be opened.");
      })
      .catch(() => {
        button.textContent = "Connection unavailable";
        setTimeout(() => {
          button.textContent = original;
          button.disabled = false;
        }, 2_500);
      });
  }

  function createBadge(candidate, candidateResult) {
    const matches = Array.isArray(candidateResult.matches) ? candidateResult.matches : [];
    const kind = matchKind(candidate, matches);
    const exact = matches.find(match => match.matchKind === "exact-job" || match.reasons?.includes("application-url"));
    const latest = [...matches].sort((left, right) => String(right.appliedDate).localeCompare(String(left.appliedDate)))[0];
    const colors = statusColors[(exact || latest)?.status] || statusColors.Applied;

    const host = document.createElement("div");
    host.setAttribute(GUIDE_ATTRIBUTE, "badge");
    host.setAttribute("data-applyly-match-kind", kind);
    host.style.cssText = "all:initial!important;position:absolute!important;top:8px!important;right:8px!important;z-index:2147483646!important;pointer-events:none!important";
    const root = host.attachShadow({ mode: "closed" });

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;display:flex;justify-content:flex-end;font-family:Inter,system-ui,sans-serif;pointer-events:auto";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = badgeLabel(kind, matches);
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", trigger.textContent + ". Show Applyly history.");
    trigger.style.cssText = [
      "all:initial", "box-sizing:border-box", "display:inline-flex", "align-items:center", "gap:6px",
      "border:1px solid " + colors[0] + "55", "border-radius:999px", "padding:6px 9px",
      "color:" + colors[0], "background:" + colors[1], "font:650 11px/1.2 system-ui,sans-serif",
      "cursor:pointer", "box-shadow:0 3px 12px rgba(0,0,0,.12)", "white-space:nowrap",
    ].join(";");

    const panel = document.createElement("section");
    panel.hidden = true;
    panel.style.cssText = [
      "box-sizing:border-box", "position:absolute", "top:calc(100% + 7px)", "right:0",
      "width:286px", "border:1px solid #d9dfda", "border-radius:13px", "padding:13px",
      "color:#18201d", "background:#fff", "box-shadow:0 16px 42px rgba(0,0,0,.2)",
      "font:12px/1.45 system-ui,sans-serif", "text-align:left",
    ].join(";");

    const eyebrow = document.createElement("p");
    eyebrow.textContent = kind === "exact-job" ? "TRACKED JOB" : kind === "similar-role" ? "RELATED HISTORY" : "COMPANY HISTORY";
    eyebrow.style.cssText = "margin:0 0 4px;color:#68736d;font-size:9px;font-weight:750;letter-spacing:.12em";

    const title = document.createElement("strong");
    title.textContent = candidate?.company || "Application history";
    title.style.cssText = "display:block;margin:0 0 2px;font-size:13px";

    const role = document.createElement("p");
    role.textContent = candidate?.role || "Detected job";
    role.style.cssText = "margin:0 0 10px;color:#68736d;font-size:11px";

    const list = document.createElement("div");
    list.style.cssText = "display:grid;gap:6px;margin-bottom:11px";
    for (const application of matches.slice(0, 4)) {
      const item = document.createElement("button");
      item.type = "button";
      item.style.cssText = "all:initial;box-sizing:border-box;display:grid;width:100%;grid-template-columns:1fr auto;gap:2px 8px;border-radius:8px;padding:7px;background:#f3f5f2;color:#18201d;font:11px/1.35 system-ui,sans-serif;cursor:pointer";
      const itemRole = document.createElement("strong");
      itemRole.textContent = application.role;
      const itemStatus = document.createElement("span");
      itemStatus.textContent = application.status;
      itemStatus.style.cssText = "font-weight:700;color:" + (statusColors[application.status]?.[0] || "#58615d");
      const itemDate = document.createElement("span");
      itemDate.textContent = formatDate(application.appliedDate);
      itemDate.style.cssText = "grid-column:1/-1;color:#6d7772;font-size:10px";
      item.append(itemRole, itemStatus, itemDate);
      item.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        sendAction(item, { type: "applyly-open", applicationId: application.id });
      });
      list.append(item);
    }

    if (candidateResult.matchCount > matches.length) {
      const more = document.createElement("p");
      more.textContent = "+" + (candidateResult.matchCount - matches.length) + " more in Applyly";
      more.style.cssText = "margin:-4px 0 10px;color:#68736d;font-size:10px";
      panel.append(eyebrow, title, role, list, more);
    } else {
      panel.append(eyebrow, title, role, list);
    }

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:7px;border-top:1px solid #e5e9e6;padding-top:10px";

    if (kind !== "exact-job") {
      const review = document.createElement("button");
      review.type = "button";
      review.textContent = "Review this job";
      review.style.cssText = "all:initial;flex:1;box-sizing:border-box;border-radius:8px;padding:7px 9px;color:#fff;background:#18201d;font:650 10px/1.2 system-ui,sans-serif;text-align:center;cursor:pointer";
      review.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        sendAction(review, { type: "applyly-capture", candidate });
      });
      actions.append(review);
    }

    const open = document.createElement("button");
    open.type = "button";
    open.textContent = kind === "exact-job" ? "Open application" : "Open Applyly";
    open.style.cssText = "all:initial;flex:1;box-sizing:border-box;border:1px solid #d9dfda;border-radius:8px;padding:7px 9px;color:#344039;background:#fff;font:650 10px/1.2 system-ui,sans-serif;text-align:center;cursor:pointer";
    open.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      sendAction(open, exact?.id
        ? { type: "applyly-open", applicationId: exact.id }
        : { type: "applyly-open" });
    });
    actions.append(open);
    panel.append(actions);

    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      trigger.setAttribute("aria-expanded", String(!panel.hidden));
    });
    wrapper.append(trigger, panel);
    root.append(wrapper);
    return host;
  }

  function decorateTarget(target, candidate, candidateResult) {
    if (!decoratedTargets.has(target)) {
      const originalPosition = target.style.position;
      const changed = getComputedStyle(target).position === "static";
      decoratedTargets.set(target, { originalPosition, changed });
      if (changed) target.style.position = "relative";
    }
    target.append(createBadge(candidate, candidateResult));
  }

  function createSummary(candidateCount, matchedCardCount, error = "") {
    document.querySelector("[" + GUIDE_ATTRIBUTE + "='summary']")?.remove();
    if ((!matchedCardCount && !error) || summaryDismissed) return;

    const host = document.createElement("div");
    host.setAttribute(GUIDE_ATTRIBUTE, "summary");
    host.style.cssText = "all:initial!important;position:fixed!important;right:18px!important;bottom:18px!important;z-index:2147483647!important";
    const root = host.attachShadow({ mode: "closed" });
    const panel = document.createElement("div");
    panel.style.cssText = "display:flex;align-items:center;gap:10px;max-width:320px;border:1px solid #3c4741;border-radius:11px;padding:9px 10px 9px 12px;color:#f7faf8;background:#18201d;box-shadow:0 10px 28px rgba(0,0,0,.22);font:600 12px/1.35 system-ui,sans-serif";
    const copy = document.createElement("span");
    copy.textContent = error
      ? "Applyly: " + error
      : matchedCardCount + " familiar job" + (matchedCardCount === 1 ? "" : "s") + " among " + candidateCount + " checked";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss Applyly summary");
    close.style.cssText = "all:initial;color:#d4dbd7;font:17px/1 system-ui;cursor:pointer";
    close.addEventListener("click", () => {
      summaryDismissed = true;
      host.remove();
    });
    panel.append(copy, close);
    root.append(panel);
    document.documentElement.append(host);
  }

  function legacyCandidateMatches(matches) {
    const grouped = new Map();
    for (const match of matches) {
      const index = Number(match.candidateIndex);
      if (!Number.isInteger(index)) continue;
      if (!grouped.has(index)) grouped.set(index, []);
      grouped.get(index).push(match);
    }
    return [...grouped].map(([candidateIndex, groupedMatches]) => ({
      candidateIndex,
      matchCount: groupedMatches.length,
      truncated: false,
      matches: groupedMatches,
    }));
  }

  function renderGuidance(context, response) {
    removeGuidance();
    const candidateResults = Array.isArray(response.candidateMatches) && response.candidateMatches.length
      ? response.candidateMatches
      : legacyCandidateMatches(response.matches || []);
    let matchedCards = 0;

    for (const candidateResult of candidateResults) {
      if (!candidateResult?.matchCount || !Array.isArray(candidateResult.matches) || !candidateResult.matches.length) continue;
      const candidateIndex = Number(candidateResult.candidateIndex);
      if (!Number.isInteger(candidateIndex)) continue;
      const allTargets = [...document.querySelectorAll("[" + CANDIDATE_ATTRIBUTE + "='" + candidateIndex + "']")];
      const visibleTargets = allTargets.filter(target => {
        const rect = target.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const targetPool = visibleTargets.length ? visibleTargets : allTargets;
      const candidateTargets = targetPool
        .filter(target => !targetPool.some(other => other !== target && other.contains(target)));
      if (!candidateTargets.length) continue;
      matchedCards += 1;
      for (const target of candidateTargets) decorateTarget(target, context.candidates[candidateIndex], candidateResult);
    }
    createSummary(context.candidates.length, matchedCards);
  }

  async function runScan() {
    if (stopped || !document.documentElement) return;
    const sequence = ++scanSequence;
    try {
      const response = await chrome.runtime.sendMessage({ type: "applyly-guide-scan" });
      if (sequence !== scanSequence || stopped) return;
      if (!response?.ok) throw new Error(response?.error || "guidance unavailable");
      renderGuidance(response.context, response);
    } catch (error) {
      if (sequence !== scanSequence || stopped) return;
      const message = error instanceof Error && /context invalidated/i.test(error.message)
        ? "reload extension"
        : error instanceof Error ? error.message : "guidance unavailable";
      removeGuidance();
      createSummary(0, 0, message);
    }
  }

  function scheduleScan(delay = 900) {
    if (stopped) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, delay);
  }

  function mutationBelongsToGuide(mutation) {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes].filter(node => node.nodeType === Node.ELEMENT_NODE);
    return nodes.length > 0 && nodes.every(node => node.hasAttribute?.(GUIDE_ATTRIBUTE) || node.closest?.("[" + GUIDE_ATTRIBUTE + "]"));
  }

  const observer = new MutationObserver(mutations => {
    if (mutations.every(mutationBelongsToGuide)) return;
    scheduleScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href", "aria-label"],
  });

  const handleVisibilityChange = () => {
    if (!document.hidden) scheduleScan(250);
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  const locationTimer = setInterval(() => {
    if (location.href === lastLocation) return;
    lastLocation = location.href;
    summaryDismissed = false;
    scheduleScan(250);
  }, 1_500);

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== "applyly-guide-remove") return;
    stopped = true;
    clearTimeout(scanTimer);
    clearInterval(locationTimer);
    observer.disconnect();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    removeGuidance();
  });

  scheduleScan(350);
}
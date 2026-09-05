import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
function element() {
  return {
    value: "", hidden: true, disabled: false, textContent: "", dataset: {}, children: [], handlers: {},
    addEventListener(name, callback) { this.handlers[name] = callback; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    querySelector() { return this.submit ||= element(); },
  };
}
async function popup(stored = {}) {
  const nodes = new Map();
  const state = { stored: structuredClone(stored), tabs: [], requests: [], injectionError: false,
    context: { mode: "detail", pageUrl: "https://jobs.example/1", candidates: [{ company: "Acme", role: "Engineer", url: "https://jobs.example/1" }] } };
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const sandbox = vm.createContext({
    URL, URLSearchParams, AbortController, DOMException, setTimeout, clearTimeout,
    navigator: { language: "en-US" }, window: { close() {} },
    document: { querySelector: get, createElement: element },
    chrome: {
      tabs: { query: async () => [{ id: 1, url: "https://jobs.example/1" }], create: async tab => state.tabs.push(tab) },
      storage: { local: {
        get: async () => state.stored,
        set: async value => Object.assign(state.stored, structuredClone(value)),
        remove: async key => { delete state.stored[key]; },
      } },
      runtime: { sendMessage: async () => ({ ok: true, enabled: false }) },
      scripting: { executeScript: async () => { if (state.injectionError) throw new Error("Cannot access this page"); return [{ result: structuredClone(state.context) }]; } },
    },
    fetch: async (url, options) => {
      state.requests.push({ url, options });
      if (state.offline) throw new TypeError("Offline");
      if (state.matchResponse && !url.endsWith("/api/health")) return state.matchResponse;
      if (url.endsWith("/api/health")) return { ok: true, json: async () => ({ apiVersion: 1, extension: { supported: true, paired: true, features: ["page-match"] } }) };
      return { ok: false, status: 401, json: async () => ({}) };
    },
  });
  vm.runInContext(source, sandbox);
  await new Promise(resolve => setImmediate(resolve));
  return { state, get, run: code => vm.runInContext(code, sandbox) };
}

test("unpaired capture reads the page without any local API request", async () => {
  const app = await popup();
  await app.run("scanPage()");
  assert.equal(app.state.requests.length, 0);
  assert.equal(app.get("#companyInput").value, "Acme");
  assert.equal(app.get("#reviewCaptureButton").hidden, false);
});

test("collection selection and edited fields reach the Applyly draft without pairing", async () => {
  const app = await popup();
  app.state.context.candidates.push({ company: "Second", role: "Intern", url: "https://jobs.example/2" });
  await app.run("scanPage()");
  app.get("#candidateSelect").value = "1";
  app.run("selectCandidate()");
  app.get("#roleInput").value = "Corrected role";
  await app.run("reviewCapturedJob()");
  const url = new URL(app.state.tabs[0].url);
  assert.equal(url.origin, "http://localhost:3000");
  assert.equal(url.searchParams.get("company"), "Second");
  assert.equal(url.searchParams.get("role"), "Corrected role");
  assert.equal(url.searchParams.get("url"), "https://jobs.example/2");
  assert.equal(url.searchParams.get("capture"), "extension");
  assert.equal(app.state.stored.applylyCaptureDraft.role, "Corrected role");
  assert.equal(app.state.requests.length, 0);
});

test("kept draft survives reopening and is only removed explicitly", async () => {
  const app = await popup();
  await app.run("scanPage()");
  await app.run("keepDraft()");
  const reopened = await popup(app.state.stored);
  assert.equal(reopened.get("#companyInput").value, "Acme");
  assert.match(reopened.get("#notice").textContent, /Restored/);
  await reopened.run("discardDraft()");
  assert.equal(reopened.state.stored.applylyCaptureDraft, undefined);
});

test("bad token is never reported connected and does not block capture", async () => {
  const app = await popup({ applylyPairingToken: "rejected-token" });
  assert.equal(app.get("#connectionBadge").dataset.state, "error");
  assert.match(app.get("#notice").textContent, /token rejected/);
  assert.equal(app.state.requests[1].options.headers.Authorization, "Bearer rejected-token");
  await app.run("scanPage()");
  assert.equal(app.get("#roleInput").value, "Engineer");
});

test("a failed rescan clears prior capture and history", async () => {
  const app = await popup();
  await app.run("scanPage()");
  app.get("#resultsSection").hidden = false;
  app.state.injectionError = true;
  await app.run("scanPage()");
  assert.equal(app.get("#matchForm").hidden, true);
  assert.equal(app.get("#reviewCaptureButton").hidden, true);
  assert.equal(app.get("#resultsSection").hidden, true);
  assert.equal(app.run("pageContext"), null);
});

test("unrecognized pages retain URL as a manual fallback", async () => {
  const app = await popup();
  app.state.context.candidates = [];
  await app.run("scanPage()");
  assert.equal(app.get("#urlInput").value, "https://jobs.example/1");
  assert.match(app.get("#notice").textContent, /manually/);
});

test("invalid job URLs and remote Applyly addresses cannot be handed off", async () => {
  const app = await popup();
  await app.run("scanPage()");
  app.get("#urlInput").value = "javascript:alert(1)";
  await assert.rejects(app.run("reviewCapturedJob()"), /valid http/);
  app.get("#urlInput").value = "https://jobs.example/1";
  app.get("#endpointInput").value = "https://remote.example";
  await assert.rejects(app.run("reviewCapturedJob()"), /local http/);
  assert.equal(app.state.tabs.length, 0);
});

test("history result opens the exact application record", async () => {
  const app = await popup();
  app.run('renderMatches([{ id: 42, role: "Engineer", company: "Acme", status: "Rejected", appliedDate: "2026-09-01" }], 1)');
  const article = app.get("#resultsList").children[0];
  await article.children.at(-1).handlers.click();
  const url = new URL(app.state.tabs[0].url);
  assert.equal(url.searchParams.get("application"), "42");
  assert.equal(url.searchParams.get("view"), "applications");
});


test("late history responses cannot overwrite an edited or rescanned job", async () => {
  const app = await popup();
  let respond;
  app.state.matchResponse = new Promise(resolve => { respond = resolve; });
  const pending = app.run('runPageMatch([{ company: "Old company" }])');
  app.run("clearMatches()");
  respond({ ok: true, json: async () => ({ matches: [{ id: 1, company: "Old company", role: "Old role" }] }) });
  await pending;
  assert.equal(app.get("#resultsSection").hidden, true);
  assert.equal(app.get("#resultsList").children.length, 0);
});

test("offline history errors leave capture usable", async () => {
  const app = await popup();
  app.state.offline = true;
  await app.run("scanPage()");
  await app.run("matchCurrentCompany()");
  assert.equal(app.get("#reviewCaptureButton").hidden, false);
  assert.match(app.get("#notice").textContent, /still keep this draft/);
  await app.run("keepDraft()");
  assert.equal(app.state.stored.applylyCaptureDraft.company, "Acme");
});

test("local address can be saved without a pairing token", async () => {
  const app = await popup();
  app.get("#endpointInput").value = "http://localhost:4173";
  await app.run("saveConnection({ preventDefault() {} })");
  assert.equal(app.state.stored.applylyEndpoint, "http://localhost:4173");
  assert.equal(app.state.requests.length, 0);
  assert.equal(app.get("#connectionBadge").textContent, "Capture ready");
});

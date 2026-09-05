import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../extension/page-reader-core.js", import.meta.url), "utf8");
const pageContextSource = await readFile(new URL("../extension/page-context.js", import.meta.url), "utf8");
const context = vm.createContext({ URL });
vm.runInContext(source, context);
const reader = context.ApplylyPageReader;

class FixtureElement {
  constructor(tagName, attributes = {}, baseUrl = "") {
    this.tagName = tagName;
    this.attributes = attributes;
    this.children = [];
    this.parentElement = null;
    this._text = "";
    this.baseUrl = baseUrl;
  }

  get textContent() {
    return this._text + this.children.map(child => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value || "");
    this.children = [];
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get href() {
    return this.attributes.href ? new URL(this.attributes.href, this.baseUrl).href : "";
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  matches(selector) {
    return selector.split(",").some(part => this.matchesSimple(part.trim()));
  }

  matchesSimple(selector) {
    const tag = selector.match(/^[a-z][a-z0-9-]*/i)?.[0];
    if (tag && this.tagName !== tag.toLowerCase()) return false;
    const attributePattern = /\[([^\]=~*^$]+)(?:\s*(\*=|\^=|\$=|~=|=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g;
    let foundAttribute = false;
    for (const match of selector.matchAll(attributePattern)) {
      foundAttribute = true;
      const name = match[1].trim();
      const actual = this.getAttribute(name);
      if (actual === null) return false;
      if (!match[2]) continue;
      const expected = (match[3] ?? match[4] ?? match[5] ?? "").trim();
      if (match[2] === "=" && actual !== expected) return false;
      if (match[2] === "*=" && !actual.includes(expected)) return false;
      if (match[2] === "^=" && !actual.startsWith(expected)) return false;
      if (match[2] === "$=" && !actual.endsWith(expected)) return false;
      if (match[2] === "~=" && !actual.split(/\s+/).includes(expected)) return false;
    }
    return Boolean(tag || foundAttribute);
  }

  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parentElement?.closest(selector) || null;
  }
}

function parseFixture(html, baseUrl) {
  const root = new FixtureElement("#document", {}, baseUrl);
  const stack = [root];
  const tokens = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9:-]*)([^>]*)>|([^<]+)/gi;
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const match of html.matchAll(tokens)) {
    if (match[3]) {
      stack.at(-1)._text += match[3];
      continue;
    }
    const tagName = match[1].toLowerCase();
    if (match[0].startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attributes = {};
    const attributePattern = /([a-z_:][a-z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/gi;
    for (const attribute of (match[2] || "").matchAll(attributePattern)) {
      attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
    }
    const element = new FixtureElement(tagName, attributes, baseUrl);
    stack.at(-1).appendChild(element);
    if (!voidTags.has(tagName) && !match[0].endsWith("/>")) stack.push(element);
  }
  const body = root.querySelector("body") || root;
  const htmlElement = root.querySelector("html") || root;
  return {
    body,
    documentElement: htmlElement,
    title: root.querySelector("title")?.textContent.trim() || "",
    querySelectorAll: selector => root.querySelectorAll(selector),
    querySelector: selector => root.querySelector(selector),
  };
}

async function runPageFixture(name, href) {
  const html = await readFile(new URL("./fixtures/" + name, import.meta.url), "utf8");
  const fixtureContext = vm.createContext({
    URL,
    document: parseFixture(html, href),
    location: new URL(href),
  });
  vm.runInContext(source, fixtureContext);
  return vm.runInContext(pageContextSource, fixtureContext);
}

test("page reader normalizes stable job identities across URL variants", () => {
  assert.equal(
    reader.normalizeJobUrl("https://www.wellfound.com/jobs/4574524-new-slug?ref=feed"),
    "wellfound.com/jobs/4574524",
  );
  assert.equal(
    reader.normalizeJobUrl("https://job-boards.greenhouse.io/example/jobs/123456?utm_source=board"),
    "greenhouse.io/jobs/123456",
  );
  assert.equal(
    reader.normalizeJobUrl("https://apply.workable.com/example/j/ABC123/?ref=jobs"),
    "workable.com/jobs/abc123",
  );
  assert.equal(
    reader.normalizeJobUrl("https://www.indeed.com/viewjob?jk=ABC123&utm_source=feed"),
    "indeed.com/job/abc123",
  );
});

test("page reader recognizes job detail links without treating feed navigation as jobs", () => {
  const valid = [
    "https://wellfound.com/jobs/4574524-growth-strategic-projects",
    "https://www.linkedin.com/jobs/view/123456789",
    "https://jobs.lever.co/example/3f359288-15cb-4d31-977a-c3ef5a7619a3",
    "https://jobs.ashbyhq.com/example/3f359288-15cb-4d31-977a-c3ef5a7619a3",
    "https://job-boards.greenhouse.io/example/jobs/123456",
    "https://apply.workable.com/example/j/ABC123/",
    "https://example.com/careers/backend-engineer",
  ];
  for (const url of valid) assert.equal(reader.isLikelyJobUrl(url), true, url);

  const invalid = [
    "https://wellfound.com/jobs",
    "https://wellfound.com/jobs/applications",
    "https://example.com/jobs/search",
    "https://example.com/jobs/categories",
    "https://example.com/company/example",
  ];
  for (const url of invalid) assert.equal(reader.isLikelyJobUrl(url), false, url);
});

test("structured JobPosting fixture extracts nested schema data and object URLs", async () => {
  const result = await runPageFixture(
    "structured-jobposting.html",
    "https://careers.example.org/careers/research-software-engineer",
  );
  assert.equal(result.mode, "detail");
  assert.deepEqual(JSON.parse(JSON.stringify(result.candidates)), [{
    company: "CERN",
    role: "Research Software Engineer",
    url: "https://careers.example.org/jobs/research-engineer-42",
    domain: "home.cern",
  }]);
});

test("LinkedIn split-pane fixture extracts data-job-id cards and their selected job fields", async () => {
  const result = await runPageFixture(
    "linkedin-split-pane.html",
    "https://www.linkedin.com/jobs/search/?keywords=engineer",
  );
  assert.equal(result.mode, "collection");
  assert.deepEqual(JSON.parse(JSON.stringify(result.candidates.map(({ company, role, url }) => ({ company, role, url })))), [
    { company: "Acme Systems", role: "Senior Platform Engineer", url: "https://www.linkedin.com/jobs/view/111/?trk=feed" },
    { company: "Northstar Labs", role: "Frontend Engineer", url: "https://www.linkedin.com/jobs/view/222/?trk=feed" },
  ]);
});

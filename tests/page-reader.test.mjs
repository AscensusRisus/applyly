import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../extension/page-reader-core.js", import.meta.url), "utf8");
const context = vm.createContext({ URL });
vm.runInContext(source, context);
const reader = context.ApplylyPageReader;

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

import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicationActivity } from "../app/lib/application-activity.mjs";

const application = appliedDate => ({ appliedDate });

test("activity grid groups persisted dates and scales relative intensity", () => {
  const activity = buildApplicationActivity([
    application("2026-09-18"),
    application("2026-09-19"), application("2026-09-19"),
    application("2026-09-20"), application("2026-09-20"), application("2026-09-20"), application("2026-09-20"),
  ], new Date("2026-09-20T18:00:00"));
  const days = activity.weeks.flat();

  assert.equal(activity.weeks.length, 53);
  assert.ok(activity.weeks.every(week => week.length === 7));
  assert.equal(activity.total, 7);
  assert.equal(activity.activeDays, 3);
  assert.equal(days.find(day => day.date === "2026-09-18")?.level, 1);
  assert.equal(days.find(day => day.date === "2026-09-19")?.level, 2);
  assert.equal(days.find(day => day.date === "2026-09-20")?.level, 4);
  assert.equal(activity.busiest?.date, "2026-09-20");
});

test("activity grid ignores invalid, out-of-window, and future applied dates", () => {
  const activity = buildApplicationActivity([
    application("2025-09-20"),
    application("2026-02-30"),
    application("not-a-date"),
    application("2026-09-21"),
    application("2026-09-20"),
  ], new Date("2026-09-20T08:00:00"));
  const days = activity.weeks.flat();

  assert.equal(activity.total, 1);
  assert.equal(activity.activeDays, 1);
  assert.equal(days.find(day => day.date === "2026-09-21")?.isFuture, true);
  assert.equal(days.find(day => day.date === "2026-09-21")?.count, 0);
});

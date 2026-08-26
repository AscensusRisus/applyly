const legalSuffixes = new Set([
  "co", "company", "corp", "corporation", "inc", "incorporated", "limited", "llc", "ltd",
  "plc", "gmbh", "ag", "sa", "sas", "bv", "oy", "ab", "as", "group", "holdings",
]);

const hiringPlatforms = [
  "linkedin.com", "indeed.com", "glassdoor.com", "wellfound.com", "hiring.cafe",
  "ycombinator.com", "oneforma.com", "otta.com", "welcome-to-the-jungle.com", "builtin.com",
  "dice.com", "levels.fyi", "remoteok.com", "weworkremotely.com", "arc.dev", "lever.co",
  "greenhouse.io", "ashbyhq.com", "workday.com", "myworkdayjobs.com", "smartrecruiters.com",
  "jobvite.com", "breezy.hr", "recruitee.com", "teamtailor.com",
];

export function normalizeCompanyName(value: string) {
  const words = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && legalSuffixes.has(words.at(-1) ?? "")) words.pop();
  return words.join(" ");
}

export function normalizeCompanyDomain(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const candidate = value.includes("://") ? value : `https://${value}`;
    return new URL(candidate).hostname.toLocaleLowerCase("en-US").replace(/^www\./, "").replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

export function inferCompanyDomain(applicationUrl: string | null | undefined) {
  const domain = normalizeCompanyDomain(applicationUrl);
  if (!domain || hiringPlatforms.some(platform => domain === platform || domain.endsWith(`.${platform}`))) return null;
  return domain;
}

export function normalizeCompanyAliases(value: unknown) {
  if (!Array.isArray(value)) return [];
  const aliases = value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
  return [...new Map(aliases.map(alias => [normalizeCompanyName(alias), alias])).entries()]
    .filter(([key]) => key)
    .map(([, alias]) => alias);
}

export function parseStoredCompanyAliases(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [];
  try { return normalizeCompanyAliases(JSON.parse(value)); } catch { return []; }
}

export function companyNameSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (Math.min(left.length, right.length) >= 5 && (left.includes(right) || right.includes(left))) return 0.82;
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const intersection = [...leftWords].filter(word => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union ? intersection / union : 0;
}

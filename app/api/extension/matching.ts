import { companyNameSimilarity, inferCompanyDomain, normalizeCompanyAliases, normalizeCompanyName } from "../../lib/company-identity";
import { listApplications } from "../applications/storage";
import { normalizeApplicationUrl } from "../../lib/application-url";
export { normalizeApplicationUrl } from "../../lib/application-url";

export type ExtensionMatchQuery = {
  company?: string;
  domain?: string;
  url?: string;
  aliases?: string[];
  role?: string;
};

const roleNoiseWords = new Set([
  "senior", "sr", "junior", "jr", "lead", "staff", "principal", "remote",
  "intern", "internship", "contract", "temporary", "full", "time", "part",
]);

function normalizeRoleWords(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(word => word && !roleNoiseWords.has(word));
}

export function roleSimilarity(left: string | undefined, right: string | undefined) {
  const leftWords = normalizeRoleWords(left);
  const rightWords = normalizeRoleWords(right);
  if (!leftWords.length || !rightWords.length) return 0;
  const leftText = leftWords.join(" ");
  const rightText = rightWords.join(" ");
  if (leftText === rightText) return 1;
  const leftSet = new Set(leftWords);
  const rightSet = new Set(rightWords);
  const shared = [...leftSet].filter(word => rightSet.has(word)).length;
  const smaller = Math.min(leftSet.size, rightSet.size);
  if (shared === smaller && smaller >= 2) return 0.9;
  return shared / new Set([...leftSet, ...rightSet]).size;
}

type ExtensionApplication = Record<string, unknown> & {
  id: number;
  company: string;
  role: string;
  status: string;
  appliedDate: string;
  companyKey?: string | null;
  companyDomain?: string | null;
  companyAliases?: string[];
  url?: string | null;
};

export async function loadExtensionApplications(db: D1Database) {
  return await listApplications(db) as ExtensionApplication[];
}

export function findExtensionMatches(applications: ExtensionApplication[], query: ExtensionMatchQuery) {
  const company = query.company?.trim() ?? "";
  const aliases = normalizeCompanyAliases(query.aliases);
  const queryNames = [company, ...aliases].map(normalizeCompanyName).filter(Boolean);
  const domain = inferCompanyDomain(query.domain) ?? inferCompanyDomain(query.url);
  const normalizedUrl = normalizeApplicationUrl(query.url);

  return applications.flatMap(application => {
    const applicationUrl = normalizeApplicationUrl(application.url);
    const urlMatch = Boolean(normalizedUrl && applicationUrl && normalizedUrl === applicationUrl);
    const storedNames = [
      application.companyKey || normalizeCompanyName(application.company),
      ...(application.companyAliases ?? []).map(normalizeCompanyName),
    ].filter(Boolean);
    const storedDomain = inferCompanyDomain(application.companyDomain) ?? inferCompanyDomain(application.url);
    const domainMatch = Boolean(domain && storedDomain && domain === storedDomain);
    const bestNameScore = queryNames.reduce(
      (best, queryName) => Math.max(best, ...storedNames.map(storedName => companyNameSimilarity(queryName, storedName))),
      0,
    );
    const roleScore = roleSimilarity(query.role, application.role);
    if (!urlMatch && !domainMatch && bestNameScore < 0.8) return [];

    const reasons = [];
    if (urlMatch) reasons.push("application-url");
    if (domainMatch) reasons.push("company-domain");
    if (bestNameScore === 1) reasons.push("company-name");
    else if (bestNameScore >= 0.8) reasons.push("company-name-similar");

    return [{
      id: application.id,
      company: application.company,
      role: application.role,
      status: application.status,
      appliedDate: application.appliedDate,
      location: application.location ?? null,
      source: application.source ?? null,
      url: application.url ?? null,
      roleScore: Math.round(roleScore * 100),
      matchKind: urlMatch ? "exact-job" : roleScore >= 0.6 ? "similar-role" : "company-history",
      score: urlMatch ? 120 : domainMatch ? 100 : Math.round(bestNameScore * 100),
      reasons,
    }];
  }).sort((left, right) => right.score - left.score || String(right.appliedDate).localeCompare(String(left.appliedDate)));
}

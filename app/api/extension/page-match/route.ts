import { env } from "cloudflare:workers";
import { authorizeExtensionRequest } from "../security";
import { findExtensionMatches, loadExtensionApplications, normalizeApplicationUrl, type ExtensionMatchQuery } from "../matching";

type PageMatchRequest = {
  pageUrl?: string;
  candidates?: ExtensionMatchQuery[];
};

const maximumCandidates = 100;
const maximumMatchesPerCandidate = 25;

function cleanCandidate(candidate: unknown): ExtensionMatchQuery | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Record<string, unknown>;
  const text = (field: string, maximum = 2_000) => typeof value[field] === "string"
    ? value[field].trim().slice(0, maximum)
    : undefined;
  const rawUrl = text("url");
  const url = rawUrl && normalizeApplicationUrl(rawUrl) ? rawUrl : undefined;
  const aliases = Array.isArray(value.aliases)
    ? value.aliases.filter((alias): alias is string => typeof alias === "string").slice(0, 20)
    : undefined;
  const cleaned = {
    company: text("company", 300),
    role: text("role", 500),
    domain: text("domain", 500),
    url,
    aliases,
  };
  return cleaned.company || cleaned.domain || cleaned.url ? cleaned : null;
}

export async function POST(request: Request) {
  if (!(await authorizeExtensionRequest(request, env.DB))) {
    return Response.json({ error: "A valid extension pairing token is required" }, { status: 401 });
  }

  let payload: PageMatchRequest;
  try {
    payload = await request.json() as PageMatchRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (payload.candidates !== undefined && !Array.isArray(payload.candidates)) {
    return Response.json({ error: "Candidates must be an array" }, { status: 400 });
  }
  if ((payload.candidates?.length ?? 0) > maximumCandidates) {
    return Response.json({ error: `A maximum of ${maximumCandidates} page candidates is supported` }, { status: 400 });
  }

  const candidates = (payload.candidates ?? []).map(cleanCandidate).filter((candidate): candidate is ExtensionMatchQuery => Boolean(candidate));
  if (!candidates.length && typeof payload.pageUrl === "string" && payload.pageUrl.trim()) {
    candidates.push({ url: payload.pageUrl.trim() });
  }
  if (!candidates.length) {
    return Response.json({ error: "At least one company or application URL candidate is required" }, { status: 400 });
  }

  try {
    const applications = await loadExtensionApplications(env.DB);
    const bestByApplication = new Map<number, Record<string, unknown>>();
    const candidateMatches = candidates.map((candidate, candidateIndex) => {
      const allMatches = findExtensionMatches(applications, candidate);
      const matches = allMatches.slice(0, maximumMatchesPerCandidate).map(match => ({
        ...match,
        candidateIndex,
        detected: {
          company: candidate.company ?? null,
          role: candidate.role ?? null,
          url: candidate.url ?? null,
        },
      }));
      return {
        candidateIndex,
        matchCount: allMatches.length,
        truncated: allMatches.length > matches.length,
        matches,
      };
    });

    candidateMatches.forEach(candidateResult => {
      for (const match of candidateResult.matches) {
        const previous = bestByApplication.get(match.id);
        if (!previous || Number(previous.score) < match.score) bestByApplication.set(match.id, match);
      }
    });

    const matches = [...bestByApplication.values()].sort(
      (left, right) => Number(right.score) - Number(left.score)
        || String(right.appliedDate).localeCompare(String(left.appliedDate)),
    );
    return Response.json({
      pageUrl: typeof payload.pageUrl === "string" ? payload.pageUrl : null,
      scannedCandidates: candidates.length,
      matches,
      matchedCandidates: candidateMatches.filter(result => result.matchCount > 0).length,
      candidateMatches,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

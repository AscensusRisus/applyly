const trackingParameters = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "ref", "referrer", "source", "trk", "trackingid",
]);

export function normalizeApplicationUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    let hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
    if (hostname === "angel.co") hostname = "wellfound.com";
    const wellfoundJob = url.pathname.match(/\/jobs\/(\d+)/);
    if (hostname === "wellfound.com" && wellfoundJob) return `wellfound.com/jobs/${wellfoundJob[1]}`;
    const linkedinJob = url.pathname.match(/\/jobs\/view\/(\d+)/);
    if (hostname.endsWith("linkedin.com") && linkedinJob) return `linkedin.com/jobs/view/${linkedinJob[1]}`;
    const indeedJob = url.searchParams.get("jk");
    if (hostname.endsWith("indeed.com") && indeedJob) return `indeed.com/job/${indeedJob.toLocaleLowerCase("en-US")}`;
    const greenhouseJob = url.pathname.match(/\/jobs\/(\d+)/);
    if (hostname.endsWith("greenhouse.io") && greenhouseJob) return "greenhouse.io/jobs/" + greenhouseJob[1];
    const workableJob = url.pathname.match(/\/j\/([^/]+)/i);
    if (hostname.endsWith("workable.com") && workableJob) return "workable.com/jobs/" + workableJob[1].toLocaleLowerCase("en-US");
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLocaleLowerCase("en-US");
      if (trackingParameters.has(normalizedKey) || normalizedKey.startsWith("utm_")) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return hostname + pathname + (url.searchParams.size ? "?" + url.searchParams.toString() : "");
  } catch {
    return null;
  }
}

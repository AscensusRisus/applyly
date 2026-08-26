(() => {
  const trackingParameters = new Set([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "ref", "referrer", "source", "trk", "trackingid",
  ]);

  function parsedUrl(value, base) {
    try {
      const url = new URL(value, base);
      return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch {
      return null;
    }
  }

  function normalizeJobUrl(value, base) {
    const url = parsedUrl(value, base);
    if (!url) return "";
    let hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
    if (hostname === "angel.co") hostname = "wellfound.com";

    const wellfoundJob = url.pathname.match(/\/jobs\/(\d+)/);
    if (hostname === "wellfound.com" && wellfoundJob) return "wellfound.com/jobs/" + wellfoundJob[1];
    const linkedinJob = url.pathname.match(/\/jobs\/view\/(\d+)/);
    if (hostname.endsWith("linkedin.com") && linkedinJob) return "linkedin.com/jobs/view/" + linkedinJob[1];
    const indeedJob = url.searchParams.get("jk");
    if (hostname.endsWith("indeed.com") && indeedJob) return "indeed.com/job/" + indeedJob.toLocaleLowerCase("en-US");
    const greenhouseJob = url.pathname.match(/\/jobs\/(\d+)/);
    if (hostname.endsWith("greenhouse.io") && greenhouseJob) return "greenhouse.io/jobs/" + greenhouseJob[1];
    const workableJob = url.pathname.match(/\/j\/([^/]+)/i);
    if (hostname.endsWith("workable.com") && workableJob) return "workable.com/jobs/" + workableJob[1].toLocaleLowerCase("en-US");

    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLocaleLowerCase("en-US");
      if (trackingParameters.has(normalized) || normalized.startsWith("utm_")) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return hostname + pathname + (url.searchParams.size ? "?" + url.searchParams.toString() : "");
  }

  function isLikelyJobUrl(value, base) {
    const url = parsedUrl(value, base);
    if (!url) return false;
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    const path = url.pathname.toLocaleLowerCase("en-US");
    if (/\/jobs\/applications(?:\/|$)/.test(path)) return false;
    if (/wellfound\.com$/.test(hostname) && /\/jobs\/\d+/.test(path)) return true;
    if (/linkedin\.com$/.test(hostname) && /\/jobs\/view\/\d+/.test(path)) return true;
    if (/indeed\.com$/.test(hostname) && (url.searchParams.has("jk") || /\/viewjob/.test(path))) return true;
    if (/jobs\.lever\.co$/.test(hostname) && /^\/[^/]+\/[^/]+/.test(path)) return true;
    if (/jobs\.ashbyhq\.com$/.test(hostname) && /^\/[^/]+\/[^/]+/.test(path)) return true;
    if (/jobs\.smartrecruiters\.com$/.test(hostname) && /^\/[^/]+\/[^/]+/.test(path)) return true;
    if (/apply\.workable\.com$/.test(hostname) && /\/j\/[^/]+/.test(path)) return true;
    if (/greenhouse\.io$/.test(hostname) && /\/jobs\/\d+/.test(path)) return true;
    return /\/(jobs?|positions?|vacancies?|careers?)\/(?!search|saved|applications|categories|remote)(?:view\/)?[^/]+/.test(path);
  }

  globalThis.ApplylyPageReader = Object.freeze({ normalizeJobUrl, isLikelyJobUrl });
})();

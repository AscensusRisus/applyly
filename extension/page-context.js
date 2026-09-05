(() => {
  const clean = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const asList = value => Array.isArray(value) ? value : value ? [value] : [];
  const candidates = [];
  const seen = new Map();
  const markedCandidateIndices = new Set();
  document.querySelectorAll("[data-applyly-candidate-index]").forEach(element => element.removeAttribute("data-applyly-candidate-index"));
  const platformNames = new Set([
    "wellfound", "angellist", "linkedin", "indeed", "glassdoor", "hiringcafe",
    "y combinator", "oneforma", "otta", "welcome to the jungle", "built in",
    "greenhouse", "lever", "ashby", "workable", "workday", "smartrecruiters",
    "jobvite", "breezy", "recruitee", "teamtailor",
  ]);
  const hiringPlatforms = [
    "linkedin.com", "indeed.com", "glassdoor.com", "wellfound.com", "angel.co",
    "hiring.cafe", "ycombinator.com", "oneforma.com", "otta.com",
    "welcome-to-the-jungle.com", "builtin.com", "dice.com", "levels.fyi",
    "remoteok.com", "weworkremotely.com", "arc.dev", "lever.co",
    "greenhouse.io", "ashbyhq.com", "workday.com", "myworkdayjobs.com",
    "smartrecruiters.com", "jobvite.com", "breezy.hr", "recruitee.com",
    "teamtailor.com",
  ];

  const cleanCompany = value => {
    const company = clean(value).replace(/^(company|hiring organization):\s*/i, "");
    if (!company || platformNames.has(company.toLocaleLowerCase("en-US"))) return "";
    return company;
  };

  const companyDomain = values => {
    for (const value of values.filter(Boolean)) {
      try {
        const hostname = new URL(value, location.href).hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
        if (!hiringPlatforms.some(platform => hostname === platform || hostname.endsWith("." + platform))) return hostname;
      } catch {
        // Publisher metadata sometimes contains non-URL identifiers.
      }
    }
    return "";
  };

  const pageReader = globalThis.ApplylyPageReader;
  if (!pageReader) throw new Error("Applyly page reader core was not loaded.");
  const candidateUrlKey = value => pageReader.normalizeJobUrl(value, location.href);
  const isLikelyJobUrl = value => pageReader.isLikelyJobUrl(value, location.href);

  const markCandidateElement = (element, candidateIndex) => {
    let target = element;
    if (target?.matches?.("a,button")) target = target.parentElement;
    if (!target || target === document.body || target === document.documentElement) return;
    target.setAttribute("data-applyly-candidate-index", String(candidateIndex));
    markedCandidateIndices.add(candidateIndex);
  };

  const addCandidate = (candidate, element) => {
    const company = cleanCompany(candidate.company);
    const role = clean(candidate.role);
    let url = "";
    try {
      const parsed = new URL(candidate.url || "", location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") url = parsed.href;
    } catch {
      // A company can still be matched when a page provides no valid job URL.
    }
    if (!company && !url) return;
    const key = candidateUrlKey(url) || (company.toLocaleLowerCase("en-US") + "|" + role.toLocaleLowerCase("en-US"));
    if (seen.has(key)) {
      markCandidateElement(element, seen.get(key));
      return;
    }
    if (candidates.length >= 100) return;
    const candidateIndex = candidates.length;
    seen.set(key, candidateIndex);
    markCandidateElement(element, candidateIndex);
    candidates.push({ company, role, url, domain: clean(candidate.domain) });
  };

  const jsonNodes = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    jsonNodes.push(value);
    if (value["@graph"]) visit(value["@graph"]);
    if (value.itemListElement) visit(value.itemListElement);
    if (value.item) visit(value.item);
    if (value.mainEntity) visit(value.mainEntity);
    if (value.mainEntityOfPage) visit(value.mainEntityOfPage);
    if (value.hasPart) visit(value.hasPart);
  };

  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(script.textContent || ""));
    } catch {
      // Invalid publisher metadata must not prevent DOM-based extraction.
    }
  }

  const isJobPosting = node => asList(node["@type"]).some(type => {
    const normalized = String(type).toLocaleLowerCase("en-US");
    return normalized === "jobposting" || normalized.endsWith("/jobposting") || normalized.endsWith("#jobposting");
  });
  const linkedUrl = value => typeof value === "string" ? value : value && typeof value === "object"
    ? value.url || value["@id"] || ""
    : "";

  for (const posting of jsonNodes.filter(isJobPosting)) {
    const organization = posting.hiringOrganization && typeof posting.hiringOrganization === "object"
      ? posting.hiringOrganization
      : {};
    addCandidate({
      company: organization.name,
      role: posting.title,
      url: linkedUrl(posting.url) || linkedUrl(posting["@id"]) || linkedUrl(posting.mainEntityOfPage) || location.href,
      domain: companyDomain([...asList(organization.sameAs), organization.url]),
    });
  }

  const cardSelectors = [
    "article", "li", "[role='listitem']", "[data-testid*='job']", "[data-test*='job']",
    "[data-cy*='job']", "[data-qa*='job']", "[class*='job-card']", "[class*='JobCard']",
    "[class*='jobCard']", "[class*='job-listing']", "[class*='JobListing']",
    "[class*='jobListing']", "[class*='application-card']", "[class*='ApplicationCard']",
    "[data-job-id]", "[data-occludable-job-id]",
  ].join(",");
  const companySelectors = [
    "[data-testid*='company']", "[data-test*='company']", "[data-cy*='company']",
    "[data-qa*='company']", "[itemprop='hiringOrganization']", "[class*='company-name']",
    "[class*='companyName']", "[class*='CompanyName']", "[class*='employer-name']",
    "[class*='employerName']", "[class*='organization-name']", "a[href*='/company/']",
    "a[href*='/companies/']", "[data-company-name]", "[data-automation-id='companyName']",
    "[class*='primary-description']", "[class*='entity-lockup__subtitle']",
  ];
  const roleSelectors = [
    "[data-testid*='job-title']", "[data-test*='job-title']", "[data-cy*='job-title']",
    "[data-qa*='job-title']", "[itemprop='title']", "[class*='job-title']",
    "[class*='jobTitle']", "[class*='JobTitle']", "[data-job-title]",
    "[data-automation-id='jobTitle']", "[class*='job-card-list__title']",
    "[class*='job-card-container__link']",
  ];
  const roleHeadingSelectors = ["h1", "h2", "h3"];
  const firstElement = (container, selectors) => selectors
    .map(selector => container.querySelector(selector))
    .find(Boolean);
  const roleFromCard = (card, jobAnchor) => {
    const semanticRole = clean(firstElement(card, roleSelectors)?.textContent);
    if (semanticRole) return semanticRole;
    const linkedRole = clean(jobAnchor?.textContent);
    if (linkedRole && !/^(?:apply(?: now)?|view(?: job)?|details?|job details|learn more|open job)$/i.test(linkedRole)) return linkedRole;
    return clean(firstElement(card, roleHeadingSelectors)?.textContent);
  };

  const findJobCard = anchor => {
    const direct = anchor.closest(cardSelectors);
    const directContainer = direct?.matches?.("a,button") ? direct.parentElement : direct;
    if (directContainer && directContainer !== document.body && directContainer !== document.documentElement) {
      const directJobLinks = [...directContainer.querySelectorAll("a[href]")].filter(link => isLikelyJobUrl(link.href));
      if (directJobLinks.length <= 1) return directContainer;
    }

    let current = anchor.parentElement;
    let best = null;
    for (let depth = 0; current && depth < 9 && current !== document.body; depth += 1, current = current.parentElement) {
      const jobLinks = [...current.querySelectorAll("a[href]")].filter(link => isLikelyJobUrl(link.href));
      if (jobLinks.length > 1) break;
      if (jobLinks.length === 1 && clean(current.textContent).length <= 6_000) best = current;
    }
    return best && best !== document.documentElement ? best : null;
  };

  const companyFromCard = (card, role) => {
    const companyElement = firstElement(card, companySelectors);
    const selected = cleanCompany(
      companyElement?.getAttribute?.("data-company-name")
      || companyElement?.textContent
      || companyElement?.getAttribute?.("aria-label"),
    );
    if (selected) return selected;

    const labelled = [...card.querySelectorAll("[aria-label]")].map(element => clean(element.getAttribute("aria-label")))
      .find(label => /^(?:company|employer|organization)\s*[:|-]/i.test(label));
    if (labelled) {
      const value = cleanCompany(labelled.replace(/^(?:company|employer|organization)\s*[:|-]\s*/i, ""));
      if (value) return value;
    }

    const normalizedRole = clean(role).toLocaleLowerCase("en-US");
    const metadataLines = [...card.querySelectorAll("p,span,div")]
      .map(element => clean(element.textContent))
      .filter(value => /[\u2022\u00b7]/.test(value) && value.length <= 500)
      .sort((left, right) => left.length - right.length);
    for (const line of metadataLines) {
      const value = cleanCompany(line.split(/[\u2022\u00b7]/, 1)[0]);
      if (!value || value.toLocaleLowerCase("en-US") === normalizedRole) continue;
      if (/^(remote|hybrid|onsite|in office|today|yesterday)$/i.test(value)) continue;
      if (/[$\u20ac\u00a3\u00a5\u20b9]|\d+\s*(?:days?|weeks?|months?)\s+ago/i.test(value)) continue;
      return value;
    }
    return "";
  };

  for (const anchor of document.querySelectorAll("a[href]")) {
    if (!isLikelyJobUrl(anchor.href)) continue;
    const card = findJobCard(anchor);
    if (!card) continue;
    const role = roleFromCard(card, anchor);
    addCandidate({
      company: companyFromCard(card, role),
      role,
      url: anchor.href,
      domain: "",
    }, card);
  }

  for (const card of document.querySelectorAll(cardSelectors)) {
    const jobAnchor = [...card.querySelectorAll("a[href]")].find(anchor => isLikelyJobUrl(anchor.href));
    const explicitJobCard = card.matches("[data-testid*='job'],[data-test*='job'],[data-cy*='job'],[data-qa*='job'],[class*='job-card'],[class*='JobCard'],[class*='jobCard'],[class*='job-listing'],[class*='JobListing'],[class*='jobListing']");
    if (!jobAnchor && !explicitJobCard) continue;
    const role = roleFromCard(card, jobAnchor);
    const company = companyFromCard(card, role);
    if (!company || (!jobAnchor && !role)) continue;
    addCandidate({
      company,
      role,
      url: jobAnchor?.href || "",
      domain: "",
    }, card);
  }

  for (const companyAnchor of document.querySelectorAll("a[href*='/company/'], a[href*='/companies/']")) {
    let container = companyAnchor.parentElement;
    for (let depth = 0; container && depth < 6 && container !== document.body; depth += 1, container = container.parentElement) {
      const jobAnchor = [...container.querySelectorAll("a[href]")].find(anchor => isLikelyJobUrl(anchor.href));
      if (!jobAnchor) continue;
      addCandidate({
        company: companyAnchor.textContent,
        role: roleFromCard(container, jobAnchor),
        url: jobAnchor?.href || "",
        domain: "",
      }, container);
      break;
    }
  }
  const pathname = location.pathname.toLocaleLowerCase("en-US");
  const jobLinkCount = [...document.querySelectorAll("a[href]")].filter(anchor => isLikelyJobUrl(anchor.href)).length;
  const collectionHint = /\/(applications|saved|search)(?:\/|$)/.test(pathname)
    || /\/jobs\/?$/.test(pathname)
    || jobLinkCount > 1
    || candidates.length > 1;

  if (!collectionHint && candidates.length === 1 && !markedCandidateIndices.has(0)) {
    markCandidateElement(document.querySelector("main, article") || document.body.firstElementChild, 0);
  }

  if (!collectionHint && candidates.length === 0) {
    const firstText = selectors => {
      for (const selector of selectors) {
        const value = clean(document.querySelector(selector)?.textContent);
        if (value) return value;
      }
      return "";
    };
    const company = firstText([
      "[data-testid='inlineHeader-companyName']", "[data-testid='company-name']",
      ".jobsearch-InlineCompanyRating-companyHeader a", ".topcard__org-name-link",
      ".jobs-unified-top-card__company-name", "[class*='company-name']",
      "[class*='companyName']", "a[href*='/company/']",
    ]);
    const role = firstText([
      "h1", "[data-testid='job-title']", ".jobsearch-JobInfoHeader-title",
      "[class*='job-title']", "[class*='jobTitle']",
    ]);
    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
    addCandidate({ company, role, url: canonicalUrl, domain: "" }, document.querySelector("main, article") || document.body);
  }

  return {
    mode: collectionHint || candidates.length > 1 ? "collection" : "detail",
    pageUrl: location.href,
    title: clean(document.title),
    candidates,
    diagnostics: {
      jobLinks: jobLinkCount,
      mappedCandidates: markedCandidateIndices.size,
    },
  };
})();

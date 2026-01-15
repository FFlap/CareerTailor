const SITE_HANDLERS = {
  indeed: {
    titleSelectors: [
      "h1[data-testid='jobTitle']",
      "h1.jobsearch-JobInfoHeader-title",
      "h1[data-testid='jobsearch-JobInfoHeader-title']",
      "h1.jobsearch-JobInfoHeader-title span",
      "h1[data-testid='jobsearch-JobInfoHeader-title'] span",
      ".jobsearch-JobInfoHeader-title span",
      "h1"
    ],
    companySelectors: [
      ".jobsearch-InlineCompanyRating div:first-child",
      "[data-testid='inlineHeader-companyName']",
      ".jobsearch-CompanyInfoWithoutHeaderImage div:first-child"
    ],
    descriptionSelectors: [
      "#jobDescriptionText",
      ".jobsearch-jobDescriptionText",
      "#jobDescriptionContainer"
    ]
  },
  linkedin: {
    titleSelectors: [
      ".jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title h2",
      ".jobs-unified-top-card__job-title a",
      ".job-details-jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__job-title h2",
      ".jobs-details-top-card__job-title",
      "h1.t-24.t-bold",
      "h1.t-24",
      ".topcard__title",
      "h1.top-card-layout__title",
      "h1"
    ],
    companySelectors: [
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__primary-description a",
      ".jobs-unified-top-card__primary-description",
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-details-top-card__company-name a",
      ".jobs-details-top-card__company-name",
      ".topcard__org-name-link",
      ".topcard__flavor-row a",
      ".top-card-layout__card .top-card-layout__second-subline a"
    ],
    descriptionSelectors: [
      "[data-testid='expandable-text-box']",
      ".jobs-description-content__text",
      ".jobs-description__content",
      ".jobs-description__container",
      ".jobs-box__html-content",
      ".show-more-less-html__markup",
      ".description__text"
    ]
  },
  glassdoor: {
    titleSelectors: [
      "h1[data-test='job-title']",
      "h1",
      ".JobInfo_jobTitle__rZ2mP"
    ],
    companySelectors: [
      "[data-test='employer-name']",
      ".EmployerProfile_employerName__Xemli",
      ".JobInfo_companyName__mA6Ih"
    ],
    descriptionSelectors: [
      "[data-test='jobDescriptionContent']",
      "#JobDescriptionContainer",
      ".JobDescription_jobDescription__uW_fK"
    ]
  }
};

function normalizeInlineText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function normalizeBlockText(text) {
  return (text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractLinkedInJobId(rawUrl) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl, window.location.href);
    const match = url.pathname.match(/\/jobs\/view\/(\d+)/);
    if (match) return match[1];
    return url.searchParams.get("currentJobId") || "";
  } catch (error) {
    return "";
  }
}

function getLinkedInJobIdFromUrl() {
  return extractLinkedInJobId(window.location.href);
}

function extractIndeedJobId(rawUrl) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl, window.location.href);
    return url.searchParams.get("jk") || url.searchParams.get("vjk") || "";
  } catch (error) {
    return "";
  }
}

function extractGlassdoorJobId(rawUrl) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl, window.location.href);
    return url.searchParams.get("jl") || url.searchParams.get("jobListingId") || "";
  } catch (error) {
    return "";
  }
}

function extractJobId(siteKey, rawUrl) {
  if (siteKey === "linkedin") return extractLinkedInJobId(rawUrl);
  if (siteKey === "indeed") return extractIndeedJobId(rawUrl);
  if (siteKey === "glassdoor") return extractGlassdoorJobId(rawUrl);
  return "";
}

function getTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const raw = el.innerText || el.textContent || "";
      const text = normalizeInlineText(raw);
      if (text) return text;
    }
  }
  return "";
}

function getMetaContent(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const content = el?.getAttribute("content") || "";
    const text = normalizeInlineText(content);
    if (text) return text;
  }
  return "";
}

function getDescription(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const raw = el.innerText || el.textContent || "";
      const text = normalizeBlockText(raw);
      if (text) return text;
    }
  }
  return "";
}

function stripHtml(raw) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(raw || ""), "text/html");
    return doc.body?.textContent || "";
  } catch {
    return String(raw || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function findJobPosting(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const type = node["@type"];
  const isJobPosting = Array.isArray(type) ? type.includes("JobPosting") : type === "JobPosting";
  if (isJobPosting) return node;
  if (node["@graph"]) return findJobPosting(node["@graph"]);
  if (node.mainEntity) return findJobPosting(node.mainEntity);
  if (node.jobPosting) return findJobPosting(node.jobPosting);
  return null;
}

function getStructuredJobPosting() {
  const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
  for (const script of scripts) {
    const text = script.textContent;
    if (!text) continue;
    try {
      const data = JSON.parse(text);
      const posting = findJobPosting(data);
      if (!posting) continue;

      const title = posting.title || posting.positionTitle || "";
      const org = posting.hiringOrganization || posting.employer || posting.organization || "";
      const company = typeof org === "string" ? org : org?.name || "";
      let description = "";
      if (typeof posting.description === "string") {
        description = stripHtml(posting.description);
      } else if (posting.description?.text) {
        description = stripHtml(posting.description.text);
      }

      return {
        title: title.replace(/\s+/g, " ").trim(),
        company: company.replace(/\s+/g, " ").trim(),
        description: description.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
      };
    } catch (error) {
      continue;
    }
  }
  return null;
}

function getIndeedTitleFallback() {
  const metaTitle = getMetaContent([
    "meta[property='og:title']",
    "meta[name='twitter:title']",
    "meta[name='title']"
  ]);
  const candidate = metaTitle || document.title || "";
  if (!candidate) return "";
  return candidate
    .replace(/\s+-\s+job post.*$/i, "")
    .replace(/\s+\|\s*indeed.*$/i, "")
    .replace(/\s+-\s*indeed.*$/i, "")
    .trim();
}

function getLinkedInDetailRoot() {
  return (
    document.querySelector("[data-view-name='job-detail-page']") ||
    document.querySelector("[data-sdui-screen*='SemanticJobDetails']") ||
    document.querySelector("main") ||
    document.body
  );
}

function getLinkedInDetailData() {
  const root = getLinkedInDetailRoot();
  if (!root) return { title: "", company: "", description: "", jobId: "", jobUrl: "" };

  const isInJobCard = (el) => Boolean(el?.closest("[data-view-name='job-search-job-card']"));
  const getLinkData = (selector) => {
    const links = Array.from(root.querySelectorAll(selector));
    let fallbackUrl = "";
    for (const link of links) {
      if (isInJobCard(link)) continue;
      const href = link.getAttribute("href") || "";
      if (href && !fallbackUrl) {
        fallbackUrl = new URL(href, window.location.href).href;
      }
      const text = normalizeInlineText(link.innerText || link.textContent || "");
      if (text) {
        const jobUrl = href ? new URL(href, window.location.href).href : "";
        return { text, url: jobUrl || fallbackUrl };
      }
    }
    return { text: "", url: fallbackUrl };
  };

  const titleLink = getLinkData("a[href*='/jobs/view/']");
  const companyLink = getLinkData("a[href*='/company/']");
  const title = titleLink.text;
  const company = companyLink.text;
  const descriptionEl = root.querySelector("[data-testid='expandable-text-box']");
  const description = descriptionEl
    ? normalizeBlockText(descriptionEl.innerText || descriptionEl.textContent || "")
    : "";
  const jobUrl = titleLink.url || "";
  const jobId = extractLinkedInJobId(jobUrl || window.location.href);

  return { title, company, description, jobId, jobUrl };
}

function getLinkedInFallback() {
  const activeCard = document.querySelector(
    ".jobs-search-results__list-item--active, .jobs-search-results__list-item.active, .jobs-search-results__list-item[aria-current='true']"
  );
  if (!activeCard) return { title: "", company: "" };

  const title =
    activeCard.querySelector("a.job-card-list__title")?.innerText?.trim() ||
    activeCard.querySelector(".job-card-list__title")?.innerText?.trim() ||
    activeCard.querySelector("a.job-card-container__link-job-title")?.innerText?.trim() ||
    activeCard.querySelector(".job-card-container__link-job-title")?.innerText?.trim() ||
    activeCard.querySelector(".job-card-container__job-title")?.innerText?.trim() ||
    activeCard.querySelector(".job-card-container__title")?.innerText?.trim() ||
    "";

  const company =
    activeCard.querySelector(".job-card-container__primary-description")?.innerText?.trim() ||
    activeCard.querySelector(".job-card-container__company-name")?.innerText?.trim() ||
    "";

  return { title, company };
}

function detectSite() {
  const host = window.location.hostname;
  if (host.includes("indeed.com")) return "indeed";
  if (host.includes("linkedin.com")) return "linkedin";
  if (host.includes("glassdoor.com")) return "glassdoor";
  return "";
}

function isLinkedInLoginWall() {
  if (!window.location.hostname.includes("linkedin.com")) return false;
  const title = document.title || "";
  if (/sign in|join linkedin/i.test(title)) return true;
  if (document.querySelector("input[name='session_key'], input[name='session_password']")) return true;
  return Boolean(document.querySelector(".authwall-sign-in-form, .authwall-sign-in__form"));
}

let lastPayload = "";
let lastUrl = window.location.href;
const lastJobIdBySite = {
  linkedin: "",
  indeed: "",
  glassdoor: ""
};

function scheduleScrape(delay = 600) {
  clearTimeout(window.__resumeScrapeTimer);
  window.__resumeScrapeTimer = setTimeout(scrapeJob, delay);
}

function collectJobData() {
  const siteKey = detectSite();
  if (!siteKey) return null;
  if (siteKey === "linkedin" && isLinkedInLoginWall()) return null;

  const config = SITE_HANDLERS[siteKey];
  let title = getTextFromSelectors(config.titleSelectors);
  let company = getTextFromSelectors(config.companySelectors);
  let description = getDescription(config.descriptionSelectors);
  const structured = getStructuredJobPosting();
  let jobId = "";
  let jobUrl = "";

  if (siteKey === "linkedin") {
    const detail = getLinkedInDetailData();
    title = detail.title || title;
    company = detail.company || company;
    description = detail.description || description;
    jobUrl = detail.jobUrl || "";
    jobId = detail.jobId || getLinkedInJobIdFromUrl();
  }

  if (siteKey === "indeed" && !title) {
    title = getIndeedTitleFallback() || title;
  }

  if (!jobId) {
    jobId = extractJobId(siteKey, jobUrl || window.location.href);
  }

  if (structured) {
    title = title || structured.title;
    company = company || structured.company;
  }
  const finalDescription = description || structured?.description || "";

  if (siteKey === "linkedin" && (!title || !company)) {
    const fallback = getLinkedInFallback();
    title = title || fallback.title;
    company = company || fallback.company;
  }

  if (siteKey === "linkedin" && !jobId && !title && !finalDescription) return null;
  if (!title && !finalDescription) return null;

  return {
    title,
    company,
    description: finalDescription,
    url: jobUrl || window.location.href,
    source: siteKey,
    jobId: jobId || ""
  };
}

function scrapeJob() {
  const job = collectJobData();
  if (!job) return;

  if (job.jobId && job.jobId !== lastJobIdBySite[job.source]) {
    lastJobIdBySite[job.source] = job.jobId;
    setTimeout(scrapeJob, 1200);
  }

  const payload = JSON.stringify({
    title: job.title,
    company: job.company,
    description: job.description,
    url: job.url,
    jobId: job.jobId || ""
  });
  if (payload === lastPayload) return;
  lastPayload = payload;

  chrome.runtime.sendMessage({
    type: "JOB_SCRAPED",
    job
  });
}

function hookHistoryNavigation() {
  if (window.__resumeHistoryHooked) return;
  window.__resumeHistoryHooked = true;
  ["pushState", "replaceState"].forEach((method) => {
    const original = history[method];
    if (typeof original !== "function") return;
    history[method] = function (...args) {
      const result = original.apply(this, args);
      scheduleScrape(250);
      return result;
    };
  });
  window.addEventListener("popstate", () => scheduleScrape(250));
}

function startUrlWatcher() {
  if (window.__resumeUrlWatcherStarted) return;
  window.__resumeUrlWatcherStarted = true;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      scheduleScrape(200);
    }
  }, 1000);
}

const observer = new MutationObserver(() => {
  scheduleScrape();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});

hookHistoryNavigation();
startUrlWatcher();
scheduleScrape(100);

window.addEventListener("load", () => {
  scheduleScrape(100);
});

document.addEventListener("click", (event) => {
  if (!window.location.hostname.includes("linkedin.com")) return;
  const target = event.target;
  if (!target) return;
  const link = target.closest("a[href*='/jobs/view/'], [data-view-name='job-search-job-card']");
  if (link) {
    scheduleScrape(400);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCRAPE_NOW") return false;
  const job = collectJobData();
  if (job) {
    chrome.runtime.sendMessage({ type: "JOB_SCRAPED", job });
    sendResponse({ ok: true, job });
  } else {
    sendResponse({ ok: false });
  }
  return true;
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    lastPayload = "";
    scrapeJob();
    scheduleScrape(300);
  }
});

window.addEventListener("focus", () => {
  lastPayload = "";
  scrapeJob();
  scheduleScrape(300);
});

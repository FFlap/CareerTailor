import { chromium } from "playwright";

const url = process.argv[2];
if (!url) {
  console.log("Usage: node scripts/playwright-job-scrape.mjs <job_url>");
  process.exit(1);
}

const selectorsBySite = {
  indeed: {
    titleSelectors: ["h1.jobsearch-JobInfoHeader-title", "h1[data-testid='jobsearch-JobInfoHeader-title']", "h1"],
    companySelectors: [".jobsearch-InlineCompanyRating div:first-child", "[data-testid='inlineHeader-companyName']"],
    descriptionSelectors: ["#jobDescriptionText", ".jobsearch-jobDescriptionText"]
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
      ".jobs-description-content__text",
      ".jobs-description__content",
      ".jobs-description__container",
      ".jobs-box__html-content",
      ".show-more-less-html__markup",
      ".description__text"
    ]
  },
  glassdoor: {
    titleSelectors: ["h1[data-test='job-title']", "h1"],
    companySelectors: ["[data-test='employer-name']", ".EmployerProfile_employerName__Xemli"],
    descriptionSelectors: ["[data-test='jobDescriptionContent']", "#JobDescriptionContainer"]
  }
};

function detectSite(hostname) {
  if (hostname.includes("indeed.com")) return "indeed";
  if (hostname.includes("linkedin.com")) return "linkedin";
  if (hostname.includes("glassdoor.com")) return "glassdoor";
  return "";
}

const defaultChromePath = "/Users/flappy/Desktop/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.CHROME_PATH || defaultChromePath;
const userDataDir = process.env.CHROME_USER_DATA_DIR || process.env.CHROME_PROFILE_DIR;
const headless = process.env.PW_HEADLESS ? process.env.PW_HEADLESS !== "0" : true;

const launchOptions = { headless };
if (executablePath) {
  launchOptions.executablePath = executablePath;
}

let browser;
let context;
const contextOptions = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  locale: "en-US"
};

if (userDataDir) {
  context = await chromium.launchPersistentContext(userDataDir, {
    ...launchOptions,
    ...contextOptions
  });
  browser = context.browser();
} else {
  browser = await chromium.launch(launchOptions);
  context = await browser.newContext(contextOptions);
}
const page = await context.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

const site = detectSite(new URL(url).hostname);
const selectors = selectorsBySite[site] || selectorsBySite.indeed;

async function scrapeData() {
  return page.evaluate(({ selectors }) => {
    const normalizePlainText = (value) => (value || "").replace(/\s+/g, " ").trim();
    const normalizeDescription = (value) =>
      (value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const stripHtml = (raw) => {
      const div = document.createElement("div");
      div.innerHTML = raw;
      return div.textContent || "";
    };

    const getText = (list) => {
      for (const selector of list) {
        const el = document.querySelector(selector);
        if (el) {
          const text = normalizePlainText(el.innerText || el.textContent || "");
          if (text) return text;
        }
      }
      return "";
    };
    const getDesc = (list) => {
      for (const selector of list) {
        const el = document.querySelector(selector);
        if (el) {
          const text = normalizeDescription(el.innerText || el.textContent || "");
          if (text) return text;
        }
      }
      return "";
    };

    const findJobPosting = (node) => {
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
    };

    const getStructuredJobPosting = () => {
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
            title: normalizePlainText(title),
            company: normalizePlainText(company),
            description: normalizeDescription(description)
          };
        } catch (error) {
          continue;
        }
      }
      return null;
    };

    return {
      title: getText(selectors.titleSelectors),
      company: getText(selectors.companySelectors),
      description: getDesc(selectors.descriptionSelectors),
      structured: getStructuredJobPosting(),
      loginWall:
        /sign in|join linkedin/i.test(document.title || "") ||
        Boolean(document.querySelector("input[name='session_key'], input[name='session_password']")),
      pageTitle: document.title || ""
    };
  }, { selectors });
}

async function findJobLink() {
  const patternsBySite = {
    indeed: ["/viewjob", "jk="],
    linkedin: ["/jobs/view/"],
    glassdoor: ["/Job/", "jobListingId="]
  };
  const patterns = patternsBySite[site] || [];
  return page.evaluate((patterns) => {
    const anchors = Array.from(document.querySelectorAll("a"));
    for (const anchor of anchors) {
      const href = anchor.href || "";
      if (!href) continue;
      if (patterns.some((pattern) => href.includes(pattern))) {
        return href;
      }
    }
    return "";
  }, patterns);
}

let data = await scrapeData();
if (data.structured) {
  data.title = data.title || data.structured.title;
  data.company = data.company || data.structured.company;
  data.description = data.description || data.structured.description;
}
delete data.structured;

if (!data.description) {
  const jobLink = await findJobLink();
  if (jobLink) {
    await page.goto(jobLink, { waitUntil: "domcontentloaded" });
    data = await scrapeData();
  }
}

console.log(JSON.stringify({ url, site, data }, null, 2));
if (userDataDir) {
  await context.close();
} else {
  await browser.close();
}

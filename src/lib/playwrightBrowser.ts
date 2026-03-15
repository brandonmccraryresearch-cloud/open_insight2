/**
 * Playwright Browser Manager for Open Insight
 *
 * Provides a lazy-initialized Chromium browser pool for real browser automation.
 * When the browser binary is unavailable (e.g. Vercel serverless), `isAvailable()`
 * returns false and callers should fall back to Gemini URL-context.
 *
 * URL allowlist mirrors `/api/tools/playwright`: only the app itself and approved
 * research domains are accessible to avoid SSRF risks.
 */

import type { Browser, Page, BrowserContext } from "playwright";

// Lazy singleton — initialized on first use
let _browser: Browser | null = null;
let _initPromise: Promise<Browser | null> | null = null;
/** Guard so process signal handlers are only registered once */
let _exitHandlersRegistered = false;

/** Max children per accessibility node (prevents enormous trees) */
const MAX_ACCESSIBILITY_CHILDREN = 20;
/** Max interactive elements returned by findInteractiveElements */
const MAX_INTERACTIVE_ELEMENTS = 100;

/** Approved external domains agents may navigate to */
const ALLOWED_EXTERNAL_DOMAINS = [
  "arxiv.org",
  "pdg.lbl.gov",
  "mathscinet.ams.org",
  "inspirehep.net",
  "scholar.google.com",
  "en.wikipedia.org",
  "ncatlab.org",
  "mathoverflow.net",
  "physics.stackexchange.com",
];

/** Check whether a URL is in the same-origin or the allowlist */
export function isAllowedTarget(url: string, appOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    const origin = new URL(appOrigin);
    if (parsed.origin === origin.origin) return true;
    return ALLOWED_EXTERNAL_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

/** Returns true when the Chromium binary is installed and usable */
export async function isAvailable(): Promise<boolean> {
  try {
    const browser = await getOrLaunchBrowser();
    return browser !== null;
  } catch {
    return false;
  }
}

/** Get or lazily launch the shared Chromium browser instance */
async function getOrLaunchBrowser(): Promise<Browser | null> {
  if (_browser) return _browser;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Dynamic import so that build/import still works in environments without
      // the playwright package installed (it's a devDependency in that case).
      const { chromium } = await import("playwright");
      _browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
        ],
      });
      // Register shutdown handlers once (singleton pattern — only on first launch)
      if (typeof process !== "undefined" && !_exitHandlersRegistered) {
        _exitHandlersRegistered = true;
        const cleanup = () => { _browser?.close().catch(() => {}); };
        process.once("exit", cleanup);
        process.once("SIGTERM", cleanup);
        process.once("SIGINT", cleanup);
      }
      return _browser;
    } catch {
      _browser = null;
      _initPromise = null;
      return null;
    }
  })();

  return _initPromise;
}

/** Create a fresh isolated browser context (and close it after use) */
async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getOrLaunchBrowser();
  if (!browser) throw new Error("Playwright browser not available");

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (compatible; OpenInsightBot/1.0; +https://openinsight.app/bot)",
      // Block media to speed up loads
      javaScriptEnabled: true,
    });
    // Block images, fonts, and media to speed up page loads
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font"].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    page = await context.newPage();
    return await fn(page);
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

// ─── Structured response types ────────────────────────────────────────────────

export interface PageSnapshot {
  url: string;
  title: string;
  /** Simplified accessibility tree for AI consumption */
  accessibility: AccessibilityNode | null;
  /** Plain text content, organized by section */
  textContent: string;
}

export interface AccessibilityNode {
  role: string;
  name?: string;
  children?: AccessibilityNode[];
  value?: string;
  description?: string;
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
}

export interface ElementInfo {
  role: string;
  name: string;
  tag: string;
  type?: string;
  placeholder?: string;
  href?: string;
  text: string;
  visible: boolean;
}

export interface ScreenshotResult {
  url: string;
  title: string;
  /** Base64-encoded PNG */
  imageBase64: string;
  width: number;
  height: number;
}

export interface ActionResult {
  success: boolean;
  url: string;
  title: string;
  message: string;
}

// ─── Core browser actions ─────────────────────────────────────────────────────

/**
 * Navigate to a URL and return a full page snapshot (accessibility tree + text).
 * This is the most useful action for AI agents — it gives structured access to
 * the page's semantic structure without needing visual rendering.
 */
export async function navigateAndSnapshot(url: string, timeoutMs = 30000): Promise<PageSnapshot> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    // Wait for the page to settle
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const title = await page.title();
    const finalUrl = page.url();

    // Get accessibility tree via ARIA roles from the DOM
    let accessibility: AccessibilityNode | null = null;
    try {
      const rawTree = await page.evaluate((maxChildren: number) => {
        function buildNode(el: Element, depth: number): AccessibilityNode | null {
          if (depth > 8) return null;
          const role = el.getAttribute("role") ||
            (el.tagName === "BUTTON" ? "button" :
             el.tagName === "A" ? "link" :
             el.tagName === "INPUT" ? "textbox" :
             el.tagName === "NAV" ? "navigation" :
             el.tagName === "MAIN" ? "main" :
             el.tagName === "HEADER" ? "banner" :
             el.tagName === "FOOTER" ? "contentinfo" :
             el.tagName === "SECTION" ? "region" :
             el.tagName === "ARTICLE" ? "article" :
             el.tagName === "H1" || el.tagName === "H2" || el.tagName === "H3" ? "heading" :
             el.tagName === "LI" ? "listitem" :
             el.tagName === "UL" || el.tagName === "OL" ? "list" :
             el.tagName === "FORM" ? "form" :
             el.tagName === "SELECT" ? "combobox" :
             null);
          if (!role) return null;

          const node: AccessibilityNode = { role };
          const name = el.getAttribute("aria-label") ||
            (el as HTMLElement).innerText?.trim().slice(0, 100) || "";
          if (name) node.name = name;

          const checked = el.getAttribute("aria-checked");
          if (checked !== null) node.checked = checked === "true";
          const disabled = el.getAttribute("aria-disabled") || (el as HTMLInputElement).disabled;
          if (disabled) node.disabled = true;
          const level = el.getAttribute("aria-level");
          if (level) node.level = parseInt(level);

          const children: AccessibilityNode[] = [];
          for (const child of Array.from(el.children).slice(0, maxChildren)) {
            const childNode = buildNode(child, depth + 1);
            if (childNode) children.push(childNode);
          }
          if (children.length > 0) node.children = children;
          return node;
        }

        interface AccessibilityNode {
          role: string;
          name?: string;
          children?: AccessibilityNode[];
          value?: string;
          description?: string;
          checked?: boolean;
          disabled?: boolean;
          expanded?: boolean;
          level?: number;
        }

        const root = buildNode(document.body, 0);
        return root;
      }, MAX_ACCESSIBILITY_CHILDREN);
      if (rawTree) {
        accessibility = rawTree as AccessibilityNode;
      }
    } catch {
      // accessibility tree extraction failed — continue without it
    }

    // Get text content organized by section
    const textContent = await page.evaluate(() => {
      const sections: string[] = [];
      // Title / headings
      const title = document.title;
      if (title) sections.push(`PAGE TITLE: ${title}`);

      // Extract text section by section using headings as delimiters
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
      if (headings.length > 0) {
        for (const h of headings) {
          sections.push(`\n[${h.tagName}] ${h.textContent?.trim() ?? ""}`);
          // Get text following this heading up to the next heading
          let next = h.nextElementSibling;
          let sectionText = "";
          while (next && !["H1","H2","H3","H4"].includes(next.tagName)) {
            const text = next.textContent?.trim();
            if (text) sectionText += text + "\n";
            next = next.nextElementSibling;
          }
          if (sectionText) sections.push(sectionText.slice(0, 500));
        }
      } else {
        // No headings — grab body text
        const body = document.body?.textContent?.trim() ?? "";
        sections.push(body.slice(0, 3000));
      }
      return sections.join("\n").slice(0, 8000);
    });

    return { url: finalUrl, title, accessibility, textContent };
  });
}

/**
 * Find all interactive elements on a page — buttons, links, inputs, selects.
 * Returns structured data about each element for AI consumption.
 */
export async function findInteractiveElements(
  url: string,
  filter?: string,
  timeoutMs = 30000,
): Promise<ElementInfo[]> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const elements = await page.evaluate((args: { filterStr?: string; maxElements: number }) => {
      const results: ElementInfo[] = [];
      const selector = "button, a[href], input, select, textarea, [role='button'], [role='link'], [role='menuitem'], [role='tab']";
      const elems = Array.from(document.querySelectorAll(selector));

      for (const el of elems.slice(0, args.maxElements)) {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";
        const tag = el.tagName.toLowerCase();
        const text = (htmlEl.textContent ?? "").trim().slice(0, 100);
        const role = el.getAttribute("role") ??
          (tag === "a" ? "link" : tag === "button" ? "button" : tag === "input" ? "textbox" : tag);
        const name = el.getAttribute("aria-label") ?? el.getAttribute("name") ?? text;
        const href = tag === "a" ? (el as HTMLAnchorElement).href : undefined;
        const type = tag === "input" ? (el as HTMLInputElement).type : undefined;
        const placeholder = tag === "input" || tag === "textarea"
          ? (el as HTMLInputElement).placeholder : undefined;

        if (args.filterStr) {
          const search = args.filterStr.toLowerCase();
          if (!text.toLowerCase().includes(search) && !name.toLowerCase().includes(search) && !role.toLowerCase().includes(search)) continue;
        }

        results.push({ role, name: name.slice(0, 100), tag, type, placeholder, href, text, visible });
      }
      return results;
    }, { filterStr: filter, maxElements: MAX_INTERACTIVE_ELEMENTS });

    return elements;
  });
}

/**
 * Click an element identified by text content, aria-label, or CSS selector.
 * Returns information about the resulting page state after the click.
 */
export async function clickElement(
  url: string,
  selector: string,
  timeoutMs = 30000,
): Promise<ActionResult> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    try {
      // Try multiple selector strategies
      const strategies = [
        () => page.getByText(selector, { exact: false }).first().click({ timeout: 5000 }),
        () => page.getByRole("button", { name: selector }).first().click({ timeout: 5000 }),
        () => page.getByRole("link", { name: selector }).first().click({ timeout: 5000 }),
        () => page.locator(selector).first().click({ timeout: 5000 }),
      ];

      let clicked = false;
      for (const strategy of strategies) {
        try {
          await strategy();
          clicked = true;
          break;
        } catch {
          // try next strategy
        }
      }

      if (!clicked) {
        return {
          success: false,
          url: page.url(),
          title: await page.title(),
          message: `Could not find clickable element matching: "${selector}"`,
        };
      }

      // Wait for navigation/reaction
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      return {
        success: true,
        url: page.url(),
        title: await page.title(),
        message: `Successfully clicked "${selector}". Now on: ${page.url()}`,
      };
    } catch (err) {
      return {
        success: false,
        url: page.url(),
        title: await page.title(),
        message: err instanceof Error ? err.message : "Click failed",
      };
    }
  });
}

/**
 * Fill a form field identified by label, placeholder, name, or CSS selector.
 */
export async function fillField(
  url: string,
  selector: string,
  value: string,
  timeoutMs = 30000,
): Promise<ActionResult> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    try {
      const strategies = [
        () => page.getByLabel(selector).first().fill(value, { timeout: 5000 }),
        () => page.getByPlaceholder(selector).first().fill(value, { timeout: 5000 }),
        () => page.locator(`[name="${selector}"]`).first().fill(value, { timeout: 5000 }),
        () => page.locator(selector).first().fill(value, { timeout: 5000 }),
      ];

      let filled = false;
      for (const strategy of strategies) {
        try {
          await strategy();
          filled = true;
          break;
        } catch {
          // try next strategy
        }
      }

      return {
        success: filled,
        url: page.url(),
        title: await page.title(),
        message: filled
          ? `Filled "${selector}" with value "${value.slice(0, 50)}"`
          : `Could not find field matching: "${selector}"`,
      };
    } catch (err) {
      return {
        success: false,
        url: page.url(),
        title: await page.title(),
        message: err instanceof Error ? err.message : "Fill failed",
      };
    }
  });
}

/**
 * Capture a screenshot of the page and return it as a base64-encoded PNG.
 */
export async function captureScreenshot(
  url: string,
  timeoutMs = 30000,
): Promise<ScreenshotResult> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const title = await page.title();
    const finalUrl = page.url();
    const viewport = page.viewportSize() ?? { width: 1280, height: 800 };

    const buffer = await page.screenshot({ type: "png", fullPage: false });
    const imageBase64 = buffer.toString("base64");

    return {
      url: finalUrl,
      title,
      imageBase64,
      width: viewport.width,
      height: viewport.height,
    };
  });
}

// ─── (No additional helpers needed — accessibility extraction is done inline) ─

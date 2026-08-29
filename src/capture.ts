const WAIT_FOR_TIMEOUT_MILLISECONDS = 15_000;
const WAIT_FOR_POLL_MILLISECONDS = 250;

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface CaptureOptions {
  /** The page to screenshot. */
  readonly url: string;
  /** Where to write the PNG. */
  readonly out: string;
  /** Defaults to 1440×900. */
  readonly viewport?: Viewport;
  /**
   * Entries seeded into the target origin's localStorage before the page
   * loads — the way in for apps that keep their session token there.
   */
  readonly localStorage?: Readonly<Record<string, string>>;
  /** CSS selector to wait for before shooting (15s timeout). */
  readonly waitFor?: string;
  /** CSS selector scrolled into view before shooting. */
  readonly scrollTo?: string;
  /** Milliseconds to let the page settle after load. Defaults to 1500. */
  readonly settleMilliseconds?: number;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForSelector(view: Bun.WebView, selector: string): Promise<void> {
  const deadline = Date.now() + WAIT_FOR_TIMEOUT_MILLISECONDS;
  const probe = `!!document.querySelector(${JSON.stringify(selector)})`;
  while (!(await view.evaluate<boolean>(probe))) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${WAIT_FOR_TIMEOUT_MILLISECONDS}ms waiting for ${selector}`);
    }
    await sleep(WAIT_FOR_POLL_MILLISECONDS);
  }
}

/** Screenshot a page with Bun.WebView and write it to `options.out` as PNG. */
export async function capture(options: CaptureOptions): Promise<void> {
  const viewport = options.viewport ?? { width: 1440, height: 900 };
  await using view = new Bun.WebView(viewport);
  const localStorageEntries = Object.entries(options.localStorage ?? {});
  if (localStorageEntries.length > 0) {
    // localStorage is origin-scoped, so land on the origin (any page, a login
    // redirect is fine) to seed the entries before loading the target.
    await view.navigate(new URL(options.url).origin);
    for (const [key, value] of localStorageEntries) {
      await view.evaluate(
        `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
      );
    }
  }
  await view.navigate(options.url);
  if (options.waitFor !== undefined) {
    await waitForSelector(view, options.waitFor);
  }
  // A fixed delay for fonts, images and entrance animations: dev servers keep
  // an HMR socket open, so there is no network-idle moment to wait for.
  await sleep(options.settleMilliseconds ?? 1500);
  if (options.scrollTo !== undefined) {
    await view.scrollTo(options.scrollTo);
    await sleep(300);
  }
  await Bun.write(options.out, await view.screenshot());
}

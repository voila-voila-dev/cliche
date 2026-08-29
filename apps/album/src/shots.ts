import { publicBaseUrl } from "../../../src/upload.ts";

export interface Shot {
  readonly key: string;
  readonly url: string;
  readonly size: number;
  /** ISO date, from the object key when it carries one, else lastModified. */
  readonly date: string;
}

const KEY_DATE = /(\d{4}-\d{2}-\d{2})/;

function dateOf(key: string, lastModified: string | undefined): string {
  return KEY_DATE.exec(key)?.[1] ?? (lastModified ?? "").slice(0, 10);
}

async function listBucket(baseUrl: string): Promise<Array<Shot>> {
  const client = new Bun.S3Client();
  const shots: Array<Shot> = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.list({
      maxKeys: 1000,
      ...(continuationToken === undefined ? {} : { continuationToken }),
    });
    for (const object of page.contents ?? []) {
      if (!/\.(png|jpe?g|webp|gif)$/i.test(object.key)) continue;
      shots.push({
        key: object.key,
        url: `${baseUrl}/${object.key}`,
        size: object.size ?? 0,
        date: dateOf(object.key, object.lastModified),
      });
    }
    continuationToken = page.isTruncated ? page.nextContinuationToken : undefined;
  } while (continuationToken !== undefined);
  return shots;
}

function demoShot(prefix: string, name: string, date: string, hue: number): Shot {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue} 90% 72%)'/><stop offset='1' stop-color='hsl(${hue + 30} 85% 55%)'/></linearGradient></defs><rect width='640' height='400' fill='url(%23g)'/><rect x='24' y='24' width='250' height='22' rx='11' fill='rgba(255,255,255,0.75)'/><rect x='24' y='58' width='160' height='22' rx='11' fill='rgba(255,255,255,0.55)'/><rect x='24' y='330' width='140' height='40' rx='10' fill='rgba(29,26,20,0.8)'/></svg>`;
  const key = `${prefix}/${date}-${name}-0000cafe.png`;
  return { key, url: `data:image/svg+xml,${svg}`, size: 42_000, date };
}

function demoShots(): Array<Shot> {
  const screens = ["home", "dashboard", "checkout", "settings", "profile"];
  const shots: Array<Shot> = [];
  let hue = 10;
  for (const [index, month] of ["2026-03", "2026-05", "2026-08"].entries()) {
    for (const [day, screen] of screens.entries()) {
      shots.push(demoShot(`pr-${100 + index * 40 + day}`, `${screen}-after`, `${month}-${String(day * 5 + 2).padStart(2, "0")}`, hue));
      hue += 37;
    }
  }
  return shots;
}

/** The bucket's shots, or a generated demo album when nothing is configured. */
export async function listShots(): Promise<{ demo: boolean; shots: Array<Shot> }> {
  try {
    const baseUrl = publicBaseUrl();
    return { demo: false, shots: await listBucket(baseUrl) };
  } catch (error) {
    console.error(
      `No bucket configured (${error instanceof Error ? error.message.split(":")[0] : error}) — serving the demo album. Run \`bunx @voila.dev/cliche setup\` to plug a real one.`,
    );
    return { demo: true, shots: demoShots() };
  }
}

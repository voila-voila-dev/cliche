import index from "./index.html";
import { listShots } from "./shots.ts";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 4949),
  routes: {
    "/": index,
    "/api/shots": async () => Response.json(await listShots()),
  },
});

console.error(`📸 l'album — ${server.url}`);

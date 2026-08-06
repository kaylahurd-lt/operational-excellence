// STATIC TEMPLATE — copy verbatim, do not hand-edit. (operational-excellence)
// The Fastify app: serves the static front-end, mounts the API routes,
// and exposes health endpoints for the k8s probes.
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "./connection.js";
import { registerRoutes } from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

export function buildApp() {
  // removeAdditional:false makes `additionalProperties: false` REJECT unknown
  // fields with a 400 instead of silently stripping them (Fastify's default).
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } },
  });

  // Liveness/readiness for the k8s probes in infra/k8s/deployment.yaml
  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/readyz", async () => ({ status: "ready" }));

  // API routes (generated per-table handlers are registered here)
  app.register(registerRoutes, { prefix: "/api" });

  // Static front-end
  app.register(fastifyStatic, {
    root: join(__dirname, "..", "frontend"),
    prefix: "/",
  });

  return app;
}

// Only listen when run directly (tests import buildApp instead).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate();
  const app = buildApp();
  app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

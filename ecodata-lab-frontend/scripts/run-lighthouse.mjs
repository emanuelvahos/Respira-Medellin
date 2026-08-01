// Audita Lighthouse en modo headless contra un build de producción ya
// levantado localmente. Diseñado para copiarse tal cual a otro proyecto
// Next.js — ver docs/lighthouse-automation.md para qué tocar al portarlo.
//
// Uso: pnpm run lighthouse

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

// ── Específico de este proyecto: cambiar por las rutas del proyecto nuevo ──
const BASE_URL = "http://localhost:3000";
const ROUTES = [
  { label: "Home", path: "/" },
  { label: "Mapa", path: "/mapa" },
  { label: "Dashboard", path: "/dashboard" },
];
const START_COMMAND = "pnpm";
const START_ARGS = ["start"];
// ─────────────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.resolve(import.meta.dirname, "..", "lighthouse-reports");
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_INTERVAL_MS = 500;

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // servidor todavía no acepta conexiones
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
  }
  throw new Error(`El servidor en ${url} no respondió dentro de ${timeoutMs}ms.`);
}

function startServer() {
  const child = spawn(START_COMMAND, START_ARGS, {
    cwd: path.resolve(import.meta.dirname, ".."),
    stdio: "ignore",
    shell: true,
  });
  return child;
}

function killServer(child) {
  if (process.platform === "win32") {
    // spawn con shell:true en Windows crea un proceso hijo de cmd.exe; taskkill
    // con /T mata el árbol completo (incluyendo el `next start` real).
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child.kill("SIGTERM");
  }
}

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

async function auditRoute(chromePort, route) {
  const url = `${BASE_URL}${route.path}`;
  const result = await lighthouse(url, {
    port: chromePort,
    output: ["json", "html"],
    onlyCategories: CATEGORIES,
    logLevel: "error",
  });

  const scores = Object.fromEntries(
    CATEGORIES.map((cat) => [cat, Math.round(result.lhr.categories[cat].score * 100)]),
  );

  const failingAudits = [];
  for (const cat of CATEGORIES) {
    for (const ref of result.lhr.categories[cat].auditRefs) {
      const audit = result.lhr.audits[ref.id];
      if (audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== "notApplicable") {
        failingAudits.push({
          category: cat,
          id: audit.id,
          title: audit.title,
          score: audit.score,
          displayValue: audit.displayValue ?? null,
        });
      }
    }
  }

  return { route, scores, failingAudits, report: result.report };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Levantando "${START_COMMAND} ${START_ARGS.join(" ")}"...`);
  const server = startServer();

  try {
    await waitForServer(BASE_URL, READY_TIMEOUT_MS);
    console.log(`Servidor listo en ${BASE_URL}.`);

    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });

    const results = [];
    try {
      for (const route of ROUTES) {
        console.log(`Auditando ${route.label} (${route.path})...`);
        const result = await auditRoute(chrome.port, route);
        results.push(result);

        const slug = route.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const [json, html] = result.report;
        await writeFile(path.join(OUTPUT_DIR, `${slug}.json`), json);
        await writeFile(path.join(OUTPUT_DIR, `${slug}.html`), html);
      }
    } finally {
      await chrome.kill();
    }

    printSummaryTable(results);
    printFailingAudits(results);
  } finally {
    console.log("Deteniendo el servidor...");
    killServer(server);
  }
}

function printSummaryTable(results) {
  console.log("\n=== Resumen Lighthouse ===");
  console.table(
    Object.fromEntries(
      results.map(({ route, scores }) => [
        route.label,
        {
          Performance: scores.performance,
          Accessibility: scores.accessibility,
          "Best Practices": scores["best-practices"],
          SEO: scores.seo,
        },
      ]),
    ),
  );
}

function printFailingAudits(results) {
  for (const { route, failingAudits } of results) {
    if (failingAudits.length === 0) continue;
    console.log(`\n--- Audits < 90 en ${route.label} (${route.path}) ---`);
    for (const audit of failingAudits) {
      const value = audit.displayValue ? ` [${audit.displayValue}]` : "";
      console.log(`  [${audit.category}] ${audit.title}${value} (score=${audit.score})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

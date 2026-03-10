#!/usr/bin/env bun
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "tests/acceptance";
const dirs = readdirSync(root)
  .filter((name) => statSync(join(root, name)).isDirectory())
  .sort();

console.log(`Running ${dirs.length} acceptance shards in parallel:\n`);
console.log(dirs.map((d) => `  • ${d}`).join("\n"));
console.log();

const started = performance.now();

const results = await Promise.allSettled(
  dirs.map(async (dir) => {
    const start = performance.now();
    const proc = Bun.spawn(
      [
        "bun",
        "test",
        "--concurrent",
        "--timeout=180000",
        join(root, dir) + "/",
      ],
      {
        env: { ...process.env, FORCE_COLOR: "1" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);

    return { dir, exitCode, stdout, stderr, elapsed };
  }),
);

console.log("─".repeat(70));
console.log();

let failed = 0;

for (const result of results) {
  if (result.status === "rejected") {
    failed++;
    console.log(`✗ (spawn error) ${result.reason}`);
    continue;
  }

  const { dir, exitCode, stdout, stderr, elapsed } = result.value;
  const icon = exitCode === 0 ? "✓" : "✗";
  const summary = stdout
    .split("\n")
    .find((l) => l.includes("pass") || l.includes("fail"));

  console.log(`${icon} ${dir.padEnd(30)} ${(elapsed + "s").padStart(8)}  ${summary?.trim() ?? ""}`);

  if (exitCode !== 0) {
    failed++;
    const output = (stdout + stderr).trim();
    if (output) {
      console.log(
        output
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      );
    }
    console.log();
  }
}

const total = ((performance.now() - started) / 1000).toFixed(1);
console.log();
console.log(`─`.repeat(70));
console.log(
  `${failed === 0 ? "✓" : "✗"} ${results.length} shards finished in ${total}s — ${failed} failed`,
);

process.exit(failed > 0 ? 1 : 0);

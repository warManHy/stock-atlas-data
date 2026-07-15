#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const manifestUrl = process.env.SOURCE_MANIFEST_URL ||
  "https://raw.githubusercontent.com/warManHy/stock-atlas-data/main/manifest.json";
const publicBaseUrl = process.env.PUBLIC_BASE_URL ||
  "https://raw.githubusercontent.com/warManHy/stock-atlas-data/main";
const workDir = resolve(".refresh");
const localSource = process.env.SOURCE_CATALOG_PATH;

const currentManifest = await getJson(manifestUrl);
if (currentManifest.schemaVersion !== 3) throw new Error("当前 GitHub 数据不是 schema v3");
if (!currentManifest.datasetUrl.startsWith("https://")) throw new Error("数据地址必须使用 HTTPS");
const currentBytes = localSource ? await readFile(resolve(localSource)) : await getBytes(currentManifest.datasetUrl);
const current = JSON.parse(currentBytes.toString("utf8"));
if (current.schemaVersion !== 3) throw new Error("数据包 schema 与 manifest 不一致");
const currentSha = sha256(currentBytes);
if (!localSource && currentSha !== currentManifest.sha256) throw new Error("远端数据包 SHA-256 校验失败");

const version = nextVersion(currentManifest.dataVersion);
const now = new Date();
current.dataVersion = version;
current.generatedAt = now.toISOString();

await rm(workDir, { recursive: true, force: true });
await mkdir(`${workDir}/input`, { recursive: true });
await writeFile(`${workDir}/input/catalog.json`, JSON.stringify(current));

const packageScript = resolve("tools/package-dataset.mjs");
const child = await import("node:child_process");
const result = child.spawnSync(process.execPath, [packageScript, `${workDir}/input/catalog.json`, publicBaseUrl, `${workDir}/out`], { encoding: "utf8" });
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "数据打包失败");

const outputManifest = JSON.parse(await readFile(`${workDir}/out/manifest.json`, "utf8"));
const outputBytes = await readFile(`${workDir}/out/catalog-v${version}.json`);
console.log(JSON.stringify({
  sourceDataVersion: currentManifest.dataVersion,
  dataVersion: version,
  stockCount: current.stockCount,
  sha256: outputManifest.sha256,
  bytes: outputBytes.length
}));

function nextVersion(previous) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const today = Number(`${values.year}${values.month}${values.day}${values.hour}${values.minute}`);
  return Math.max(today, Number(previous) + 1);
}

async function getJson(url) {
  return JSON.parse((await getBytes(url)).toString("utf8"));
}

async function getBytes(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "StockAtlas-refresh" } });
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

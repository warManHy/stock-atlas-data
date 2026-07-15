#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [input, publicBaseUrl, output = "dist-data"] = process.argv.slice(2);
if (!input || !publicBaseUrl) throw new Error("用法: node tools/package-dataset.mjs <catalog.json> <https://公开目录地址> [输出目录]");
if (!publicBaseUrl.startsWith("https://")) throw new Error("公开目录地址必须使用 HTTPS");
const bytes = readFileSync(input);
const data = JSON.parse(bytes.toString("utf8"));
if (![2, 3].includes(data.schemaVersion)) throw new Error("schemaVersion 必须为 2 或 3");
if (!Number.isSafeInteger(data.dataVersion) || data.dataVersion < 1) throw new Error("dataVersion 必须为正整数");
if (!Array.isArray(data.industries) || data.industries.length === 0) throw new Error("industries 不能为空");
const industryIds = new Set();
const stockCodes = new Set();
let stockCount = 0;
for (const [i, industry] of data.industries.entries()) {
  requireText(industry.id, `industries[${i}].id`); requireText(industry.name, `industries[${i}].name`); requireText(industry.description, `industries[${i}].description`);
  if (industryIds.has(industry.id)) throw new Error(`行业 id 重复：${industry.id}`); industryIds.add(industry.id);
  if (!Array.isArray(industry.stocks)) throw new Error(`${industry.id}.stocks 必须为数组`);
  for (const [j, stock] of industry.stocks.entries()) {
    const at = `${industry.id}.stocks[${j}]`;
    for (const field of ["code", "name", "summary", "mainBusiness"]) requireText(stock[field], `${at}.${field}`);
    if (data.schemaVersion >= 3) requireText(stock.cooperation, `${at}.cooperation`);
    if (!Array.isArray(stock.keywords) || !stock.financial || !stock.behavior || !stock.assessment) throw new Error(`${at} 字段不完整`);
    if (stockCodes.has(stock.code)) throw new Error(`股票代码重复：${stock.code}`); stockCodes.add(stock.code); stockCount++;
  }
}
const outputDir = resolve(output); mkdirSync(outputDir, { recursive: true });
const fileName = `catalog-v${data.dataVersion}.json`; copyFileSync(input, resolve(outputDir, fileName));
const manifest = { schemaVersion: data.schemaVersion, dataVersion: data.dataVersion, datasetUrl: `${publicBaseUrl.replace(/\/$/, "")}/${fileName}`, sha256: createHash("sha256").update(bytes).digest("hex") };
writeFileSync(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`完成：${data.industries.length} 个行业，${stockCount} 只股票`);
function requireText(value, path) { if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} 不能为空`); }

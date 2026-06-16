import { writeFile } from "node:fs/promises";

const SOURCE_URL = "https://wiki.biligame.com/lysk/%E6%80%9D%E5%BF%B5:%E7%AD%9B%E9%80%89";
const OUTPUT_FILE = "cards.js";

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#58;/g, ":")
    .replace(/&colon;/g, ":");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, "")).trim();
}

function readParams(attrs) {
  const params = {};
  const attrPattern = /data-param(\d+)="([^"]*)"/g;
  let match;
  while ((match = attrPattern.exec(attrs))) {
    params[match[1]] = decodeHtml(match[2]);
  }
  return params;
}

function extractImage(body) {
  const match = body.match(/<div class="card-img".*?<img[^>]+src="([^"]+)"/s);
  return match ? decodeHtml(match[1]) : "";
}

function parseCards(html) {
  const cards = [];
  const blockPattern = /<div class="divsort"\s+([^>]*)>(.*?)<div class="card-name">(.*?)<\/div>\s*<\/div>/gs;
  let match;

  while ((match = blockPattern.exec(html))) {
    const params = readParams(match[1]);
    const name = stripTags(match[3]);

    if (!params["1"] || !name) continue;

    cards.push({
      role: params["1"],
      rarity: params["2"] || "",
      color: params["3"] || "",
      type: params["4"] || "",
      talent: params["5"] || "",
      availability: params["6"] || "",
      image: extractImage(match[2]),
      name
    });
  }

  return cards;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 card-checklist-updater"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const cards = parseCards(html);

  if (cards.length < 300) {
    throw new Error(`Parsed only ${cards.length} cards. The wiki markup may have changed.`);
  }

  const js = `window.LYSK_CARDS = ${JSON.stringify(cards)};\nwindow.LYSK_CARDS_SOURCE = ${JSON.stringify({
    url: SOURCE_URL,
    updatedAt: new Date().toISOString(),
    count: cards.length
  })};\n`;

  await writeFile(OUTPUT_FILE, js, "utf8");
  console.log(`Generated ${OUTPUT_FILE} with ${cards.length} cards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

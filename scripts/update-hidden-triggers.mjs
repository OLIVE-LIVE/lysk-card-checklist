const SOURCE_URL = "https://wiki.biligame.com/lysk/%E9%9A%90%E8%97%8F%E8%A7%A6%E5%8F%91?action=raw";

function splitParams(text) {
  return text.split("|").map((part) => part.trim()).filter(Boolean);
}

function cleanWikiText(value) {
  return String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/\{\{拍照物品\|([^{}]+)\}\}/g, (_, body) => {
      const parts = splitParams(body).filter((part) => !part.startsWith("link="));
      const name = parts[1] || parts[0] || "";
      const owner = parts[2] && parts[2] !== "小" ? parts[2] : "";
      return owner ? `${owner}:${name}` : name;
    })
    .replace(/\{\{(?:图标|item)\|([^{}]+)\}\}/g, (_, body) => {
      const parts = splitParams(body).filter((part) => !part.includes("=") && !/^紫|小|中|大$/.test(part));
      return parts[1] || parts[0] || "";
    })
    .replace(/\{\{玩家(?:\|昵称)?\}\}/g, "玩家")
    .replace(/\{\{短信表情\|([^{}]+)\}\}/g, "$1")
    .replace(/\{\{([^{}]+)\}\}/g, (_, body) => {
      const parts = splitParams(body).filter((part) => !part.includes("="));
      return parts[parts.length - 1] || parts[0] || "";
    })
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\/\s*\/\s*/g, " / ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

function splitCells(block) {
  const normalized = String(block || "").replace(/\r/g, "").trim();
  const withoutFirstPipe = normalized.startsWith("|") ? normalized.slice(1) : normalized;
  return withoutFirstPipe.split(/\n\|/).map((cell) => cell.trim()).filter(Boolean);
}

function parseTriggers(raw) {
  const triggers = [];
  const rowPattern = /\{\{隐藏触发\|([^|}]+)\|([^|}]+)\|id=(\d+)\|角色=([^}]+)\}\}([\s\S]*?)(?=\n\{\{隐藏触发\||\n\|\})/g;
  let match;

  while ((match = rowPattern.exec(raw))) {
    const cells = splitCells(match[5]);
    const condition = cleanWikiText(cells[0]);
    const reward = cleanWikiText(cells.slice(1).join(" "));
    if (!condition && !reward) continue;

    triggers.push({
      id: match[3],
      system: cleanWikiText(match[1]).replace("其他", "其它"),
      subtype: cleanWikiText(match[2]),
      role: cleanWikiText(match[4]),
      condition,
      reward
    });
  }

  return triggers;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "lysk-card-checklist-updater/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch hidden triggers: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  const triggers = parseTriggers(raw);
  if (triggers.length < 100) {
    throw new Error(`Parsed only ${triggers.length} hidden triggers; aborting update.`);
  }

  const output = [
    `window.LYSK_HIDDEN_TRIGGERS = ${JSON.stringify(triggers)};`,
    `window.LYSK_HIDDEN_TRIGGERS_SOURCE = ${JSON.stringify({
      url: SOURCE_URL.replace("?action=raw", ""),
      updatedAt: new Date().toISOString(),
      count: triggers.length
    })};`,
    ""
  ].join("\n");

  await import("node:fs/promises").then((fs) => fs.writeFile("hidden-triggers.js", output, "utf8"));
  console.log(`Updated hidden-triggers.js with ${triggers.length} triggers.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

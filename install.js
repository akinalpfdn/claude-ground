#!/usr/bin/env node
// install.js — claude-ground installer
// Works on macOS, Linux, and Windows.
//
// Usage:
//   node install.js                    # interactive mode
//   node install.js go swift           # specify languages directly
//   node install.js --project          # project-scoped install (.claude/rules/)
//   node install.js --project go swift

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// --- Paths ---
const SCRIPT_DIR = __dirname;
const RULES_DIR = process.env.CLAUDE_GROUND_RULES_DIR || path.join(SCRIPT_DIR, "rules");
const TEMPLATES_DIR = process.env.CLAUDE_GROUND_TEMPLATES_DIR || path.join(SCRIPT_DIR, "templates");

// --- Colors (disabled on Windows if no ANSI support) ---
const supportsColor = process.platform !== "win32" || process.env.TERM;
const c = {
  red:    supportsColor ? "\x1b[31m" : "",
  green:  supportsColor ? "\x1b[32m" : "",
  yellow: supportsColor ? "\x1b[33m" : "",
  cyan:   supportsColor ? "\x1b[36m" : "",
  bold:   supportsColor ? "\x1b[1m"  : "",
  reset:  supportsColor ? "\x1b[0m"  : "",
};

const ok  = `  ${c.green}✓${c.reset}`;
const err = `  ${c.red}✗${c.reset}`;
const warn = `  ${c.yellow}!${c.reset}`;
const line = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

// --- Helpers ---
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function exists(p) {
  return fs.existsSync(p);
}

function isDirEmpty(p) {
  return !exists(p) || fs.readdirSync(p).length === 0;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// --- Discover available languages ---
const availableLangs = fs
  .readdirSync(RULES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "common")
  .map((d) => d.name);

// --- Parse args ---
let target = "global";
let args = process.argv.slice(2);

if (args[0] === "--project") {
  target = "project";
  args = args.slice(1);
}

const homeDir = process.env.HOME || process.env.USERPROFILE;
const destDir =
  target === "global"
    ? process.env.CLAUDE_RULES_DIR || path.join(homeDir, ".claude", "rules")
    : path.join(process.cwd(), ".claude", "rules");

// --- Main ---
async function main() {
  let selectedLangs = [];
  let hasUI = false;
  let installTemplates = false;

  if (args.length > 0) {
    // Non-interactive: validate and use args
    for (const lang of args) {
      if (!/^[a-zA-Z0-9_-]+$/.test(lang)) {
        console.error(`${c.red}Error: invalid language name '${lang}'${c.reset}`);
        process.exit(1);
      }
      if (!availableLangs.includes(lang)) {
        console.error(`${c.red}Error: no rules found for '${lang}'${c.reset}`);
        console.error(`Available: ${availableLangs.join(", ")}`);
        process.exit(1);
      }
      selectedLangs.push(lang);
    }
  } else {
    // Interactive mode
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log();
    console.log(`${c.bold}claude-ground installer${c.reset}`);
    console.log(line);
    console.log();

    if (target === "global") {
      console.log(`Target: ${c.cyan}global${c.reset} → ${destDir}`);
      console.log("Active across all projects.");
    } else {
      console.log(`Target: ${c.cyan}project${c.reset} → ${destDir}`);
      console.log("Active in this project only.");
    }

    console.log();
    console.log(`${c.bold}Which languages do you want rules for?${c.reset}`);
    console.log(`${c.yellow}common/ rules are always installed.${c.reset}`);
    console.log();
    console.log('Space-separated list (e.g: go swift typescript)');
    console.log("For all: all");
    console.log();
    console.log("Available languages:");
    for (const lang of availableLangs) console.log(`  • ${lang}`);
    console.log();

    const langInput = await ask(rl, "Selection: ");

    if (langInput.trim() === "all") {
      selectedLangs = [...availableLangs];
    } else {
      selectedLangs = langInput.trim().split(/\s+/).filter(Boolean);
      for (const lang of selectedLangs) {
        if (!availableLangs.includes(lang)) {
          console.error(`${c.red}Error: '${lang}' not found. Available: ${availableLangs.join(", ")}${c.reset}`);
          rl.close();
          process.exit(1);
        }
      }
    }

    const uiAnswer = await ask(rl, "\nDoes this project have a UI? (adds frontend rules) [y/N]: ");
    hasUI = /^y/i.test(uiAnswer.trim());

    const tmplAnswer = await ask(rl, "\nCopy project templates too? (CLAUDE.md, DECISIONS.md, phases/) [y/N]: ");
    installTemplates = /^y/i.test(tmplAnswer.trim());

    rl.close();
  }

  // --- Install ---
  console.log();
  console.log(`${c.bold}Installing...${c.reset}`);
  console.log(line);

  if (exists(destDir) && !isDirEmpty(destDir)) {
    console.log(`${c.yellow}Warning: ${destDir} already exists. Files will be overwritten.${c.reset}`);
  }

  // common/ always installed
  copyDir(path.join(RULES_DIR, "common"), path.join(destDir, "common"));
  console.log(`${ok} common rules → ${destDir}/common/`);

  if (hasUI) {
    console.log(`${ok} frontend rules included (common/frontend.md)`);
  }

  // Selected languages
  for (const lang of selectedLangs) {
    const langDir = path.join(RULES_DIR, lang);
    if (!exists(langDir)) {
      console.log(`${err} No rules for '${lang}', skipping.`);
      continue;
    }
    copyDir(langDir, path.join(destDir, lang));
    console.log(`${ok} ${lang} → ${destDir}/${lang}/`);
  }

  // Templates
  if (installTemplates) {
    console.log();
    const projectDir = process.cwd();
    const claudeDir = path.join(projectDir, ".claude");

    const claudeMdDest = path.join(projectDir, "CLAUDE.md");
    if (exists(claudeMdDest)) {
      console.log(`${warn} CLAUDE.md already exists, skipping. (edit manually)`);
    } else {
      fs.copyFileSync(path.join(TEMPLATES_DIR, "CLAUDE.md"), claudeMdDest);
      console.log(`${ok} CLAUDE.md → project root`);
    }

    const decisionsDest = path.join(projectDir, "DECISIONS.md");
    if (exists(decisionsDest)) {
      console.log(`${warn} DECISIONS.md already exists, skipping.`);
    } else {
      fs.copyFileSync(path.join(TEMPLATES_DIR, "DECISIONS.md"), decisionsDest);
      console.log(`${ok} DECISIONS.md → project root`);
    }

    const phasesDir = path.join(claudeDir, "phases");
    if (exists(phasesDir)) {
      console.log(`${warn} .claude/phases/ already exists, skipping.`);
    } else {
      fs.mkdirSync(phasesDir, { recursive: true });
      fs.copyFileSync(
        path.join(TEMPLATES_DIR, "phases", "PHASE-01.md"),
        path.join(phasesDir, "PHASE-01-active.md")
      );
      console.log(`${ok} .claude/phases/PHASE-01-active.md → project`);
    }
  }

  // Summary
  console.log();
  console.log(line);
  console.log(`${c.green}${c.bold}Done.${c.reset}`);
  console.log();
  console.log(`Rules installed to: ${c.cyan}${destDir}${c.reset}`);
  if (selectedLangs.length > 0) {
    console.log(`Languages: ${c.cyan}${selectedLangs.join(", ")}${c.reset}`);
  }
  console.log();
  console.log("Next steps:");
  console.log("  1. Fill in CLAUDE.md with your project details");
  console.log("  2. Define your first phase in .claude/phases/PHASE-01-active.md");
  console.log("  3. Log your initial stack decision in DECISIONS.md");
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
// install.js — claude-ground installer
// Works on macOS, Linux, and Windows.
//
// Usage:
//   node install.js                       # interactive — pick languages, install rules globally
//   node install.js go swift              # non-interactive — install rules globally
//   node install.js --templates           # project templates only (no rules)
//   node install.js --templates go swift  # install rules globally + project templates

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SCRIPT_DIR = __dirname;
const RULES_DIR = process.env.CLAUDE_GROUND_RULES_DIR || path.join(SCRIPT_DIR, "rules");
const TEMPLATES_DIR = process.env.CLAUDE_GROUND_TEMPLATES_DIR || path.join(SCRIPT_DIR, "templates");

const supportsColor = process.platform !== "win32" || process.env.TERM;
const c = {
  red:    supportsColor ? "\x1b[31m" : "",
  green:  supportsColor ? "\x1b[32m" : "",
  yellow: supportsColor ? "\x1b[33m" : "",
  cyan:   supportsColor ? "\x1b[36m" : "",
  bold:   supportsColor ? "\x1b[1m"  : "",
  reset:  supportsColor ? "\x1b[0m"  : "",
};

const ok   = `  ${c.green}✓${c.reset}`;
const fail = `  ${c.red}✗${c.reset}`;
const warn = `  ${c.yellow}!${c.reset}`;
const line = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function exists(p) { return fs.existsSync(p); }
function isDirEmpty(p) { return !exists(p) || fs.readdirSync(p).length === 0; }
function ask(rl, q) { return new Promise((res) => rl.question(q, res)); }

const availableLangs = fs
  .readdirSync(RULES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "common")
  .map((d) => d.name);

let withTemplates = false;
let args = process.argv.slice(2);
if (args[0] === "--templates") {
  withTemplates = true;
  args = args.slice(1);
}

const homeDir = process.env.HOME || process.env.USERPROFILE;
const globalDest = process.env.CLAUDE_RULES_DIR || path.join(homeDir, ".claude", "rules");

// --templates without language args = templates only, no rules
const installRules = !withTemplates || args.length > 0;

async function main() {
  let selectedLangs = [];
  let hasUI = false;

  // --- Language selection (only when installing rules) ---
  if (installRules) {
    if (args.length > 0) {
      // Non-interactive: validate args
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
      // Interactive: ask for languages
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      console.log();
      console.log(`${c.bold}claude-ground installer${c.reset}`);
      console.log(line);
      console.log(`Target: ${c.cyan}global${c.reset} → ${globalDest}`);
      console.log("Active across all projects.");
      console.log();
      console.log(`${c.bold}Which languages do you want rules for?${c.reset}`);
      console.log(`${c.yellow}common/ rules are always installed.${c.reset}`);
      console.log();
      console.log("Space-separated (e.g: go swift typescript) — or: all");
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

      if (!withTemplates) {
        const tmplAns = await ask(rl, "\nSet up project templates too? (CLAUDE.md, DECISIONS.md, phases/) [y/N]: ");
        withTemplates = /^y/i.test(tmplAns.trim());
      }

      rl.close();
    }
  }

  // --- Install rules ---
  if (installRules) {
    console.log();
    console.log(`${c.bold}Installing rules...${c.reset}`);
    console.log(line);

    if (exists(globalDest) && !isDirEmpty(globalDest)) {
      console.log(`${c.yellow}Warning: ${globalDest} already exists. Files will be overwritten.${c.reset}`);
    }

    copyDir(path.join(RULES_DIR, "common"), path.join(globalDest, "common"));
    console.log(`${ok} common → ${globalDest}/common/`);

    for (const lang of selectedLangs) {
      const langDir = path.join(RULES_DIR, lang);
      if (!exists(langDir)) { console.log(`${fail} No rules for '${lang}', skipping.`); continue; }
      copyDir(langDir, path.join(globalDest, lang));
      console.log(`${ok} ${lang} → ${globalDest}/${lang}/`);
    }
  }

  // --- Templates ---
  if (withTemplates) {
    // Ask UI question for CLAUDE.md configuration
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const uiAns = await ask(rl, "\nDoes this project have a UI? (uncomments frontend rules in CLAUDE.md) [y/N]: ");
    hasUI = /^y/i.test(uiAns.trim());
    rl.close();

    console.log();
    console.log(`${c.bold}Setting up project templates...${c.reset}`);
    console.log(line);

    const projectDir = process.cwd();
    const claudeDir = path.join(projectDir, ".claude");
    const claudeMdDest = path.join(projectDir, "CLAUDE.md");
    const decisionsDest = path.join(projectDir, "DECISIONS.md");
    const phasesDir = path.join(claudeDir, "phases");

    if (exists(claudeMdDest)) {
      const refs = [
        "@rules/common/core.md",
        "@rules/common/decisions.md",
        "@rules/common/git.md",
        "@rules/common/testing.md",
        "@rules/common/debug.md",
        "@rules/common/existing-code.md",
      ];
      if (hasUI) refs.push("@rules/common/frontend.md");
      for (const lang of selectedLangs) refs.push(`@rules/${lang}/${lang}.md`);

      console.log(`${warn} CLAUDE.md already exists. Add these lines to activate claude-ground:`);
      console.log();
      for (const ref of refs) console.log(`      ${c.cyan}${ref}${c.reset}`);
      console.log();
    } else {
      // Copy template and optionally uncomment frontend line
      let claudeMd = fs.readFileSync(path.join(TEMPLATES_DIR, "CLAUDE.md"), "utf8");
      if (hasUI) {
        claudeMd = claudeMd.replace("<!-- @rules/common/frontend.md -->", "@rules/common/frontend.md");
      }
      fs.writeFileSync(claudeMdDest, claudeMd);
      console.log(`${ok} CLAUDE.md → project root${hasUI ? " (frontend rules enabled)" : ""}`);
    }

    if (exists(decisionsDest)) {
      console.log(`${warn} DECISIONS.md already exists, skipping.`);
    } else {
      fs.copyFileSync(path.join(TEMPLATES_DIR, "DECISIONS.md"), decisionsDest);
      console.log(`${ok} DECISIONS.md → project root`);
    }

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

  // --- Summary ---
  console.log();
  console.log(line);
  console.log(`${c.green}${c.bold}Done.${c.reset}`);
  console.log();
  if (installRules) {
    console.log(`Rules installed to: ${c.cyan}${globalDest}${c.reset}`);
    if (selectedLangs.length > 0) console.log(`Languages: ${c.cyan}${selectedLangs.join(", ")}${c.reset}`);
  }
  console.log();
  console.log("Next steps:");
  if (withTemplates) {
    console.log("  1. Fill in CLAUDE.md with your project details");
    console.log("  2. Define your first phase in .claude/phases/PHASE-01-active.md");
    console.log("  3. Log your initial stack decision in DECISIONS.md");
  } else {
    console.log("  Run with --templates from your project directory to set up CLAUDE.md and phases.");
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });

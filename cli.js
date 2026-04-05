#!/usr/bin/env node
// cli.js — claude-ground CLI
// Works on macOS, Linux, and Windows.
//
// Usage:
//   claudeground                           # interactive — pick languages + skills, install globally
//   claudeground install                   # same as above
//   claudeground install go swift          # non-interactive — install rules globally
//   claudeground init                      # interactive — set up project (CLAUDE.md, phases, skills)
//   claudeground init go swift             # non-interactive — set up project for specific languages
//   claudeground update                    # re-install rules + skills using saved preferences

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SCRIPT_DIR = __dirname;
const RULES_DIR = process.env.CLAUDE_GROUND_RULES_DIR || path.join(SCRIPT_DIR, "rules");
const COMMANDS_DIR = process.env.CLAUDE_GROUND_COMMANDS_DIR || path.join(SCRIPT_DIR, "commands");
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

const availableSkills = fs
  .readdirSync(COMMANDS_DIR, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".md"))
  .map((f) => f.name.replace(/\.md$/, ""));

const homeDir = process.env.HOME || process.env.USERPROFILE;
const globalRulesDest = process.env.CLAUDE_RULES_DIR || path.join(homeDir, ".claude", "rules");
const configPath = path.join(homeDir, ".claude", ".claude-ground.json");

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); }
  catch { return null; }
}

function saveConfig(languages, skills) {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ languages, skills }, null, 2) + "\n");
}

// --- Parse command ---
const rawArgs = process.argv.slice(2);
const commands = ["install", "init", "update", "help"];
let command = rawArgs[0] && commands.includes(rawArgs[0]) ? rawArgs[0] : null;
let args = command ? rawArgs.slice(1) : rawArgs;

// No command given: default to "install" (interactive)
if (!command && args.length === 0) command = "install";
// Bare language args without command: default to "install" (non-interactive)
if (!command && args.length > 0) command = "install";

function showHelp() {
  console.log();
  console.log(`${c.bold}claude-ground${c.reset} — opinionated rules, skills & templates for Claude Code`);
  console.log();
  console.log("Usage:");
  console.log(`  ${c.cyan}claudeground${c.reset}                           Interactive global install`);
  console.log(`  ${c.cyan}claudeground install${c.reset}                   Same as above`);
  console.log(`  ${c.cyan}claudeground install go swift${c.reset}          Non-interactive — specific languages`);
  console.log(`  ${c.cyan}claudeground init${c.reset}                      Set up current project`);
  console.log(`  ${c.cyan}claudeground init go swift${c.reset}             Set up project for specific languages`);
  console.log(`  ${c.cyan}claudeground update${c.reset}                    Re-install using saved preferences`);
  console.log(`  ${c.cyan}claudeground help${c.reset}                      Show this help`);
  console.log();
  console.log("Commands:");
  console.log(`  ${c.bold}install${c.reset}   Install rules + skills globally (~/.claude/)`);
  console.log(`  ${c.bold}init${c.reset}      Set up project templates (CLAUDE.md, DECISIONS.md, phases, skills)`);
  console.log(`  ${c.bold}update${c.reset}    Re-install rules + skills using saved preferences from last install`);
  console.log(`  ${c.bold}help${c.reset}      Show this help message`);
  console.log();
}

// --- Shared: language selection ---
async function selectLanguages(rl, contextLabel) {
  if (args.length > 0) {
    // Non-interactive: validate args
    const selected = [];
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
      selected.push(lang);
    }
    return selected;
  }

  console.log();
  console.log(`${c.bold}Which languages do you use?${c.reset}`);
  if (contextLabel) console.log(`${c.yellow}${contextLabel}${c.reset}`);
  console.log();
  console.log("Space-separated (e.g: go swift typescript) — or: all / none");
  console.log();
  console.log("Available languages:");
  for (const lang of availableLangs) console.log(`  • ${lang}`);
  console.log();

  const input = await ask(rl, "Selection: ");

  if (input.trim() === "all") return [...availableLangs];
  if (input.trim() === "none" || input.trim() === "") return [];

  const selected = input.trim().split(/\s+/).filter(Boolean);
  for (const lang of selected) {
    if (!availableLangs.includes(lang)) {
      console.error(`${c.red}Error: '${lang}' not found. Available: ${availableLangs.join(", ")}${c.reset}`);
      process.exit(1);
    }
  }
  return selected;
}

// --- Shared: skill selection ---
async function selectSkills(rl) {
  if (availableSkills.length === 0 || args.length > 0) return [];

  console.log();
  console.log(`${c.bold}Which skills (slash commands) do you want?${c.reset}`);
  console.log();
  console.log("Space-separated (e.g: mac-release) — or: all / none");
  console.log();
  console.log("Available skills:");
  for (const skill of availableSkills) console.log(`  • ${skill}`);
  console.log();

  const input = await ask(rl, "Selection: ");

  if (input.trim() === "all") return [...availableSkills];
  if (input.trim() === "none" || input.trim() === "") return [];

  const selected = input.trim().split(/\s+/).filter(Boolean);
  for (const skill of selected) {
    if (!availableSkills.includes(skill)) {
      console.error(`${c.red}Error: '${skill}' not found. Available: ${availableSkills.join(", ")}${c.reset}`);
      process.exit(1);
    }
  }
  return selected;
}

// --- Shared: install skills to a directory ---
function installSkills(selectedSkills, destDir, label) {
  if (selectedSkills.length === 0) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const skill of selectedSkills) {
    const src = path.join(COMMANDS_DIR, `${skill}.md`);
    if (!exists(src)) { console.log(`${fail} No skill '${skill}', skipping.`); continue; }
    fs.copyFileSync(src, path.join(destDir, `${skill}.md`));
    console.log(`${ok} /${skill} → ${label}/${skill}.md`);
  }
}

// =============================================
// COMMAND: install (global)
// =============================================
async function cmdInstall() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log();
  console.log(`${c.bold}claude-ground installer${c.reset}`);
  console.log(line);
  console.log(`Target: ${c.cyan}global${c.reset} → ${globalRulesDest}`);
  console.log("Active across all projects.");

  const selectedLangs = await selectLanguages(rl, "common/ rules are always installed.");
  const selectedSkills = await selectSkills(rl);

  // Ask about project setup
  let doInit = false;
  if (args.length === 0) {
    const ans = await ask(rl, "\nAlso set up current directory as a project? (CLAUDE.md, phases, etc.) [y/N]: ");
    doInit = /^y/i.test(ans.trim());
  }

  rl.close();

  // Install rules
  console.log();
  console.log(`${c.bold}Installing rules...${c.reset}`);
  console.log(line);

  if (exists(globalRulesDest) && !isDirEmpty(globalRulesDest)) {
    console.log(`${c.yellow}Warning: ${globalRulesDest} already exists. Files will be overwritten.${c.reset}`);
  }

  copyDir(path.join(RULES_DIR, "common"), path.join(globalRulesDest, "common"));
  console.log(`${ok} common → ${globalRulesDest}/common/`);

  for (const lang of selectedLangs) {
    const langDir = path.join(RULES_DIR, lang);
    if (!exists(langDir)) { console.log(`${fail} No rules for '${lang}', skipping.`); continue; }
    copyDir(langDir, path.join(globalRulesDest, lang));
    console.log(`${ok} ${lang} → ${globalRulesDest}/${lang}/`);
  }

  // Install skills globally
  installSkills(selectedSkills, path.join(homeDir, ".claude", "commands"), "~/.claude/commands");

  // Save preferences for `claudeground update`
  saveConfig(selectedLangs, selectedSkills);
  console.log(`${ok} Preferences saved to ${configPath}`);

  // Summary
  console.log();
  console.log(line);
  console.log(`${c.green}${c.bold}Done.${c.reset}`);
  console.log();
  console.log(`Rules installed to: ${c.cyan}${globalRulesDest}${c.reset}`);
  if (selectedLangs.length > 0) console.log(`Languages: ${c.cyan}${selectedLangs.join(", ")}${c.reset}`);
  if (selectedSkills.length > 0) console.log(`Skills: ${c.cyan}${selectedSkills.map((s) => "/" + s).join(", ")}${c.reset}`);

  // Chain into init if requested
  if (doInit) {
    console.log();
    await runInit(selectedLangs, selectedSkills);
  } else {
    console.log();
    console.log("Next: run `claudeground init` from your project directory to set up templates.");
    console.log();
  }
}

// =============================================
// COMMAND: init (project setup)
// =============================================
async function runInit(preSelectedLangs, preSelectedSkills) {
  const needsPrompt = !preSelectedLangs;
  let selectedLangs = preSelectedLangs || [];
  let selectedSkills = preSelectedSkills || [];
  let hasUI = false;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (needsPrompt) {
    console.log();
    console.log(`${c.bold}claude-ground — project setup${c.reset}`);
    console.log(line);
    console.log(`Setting up: ${c.cyan}${process.cwd()}${c.reset}`);

    selectedLangs = await selectLanguages(rl);
    selectedSkills = await selectSkills(rl);
  }

  const uiAns = await ask(rl, "\nDoes this project have a UI? (uncomments frontend rules in CLAUDE.md) [y/N]: ");
  hasUI = /^y/i.test(uiAns.trim());
  rl.close();

  console.log();
  console.log(`${c.bold}Setting up project...${c.reset}`);
  console.log(line);

  const projectDir = process.cwd();
  const claudeDir = path.join(projectDir, ".claude");
  const claudeMdDest = path.join(projectDir, "CLAUDE.md");
  const decisionsDest = path.join(projectDir, "DECISIONS.md");
  const phasesDir = path.join(claudeDir, "phases");

  // CLAUDE.md
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
    let claudeMd = fs.readFileSync(path.join(TEMPLATES_DIR, "CLAUDE.md"), "utf8");
    if (hasUI) {
      claudeMd = claudeMd.replace("<!-- @rules/common/frontend.md -->", "@rules/common/frontend.md");
    }
    for (const lang of selectedLangs) {
      claudeMd = claudeMd.replace(`<!-- @rules/${lang}/${lang}.md -->`, `@rules/${lang}/${lang}.md`);
    }
    fs.writeFileSync(claudeMdDest, claudeMd);
    console.log(`${ok} CLAUDE.md → project root${hasUI ? " (frontend enabled)" : ""}`);
    if (selectedLangs.length > 0) console.log(`${ok} Language rules uncommented: ${selectedLangs.join(", ")}`);
  }

  // DECISIONS.md
  if (exists(decisionsDest)) {
    console.log(`${warn} DECISIONS.md already exists, skipping.`);
  } else {
    fs.copyFileSync(path.join(TEMPLATES_DIR, "DECISIONS.md"), decisionsDest);
    console.log(`${ok} DECISIONS.md → project root`);
  }

  // Phases
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

  // Skills locally
  installSkills(selectedSkills, path.join(claudeDir, "commands"), ".claude/commands");

  // Summary
  console.log();
  console.log(line);
  console.log(`${c.green}${c.bold}Project ready.${c.reset}`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Fill in CLAUDE.md with your project details");
  console.log("  2. Define your first phase in .claude/phases/PHASE-01-active.md");
  console.log("  3. Log your initial stack decision in DECISIONS.md");
  console.log();
}

async function cmdInit() {
  await runInit(null, null);
}

// =============================================
// COMMAND: update (re-install from saved config)
// =============================================
async function cmdUpdate() {
  const cfg = loadConfig();
  if (!cfg) {
    console.error(`${c.red}No saved preferences found. Run \`claudeground install\` first.${c.reset}`);
    process.exit(1);
  }

  const { languages = [], skills = [] } = cfg;

  console.log();
  console.log(`${c.bold}claude-ground update${c.reset}`);
  console.log(line);
  console.log(`Languages: ${c.cyan}${languages.length > 0 ? languages.join(", ") : "none"}${c.reset}`);
  console.log(`Skills: ${c.cyan}${skills.length > 0 ? skills.map((s) => "/" + s).join(", ") : "none"}${c.reset}`);

  // Install rules
  console.log();
  console.log(`${c.bold}Updating rules...${c.reset}`);
  console.log(line);

  copyDir(path.join(RULES_DIR, "common"), path.join(globalRulesDest, "common"));
  console.log(`${ok} common → ${globalRulesDest}/common/`);

  for (const lang of languages) {
    const langDir = path.join(RULES_DIR, lang);
    if (!exists(langDir)) {
      console.log(`${warn} '${lang}' no longer available, skipping.`);
      continue;
    }
    copyDir(langDir, path.join(globalRulesDest, lang));
    console.log(`${ok} ${lang} → ${globalRulesDest}/${lang}/`);
  }

  // Install skills
  const globalCmds = path.join(homeDir, ".claude", "commands");
  for (const skill of skills) {
    const src = path.join(COMMANDS_DIR, `${skill}.md`);
    if (!exists(src)) {
      console.log(`${warn} /${skill} no longer available, skipping.`);
      continue;
    }
    fs.mkdirSync(globalCmds, { recursive: true });
    fs.copyFileSync(src, path.join(globalCmds, `${skill}.md`));
    console.log(`${ok} /${skill} → ~/.claude/commands/${skill}.md`);
  }

  console.log();
  console.log(line);
  console.log(`${c.green}${c.bold}Updated.${c.reset}`);
  console.log();
}

// =============================================
// MAIN
// =============================================
async function main() {
  switch (command) {
    case "install": return cmdInstall();
    case "init":    return cmdInit();
    case "update":  return cmdUpdate();
    case "help":    return showHelp();
    default:        return showHelp();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

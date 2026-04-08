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
const { checkbox, confirm } = require("@inquirer/prompts");

// ─── Paths ───────────────────────────────────────────────
const SCRIPT_DIR = __dirname;
const RULES_DIR = process.env.CLAUDE_GROUND_RULES_DIR || path.join(SCRIPT_DIR, "rules");
const COMMANDS_DIR = process.env.CLAUDE_GROUND_COMMANDS_DIR || path.join(SCRIPT_DIR, "commands");
const TEMPLATES_DIR = process.env.CLAUDE_GROUND_TEMPLATES_DIR || path.join(SCRIPT_DIR, "templates");

const homeDir = process.env.HOME || process.env.USERPROFILE;
const globalRulesDest = process.env.CLAUDE_RULES_DIR || path.join(homeDir, ".claude", "rules");
const configPath = path.join(homeDir, ".claude", ".claude-ground.json");

// ─── Theme ───────────────────────────────────────────────
const supportsColor = process.platform !== "win32" || process.env.TERM;
const c = {
  red:    supportsColor ? "\x1b[31m" : "",
  green:  supportsColor ? "\x1b[32m" : "",
  yellow: supportsColor ? "\x1b[33m" : "",
  cyan:   supportsColor ? "\x1b[36m" : "",
  dim:    supportsColor ? "\x1b[2m"  : "",
  bold:   supportsColor ? "\x1b[1m"  : "",
  reset:  supportsColor ? "\x1b[0m"  : "",
};

const ok   = `  ${c.green}✓${c.reset}`;
const fail = `  ${c.red}✗${c.reset}`;
const warn = `  ${c.yellow}!${c.reset}`;

function banner(title, subtitle) {
  console.log();
  console.log(`  ${c.bold}${c.cyan}claude-ground${c.reset} ${c.dim}— ${title}${c.reset}`);
  if (subtitle) console.log(`  ${c.dim}${subtitle}${c.reset}`);
  console.log();
}

function section(title) {
  console.log(`  ${c.bold}${title}${c.reset}`);
}

// ─── Helpers ─────────────────────────────────────────────
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

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); }
  catch { return null; }
}

function saveConfig(languages, skills) {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ languages, skills }, null, 2) + "\n");
}

// ─── Discovery ───────────────────────────────────────────
const availableLangs = fs
  .readdirSync(RULES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "common")
  .map((d) => d.name);

const skillDescriptions = {
  "cg-mac-release":         "macOS app release pipeline (sign, notarize, DMG, GitHub release)",
  "cg-devplan":             "Structured development plans for Claude Code",
  "cg-store-listing":       "ASO-optimized App Store / Google Play metadata",
  "cg-security-hardening":  "OWASP-aligned security hardening guide",
  "cg-indie-deploy":        "Single-VPS deployment (Caddy, systemd, TLS, backups)",
  "cg-indie-observability": "Structured logging, error tracking, uptime monitoring",
  "cg-oss-git-hygiene":     "OSS repo setup (rulesets, signing, templates, triage)",
};

const availableSkills = fs
  .readdirSync(COMMANDS_DIR, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".md"))
  .map((f) => f.name.replace(/\.md$/, ""));

// ─── Parse command ───────────────────────────────────────
const rawArgs = process.argv.slice(2);
const validCommands = ["install", "init", "update", "uninstall", "help"];
let command = rawArgs[0] && validCommands.includes(rawArgs[0]) ? rawArgs[0] : null;
let args = command ? rawArgs.slice(1) : rawArgs;

if (!command && args.length === 0) command = "install";
if (!command && args.length > 0) command = "install";

// ─── Help ────────────────────────────────────────────────
function showHelp() {
  banner("opinionated rules, skills & templates for Claude Code");
  console.log("  Usage:");
  console.log(`    ${c.cyan}claudeground${c.reset}                           Interactive global install`);
  console.log(`    ${c.cyan}claudeground install${c.reset}                   Same as above`);
  console.log(`    ${c.cyan}claudeground install go swift${c.reset}          Non-interactive — specific languages`);
  console.log(`    ${c.cyan}claudeground init${c.reset}                      Set up current project`);
  console.log(`    ${c.cyan}claudeground init go swift${c.reset}             Set up project for specific languages`);
  console.log(`    ${c.cyan}claudeground update${c.reset}                    Re-install using saved preferences`);
  console.log(`    ${c.cyan}claudeground uninstall${c.reset}                 Remove installed rules, skills, and config`);
  console.log(`    ${c.cyan}claudeground help${c.reset}                      Show this help`);
  console.log();
  console.log("  Commands:");
  console.log(`    ${c.bold}install${c.reset}     Install rules + skills globally (~/.claude/)`);
  console.log(`    ${c.bold}init${c.reset}        Set up project (CLAUDE.md, DECISIONS.md, phases, skills)`);
  console.log(`    ${c.bold}update${c.reset}      Re-install using saved preferences`);
  console.log(`    ${c.bold}uninstall${c.reset}   Remove installed rules, skills, and config`);
  console.log(`    ${c.bold}help${c.reset}        Show this help message`);
  console.log();
}

// ─── Prompts ─────────────────────────────────────────────
async function selectLanguages() {
  if (args.length > 0) {
    for (const lang of args) {
      if (!availableLangs.includes(lang)) {
        console.error(`\n  ${c.red}Error: no rules found for '${lang}'${c.reset}`);
        console.error(`  Available: ${availableLangs.join(", ")}\n`);
        process.exit(1);
      }
    }
    return [...args];
  }

  const selected = await checkbox({
    message: `Select languages ${c.dim}(${availableLangs.length} available)${c.reset}`,
    instructions: false,
    pageSize: 10,
    choices: availableLangs.map((lang) => ({
      name: lang,
      value: lang,
    })),
    theme: {
      prefix: "  ",
      style: {
        highlight: (text) => `${c.cyan}${text}${c.reset}`,
      },
    },
  });

  return selected;
}

async function selectSkills() {
  if (availableSkills.length === 0 || args.length > 0) return [];

  const selected = await checkbox({
    message: `Select skills ${c.dim}(${availableSkills.length} available)${c.reset}`,
    instructions: false,
    pageSize: 10,
    choices: availableSkills.map((skill) => ({
      name: `${skill}  ${c.dim}${skillDescriptions[skill] || ""}${c.reset}`,
      value: skill,
    })),
    theme: {
      prefix: "  ",
      style: {
        highlight: (text) => `${c.cyan}${text}${c.reset}`,
      },
    },
  });

  return selected;
}

// ─── Install skills to a directory ───────────────────────
function installSkills(selectedSkills, destDir, label) {
  if (selectedSkills.length === 0) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const skill of selectedSkills) {
    const src = path.join(COMMANDS_DIR, `${skill}.md`);
    if (!exists(src)) { console.log(`${fail} No skill '${skill}', skipping.`); continue; }
    fs.copyFileSync(src, path.join(destDir, `${skill}.md`));
    console.log(`${ok} /${skill} → ${label}/`);
  }
}

// ─── Install rules to a directory ────────────────────────
function installRules(selectedLangs, dest) {
  if (exists(dest) && !isDirEmpty(dest)) {
    console.log(`  ${c.yellow}${dest} exists — files will be overwritten.${c.reset}`);
  }

  copyDir(path.join(RULES_DIR, "common"), path.join(dest, "common"));
  console.log(`${ok} common/`);

  for (const lang of selectedLangs) {
    const langDir = path.join(RULES_DIR, lang);
    if (!exists(langDir)) { console.log(`${fail} ${lang} — not found, skipping.`); continue; }
    copyDir(langDir, path.join(dest, lang));
    console.log(`${ok} ${lang}/`);
  }
}

// ═════════════════════════════════════════════════════════
// COMMAND: install
// ═════════════════════════════════════════════════════════
async function cmdInstall() {
  banner("global install", `Target: ${globalRulesDest}`);

  const selectedLangs = await selectLanguages();
  const selectedSkills = await selectSkills();

  let doInit = false;
  if (args.length === 0) {
    doInit = await confirm({
      message: "Also set up current directory as a project?",
      default: false,
      theme: { prefix: "\n  " },
    });
  }

  // Install
  console.log();
  section("Installing rules...");
  installRules(selectedLangs, globalRulesDest);

  if (selectedSkills.length > 0) {
    console.log();
    section("Installing skills...");
    installSkills(selectedSkills, path.join(homeDir, ".claude", "commands"), "~/.claude/commands");
  }

  saveConfig(selectedLangs, selectedSkills);

  // Summary
  console.log();
  console.log(`  ${c.green}${c.bold}Done.${c.reset}`);
  console.log();
  if (selectedLangs.length > 0) console.log(`  Languages: ${c.cyan}${selectedLangs.join(", ")}${c.reset}`);
  if (selectedSkills.length > 0) console.log(`  Skills:    ${c.cyan}${selectedSkills.map((s) => "/" + s).join(", ")}${c.reset}`);
  console.log(`  Config:    ${c.dim}${configPath}${c.reset}`);

  if (doInit) {
    await runInit(selectedLangs, selectedSkills);
  } else {
    console.log();
    console.log(`  Run ${c.cyan}claudeground init${c.reset} in your project directory to set up templates.`);
    console.log();
  }
}

// ═════════════════════════════════════════════════════════
// COMMAND: init
// ═════════════════════════════════════════════════════════
async function runInit(preSelectedLangs, preSelectedSkills) {
  const needsPrompt = !preSelectedLangs;
  let selectedLangs = preSelectedLangs || [];
  let selectedSkills = preSelectedSkills || [];

  if (needsPrompt) {
    banner("project setup", `Directory: ${process.cwd()}`);
    selectedLangs = await selectLanguages();
    selectedSkills = await selectSkills();
  }

  const hasUI = await confirm({
    message: "Does this project have a UI? (enables frontend rules in CLAUDE.md)",
    default: false,
    theme: { prefix: "\n  " },
  });

  console.log();
  section("Setting up project...");

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
    console.log(`${ok} CLAUDE.md${hasUI ? " (frontend enabled)" : ""}`);
    if (selectedLangs.length > 0) console.log(`${ok} Language rules: ${selectedLangs.join(", ")}`);
  }

  // DECISIONS.md
  if (exists(decisionsDest)) {
    console.log(`${warn} DECISIONS.md already exists, skipping.`);
  } else {
    fs.copyFileSync(path.join(TEMPLATES_DIR, "DECISIONS.md"), decisionsDest);
    console.log(`${ok} DECISIONS.md`);
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
    console.log(`${ok} .claude/phases/PHASE-01-active.md`);
  }

  // Skills locally
  if (selectedSkills.length > 0) {
    installSkills(selectedSkills, path.join(claudeDir, "commands"), ".claude/commands");
  }

  // Summary
  console.log();
  console.log(`  ${c.green}${c.bold}Project ready.${c.reset}`);
  console.log();
  console.log(`  Next steps:`);
  console.log(`    1. Fill in ${c.cyan}CLAUDE.md${c.reset} with your project details`);
  console.log(`    2. Define your first phase in ${c.cyan}.claude/phases/PHASE-01-active.md${c.reset}`);
  console.log(`    3. Log your initial stack decision in ${c.cyan}DECISIONS.md${c.reset}`);
  console.log();
}

async function cmdInit() {
  await runInit(null, null);
}

// ═════════════════════════════════════════════════════════
// COMMAND: update
// ═════════════════════════════════════════════════════════
async function cmdUpdate() {
  const cfg = loadConfig();
  if (!cfg) {
    console.error(`\n  ${c.red}No saved preferences found. Run \`claudeground install\` first.${c.reset}\n`);
    process.exit(1);
  }

  const { languages = [], skills = [] } = cfg;

  banner("update", "Re-installing from saved preferences");

  console.log(`  Languages: ${c.cyan}${languages.length > 0 ? languages.join(", ") : "none"}${c.reset}`);
  console.log(`  Skills:    ${c.cyan}${skills.length > 0 ? skills.map((s) => "/" + s).join(", ") : "none"}${c.reset}`);

  console.log();
  section("Updating rules...");

  copyDir(path.join(RULES_DIR, "common"), path.join(globalRulesDest, "common"));
  console.log(`${ok} common/`);

  for (const lang of languages) {
    const langDir = path.join(RULES_DIR, lang);
    if (!exists(langDir)) {
      console.log(`${warn} ${lang} — no longer available, skipping.`);
      continue;
    }
    copyDir(langDir, path.join(globalRulesDest, lang));
    console.log(`${ok} ${lang}/`);
  }

  if (skills.length > 0) {
    console.log();
    section("Updating skills...");
    const globalCmds = path.join(homeDir, ".claude", "commands");
    for (const skill of skills) {
      const src = path.join(COMMANDS_DIR, `${skill}.md`);
      if (!exists(src)) {
        console.log(`${warn} /${skill} — no longer available, skipping.`);
        continue;
      }
      fs.mkdirSync(globalCmds, { recursive: true });
      fs.copyFileSync(src, path.join(globalCmds, `${skill}.md`));
      console.log(`${ok} /${skill}`);
    }
  }

  console.log();
  console.log(`  ${c.green}${c.bold}Updated.${c.reset}`);
  console.log();
}

// ═════════════════════════════════════════════════════════
// COMMAND: uninstall
// ═════════════════════════════════════════════════════════
async function cmdUninstall() {
  const cfg = loadConfig();

  banner("uninstall", "Select what to remove");

  // Build list of removable items
  const choices = [];

  // Common rules (always installed)
  const commonDir = path.join(globalRulesDest, "common");
  if (exists(commonDir)) {
    choices.push({
      name: `common rules  ${c.dim}(${commonDir})${c.reset}`,
      value: { type: "rule-dir", path: commonDir, label: "common/" },
      checked: true,
    });
  }

  // Language rules
  const installedLangs = cfg?.languages || [];
  for (const lang of installedLangs) {
    const langDir = path.join(globalRulesDest, lang);
    if (exists(langDir)) {
      choices.push({
        name: `${lang} rules  ${c.dim}(${langDir})${c.reset}`,
        value: { type: "rule-dir", path: langDir, label: `${lang}/` },
        checked: true,
      });
    }
  }

  // Also check for language dirs not in config (manually installed or from older version)
  if (exists(globalRulesDest)) {
    for (const entry of fs.readdirSync(globalRulesDest, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "common" && !installedLangs.includes(entry.name)) {
        const langDir = path.join(globalRulesDest, entry.name);
        choices.push({
          name: `${entry.name} rules  ${c.dim}(${langDir})${c.reset}`,
          value: { type: "rule-dir", path: langDir, label: `${entry.name}/` },
          checked: true,
        });
      }
    }
  }

  // Skills
  const globalCmds = path.join(homeDir, ".claude", "commands");
  if (exists(globalCmds)) {
    for (const entry of fs.readdirSync(globalCmds, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.startsWith("cg-") && entry.name.endsWith(".md")) {
        const skillName = entry.name.replace(/\.md$/, "");
        const skillPath = path.join(globalCmds, entry.name);
        choices.push({
          name: `/${skillName}  ${c.dim}(${skillPath})${c.reset}`,
          value: { type: "skill", path: skillPath, label: `/${skillName}` },
          checked: true,
        });
      }
    }
  }

  // Config file
  if (exists(configPath)) {
    choices.push({
      name: `config  ${c.dim}(${configPath})${c.reset}`,
      value: { type: "config", path: configPath, label: "config" },
      checked: true,
    });
  }

  if (choices.length === 0) {
    console.log(`  Nothing to remove — claude-ground is not installed.`);
    console.log();
    return;
  }

  const toRemove = await checkbox({
    message: `Select what to remove ${c.dim}(${choices.length} items)${c.reset}`,
    instructions: false,
    pageSize: 10,
    choices,
    theme: {
      prefix: "  ",
      style: {
        highlight: (text) => `${c.red}${text}${c.reset}`,
      },
    },
  });

  if (toRemove.length === 0) {
    console.log();
    console.log(`  Nothing selected. No changes made.`);
    console.log();
    return;
  }

  const proceed = await confirm({
    message: `Remove ${toRemove.length} item${toRemove.length > 1 ? "s" : ""}?`,
    default: false,
    theme: { prefix: "\n  " },
  });

  if (!proceed) {
    console.log(`\n  Cancelled.\n`);
    return;
  }

  console.log();
  section("Removing...");

  for (const item of toRemove) {
    try {
      if (item.type === "rule-dir") {
        fs.rmSync(item.path, { recursive: true, force: true });
      } else {
        fs.unlinkSync(item.path);
      }
      console.log(`${ok} ${item.label}`);
    } catch (err) {
      console.log(`${fail} ${item.label} — ${err.message}`);
    }
  }

  // Clean up empty rules dir
  if (exists(globalRulesDest) && isDirEmpty(globalRulesDest)) {
    fs.rmSync(globalRulesDest, { recursive: true, force: true });
    console.log(`${ok} ${globalRulesDest} (empty, removed)`);
  }

  console.log();
  console.log(`  ${c.green}${c.bold}Done.${c.reset}`);
  console.log();
  console.log(`  To fully remove the CLI: ${c.cyan}npm uninstall -g claude-ground${c.reset}`);
  console.log();
}

// ═════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════
async function main() {
  switch (command) {
    case "install":   return cmdInstall();
    case "init":      return cmdInit();
    case "update":    return cmdUpdate();
    case "uninstall": return cmdUninstall();
    case "help":      return showHelp();
    default:          return showHelp();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

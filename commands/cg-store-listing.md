---
name: cg-store-listing
description: Generate App Store, Mac App Store, and Google Play Store listing metadata for apps. Use this skill whenever the user wants to create or optimize store listings, app descriptions, keywords, subtitles, short descriptions, category suggestions, or localized metadata for any app store. Trigger on phrases like "write my App Store description", "Play Store listing", "store metadata", "ASO", "app keywords", "app subtitle", "prepare my app for the store", "localize my listing", or when the user is preparing to submit an app to any store. Also trigger when the user asks to improve or optimize an existing store listing.
---

# Store Listing Skill

Generate complete, ASO-optimized store listing metadata for Apple App Store (iOS), Mac App Store, and Google Play Store. The output is a structured metadata file ready to copy into App Store Connect or Google Play Console.

## Input sources

Before asking the user to describe their app from scratch, check if the project already contains useful context:

1. **DEVPLAN.md** — If present, extract: app name, overview, feature list, target platform, and target audience. This is the richest source.
2. **README.md** — If present, extract: app description, feature list, tech stack (useful for developer-facing tools), and screenshots descriptions.
3. **Neither exists** — Ask the user for a brief description (3-5 sentences about what the app does, who it's for, and what makes it different).

Always confirm extracted information with the user before generating. A quick "I found this in your DEVPLAN — does this capture it?" is enough.

## Workflow

### Step 1: Gather context

From DEVPLAN/README or user input, identify:
- App name
- What it does (core value proposition)
- Target audience
- Key features (top 3-5)
- What makes it different from alternatives
- Target store(s): Apple App Store, Mac App Store, Google Play, or multiple

### Step 2: Ask what's missing

Only ask questions the source material doesn't answer:

- **Tone**: Professional/serious, friendly/approachable, playful/fun, minimal/understated? This shapes all copy.
- **Competitor landscape**: Any specific apps this competes with? Helps avoid overlapping keywords and find differentiation angles.
- **Localization languages**: Which languages beyond the primary? (Suggest EN + user's native language as a minimum if the app is localized.)
- **Pricing model**: Free, paid upfront, freemium, subscription? Affects how the description frames value.

Do NOT ask about:
- Features already listed in DEVPLAN/README
- Technical implementation details
- Screenshot content (out of scope for this skill)

### Step 3: Generate metadata

Produce a single markdown file with all store metadata, organized by store. Structure below.

---

## Character limits — the hard rules

These limits are enforced by the stores. Every piece of generated metadata must respect them. Count characters carefully including spaces.

### Apple App Store (iOS & Mac App Store)
| Field | Limit | Indexed for search | Visible to users |
|-------|-------|--------------------|------------------|
| App Name | 30 chars | Yes | Yes |
| Subtitle | 30 chars | Yes | Yes |
| Keyword Field | 100 chars | Yes | No |
| Promotional Text | 170 chars | No | Yes |
| Description | 4000 chars | No | Yes |

**Apple-specific rules:**
- Keywords: comma-separated, no spaces after commas, no duplicates from title/subtitle (Apple already indexes those)
- Subtitle: must form a readable phrase, not a keyword list — Apple rejects keyword stuffing
- Don't repeat words across title + subtitle + keywords — each word only needs to appear once across all three fields to be indexed
- Singular/plural: Apple indexes both forms in most languages, so don't waste keyword space on both
- The last word of a 30-char subtitle may not get indexed — keep critical keywords earlier
- Promotional text can be updated without a new app version — use this for seasonal messaging, announcements, and freshness signals
- Description can only be updated with a new version submission

### Google Play Store
| Field | Limit | Indexed for search | Visible to users |
|-------|-------|--------------------|------------------|
| App Title | 30 chars | Yes | Yes |
| Short Description | 80 chars | Yes | Yes |
| Full Description | 4000 chars | Yes | Yes |

**Google Play-specific rules:**
- No dedicated keyword field — Google extracts keywords from title, short description, and full description
- Full description IS indexed (unlike Apple) — this is where keyword strategy lives
- Natural keyword placement in descriptions — Google penalizes stuffing
- Repeat primary keyword 3-5 times naturally across the full description — but never awkwardly
- Don't use: "free", "best", "#1", "top", "download now", promotional claims, emoji/emoticons in title
- No ALL CAPS unless it's the brand name
- Short description: treat as an elevator pitch, not a keyword dump — it appears in search results
- **Custom Store Listings**: Google Play allows different metadata per country — suggest this for apps targeting multiple regions
- **A/B testing**: Google Play Console supports native A/B testing for descriptions, icons, and screenshots — recommend the user test variations

### Mac App Store
Same limits as iOS App Store. Key differences:
- Users are on desktop — description should emphasize productivity, workflow integration, keyboard shortcuts, and how the app fits into a desktop workflow
- Mac users expect more detail about system requirements, compatibility, and Apple Silicon support
- Menu bar / utility apps should clearly state they live in the menu bar and describe what's accessible without opening a full window
- Mac users are more willing to pay upfront — frame the value proposition around professional use and time saved
- Mention Spotlight, Shortcuts, or Widgets integration if applicable — these are differentiators Mac users actively search for
- Developer Tools category is less competitive on Mac — if the app fits, prefer it over Utilities

## The first 3 lines rule

On both Apple and Google, users see only the first 1-3 lines of the description before tapping "Read More." Most users never tap it.

**These lines determine conversion.** They must:
1. State what the app does in one concrete sentence (not a tagline)
2. Name who it's for or what problem it solves
3. Give one specific reason to keep reading

**Bad first line:** "Welcome to AppName, the ultimate productivity solution designed to enhance your workflow."
**Good first line:** "AppName turns any screenshot into a clean, shareable image in two clicks — no design skills needed."

## Writing principles

**Always show character counts.** After each field, show `(X/Y chars)` so the developer can verify limits at a glance. This is non-negotiable — store rejections from exceeding limits waste days.

**Lead with the value, not the feature.** "Encrypt your notes with one hotkey" is better than "AES-256-GCM encrypted note manager." Users care about what it does for them first.

**Keyword strategy is distribution, not repetition.** In Apple: a word only needs to appear once across title + subtitle + keywords to be indexed. Don't waste space repeating. In Google: spread keywords naturally across title, short description, and full description.

**Localization is adaptation, not translation.** When generating localized metadata:
- Research how users in that locale search for this type of app (search terms differ by culture)
- Adapt the value proposition to local context
- Keyword fields should contain locale-appropriate terms, not translated English keywords
- Character limits apply per-locale — some languages are more verbose than others

**Match the tone to the app.** A cute puzzle game and a security tool need completely different copy. Infer tone from the app's nature, or ask if ambiguous.

**Description structure that converts:**
1. Opening hook — one sentence, what does this app do for me? (This is the "before Read More" line)
2. Key differentiator — why this over alternatives?
3. Feature highlights — top 3-5, benefit-oriented (not feature-oriented)
4. Social proof / credibility — if available (awards, user count, reviews)
5. Call to action — only if natural (avoid "Download now!")

## Anti-patterns: what NOT to write

AI-generated app descriptions have recognizable patterns that erode trust. Avoid all of these:

**Superlative stacking** — Never pile adjectives: "revolutionary, cutting-edge, seamless, powerful experience." Pick one honest adjective or use none.

**Generic benefit claims** — "Designed to enhance your productivity" says nothing. Replace with a specific claim: "Saves 20 minutes per day by auto-sorting your clipboard."

**Passive voice and hedging** — "Is designed to help you manage" → "Manages your". Second person, present tense, active voice. Always.

**Feature lists without context** — Don't list "Cloud sync, Dark mode, Widgets" as bullets. Explain why each matters: "Cloud sync — pick up exactly where you left off on any device."

**Marketing filler** — Delete these on sight: "Whether you're a...", "Say goodbye to...", "Take your X to the next level", "Unleash the power of", "Experience the future of". These are the fingerprint of AI-generated copy.

**Exclamation marks** — One per entire description maximum. Zero is better. Excitement should come from what the app does, not punctuation.

**The "everything for everyone" trap** — Don't try to appeal to every user segment. A listing that speaks directly to one audience converts better than one that vaguely addresses three.

**Self-test:** Read the description aloud. If it sounds like a press release or a LinkedIn post, rewrite it. If you can swap in any other app's name and the description still makes sense, it's too generic.

## Keyword strategy — depth guide

### Apple: the 100-character field

This is the most valuable real estate in ASO. Every character matters.

- **Don't repeat** any word already in the app name or subtitle — Apple indexes them automatically
- **No spaces after commas** — `clipboard,manager,paste,history` not `clipboard, manager, paste, history`
- **Singular only** — Apple indexes both forms; "clip" covers "clips"
- **Target long-tail keywords** — indie apps can't compete on "photo editor" but can rank for "batch photo resize"
- **Difficulty scoring** — if you have access to ASO tools (AppTweak, Sensor Tower), target keywords with difficulty < 40 for new apps
- **Iterate every 4-6 weeks** — review keyword performance after each update, swap underperformers
- Use competitor names only if legally safe and contextually relevant (e.g., "alternative" as a keyword)

### Google: description as keyword field

- Primary keyword in title (once), short description (once), full description (3-5 times naturally)
- Google also indexes user reviews — encourage reviews that naturally mention your key features
- Avoid keyword stuffing — Google's algorithm penalizes density above natural language patterns
- **Promotional Content** and **In-App Events** (Apple equivalent: also called In-App Events) provide additional indexable text that appears in search results — use them

### Both stores

- **Update frequency matters** — apps updated within the last 30 days rank higher on both stores. Even small updates help. Time metadata refreshes with version updates.
- **Privacy nutrition labels** (Apple) are now a ranking signal — incomplete labels suppress visibility. Ensure they're filled out completely.

## Localization priorities

If the user asks "which languages should I localize to?", recommend based on ROI for indie apps:

| Priority | Language | Why |
|----------|----------|-----|
| 1 | Japanese | High willingness to pay, low competition for English-origin apps |
| 2 | Korean | Same pattern as Japanese, growing market |
| 3 | German | Largest European market, strong app spending |
| 4 | French | Second largest European market |
| 5 | Brazilian Portuguese | Massive market, underserved by localized indie apps |
| 6 | Spanish | Covers Spain + Latin America |

**Key insight:** Localizing metadata alone (without localizing the app itself) can increase downloads 20-30% in non-English markets. This is low effort, high impact — even machine translation for keyword fields is acceptable since users don't see them. But titles, subtitles, and descriptions should be culturally adapted, not machine-translated.

## Category recommendations

When suggesting categories, consider:
- Primary category should match the app's core function (this affects which charts it appears in)
- Secondary category can be strategic — less competitive categories give better chart placement
- Don't pick overly broad categories where the app will drown (e.g., "Utilities" for everything)
- **Check competitor density before recommending** — a smaller category with less competition often outperforms the "correct" category

Common indie app category mappings:
- Menu bar tools / system utilities → Developer Tools or Utilities
- Note-taking / organization → Productivity
- Clipboard managers → Utilities or Productivity
- Games → match the genre specifically (Puzzle, Strategy, Action, etc.)
- Health/fitness → Health & Fitness (but review guidelines are strict here)
- Developer-facing tools → Developer Tools (less competitive, especially on Mac)

## Avoid these common rejection triggers

- Price references in description ("only $4.99") — prices vary by region
- "Best", "#1", "top-rated" — unverifiable claims
- Mentioning competing apps by name in description (keywords are sometimes OK)
- Referencing other platforms ("also available on Android") in an iOS listing
- Using trademarked terms as keywords
- Incomplete privacy nutrition labels
- Emoji in app titles (Google rejects, Apple may reject)

## Output

Save the metadata as `STORE-LISTING.md` in the project root (or wherever the user specifies). The file should be ready to copy field-by-field into App Store Connect or Google Play Console.

## Output structure

```markdown
# [App Name] — Store Listing Metadata

## Apple App Store (iOS)

### App Name
[name — 30 chars max, show character count]

### Subtitle
[subtitle — 30 chars max, show character count]

### Keywords
[comma-separated,no-spaces,after-commas — 100 chars max, show character count]

### Promotional Text
[promotional text — 170 chars max, show character count]

### Description
[full description — 4000 chars max, show character count]

### Category
Primary: [category]
Secondary: [category]

---

## Mac App Store

(Same structure as above, tailored for desktop audience.
Emphasize: workflow integration, keyboard shortcuts, menu bar behavior,
system requirements, Apple Silicon support.)

---

## Google Play Store

### App Title
[title — 30 chars max, show character count]

### Short Description
[short description — 80 chars max, show character count]

### Full Description
[full description — 4000 chars max, show character count]

### Category
[category]

---

## Localized: [Language Name]

(Repeat the full structure above for each requested language.
NOT machine-translated — culturally adapted. Keywords should reflect
how users in that locale actually search, not direct translations.
Titles and descriptions: human-quality adaptation.
Keyword fields only: machine translation acceptable.)
```

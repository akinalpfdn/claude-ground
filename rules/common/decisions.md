# Decision Logging Rules

Every project gets a `DECISIONS.md` in its root. This file is created at project start, not when the first decision is made.

---

## What Gets Logged

Log any decision where the reasoning might be questioned later:

- Why this language / framework / library
- Why this architecture (monolith vs microservice, REST vs GraphQL, etc.)
- Why this data model
- Why a library was rejected
- Why a simpler approach was chosen over a more correct one
- Any decision made under time pressure or uncertainty

## What Does NOT Get Logged

- Implementation details (how to write a function)
- Decisions with only one reasonable option
- Stylistic choices already covered by rules

---

## Format

```markdown
# Decisions

## YYYY-MM-DD — [Short Title]
**Chosen:** [What was decided]  
**Alternatives:** [What else was considered]  
**Why:** [Full reasoning — be specific, not generic]  
**Trade-offs:** [What is lost or risked with this choice]  
**Revisit if:** [Condition under which this should be reconsidered]

---
```

---

## Rules

- Log the decision at the time it's made, not retroactively.
- "It's the most popular option" is not a reason. Be specific.
- If the user made the call, log it as "User decision:" so the context is clear.
- Decisions are append-only. Do not edit past entries — add a new entry if something changes.

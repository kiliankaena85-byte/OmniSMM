---
name: skill-governance-policy
version: 1.0.0
owner: team-platform-ops
tier: tier-2
security_review_required: true
description: |
  Enforces enterprise and team governance rules for creating, modifying, 
  and publishing Antigravity skills. Validates skill ownership, security 
  constraints, mandatory health checks, and changelog requirements before 
  a skill can be merged into a shared team repository. 
  Use when the user asks to "publish this skill", "prepare skill for PR", 
  "submit this skill to the team", or "audit skill compliance".
---

# Skill Governance Policy 🏢

In a team setting, an agent's skills define its authorized behavior. A poorly 
written or malicious skill in a shared `.agent/skills/` directory affects 
every developer on the team. 

This skill acts as the **Gatekeeper**. Before any skill is allowed to leave a 
developer's local machine and enter the team's shared repository, it must pass 
strict governance policies: ownership, health scores, version control, and 
security scans.

## The Governance Model

A production-ready team skill must have:
1. **Clear Ownership:** A `CODEOWNERS` equivalent in the frontmatter (`owner:`).
2. **High Quality:** A minimum `skill-health-checker` grade of B (80+).
3. **Traceability:** Proper semantic versioning and a `CHANGELOG.md`.
4. **Safety:** A recorded `dry-run-skill-tester` execution report.

---

## When to activate

Activate this skill **as a pre-hook and post-hook** in the following situations:

| Trigger | Action |
|---|---|
| User asks to "publish the `deploy-helper` skill" | Run the policy enforcer and prepare PR |
| User asks "Is this skill ready for the team repo?" | Run compliance audit |
| User asks to "create a pull request for my new skill" | Generate a compliant Skill PR |

---

## Step-by-step execution protocol

### Step 1 — Run the Policy Enforcer

Before helping the user publish or share a skill, you must evaluate it 
against the team's governance rules.

```bash
python {{SKILL_PATH}}/scripts/policy_enforcer.py audit \
  --skill-dir "<path_to_target_skill>"
```

The enforcer checks for:
- `owner` and `tier` fields in the `SKILL.md` frontmatter.
- Presence of a `.versions/CHANGELOG.md`.
- Restricted patterns in `scripts/` (e.g., `sudo`, unauthorized network calls).

### Step 2 — Handle Audit Failures

If `policy_enforcer.py` exits with code `1` (Failure), **HALT the publishing process**.
1. Present the compliance failures to the user.
2. Instruct the user on how to fix them (e.g., "You need to add an `owner:` field to your frontmatter", or "Run `skill-health-checker` and fix the CRITICAL errors").
3. Do not proceed to Step 3 until the audit passes.

### Step 3 — Ensure Prerequisites are Met

If the audit passes, verify via conversation or workspace history that the 
following external checks were performed:
- Did they run `secret-leak-guard`?
- Did they run `dry-run-skill-tester` to prove the skill is safe?

If not, strongly recommend they do so before proceeding.

### Step 4 — Generate the Skill Pull Request

To submit the skill to the shared team repository, generate a standardized 
Skill PR markdown file. This ensures human reviewers have all the context 
they need.

```bash
python {{SKILL_PATH}}/scripts/generate_skill_pr.py \
  --skill-dir "<path_to_target_skill>" \
  --pr-type "NEW_SKILL" # or "UPDATE", "DEPRECATION"
```

### Step 5 — Commit and Branch (Optional)

If the user requested you to open the PR, and you have `git` access:
1. Create a new branch: `git checkout -b skill-update-<skill-name>`
2. Stage the skill: `git add .agent/skills/<skill-name>`
3. Commit with a conventional message: `feat(skills): add <skill-name> (v1.0.0)`
4. Present the generated PR description to the user to copy/paste into GitHub/GitLab.

---

## Enterprise Frontmatter Extensions

This skill requires developers to use extended frontmatter fields in their `SKILL.md`:

```yaml
---
name: k8s-pod-restart
version: 1.1.0
owner: team-platform-ops       # REQUIRED: GitHub team or email
tier: tier-2                   # REQUIRED: tier-1 (core), tier-2 (team), tier-3 (experimental)
security_review_required: true # Triggers manual human review flag
description: |
  Restarts a Kubernetes pod and tails logs.
---
```

---

## Scope boundaries

This skill manages **compliance and publishing workflows**. It does NOT:
- Auto-approve PRs in GitHub/GitLab (requires human review).
- Actually replace the `skill-health-checker` (it merely verifies that health standards are conceptually met or enforced via scripts).
- Restrict local experimentation (developers are permitted to experiment locally; governance only applies when *publishing*).

---

## Error handling

If the `policy_enforcer.py` or `generate_skill_pr.py` scripts encounter execution issues (e.g. permission access errors when scanning directories or write errors when generating reports):
1. **Never block the user's workflow:** If a local test fails solely due to file system permission bugs, allow local development to continue.
2. **Warn clearly:** Output a clear error message `[Warning: Governance compliance check failed]` and state the exact check that failed.
3. **Log the failure:** Log the failure outcome using `skill-activation-logger` and inform the user.

---

## References
- `{{SKILL_PATH}}/scripts/policy_enforcer.py` — The static compliance scanner.
- `{{SKILL_PATH}}/scripts/generate_skill_pr.py` — PR template generator.

---
name: flaky-test-detective
version: 1.0.0
description: |
  Statically detects flaky, unreliable, and non-deterministic tests.
  Identifies root causes of intermittent failures: time dependencies, unseeded
  random data, async race conditions, shared mutable state, network calls,
  filesystem order assumptions, and environment dependencies. Use when tests
  fail intermittently, when CI fails but passes locally, before merging test PRs,
  or when agent-generated tests are unstable.
---

# Flaky Test Detective 🔍

This skill finds tests that **will eventually fail** even when the code
they test is correct.

Flaky tests are not random.  
They fail for specific, detectable structural reasons.  
This skill finds those reasons statically — without running the tests.

---

## Why static detection works

Most flakiness comes from a small set of anti-patterns:

```text
1. Time-based assertions  →  will fail at midnight, DST, or slow CI
2. Random data without seed  →  produces different values each run
3. Race conditions in async  →  depends on scheduling order
4. Shared mutable state  →  tests pollute each other
5. External network calls  →  fail on network hiccup or rate limit
6. Filesystem ordering  →  os.listdir() order is not guaranteed
7. Hardcoded ports  →  fail when port is already in use
8. Process ID / timing assumptions  →  different on every machine
9. Implicit test ordering  →  test B assumes test A ran first
10. Timezone-unaware datetimes  →  fail when server moves timezone
```

These patterns are **identifiable without execution**.  
Static analysis catches them before they waste CI minutes.

---

## Flakiness categories

| Category | Code | Description |
|---|---|---|
| Time dependency | `TIME` | Uses `datetime.now()`, `time.time()`, `Date.now()` without injection |
| Random dependency | `RANDOM` | Uses `random`, `Math.random()`, `uuid4()` without seed |
| Async race | `ASYNC` | Missing `await`, fire-and-forget, unguarded concurrent writes |
| Shared state | `STATE` | Module-level mutable variables mutated across tests |
| External call | `NETWORK` | HTTP/gRPC/DB calls without mock or fixture |
| Order dependency | `ORDER` | Test assumes another test ran before it |
| Filesystem | `FS` | Uses `os.listdir`, temp dir without isolation, hardcoded paths |
| Port / resource | `PORT` | Hardcoded ports, hardcoded PIDs |
| Sleep / poll | `SLEEP` | Uses `time.sleep`, busy-wait, `setTimeout` without backoff |
| Environment | `ENV` | Reads `os.environ` directly without fixture |
| Float precision | `FLOAT` | `assertEqual(a, b)` on float values |
| Unordered comparison | `ORDER_CMP` | `assertEqual` on dict, set, or unordered collection |

---

## Severity levels

| Severity | Meaning |
|---|---|
| `CRITICAL` | Will fail on CI reliably within a few runs |
| `HIGH` | Will fail intermittently; likely caught within a sprint |
| `MEDIUM` | Potential flakiness; depends on environment |
| `LOW` | Smell; unlikely to fail but poor practice |

---

## When to activate this skill

| Trigger | Why |
|---|---|
| Agent writes new tests | Prevent flaky tests from being committed |
| Test fails in CI but passes locally | Static scan may reveal root cause |
| PR modifies test files | Pre-merge flakiness gate |
| CI green rate drops below 95% | Investigate existing test suite |
| Parallel test execution introduced | Shared state issues become more likely |
| New timezone or cloud region added | Time-related tests at risk |
| Test suite migrated to async | Async race categories need scan |
| User says "tests are flaky" | Direct activation |

---

## Step-by-step execution protocol

### Step 1 — Scan one test file

```bash
python {{SKILL_PATH}}/scripts/flaky_detective.py scan \
  --file "tests/test_auth.py"
```

### Step 2 — Scan a directory

```bash
python {{SKILL_PATH}}/scripts/flaky_detective.py scan \
  --dir "tests/"
```

### Step 3 — Scan with minimum severity filter

```bash
python {{SKILL_PATH}}/scripts/flaky_detective.py scan \
  --dir "tests/" \
  --min-severity HIGH
```

### Step 4 — Scan and produce fix suggestions

```bash
python {{SKILL_PATH}}/scripts/flaky_detective.py scan \
  --dir "tests/" \
  --suggest-fixes
```

### Step 5 — Scan specific test name pattern

```bash
python {{SKILL_PATH}}/scripts/flaky_detective.py scan \
  --dir "tests/" \
  --test-pattern "test_auth"
```

### Step 6 — Output as JSON for CI integration

```bash
python {{SKILL_PATH}}/scripts/flaky_detective.py scan \
  --dir "tests/" \
  --json \
  --min-severity MEDIUM
```

---

## Patterns detected — Python examples

### TIME — time dependency

```python
# BAD — will fail if test runs at midnight or during DST
def test_daily_report():
    report = generate_report()
    assert report.date == datetime.now().date()

# GOOD — inject time as dependency
def test_daily_report():
    frozen = date(2026, 5, 22)
    report = generate_report(reference_date=frozen)
    assert report.date == frozen
```

---

### RANDOM — unseeded random data

```python
# BAD — different values every run
def test_token_length():
    token = generate_token()
    random_suffix = random.randint(0, 9999)
    assert len(token) == 32 + len(str(random_suffix))

# GOOD — seed or use fixed values
def test_token_length():
    token = generate_token()
    assert len(token) == 32
```

---

### ASYNC — missing await / race

```python
# BAD — fire and forget, state may not be set
async def test_user_created():
    asyncio.create_task(create_user("alice"))  # not awaited
    user = await get_user("alice")
    assert user is not None

# GOOD — await coroutine directly
async def test_user_created():
    await create_user("alice")
    user = await get_user("alice")
    assert user is not None
```

---

### STATE — shared mutable state

```python
# BAD — module-level list shared across all tests
_cache = []

def test_add_item():
    _cache.append("item")
    assert len(_cache) == 1  # fails if another test ran first

# GOOD — isolate in fixture
@pytest.fixture(autouse=True)
def clear_cache():
    _cache.clear()
    yield
    _cache.clear()
```

---

### NETWORK — external call without mock

```python
# BAD — fails on network hiccup
def test_exchange_rate():
    rate = requests.get("https://api.example.com/rates").json()
    assert rate["USD"] > 0

# GOOD — mock the external call
def test_exchange_rate(requests_mock):
    requests_mock.get("https://api.example.com/rates",
                      json={"USD": 1.08})
    rate = get_exchange_rate()
    assert rate["USD"] == 1.08
```

---

### SLEEP — unreliable wait

```python
# BAD — brittle on slow CI
def test_background_job():
    trigger_job()
    time.sleep(2)
    assert job_completed()

# GOOD — poll with timeout
def test_background_job():
    trigger_job()
    wait_until(job_completed, timeout=10, interval=0.1)
```

---

### FLOAT — float equality

```python
# BAD — floating point precision error
def test_price_calculation():
    assert calculate_price(1.1, 3) == 3.3  # may be 3.3000000000000003

# GOOD — use pytest.approx for precision
def test_price_calculation():
    assert calculate_price(1.1, 3) == pytest.approx(3.3)
```

---

### ORDER_CMP — unordered comparison

```python
# BAD — dict key order not guaranteed in all Python versions
def test_response_keys():
    result = get_response()
    assert list(result.keys()) == ["id", "name", "email"]

# GOOD — compare sets directly
def test_response_keys():
    assert set(result.keys()) == {"id", "name", "email"}
```

---

## Report format

```text
🔍 Flaky Test Detective Report
════════════════════════════════════════════════════
Directory      : tests/
Files scanned  : 24
Tests found    : 187
Flaky findings : 12
════════════════════════════════════════════════════

💀 CRITICAL  [TIME]  tests/test_reports.py
  Test     : test_daily_report
  Line     : 47
  Pattern  : datetime.now() used directly in assertion
  Detail   : `assert report.date == datetime.now().date()`
             Will fail if test crosses midnight during execution
             or runs in a different timezone on CI.
  Fix      : Inject a fixed date or use freezegun.

🔴 HIGH  [NETWORK]  tests/test_pricing.py
  Test     : test_exchange_rate
  Line     : 112
  Pattern  : HTTP call without mock: requests.get(
  Detail   : Live network call to external API.
             Fails on network unavailability or rate limiting.
  Fix      : Use requests_mock or responses library.

🟠 MEDIUM  [STATE]  tests/test_cache.py
  Test     : test_add_item
  Line     : 23
  Pattern  : Module-level mutable variable `_cache` modified in test
  Detail   : `_cache` is shared across all test instances.
             Test passes alone but fails in full suite.
  Fix      : Add autouse fixture to clear `_cache` before/after each test.

🟡 LOW  [FLOAT]  tests/test_math.py
  Test     : test_tax_calculation
  Line     : 88
  Pattern  : assertEqual on float values
  Detail   : `assert calculate_tax(99.99) == 9.999`
             Float precision varies across Python versions and platforms.
  Fix      : Use pytest.approx or round().

════════════════════════════════════════════════════
By severity:   CRITICAL=1  HIGH=1  MEDIUM=1  LOW=1
By category:   TIME=1  NETWORK=1  STATE=1  FLOAT=1
════════════════════════════════════════════════════
```

---

## Fix suggestion format

When `--suggest-fixes` is used, each finding includes a concrete
before/after suggestion:

```text
Fix suggestion for test_daily_report (TIME):

  Before:
    def test_daily_report():
        report = generate_report()
        assert report.date == datetime.now().date()

  After (option 1 — inject date):
    def test_daily_report():
        fixed_date = date(2026, 1, 1)
        report = generate_report(reference_date=fixed_date)
        assert report.date == fixed_date

  After (option 2 — freezegun):
    from freezegun import freeze_time

    @freeze_time("2026-01-01")
    def test_daily_report():
        report = generate_report()
        assert report.date == date(2026, 1, 1)
```

---

## Integration with other skills

| Skill | Integration |
|---|---|
| `technical-debt-annotator` | Annotate unfixed flaky tests as tracked debt |
| `skill-activation-logger` | Log scan events for flakiness trend tracking |
| `dry-run-skill-tester` | Use to test skills that contain test invocations |
| `conflict-resolution-arbitrator` | Flaky tests often hide merge conflicts |
| `workspace-snapshot` | Snapshot before bulk flakiness fixes |

---

## Scope boundaries

This skill does NOT:

- run tests to confirm flakiness empirically;
- fix tests automatically;
- detect flakiness from CI run history;
- guarantee a test is stable if no patterns are found;
- analyze compiled or transpiled test output;
- guarantee detection of all imaginable test instability causes.

It provides **static analysis** to find likely causes of flakiness
before running tests.

---

## Supported languages

| Language | Extensions | Support level |
|---|---|---|
| Python | `.py` | Full |
| TypeScript / JavaScript | `.ts`, `.tsx`, `.js`, `.jsx` | Full |
| Go | `.go` | Partial |
| Java / Kotlin | `.java`, `.kt` | Partial |

---

## Error handling

| Error | Response |
|---|---|
| File not readable | Skip, report path |
| Unknown language | Report unsupported, skip |
| Empty test file | Report zero findings, continue |
| Test function not found | Report zero test functions |
| Pattern regex error | Skip that pattern, log warning |
| Output path not writable | Print to stdout |

---

## References

- `{{SKILL_PATH}}/scripts/flaky_detective.py` — static scanner
- [pytest-flakefinder](https://github.com/dropbox/pytest-flakefinder)
- [Google Testing Blog: Flaky Tests](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)
- [freezegun](https://github.com/spulec/freezegun) — time mocking
- [responses](https://github.com/getsentry/responses) — HTTP mocking

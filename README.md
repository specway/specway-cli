<p align="center">
  <br />
  <strong>specway</strong>
  <br />
  The OpenAPI toolkit for your terminal.
  <br />
  <br />
  <a href="#install">Install</a> &bull;
  <a href="#commands">Commands</a> &bull;
  <a href="#ci-integration">CI Integration</a> &bull;
  <a href="https://specway.com">specway.com</a>
  <br />
  <br />
</p>

---

Validate specs. Preview docs locally with hot-reload. Catch breaking changes before they ship. Publish hosted docs in one command.

```
$ specway validate petstore.yaml

  Petstore v1.0.0
  https://petstore.swagger.io/v2

  Auth:  Bearer Token
  Endpoints:  4 total
    DELETE  1
    GET     2
    POST    1
  Tags:  Pets

  ✓ Valid
```

## Install

```bash
npm install -g specway
```

Or use without installing:

```bash
npx specway validate openapi.yaml
```

**Requirements:** Node.js 18+

## Commands

### `specway validate`

Validate an OpenAPI 3.x or Swagger 2.0 spec. Displays title, version, base URL, auth methods, endpoints by HTTP method, tags, and any errors or warnings.

```bash
specway validate openapi.yaml
specway validate https://petstore3.swagger.io/api/v3/openapi.json

# JSON output for CI pipelines
specway validate openapi.yaml --json

# Treat warnings as errors
specway validate openapi.yaml --strict
```

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON |
| `--strict` | Treat warnings as errors (exit 1) |

**Exit codes:** `0` valid, `1` errors found.

---

### `specway init`

Scaffold a starter OpenAPI 3.0 spec with bearer auth, example endpoints, and helpful comments.

```bash
specway init                    # Creates openapi.yaml
specway init -f my-api.yaml     # Custom filename
specway init --json             # JSON format instead of YAML
```

| Flag | Description |
|------|-------------|
| `-f, --filename <name>` | Output filename (default: `openapi.yaml`) |
| `--json` | Generate JSON instead of YAML |

---

### `specway preview`

Launch a local documentation server with automatic hot-reload on file save.

```bash
specway preview openapi.yaml
specway preview openapi.yaml -p 3000      # Custom port
specway preview openapi.yaml --no-open    # Don't open browser
```

| Flag | Description |
|------|-------------|
| `-p, --port <port>` | Port number (default: `8080`) |
| `--no-open` | Skip auto-opening browser |

Edit your spec file and the preview updates instantly via SSE — no manual refresh needed.

---

### `specway diff`

Compare two specs and detect breaking vs. non-breaking changes. Built for CI — exits with code 1 when breaking changes are found.

```bash
specway diff v1.yaml v2.yaml
specway diff v1.yaml v2.yaml --breaking-only
specway diff v1.yaml v2.yaml --json
```

```
$ specway diff v1.yaml v2.yaml

  Breaking Changes (3)

    ✗ Endpoint removed: DELETE /pets/{petId}
    ✗ Required parameter added: "status" on GET /pets
    ✗ Parameter type changed: "petId" number -> string on GET /pets/{petId}

  Non-Breaking Changes (2)

    ~ Endpoint added: POST /pets/{petId}/adopt
    ~ Optional parameter added: "species" on GET /pets

  ✗ 3 breaking change(s) detected
    2 non-breaking change(s)
```

**What counts as breaking:**
- Endpoint removed
- Required parameter added
- Parameter type changed
- Required body field added
- Response field removed

**What counts as non-breaking:**
- Endpoint added
- Optional parameter added
- Description changed

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON |
| `--breaking-only` | Only show breaking changes |

**Exit codes:** `0` no breaking changes, `1` breaking changes found.

---

### `specway publish`

Publish your API docs to [Specway](https://specway.com) for hosted documentation.

```bash
specway publish openapi.yaml --key sk_live_xxx

# Or use environment variable
SPECWAY_API_KEY=sk_live_xxx specway publish openapi.yaml
```

API key resolution order: `--key` flag > `SPECWAY_API_KEY` env > `~/.specway/config.json`

| Flag | Description |
|------|-------------|
| `--key <key>` | Specway API key |

---

## CI Integration

### GitHub Actions

```yaml
name: API Spec Check
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Validate spec
        run: npx specway validate openapi.yaml --strict

      - name: Check for breaking changes
        run: |
          git fetch origin main
          git show origin/main:openapi.yaml > /tmp/old-spec.yaml
          npx specway diff /tmp/old-spec.yaml openapi.yaml
```

### Other CI systems

specway uses exit codes for CI integration:

- **validate:** exits `1` on validation errors (or warnings in `--strict` mode)
- **diff:** exits `1` when breaking changes are detected

Use `--json` on any command for machine-readable output.

---

## Supported Formats

- OpenAPI 3.0.x
- OpenAPI 3.1.x
- Swagger 2.0
- JSON and YAML (auto-detected)
- File paths and URLs

## License

[MIT](LICENSE)

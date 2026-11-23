# Troubleshooting

| Symptom | Cause | Fix |
| - | - | - |
| `Missing dependency "playwright"` (exit 3) | Optional deps not installed | `studio3 setup --only review`, or install Playwright in the project |
| `Chromium could not be launched` | No browser build for the resolved Playwright version | `studio3 setup --browsers` or `npx playwright install chromium`. On Linux servers also `npx playwright install-deps chromium` (needs root; ask the user) |
| Browser launches, `webgl` is `warn` | No GPU and software GL disabled | 3D diagnostics will report canvas initialisation failure honestly; run on a machine with GL, or accept `limited` results |
| `webgpu … unavailable` | Normal for headless Chromium and many browsers | Nothing to fix. WebGPU checks are reported `unavailable`; the WebGL path is what gets verified |
| `Command "x" is not available in this build` (exit 4) | Partial copy of the plugin | Reinstall; verify with `studio3 doctor` |
| `Catalog not found` | `library/catalog.json` missing | In a checkout: `node scripts/build-catalog.mjs`. In an install: reinstall |
| `sharp` fails to load on macOS Apple Silicon | Binary for another architecture copied between machines | Remove the deps directory and re-run `studio3 setup --only assets` on the target machine |
| KTX2 step `skipped` | `ktx` (KTX-Software) not on PATH | Install KTX-Software if KTX2 output is required; otherwise WebP is used and the report says so |
| `import` reports Blender unavailable | `blender` not on PATH | Install Blender or export glTF/GLB from the DCC tool directly |
| `claude plugin install` says plugin not found | Marketplace not added, or names differ | `claude plugin marketplace add <path>`; the id is `studio3@studio3-marketplace` |
| Skills missing after install | Session started before install | Restart the session or run `/reload-plugins` (Claude Code) |
| Dev server pages never hydrate in headless tests | Next.js dev blocks cross-origin dev requests from `127.0.0.1` | Use `http://localhost:<port>` |
| Review screenshots are blank for a canvas | Scene mounts lazily or renders on demand | Increase the settle time or interact first; see `studio3 review run --help` |

## Platform notes

- **macOS (Apple Silicon and Intel)**: Node from nodejs.org, Homebrew, fnm or nvm all work. Playwright stores
  browsers in `~/Library/Caches/ms-playwright`.
- **Linux**: headless Chromium needs system libraries; in minimal containers WebGL runs on SwiftShader, which is
  sufficient for functional 3D checks. Frame-time numbers from software rendering describe the CI machine, not
  a user's device.
- **CI**: cache `~/.cache/ms-playwright` and the deps directory; run `studio3 doctor --browser --strict` as a
  preflight so a missing browser fails fast instead of producing skipped reviews.

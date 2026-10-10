# Overtype

Windows 11 app: Tauri 2, React, TypeScript and Rust. vLLM is a separate server.

- Latest user decisions override the historical glass specifications below: read docs/UI-DECISIONS.md and track individual fixes in docs/UI-ISSUES.md.

- Read docs/SPEC.md and docs/BRIDGE.md before changing interfaces.
- 0.6.0 (Settings, first-run setup, servers, real glass): docs/PLAN-0.6.md (an executed, historical plan) and docs/VERRE-0.6.md were the plan; the current contract is docs/BRIDGE.md; design-lab/reglages/ (README.md first) is the visual and behavioural reference. The app's name is read from src/brand.ts and src-tauri/src/brand.rs, never written in new code. The app is Overtype since 0.6.0 (FlowTranslate before). What deliberately keeps the old name: the bundle identifier com.flowtranslate.desktop and its data folder, the FLOWTRANSLATE_* variables, the Rust crate (flowtranslate, flowtranslate_lib), the model names flowtranslate-*, CSS classes, this folder. src-tauri/windows/hooks.nsh removes an installed FlowTranslate when Overtype is installed over it.
- Art direction « Îlot » (2026-09-24): docs/DA-PLAN.md is its executed, historical implementation plan (the current contract is docs/BRIDGE.md), and the design lab design-lab/ (open design-lab/labo-flowtranslate.html, read design-lab/README.md) is the visual and motion reference, to keep in the repository; its defaults are Lucas's choices. The former reference docs/design/glass-reader/c-overlapping-pill.png and the graphite glass are historical. No large header or footer.
- Preserve clipboard updates and never replace a selection unless its identity and text are revalidated.
- Never log source text, translations, clipboard contents or a whole key (the diagnostic journal keeps at most a key's last 4 characters). History is explicitly opt-in and encrypted with Windows DPAPI.
- Never include model weights, credentials or user data in Git.
- Do not stop existing GPU processes. Inspect free VRAM before inference tests.
- One branch per piece of work. Parallel agents may use temporary worktrees of that branch, merged back then deleted, never pushed. Each agent owns only its assigned scope.
- Agents: Claude does everything, with subagents or a workflow. The former routing (Astra, Sol, Luna, Terra, Codex) is obsolete (Lucas): ignore any mention of it in older documents. Few branches: work lands on the branch of the release in progress (one branch per piece of work, see above).
- Reuse established frontend primitives and animation libraries (motion, Radix, lucide-react); follow the Îlot art direction in docs/DA-PLAN.md. Validate the real Windows window as well as the browser preview before claiming the UI is ready. See docs/UI-ITERATION.md.
- Before committing, pass the guards: `npm run lint`, `npm run typecheck:test`, `cargo fmt --check --manifest-path src-tauri/Cargo.toml` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`.
- Keep claims of testing tied to actual executed checks. A mocked translation is not an inference benchmark.

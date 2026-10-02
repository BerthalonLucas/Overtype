# FlowTranslate

Windows 11 app: Tauri 2, React, TypeScript and Rust. vLLM is a separate server.

- Latest user decisions override the historical glass specifications below: read docs/UI-DECISIONS.md and track individual fixes in docs/UI-ISSUES.md. Main work without subagents; the user separately permits Claude Code/Fable 5.1 for bounded frontend variants. No such variant has been launched for the workbench milestone.

- Read docs/SPEC.md and docs/BRIDGE.md before changing interfaces.
- 0.6.0 (Settings, first-run setup, servers, real glass): docs/PLAN-0.6.md and docs/VERRE-0.6.md are the plan, design-lab/reglages/ (README.md first) is the visual and behavioural reference. The app's name is read from src/brand.ts and src-tauri/src/brand.rs, never written in new code.
- New art direction (« Îlot », 2026-09-24): docs/DA-PLAN.md is the implementation plan and the design lab design-lab/ (open design-lab/labo-flowtranslate.html, read design-lab/README.md) is the visual and motion reference, to keep in the repository; its defaults are Lucas's choices. The former reference docs/design/glass-reader/c-overlapping-pill.png and the graphite glass are historical. No large header or footer.
- Preserve clipboard updates and never replace a selection unless its identity and text are revalidated.
- Never log source text, translations, credentials or clipboard contents. History is explicitly opt-in and encrypted with Windows DPAPI.
- Never include model weights, credentials or user data in Git.
- Do not stop existing GPU processes. Inspect free VRAM before inference tests.
- Use branches/worktrees for independent agent work. Each agent owns only its assigned scope.
- Agents: Claude with subagents or a workflow; the former routing (Astra, Sol, Luna, Terra) no longer applies. Few branches: work lands on the branch of the release in progress.
- Reuse established frontend primitives and animation libraries (motion, Radix, lucide-react); follow the Îlot art direction in docs/DA-PLAN.md. Validate the real Windows window as well as the browser preview before claiming the UI is ready. See docs/UI-ITERATION.md.
- Keep claims of testing tied to actual executed checks. A mocked translation is not an inference benchmark.

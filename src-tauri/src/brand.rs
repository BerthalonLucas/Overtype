//! The name of the application, in one place (docs/PLAN-0.6.md §0): the app was FlowTranslate
//! until 0.5.1, so no new code writes it. The frontend's twin is `src/brand.ts` (`appName`).
//! The identifier `com.flowtranslate.desktop` (data folder, DPAPI scope, history) and the
//! `FLOWTRANSLATE_*` variables do not change with the name.
pub const APP_NAME: &str = "Overtype";

// What Rust accepts for « After replacing » (settings::validate): the sliders of the Settings and
// the pill's countdown (src/result/countdown.ts) never leave these ranges.
export const undoRange = { min: 2, max: 20, step: 1 } as const;
export const changedWordsRange = { min: 5, max: 120, step: 5 } as const;

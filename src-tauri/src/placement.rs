use crate::types::{PillSide, PlacementSide, Rect};

/// Places the glass (region zero) beside its anchor. `extent` is how far the window
/// reaches below the glass top (physical): the menu space is reserved under the pill
/// since 2026-09-13, so the side is chosen on the whole window, not on the glass alone.
pub fn overlay(
    anchor: Rect,
    work: Rect,
    width: f64,
    height: f64,
    extent: f64,
    hint: Option<PlacementSide>,
) -> (Rect, PlacementSide) {
    let gap = 8.0;
    let decision_height = if hint.is_none() {
        height.max(220.0).max(extent)
    } else {
        height
    };
    let below_fits = anchor.y + anchor.height + gap + decision_height <= work.y + work.height;
    let side = hint.unwrap_or(if below_fits {
        PlacementSide::Below
    } else {
        PlacementSide::Above
    });
    let raw_y = match side {
        PlacementSide::Below => anchor.y + anchor.height + gap,
        _ => anchor.y - height - gap,
    };
    let width = width.min(work.width);
    let height = height.min(work.height);
    let x = (anchor.x + anchor.width - width).clamp(work.x, work.x + work.width - width);
    let y = raw_y.clamp(work.y, work.y + work.height - height);
    (
        Rect {
            x,
            y,
            width,
            height,
        },
        side,
    )
}

/// Docked window: bottom-centre of the work area, 8 logical px above its bottom edge.
/// The frontend keeps the tab on the window's bottom edge, so a taller window only
/// moves the top edge.
/// Bottom-centre, resting on the work area: the window's own bottom halo (frontend
/// padding for the tab shadow) keeps the tab off the taskbar.
pub fn docked(work: Rect, width: f64, height: f64) -> Rect {
    clamp(
        work,
        work.x + (work.width - width) / 2.,
        work.y + work.height - height,
        width,
        height,
    )
}

pub fn clamp(work: Rect, x: f64, y: f64, width: f64, height: f64) -> Rect {
    let width = width.min(work.width);
    let height = height.min(work.height);
    Rect {
        x: x.clamp(work.x, work.x + work.width - width),
        y: y.clamp(work.y, work.y + work.height - height),
        width,
        height,
    }
}

fn intersects(a: &Rect, b: &Rect) -> bool {
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/// Where the pill rests after a paste (lot 9), physical: under the last line of the new text,
/// its right edge on the end of that line (like the capture's placement), never over any
/// line; with no room below, above the first line; `margin`: right of the text column,
/// level with the last line, before those two. Within the work area. The last element says
/// whether the pill clears every line (false only when nothing fits: then below, clamped).
/// `end` is the line segment the text ends on; `gap` the room between text and pill.
pub fn pill_after_paste(
    lines: &[Rect],
    end: Rect,
    work: Rect,
    width: f64,
    height: f64,
    gap: f64,
    margin: bool,
) -> (Rect, PillSide, bool) {
    let block = lines.iter().copied().chain(Some(end));
    let (mut top, mut bottom, mut right) = (f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY);
    for line in block {
        top = top.min(line.y);
        bottom = bottom.max(line.y + line.height);
        right = right.max(line.x + line.width);
    }
    let x_end =
        (end.x + end.width - width).clamp(work.x, (work.x + work.width - width).max(work.x));
    let below = Rect {
        x: x_end,
        y: bottom + gap,
        width,
        height,
    };
    let above = Rect {
        x: x_end,
        y: top - gap - height,
        width,
        height,
    };
    let beside = Rect {
        x: right + gap,
        y: (end.y + (end.height - height) / 2.)
            .clamp(work.y, (work.y + work.height - height).max(work.y)),
        width,
        height,
    };
    let fits = |r: &Rect| {
        r.x >= work.x
            && r.y >= work.y
            && r.x + r.width <= work.x + work.width
            && r.y + r.height <= work.y + work.height
    };
    let clear = |r: &Rect| {
        !lines
            .iter()
            .chain(Some(&end))
            .any(|line| intersects(line, r))
    };
    let order = if margin {
        [
            (beside, PillSide::Margin),
            (below, PillSide::Below),
            (above, PillSide::Above),
        ]
    } else {
        [
            (below, PillSide::Below),
            (above, PillSide::Above),
            (beside, PillSide::Margin),
        ]
    };
    if let Some((rect, side)) = order
        .into_iter()
        .find(|(rect, _)| fits(rect) && clear(rect))
    {
        return (rect, side, true);
    }
    let rect = clamp(work, below.x, below.y, width, height);
    (rect, PillSide::Below, clear(&rect))
}

/// When the pasted text could not be found: the old selection's lines grown or shrunk by the
/// estimated number of lines of the new text (as many more as it is longer, at least one),
/// ending on the old anchor moved by that height. Returns the block and the line it ends on.
pub fn estimated_text(
    old_lines: &[Rect],
    anchor: Rect,
    old_len: usize,
    new_len: usize,
) -> (Vec<Rect>, Rect) {
    let lines = if old_lines.is_empty() {
        vec![anchor]
    } else {
        old_lines.to_vec()
    };
    let rows = lines.len() as f64;
    let new_rows = (rows * new_len as f64 / old_len.max(1) as f64)
        .ceil()
        .clamp(1., 64.);
    let dy = (new_rows - rows) * anchor.height;
    let end = Rect {
        y: anchor.y + dy,
        ..anchor
    };
    let left = lines.iter().map(|r| r.x).fold(f64::INFINITY, f64::min);
    let top = lines.iter().map(|r| r.y).fold(f64::INFINITY, f64::min);
    let right = lines
        .iter()
        .map(|r| r.x + r.width)
        .fold(f64::NEG_INFINITY, f64::max);
    let bottom = (end.y + end.height).max(top + anchor.height);
    (
        vec![Rect {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        }],
        end,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pill_rests_under_the_new_text_on_its_end_and_never_over_it() {
        let work = Rect {
            x: 0.,
            y: 0.,
            width: 1920.,
            height: 1040.,
        };
        let lines = [
            Rect {
                x: 100.,
                y: 200.,
                width: 600.,
                height: 20.,
            },
            Rect {
                x: 100.,
                y: 220.,
                width: 240.,
                height: 20.,
            },
        ];
        let (pill, side, clear) = pill_after_paste(&lines, lines[1], work, 120., 32., 8., false);
        assert_eq!(
            (pill, side, clear),
            (
                Rect {
                    x: 220.,
                    y: 248.,
                    width: 120.,
                    height: 32.
                },
                PillSide::Below,
                true
            )
        );
        // Near the bottom of the screen: above the first line.
        let low = [
            Rect {
                x: 100.,
                y: 990.,
                width: 600.,
                height: 20.,
            },
            Rect {
                x: 100.,
                y: 1010.,
                width: 240.,
                height: 20.,
            },
        ];
        let (pill, side, _) = pill_after_paste(&low, low[1], work, 120., 32., 8., false);
        assert_eq!((pill.y, side), (950., PillSide::Above));
        assert!(low.iter().all(|line| !intersects(line, &pill)));
        // In the margin: right of the widest line, level with the last one.
        let (pill, side, _) = pill_after_paste(&lines, lines[1], work, 120., 32., 8., true);
        assert_eq!((pill.x, pill.y, side), (708., 214., PillSide::Margin));
        // No room on the right: under the text after all.
        let wide = [Rect {
            x: 100.,
            y: 200.,
            width: 1800.,
            height: 20.,
        }];
        assert_eq!(
            pill_after_paste(&wide, wide[0], work, 120., 32., 8., true).1,
            PillSide::Below
        );
        // A last line ending near the left edge: the pill is clamped into the screen, still under.
        let short = [Rect {
            x: 0.,
            y: 200.,
            width: 40.,
            height: 20.,
        }];
        let (pill, side, clear) = pill_after_paste(&short, short[0], work, 120., 32., 8., false);
        assert_eq!(
            (pill.x, pill.y, side, clear),
            (0., 228., PillSide::Below, true)
        );
    }

    #[test]
    fn an_unfound_text_is_estimated_from_the_old_lines_and_their_length() {
        let old = [
            Rect {
                x: 100.,
                y: 200.,
                width: 500.,
                height: 20.,
            },
            Rect {
                x: 100.,
                y: 220.,
                width: 300.,
                height: 20.,
            },
        ];
        // Twice as long: four lines, the anchor two lines lower.
        let (block, end) = estimated_text(&old, old[1], 100, 200);
        assert_eq!(
            end,
            Rect {
                x: 100.,
                y: 260.,
                width: 300.,
                height: 20.
            }
        );
        assert_eq!(
            block,
            vec![Rect {
                x: 100.,
                y: 200.,
                width: 500.,
                height: 80.
            }]
        );
        // Much shorter: one line, never less.
        let (block, end) = estimated_text(&old, old[1], 100, 10);
        assert_eq!((end.y, block[0].height), (200., 20.));
    }
    #[test]
    fn chooses_above_at_bottom_and_keeps_hint() {
        let work = Rect {
            x: 0.,
            y: 0.,
            width: 1000.,
            height: 800.,
        };
        let a = Rect {
            x: 900.,
            y: 760.,
            width: 20.,
            height: 20.,
        };
        let (r, s) = overlay(a, work, 280., 200., 200., None);
        assert_eq!(s, PlacementSide::Above);
        assert!(r.x + r.width <= 1000.);
        assert_eq!(
            overlay(a, work, 280., 300., 300., Some(s)).1,
            PlacementSide::Above
        );
    }
    #[test]
    fn the_reserved_window_below_the_glass_decides_the_side() {
        let work = Rect {
            x: 0.,
            y: 0.,
            width: 1000.,
            height: 800.,
        };
        // 300 px of room below the anchor: a 120 px glass fits, a 334 px window does not.
        let a = Rect {
            x: 400.,
            y: 480.,
            width: 20.,
            height: 20.,
        };
        assert_eq!(
            overlay(a, work, 280., 120., 120., None).1,
            PlacementSide::Below
        );
        assert_eq!(
            overlay(a, work, 280., 120., 334., None).1,
            PlacementSide::Above
        );
        // A chosen side is kept whatever the extent.
        assert_eq!(
            overlay(a, work, 280., 120., 334., Some(PlacementSide::Below)).1,
            PlacementSide::Below
        );
    }
    #[test]
    fn reserves_long_result_on_first_choice() {
        let work = Rect {
            x: 0.,
            y: 0.,
            width: 1000.,
            height: 800.,
        };
        let a = Rect {
            x: 400.,
            y: 650.,
            width: 20.,
            height: 20.,
        };
        assert_eq!(
            overlay(a, work, 280., 40., 40., None).1,
            PlacementSide::Above
        );
    }
    #[test]
    fn manual_position_stays_in_offset_work_area_after_resize() {
        let work = Rect {
            x: -1920.,
            y: 40.,
            width: 1920.,
            height: 1040.,
        };
        assert_eq!(
            clamp(work, -50., 1000., 420., 440.),
            Rect {
                x: -420.,
                y: 640.,
                width: 420.,
                height: 440.,
            }
        );
    }
    #[test]
    fn docked_window_rests_on_the_bottom_edge_of_a_negative_work_area() {
        let work = Rect {
            x: -1600.,
            y: -200.,
            width: 1600.,
            height: 1200.,
        };
        assert_eq!(
            docked(work, 300., 40.),
            Rect {
                x: -950.,
                y: 960.,
                width: 300.,
                height: 40.
            }
        );
        // Growing upward: same bottom edge for a taller window.
        let tall = docked(work, 300., 260.);
        assert_eq!(tall.y + tall.height, 1000.);
    }
}

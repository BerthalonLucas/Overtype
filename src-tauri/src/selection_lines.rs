//! The lines of a UI Automation selection (« Îlot », lot 5) and their conversion for the
//! `halo` window (lot 6).
//!
//! `GetBoundingRectangles` gives one rectangle per visible run of the range, in physical
//! screen pixels: several on one line when the style changes (Word, Chromium), none for a
//! line scrolled out of view, and sometimes empty or absurd ones (Electron, old web fields,
//! terminals). `lines` turns that into one rectangle per line segment, still physical;
//! `halo_frame` converts them once, for the window that draws them, into logical pixels
//! relative to that window. The anchor of the capture stays the raw last rectangle: the
//! placement and `validate_target` compare it physically, untouched by this module.
use crate::types::Rect;

/// At most this many line rectangles per capture. Beyond, counted per line (review of
/// da-ilot, n°8): the segments of the first line, one box for the lines in between (held
/// between the first line's bottom and the last line's top), the segments of the last line;
/// a first or last line with too many segments is one box. They never overlap.
pub const MAX_LINES: usize = 64;

/// Room around the lines for the glow of the sweep, in logical pixels (DA-PLAN lot 6).
pub const HALO_MARGIN: f64 = 12.;

/// Finite and not empty.
pub fn drawable(rect: &Rect) -> bool {
    rect.x.is_finite()
        && rect.y.is_finite()
        && rect.width.is_finite()
        && rect.height.is_finite()
        && rect.width > 0.
        && rect.height > 0.
}

/// The flat `[x, y, width, height, …]` array of `GetBoundingRectangles`, as rectangles.
pub fn from_flat(values: &[f64]) -> Vec<Rect> {
    values
        .as_chunks::<4>()
        .0
        .iter()
        .map(|v| Rect {
            x: v[0],
            y: v[1],
            width: v[2],
            height: v[3],
        })
        .collect()
}

fn right(r: &Rect) -> f64 {
    r.x + r.width
}
fn bottom(r: &Rect) -> f64 {
    r.y + r.height
}

fn union(a: &Rect, b: &Rect) -> Rect {
    let (x, y) = (a.x.min(b.x), a.y.min(b.y));
    Rect {
        x,
        y,
        width: right(a).max(right(b)) - x,
        height: bottom(a).max(bottom(b)) - y,
    }
}

fn intersection(a: &Rect, b: &Rect) -> Option<Rect> {
    let (x, y) = (a.x.max(b.x), a.y.max(b.y));
    let r = Rect {
        x,
        y,
        width: right(a).min(right(b)) - x,
        height: bottom(a).min(bottom(b)) - y,
    };
    drawable(&r).then_some(r)
}

/// `rect` cut to `window`, when something of it is left.
pub fn clip(rect: &Rect, window: &Rect) -> Option<Rect> {
    intersection(rect, window)
}

/// The bounding box of rectangles (None when there are none).
pub fn bounds(rects: &[Rect]) -> Option<Rect> {
    rects.iter().copied().reduce(|a, b| union(&a, &b))
}

/// Two runs share a line when they overlap vertically over half the shorter one.
fn same_line(line: &Rect, run: &Rect) -> bool {
    let overlap = bottom(line).min(bottom(run)) - line.y.max(run.y);
    overlap >= 0.5 * line.height.min(run.height)
}

/// One rectangle per line segment, sorted top to bottom then left to right, physical.
/// Runs are dropped when not drawable, clipped to the source window and dropped when
/// nothing of them lies inside it. The runs of one line merge unless a gap wider than the
/// line height separates them (two table columns stay two segments). Capped at
/// `MAX_LINES`.
pub fn lines(raw: &[Rect], window: Option<Rect>) -> Vec<Rect> {
    let mut runs: Vec<Rect> = raw
        .iter()
        .filter(|r| drawable(r))
        .filter_map(|r| match window.filter(drawable) {
            Some(window) => intersection(r, &window),
            None => Some(*r),
        })
        .collect();
    runs.sort_by(|a, b| {
        (a.y + a.height / 2.)
            .total_cmp(&(b.y + b.height / 2.))
            .then(a.x.total_cmp(&b.x))
    });
    // Vertical grouping first, over the whole line box: a taller run (a bigger font, an
    // emoji) joins the line it overlaps instead of opening a new one.
    let mut groups: Vec<(Rect, Vec<Rect>)> = Vec::new();
    for run in runs {
        match groups.last_mut() {
            Some((line, members)) if same_line(line, &run) => {
                *line = union(line, &run);
                members.push(run);
            }
            _ => groups.push((run, vec![run])),
        }
    }
    let mut rows = Vec::new();
    for (line, mut members) in groups {
        members.sort_by(|a, b| a.x.total_cmp(&b.x));
        let mut segments = Vec::new();
        let mut current: Option<Rect> = None;
        for run in members {
            current = Some(match current {
                Some(segment) if run.x - right(&segment) <= line.height => union(&segment, &run),
                Some(segment) => {
                    segments.push(segment);
                    run
                }
                None => run,
            });
        }
        segments.extend(current);
        rows.push(segments);
    }
    cap(rows)
}

/// The segments of every line, or, beyond `MAX_LINES` segments, the first line, a box for the
/// lines in between and the last line. Counted per line, not per segment: with two columns
/// the box of the middle segments would otherwise cover the first and the last line.
fn cap(rows: Vec<Vec<Rect>>) -> Vec<Rect> {
    if rows.iter().map(Vec::len).sum::<usize>() <= MAX_LINES {
        return rows.into_iter().flatten().collect();
    }
    let keep = |row: &[Rect]| {
        if row.len() * 2 < MAX_LINES {
            row.to_vec()
        } else {
            bounds(row).into_iter().collect()
        }
    };
    let [first, middle @ .., last] = rows.as_slice() else {
        return rows.iter().flat_map(|row| keep(row)).collect();
    };
    let mut kept = keep(first);
    let (top, floor) = (
        bounds(first).map_or(f64::NEG_INFINITY, |r| bottom(&r)),
        bounds(last).map_or(f64::INFINITY, |r| r.y),
    );
    if let Some(inner) = bounds(&middle.concat()) {
        let (y, end) = (inner.y.max(top), bottom(&inner).min(floor));
        let held = Rect {
            y,
            height: end - y,
            ..inner
        };
        if drawable(&held) {
            kept.push(held);
        }
    }
    kept.extend(keep(last));
    kept
}

/// Where the halo window goes and what it draws.
#[derive(Clone, Debug, PartialEq)]
pub struct HaloFrame {
    /// The window, in physical screen pixels, on whole pixels: the union of the lines
    /// grown by `HALO_MARGIN` logical pixels on each side.
    pub window: Rect,
    /// The lines, in logical pixels relative to the window's top-left corner (CSS pixels
    /// of the halo page at `scale`).
    pub lines: Vec<Rect>,
    /// The window size in logical pixels.
    pub width: f64,
    pub height: f64,
}

/// Converts physical line rectangles for a window drawn at `scale` (its screen's DPI
/// scale: 1, 1.5, 2…). The physical origin of the screen matters only through the
/// window's own origin, so a screen left of or above the primary one (negative
/// coordinates) converts the same way.
pub fn halo_frame(lines: &[Rect], scale: f64, margin: f64) -> Option<HaloFrame> {
    if !(scale.is_finite() && scale > 0.) {
        return None;
    }
    let union = bounds(lines)?;
    let grow = margin * scale;
    let (left, top) = ((union.x - grow).floor(), (union.y - grow).floor());
    let (width, height) = (
        (right(&union) + grow).ceil() - left,
        (bottom(&union) + grow).ceil() - top,
    );
    let window = Rect {
        x: left,
        y: top,
        width,
        height,
    };
    let local = lines
        .iter()
        .map(|r| Rect {
            x: (r.x - left) / scale,
            y: (r.y - top) / scale,
            width: r.width / scale,
            height: r.height / scale,
        })
        .collect();
    Some(HaloFrame {
        window,
        lines: local,
        width: width / scale,
        height: height / scale,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(x: f64, y: f64, width: f64, height: f64) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn runs_of_one_line_merge_and_lines_stay_apart() {
        // Word or Chromium: three runs on the first line (a bold word in the middle),
        // one on the second; the lines touch without overlapping.
        let raw = [
            r(100., 200., 40., 20.),
            r(140., 200., 30., 20.),
            r(170., 201., 80., 19.),
            r(100., 220., 120., 20.),
        ];
        assert_eq!(
            lines(&raw, None),
            vec![r(100., 200., 150., 20.), r(100., 220., 120., 20.)]
        );
    }

    #[test]
    fn a_taller_run_joins_its_line() {
        let raw = [
            r(100., 200., 40., 20.),
            r(140., 194., 24., 30.),
            r(164., 200., 50., 20.),
            r(100., 224., 60., 20.),
        ];
        assert_eq!(
            lines(&raw, None),
            vec![r(100., 194., 114., 30.), r(100., 224., 60., 20.)]
        );
    }

    #[test]
    fn document_order_does_not_matter() {
        let raw = [
            r(100., 220., 120., 20.),
            r(170., 200., 80., 20.),
            r(100., 200., 70., 20.),
        ];
        assert_eq!(
            lines(&raw, None),
            vec![r(100., 200., 150., 20.), r(100., 220., 120., 20.)]
        );
    }

    #[test]
    fn distant_columns_of_one_line_stay_two_segments() {
        let raw = [r(100., 200., 60., 20.), r(400., 200., 60., 20.)];
        assert_eq!(lines(&raw, None).len(), 2);
        // A gap no wider than the line height is a space between two runs.
        assert_eq!(
            lines(&[r(100., 200., 60., 20.), r(180., 200., 60., 20.)], None),
            vec![r(100., 200., 140., 20.)]
        );
    }

    #[test]
    fn empty_absurd_and_outside_runs_are_dropped_and_the_rest_clipped() {
        let window = Some(r(0., 0., 800., 600.));
        let raw = [
            r(10., 10., 0., 20.),
            r(10., 40., 50., 0.),
            r(f64::NAN, 70., 50., 20.),
            r(10., f64::INFINITY, 50., 20.),
            r(900., 100., 50., 20.),
            r(-300., 100., 50., 20.),
            r(10., 700., 50., 20.),
            r(760., 300., 100., 20.),
            r(10., 590., 60., 20.),
        ];
        assert_eq!(
            lines(&raw, window),
            vec![r(760., 300., 40., 20.), r(10., 590., 60., 10.)]
        );
        assert!(lines(&[], window).is_empty());
        assert!(lines(&[r(900., 100., 50., 20.)], window).is_empty());
    }

    #[test]
    fn a_window_on_a_screen_left_of_the_primary_keeps_its_runs() {
        let window = Some(r(-1920., 100., 1200., 800.));
        assert_eq!(
            lines(&[r(-1800., 300., 200., 20.)], window),
            vec![r(-1800., 300., 200., 20.)]
        );
    }

    #[test]
    fn beyond_64_lines_keeps_first_middle_box_and_last() {
        let raw: Vec<Rect> = (0..MAX_LINES)
            .map(|i| r(100., 100. + 20. * i as f64, 300. + i as f64, 20.))
            .collect();
        assert_eq!(lines(&raw, None).len(), MAX_LINES);
        let raw: Vec<Rect> = (0..200)
            .map(|i| {
                r(
                    100. - (i % 3) as f64,
                    100. + 20. * i as f64,
                    300. + i as f64,
                    20.,
                )
            })
            .collect();
        let kept = lines(&raw, None);
        assert_eq!(kept.len(), 3);
        assert_eq!(kept[0], raw[0]);
        assert_eq!(kept[2], raw[199]);
        assert_eq!(kept[1], r(98., 120., 300. + 198. - 98. + 100., 20. * 198.));
        // The three never overlap: the halo paints each place once.
        assert!(bottom(&kept[0]) <= kept[1].y && bottom(&kept[1]) <= kept[2].y);
    }

    #[test]
    fn beyond_64_segments_two_columns_keep_their_first_and_last_line_uncovered() {
        // Review n°8: 33 lines in two columns (A at x 100..160, B at x 400..460) are 66
        // segments; the middle box used to cover A0 and B32.
        let raw: Vec<Rect> = (0..33)
            .flat_map(|i| {
                [
                    r(100., 100. + 20. * i as f64, 60., 20.),
                    r(400., 100. + 20. * i as f64, 60., 20.),
                ]
            })
            .collect();
        let kept = lines(&raw, None);
        assert_eq!(
            kept,
            vec![
                r(100., 100., 60., 20.),
                r(400., 100., 60., 20.),
                r(100., 120., 360., 620.),
                r(100., 740., 60., 20.),
                r(400., 740., 60., 20.),
            ]
        );
        for (i, a) in kept.iter().enumerate() {
            for b in &kept[i + 1..] {
                assert!(intersection(a, b).is_none(), "{a:?} and {b:?} overlap");
            }
        }
        // A first line of many segments is one box; so is a single line.
        let many: Vec<Rect> = (0..40)
            .map(|i| r(100. + 50. * i as f64, 100., 20., 20.))
            .chain((0..40).map(|i| r(100. + 50. * i as f64, 120., 20., 20.)))
            .collect();
        assert_eq!(
            lines(&many, None),
            vec![r(100., 100., 1970., 20.), r(100., 120., 1970., 20.)]
        );
        let one: Vec<Rect> = (0..70)
            .map(|i| r(100. + 50. * i as f64, 100., 20., 20.))
            .collect();
        assert_eq!(lines(&one, None), vec![r(100., 100., 3470., 20.)]);
    }

    #[test]
    fn many_runs_on_few_lines_are_counted_as_lines() {
        // 300 runs on 3 lines: grouping comes before the cap.
        let raw: Vec<Rect> = (0..300)
            .map(|i| {
                r(
                    100. + 10. * (i % 100) as f64,
                    100. + 20. * (i / 100) as f64,
                    10.,
                    20.,
                )
            })
            .collect();
        assert_eq!(
            lines(&raw, None),
            vec![
                r(100., 100., 1000., 20.),
                r(100., 120., 1000., 20.),
                r(100., 140., 1000., 20.)
            ]
        );
    }

    #[test]
    fn from_flat_reads_quadruples_and_ignores_a_torn_tail() {
        assert_eq!(
            from_flat(&[1., 2., 3., 4., 5., 6., 7., 8., 9.]),
            vec![r(1., 2., 3., 4.), r(5., 6., 7., 8.)]
        );
    }

    /// Physical → logical at 100 %, 150 % and 200 %, on a screen at the origin, right of it
    /// and left of it (negative coordinates): the window grows by 12 logical pixels, lands
    /// on whole physical pixels, and every line converts back to its physical rectangle.
    #[test]
    fn halo_conversion_at_100_150_and_200_percent_on_three_screens() {
        for scale in [1.0, 1.5, 2.0] {
            for origin in [(0., 0.), (2560., 0.), (-2880., -300.)] {
                let physical = [
                    r(origin.0 + 301., origin.1 + 407.5, 450.25, 19. * scale),
                    r(
                        origin.0 + 301.,
                        origin.1 + 407.5 + 19. * scale,
                        212.,
                        19. * scale,
                    ),
                ];
                let frame = halo_frame(&physical, scale, HALO_MARGIN).expect("frame");
                let w = frame.window;
                assert!(
                    [w.x, w.y, w.width, w.height]
                        .iter()
                        .all(|v| v.fract() == 0.),
                    "whole pixels at {scale}"
                );
                let union = bounds(&physical).unwrap();
                assert!(w.x <= union.x - 12. * scale && w.y <= union.y - 12. * scale);
                assert!(
                    w.x + w.width >= right(&union) + 12. * scale
                        && w.y + w.height >= bottom(&union) + 12. * scale
                );
                assert!(w.x > union.x - 12. * scale - 1. && w.y > union.y - 12. * scale - 1.);
                assert!(
                    (frame.width - w.width / scale).abs() < 1e-9
                        && (frame.height - w.height / scale).abs() < 1e-9
                );
                for (logical, source) in frame.lines.iter().zip(physical.iter()) {
                    assert!(
                        (logical.x * scale + w.x - source.x).abs() < 1e-9,
                        "x at {scale}"
                    );
                    assert!(
                        (logical.y * scale + w.y - source.y).abs() < 1e-9,
                        "y at {scale}"
                    );
                    assert!((logical.width * scale - source.width).abs() < 1e-9);
                    assert!((logical.height * scale - source.height).abs() < 1e-9);
                    // Inside the window with the margin around it, in CSS pixels.
                    assert!(logical.x >= 12. - 1e-9 && logical.y >= 12. - 1e-9);
                    assert!(logical.x + logical.width <= frame.width - 12. + 1e-9);
                    assert!(logical.y + logical.height <= frame.height - 12. + 1e-9);
                }
                // A line of 19 logical pixels is 19 CSS pixels tall at every scale.
                assert!((frame.lines[0].height - 19.).abs() < 1e-9);
            }
        }
    }

    #[test]
    fn exact_values_at_150_percent() {
        let frame = halo_frame(&[r(1500., 600., 300., 30.)], 1.5, HALO_MARGIN).unwrap();
        assert_eq!(frame.window, r(1482., 582., 336., 66.));
        assert_eq!(frame.lines, vec![r(12., 12., 200., 20.)]);
        assert_eq!((frame.width, frame.height), (224., 44.));
    }

    #[test]
    fn no_frame_without_lines_or_scale() {
        assert!(halo_frame(&[], 1., HALO_MARGIN).is_none());
        assert!(halo_frame(&[r(0., 0., 10., 10.)], 0., HALO_MARGIN).is_none());
        assert!(halo_frame(&[r(0., 0., 10., 10.)], f64::NAN, HALO_MARGIN).is_none());
    }
}

//! The colour under the selected text (« mise en valeur », Lucas 25/09): the halo draws its
//! light or dark version from it, and the reflection that passes over the letters is a veil
//! of exactly that colour. Read once, at the capture, before any of our windows covers the
//! text: a few pixels just around the lines, compared with one another. Only the colour
//! they agree on is kept; no pixel is stored or logged.
use crate::types::Rect;

/// At most this many lines are sampled: the first three and the last.
const SAMPLED_LINES: usize = 4;
/// Beyond this area the bounds of the points are not read in one piece but point by point.
const MAX_BLIT: i64 = 4096 * 2048;

/// Points just outside the selection's lines, physical: left of a line's first run, right of
/// its last, just above and below its middle. Inside `window` only (the source's rectangle):
/// a point beyond it would read another application or nothing.
pub fn points(lines: &[Rect], window: Option<Rect>) -> Vec<(i32, i32)> {
    let picked: Vec<&Rect> = if lines.len() > SAMPLED_LINES {
        lines[..SAMPLED_LINES - 1]
            .iter()
            .chain(lines.last())
            .collect()
    } else {
        lines.iter().collect()
    };
    picked
        .into_iter()
        .flat_map(|r| {
            let (middle_x, middle_y) =
                ((r.x + r.width / 2.).round(), (r.y + r.height / 2.).round());
            [
                (r.x - 4., middle_y),
                (r.x + r.width + 4., middle_y),
                (middle_x, r.y - 2.),
                (middle_x, r.y + r.height + 2.),
            ]
        })
        .filter(|&(x, y)| inside(x, y, window))
        .map(|(x, y)| (x.floor() as i32, y.floor() as i32))
        .collect()
}

/// Points just inside the corners of the text box: asked only when the lines disagree.
pub fn corners(text_box: &Rect, window: Option<Rect>) -> Vec<(i32, i32)> {
    let (left, top, right, bottom) = (
        text_box.x + 4.,
        text_box.y + 4.,
        text_box.x + text_box.width - 5.,
        text_box.y + text_box.height - 5.,
    );
    if right < left || bottom < top {
        return Vec::new();
    }
    [(left, top), (right, top), (left, bottom), (right, bottom)]
        .into_iter()
        .filter(|&(x, y)| inside(x, y, window))
        .map(|(x, y)| (x.floor() as i32, y.floor() as i32))
        .collect()
}

fn inside(x: f64, y: f64, window: Option<Rect>) -> bool {
    x.is_finite()
        && y.is_finite()
        && window.is_none_or(|w| x >= w.x && y >= w.y && x < w.x + w.width && y < w.y + w.height)
}

/// The colour at least two points agree on, the most agreed first (the earliest on a tie).
/// Letters, antialiasing and a selection's own colour rarely agree twice around the lines;
/// the ground does.
pub fn agreed(colors: &[[u8; 3]]) -> Option<[u8; 3]> {
    let mut best: Option<([u8; 3], usize)> = None;
    for color in colors {
        let count = colors.iter().filter(|other| *other == color).count();
        if count >= 2 && best.is_none_or(|(_, most)| count > most) {
            best = Some((*color, count));
        }
    }
    best.map(|(color, _)| color)
}

/// A dark ground: the halo draws its dark version (perceived luminance below the middle).
pub fn dark(color: [u8; 3]) -> bool {
    0.299 * f64::from(color[0]) + 0.587 * f64::from(color[1]) + 0.114 * f64::from(color[2]) < 128.
}

/// The ground under `lines` (physical), or inside `text_box` when the lines disagree.
pub fn under(lines: &[Rect], text_box: Option<Rect>, window: Option<Rect>) -> Option<[u8; 3]> {
    agreed(&read(&points(lines, window)))
        .or_else(|| text_box.and_then(|b| agreed(&read(&corners(&b, window)))))
}

/// The colours of `points` on the screen: one `BitBlt` of their bounds, or one per point when
/// the bounds are too large. A point that cannot be read is left out.
fn read(points: &[(i32, i32)]) -> Vec<[u8; 3]> {
    let (Some(left), Some(top)) = (
        points.iter().map(|p| p.0).min(),
        points.iter().map(|p| p.1).min(),
    ) else {
        return Vec::new();
    };
    let (right, bottom) = (
        points.iter().map(|p| p.0).max().unwrap_or(left),
        points.iter().map(|p| p.1).max().unwrap_or(top),
    );
    let (width, height) = (right - left + 1, bottom - top + 1);
    if i64::from(width) * i64::from(height) <= MAX_BLIT {
        if let Some(pixels) = blit(left, top, width, height) {
            return points
                .iter()
                .filter_map(|&(x, y)| {
                    pixels
                        .get(((y - top) * width + (x - left)) as usize)
                        .copied()
                })
                .collect();
        }
        return Vec::new();
    }
    points
        .iter()
        .filter_map(|&(x, y)| blit(x, y, 1, 1).and_then(|p| p.first().copied()))
        .collect()
}

/// The screen's pixels in a rectangle (physical, the virtual screen's coordinates), as RGB.
#[cfg(windows)]
fn blit(x: i32, y: i32, width: i32, height: i32) -> Option<Vec<[u8; 3]>> {
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    if width <= 0 || height <= 0 {
        return None;
    }
    unsafe {
        let screen = GetDC(None);
        if screen.is_invalid() {
            return None;
        }
        let memory = CreateCompatibleDC(Some(screen));
        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
        let pixels = match CreateDIBSection(Some(memory), &info, DIB_RGB_COLORS, &mut bits, None, 0)
        {
            Ok(bitmap) => {
                let previous = SelectObject(memory, bitmap.into());
                let copied = BitBlt(memory, 0, 0, width, height, Some(screen), x, y, SRCCOPY)
                    .is_ok()
                    && !bits.is_null();
                // Top-down 32-bit DIB: B, G, R, unused per pixel.
                let read = copied.then(|| {
                    std::slice::from_raw_parts(bits as *const u8, (width * height * 4) as usize)
                        .chunks_exact(4)
                        .map(|p| [p[2], p[1], p[0]])
                        .collect()
                });
                SelectObject(memory, previous);
                let _ = DeleteObject(bitmap.into());
                read
            }
            Err(_) => None,
        };
        let _ = DeleteDC(memory);
        ReleaseDC(None, screen);
        pixels
    }
}

#[cfg(not(windows))]
fn blit(_: i32, _: i32, _: i32, _: i32) -> Option<Vec<[u8; 3]>> {
    None
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
    fn four_points_around_each_line_inside_the_window_only() {
        let line = r(100., 50., 200., 20.);
        assert_eq!(
            points(&[line], None),
            vec![(96, 60), (304, 60), (200, 48), (200, 72)]
        );
        // The window starts at x 98: the point left of the line is outside it.
        assert_eq!(
            points(&[line], Some(r(98., 0., 400., 400.))),
            vec![(304, 60), (200, 48), (200, 72)]
        );
        // Beyond four lines, the first three and the last.
        let many: Vec<Rect> = (0..10)
            .map(|n| r(0., 20. * f64::from(n) + 10., 50., 18.))
            .collect();
        let sampled: Vec<(i32, i32)> = points(&many, None);
        assert_eq!(sampled.len(), 16);
        assert_eq!(sampled[15], (25, 20 * 9 + 10 + 18 + 2));
    }

    #[test]
    fn the_corners_of_the_text_box_are_just_inside_it() {
        assert_eq!(
            corners(&r(10., 20., 300., 100.), None),
            vec![(14, 24), (305, 24), (14, 115), (305, 115)]
        );
        assert!(
            corners(&r(10., 20., 5., 5.), None).is_empty(),
            "a box too small has no inside corner"
        );
    }

    #[test]
    fn the_ground_is_what_two_points_at_least_agree_on() {
        let (white, ink, blue) = ([255, 255, 255], [32, 33, 36], [0, 120, 215]);
        assert_eq!(
            agreed(&[ink, white, blue, white, [40, 41, 44]]),
            Some(white)
        );
        assert_eq!(agreed(&[ink, white, blue]), None, "no two agree");
        assert_eq!(agreed(&[]), None);
        // The most agreed wins; on a tie, the first seen.
        assert_eq!(agreed(&[blue, blue, white, white, white]), Some(white));
        assert_eq!(agreed(&[blue, white, blue, white]), Some(blue));
    }

    #[test]
    fn dark_and_light_grounds() {
        assert!(!dark([255, 255, 255]));
        assert!(!dark([230, 230, 230]), "Word's grey canvas is light");
        assert!(dark([30, 31, 34]));
        assert!(dark([0, 0, 0]));
        // Luminance near the middle: saturated blue is dark, saturated yellow light.
        assert!(dark([0, 0, 255]));
        assert!(!dark([255, 255, 0]));
    }
}

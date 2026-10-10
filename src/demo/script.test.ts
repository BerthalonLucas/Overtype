import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  cues,
  cuesBetween,
  dragProgress,
  hudAt,
  introAt,
  keysAt,
  phaseAt,
  phaseIds,
  phaseIndexAt,
  phaseProgress,
  phaseStarts,
  pointerAt,
  position,
  stills,
  T,
  type Cue,
  type PlayerState,
  type PointerPlaces,
} from './script';

const places: PointerPlaces = {
  home: { x: 800, y: 700 },
  dragFrom: { x: 100, y: 200 },
  dragTo: { x: 300, y: 250 },
  rest: { x: 420, y: 330 },
  ask: { x: 290, y: 280 },
  tile: { x: 240, y: 300 },
  aside: { x: 380, y: 360 },
  undo: { x: 270, y: 290 },
  caret: { x: 330, y: 320 },
  out: { x: 760, y: 640 },
};
const drag = (p: number) => ({ x: 100 + 200 * p, y: 200 + 50 * p });

// A host whose time and frames the test drives.
function host() {
  let now = 0;
  const frames: Array<(now: number) => void> = [];
  const fired: Cue[] = [];
  const states: PlayerState[] = [];
  return {
    fired,
    states,
    frames: () => frames.length,
    advance(ms: number, step = 16) {
      for (let done = 0; done < ms; done += step) {
        now += step;
        const due = frames.splice(0);
        for (const run of due) run(now);
      }
    },
    host: {
      now: () => now,
      frame: (run: (now: number) => void) => {
        frames.push(run);
        return () => {
          const at = frames.indexOf(run);
          if (at >= 0) frames.splice(at, 1);
        };
      },
      onCue: (cue: Cue) => {
        fired.push(cue);
      },
      onChange: (state: PlayerState) => {
        states.push(state);
      },
    },
  };
}

describe('the phases', () => {
  it('are seven, in order, each with its start', () => {
    expect(phaseIds).toEqual(['ready', 'select', 'shortcut', 'menu', 'work', 'result', 'undo']);
    const starts = phaseIds.map((id) => phaseStarts[id]);
    expect(starts[0]).toBe(0);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    expect(T.end).toBeGreaterThan(starts[starts.length - 1]);
  });
  it('give one position: 2.5 is the middle of the third phase', () => {
    expect(phaseAt(0)).toBe('ready');
    expect(phaseAt(T.select)).toBe('select');
    expect(phaseAt(T.select - 1)).toBe('ready');
    expect(phaseIndexAt(T.paste)).toBe(5);
    expect(phaseProgress(0)).toBe(0);
    expect(phaseProgress((T.shortcut + T.menu) / 2)).toBeCloseTo(0.5);
    expect(position((T.shortcut + T.menu) / 2)).toBeCloseTo(2.5);
    expect(position(T.END)).toBe(7);
    let previous = -1;
    for (let t = 0; t <= T.END; t += 50) {
      expect(position(t)).toBeGreaterThanOrEqual(previous);
      previous = position(t);
    }
  });
  it('hold each action in its own phase', () => {
    expect(phaseAt(T.introOut)).toBe('ready');
    for (const time of [T.cursorIn, T.press, T.dragFrom, T.dragTo, T.release]) expect(phaseAt(time)).toBe('select');
    for (const time of [T.hudIn, T.key1, T.key2, T.key3, T.open]) expect(phaseAt(time)).toBe('shortcut');
    for (const time of [T.toAsk, T.atAsk, T.toTile, T.click]) expect(phaseAt(time)).toBe('menu');
    for (const time of [T.pick, T.answer]) expect(phaseAt(time)).toBe('work');
    expect(phaseAt(T.paste)).toBe('result');
    for (const time of [T.toUndo, T.atUndo, T.caret]) expect(phaseAt(time)).toBe('undo');
    // The drag is the one Lucas asked for: about 1.6 s.
    expect(T.dragTo - T.dragFrom).toBe(1600);
  });
  it('have a still picture each, for reduced motion', () => {
    expect(Object.keys(stills)).toEqual([...phaseIds]);
    expect(stills.ready.intro).toBe(true);
    expect(stills.select.selected).toBe(true);
    expect(stills.shortcut.ilot).toBe('compact');
    expect(stills.menu.ilot).toBe('grid');
    expect(stills.work).toMatchObject({ ilot: 'working', halo: 'work', pasted: false });
    expect(stills.result).toMatchObject({ ilot: 'done', pasted: true, marks: true });
    expect(stills.undo).toMatchObject({ ilot: 'check', marks: false });
  });
});

describe('the cues', () => {
  it('are in order and found once by the span that crosses them', () => {
    for (let i = 1; i < cues.length; i++) expect(cues[i].at).toBeGreaterThan(cues[i - 1].at);
    expect(cuesBetween(0, T.END).map((cue) => cue.id)).toEqual(cues.map((cue) => cue.id));
    expect(cuesBetween(T.open - 1, T.open).map((cue) => cue.id)).toEqual(['open']);
    expect(cuesBetween(T.open, T.open + 10)).toEqual([]);
  });
});

describe('the continuous values', () => {
  it('light the keys one after the other, then release them together', () => {
    expect(keysAt(T.key1 - 1).map((key) => key.lit)).toEqual([0, 0, 0]);
    const second = keysAt(T.key2 + 200);
    expect(second[0].lit).toBe(1);
    expect(second[1].lit).toBe(1);
    expect(second[2].lit).toBe(0);
    expect(keysAt(T.open).every((key) => key.lit === 1)).toBe(true);
    expect(keysAt(T.keysUp + 400).every((key) => key.lit === 0 && key.down === 0)).toBe(true);
    // Four keys (Ctrl + Alt + Shift + Space) share the same span.
    const four = keysAt(T.key3 + 200, 4);
    expect(four).toHaveLength(4);
    expect(four.every((key) => key.lit === 1)).toBe(true);
    expect(keysAt(T.key1 + 10, 4)[3].lit).toBe(0);
  });
  it('show the keys under the window only around the shortcut', () => {
    expect(hudAt(T.hudIn - 1).opacity).toBe(0);
    expect(hudAt(T.key2).opacity).toBe(1);
    expect(hudAt(T.hudOut + 400).opacity).toBe(0);
    expect(introAt(1000).opacity).toBe(1);
    expect(introAt(T.select).on).toBe(false);
  });
  it('drag from 0 to 1 and nowhere else', () => {
    expect(dragProgress(T.dragFrom - 1)).toBe(0);
    expect(dragProgress((T.dragFrom + T.dragTo) / 2)).toBe(0.5);
    expect(dragProgress(T.END)).toBe(1);
  });
  it('move the pointer without a jump, an I-beam over the text, pressed while it drags and clicks', () => {
    let previous = pointerAt(0, places, drag);
    for (let t = 8; t <= T.END; t += 8) {
      const pointer = pointerAt(t, places, drag);
      expect(Math.hypot(pointer.x - previous.x, pointer.y - previous.y), `t ${t}`).toBeLessThan(20);
      previous = pointer;
    }
    expect(pointerAt(0, places, drag).opacity).toBe(0);
    expect(pointerAt(T.cursorAt + 50, places, drag)).toMatchObject({ x: 100, y: 200, shape: 'beam', opacity: 1 });
    expect(pointerAt((T.dragFrom + T.dragTo) / 2, places, drag)).toMatchObject({
      x: 200,
      y: 225,
      shape: 'beam',
      press: 1,
    });
    expect(pointerAt(T.atAsk + 10, places, drag)).toMatchObject({ ...places.ask, shape: 'arrow', press: 0 });
    expect(pointerAt(T.click + 110, places, drag).press).toBeGreaterThan(0.9);
    expect(pointerAt(T.atUndo + 200, places, drag)).toMatchObject(places.undo);
    expect(pointerAt(T.caret + 50, places, drag).shape).toBe('beam');
    expect(pointerAt(T.END, places, drag).opacity).toBe(0);
  });
});

describe('the player', () => {
  it('fires every cue once, in order, and ends', () => {
    const h = host();
    const player = createPlayer(h.host);
    player.play();
    h.advance(T.END + 500);
    expect(h.fired.map((cue) => cue.id)).toEqual(cues.map((cue) => cue.id));
    expect(player.state()).toEqual({ t: T.END, playing: false, ended: true });
    expect(h.frames()).toBe(0);
    // Asked to play again at the end, it stays there.
    player.play();
    expect(h.frames()).toBe(0);
  });
  it('stands still while paused and goes on from the same instant', () => {
    const h = host();
    const player = createPlayer(h.host);
    player.play();
    h.advance(T.press + 20);
    player.pause();
    const at = player.state().t;
    const fired = h.fired.length;
    h.advance(5000);
    expect(player.state()).toEqual({ t: at, playing: false, ended: false });
    expect(h.fired).toHaveLength(fired);
    player.play();
    player.play();
    expect(h.frames()).toBe(1);
    h.advance(160);
    expect(player.state().t).toBeCloseTo(at + 160, -1);
  });
  it('starts again from any instant with every cue to come', () => {
    const h = host();
    const player = createPlayer(h.host);
    player.play();
    h.advance(T.pick + 100);
    const before = h.fired.length;
    player.restart();
    player.restart();
    expect(player.state()).toMatchObject({ t: 0, playing: true });
    expect(h.frames()).toBe(1);
    h.advance(T.END + 500);
    expect(h.fired.slice(before).map((cue) => cue.id)).toEqual(cues.map((cue) => cue.id));
  });
  it('can be stopped at any instant: no cue, no frame, no word after', () => {
    for (const at of [0, T.press, T.open + 5, T.pick, T.paste + 1, T.caret, T.END - 10]) {
      const h = host();
      const player = createPlayer(h.host);
      player.play();
      h.advance(at);
      player.stop();
      const fired = h.fired.length,
        told = h.states.length;
      h.advance(T.END);
      player.play();
      player.restart();
      player.pause();
      h.advance(2000);
      expect(h.fired, `stopped at ${at}`).toHaveLength(fired);
      expect(h.states).toHaveLength(told);
      expect(h.frames()).toBe(0);
    }
  });
  it('stops from inside a cue without firing the next one of the same frame', () => {
    const h = host();
    const fired: string[] = [];
    const player = createPlayer({
      ...h.host,
      onCue: (cue) => {
        fired.push(cue.id);
        if (cue.id === 'click') player.stop();
      },
    });
    player.play();
    h.advance(T.END);
    expect(fired.at(-1)).toBe('click');
  });
  it('never jumps over a stalled frame', () => {
    const h = host();
    const player = createPlayer(h.host);
    player.play();
    h.advance(5000, 5000);
    expect(player.state().t).toBeLessThanOrEqual(64);
  });
});

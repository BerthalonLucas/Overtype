import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button, Dialog, Field, Input, Tooltip, TooltipProvider, useFieldId } from './controls';

const must = <T,>(value: T | null | undefined): T => {
  if (value == null) throw new Error('missing');
  return value;
};

// The shared controls of the Settings and the setup, as a keyboard or a screen reader meets them.
let root: Root;
let host: HTMLElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = (node: React.ReactNode) => act(async () => root.render(node));
// Until the exit animation is over (the dialog leaves through AnimatePresence).
async function until(test: () => boolean, ms = 3000) {
  const start = Date.now();
  while (!test()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  }
}

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button id="opener" onClick={() => setOpen(true)}>
        Open
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Title"
        actions={
          <Button id="done" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <textarea id="inside" autoFocus />
      </Dialog>
    </>
  );
}

// FE-01 (audit Elio): the dialog gave the focus to <body> when it closed.
describe('Dialog', () => {
  for (const [way, close] of [
    [
      'Escape',
      () => must(document.activeElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ],
    ['its cross', () => must(document.querySelector<HTMLButtonElement>('.ft-dialog-close')).click()],
    ['its own button', () => must(document.querySelector<HTMLButtonElement>('#done')).click()],
  ] as const) {
    it(`gives the focus back to the button that opened it, closed by ${way}`, async () => {
      await render(<Opener />);
      const opener = must(document.querySelector<HTMLButtonElement>('#opener'));
      opener.focus();
      await act(async () => opener.click());
      await until(() => document.querySelector('.ft-dialog') !== null);
      expect(document.activeElement?.id).toBe('inside');
      await act(async () => close());
      await until(() => document.querySelector('.ft-dialog') === null);
      // Radix moves the focus on the next task once its scope is gone.
      await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(document.activeElement).toBe(opener);
    });
  }
});

// FE-03 (audit Elio): the hint and the problem under a field were not tied to its control.
describe('Field', () => {
  function Probe({ problem }: { problem?: string }) {
    const id = useFieldId('x');
    return (
      <Field label="Address" htmlFor={id} hint="The hint" problem={problem}>
        {(control) => <Input id={id} {...control} />}
      </Field>
    );
  }
  it('describes its control by its hint, then by its problem, which also marks it invalid', async () => {
    await render(<Probe />);
    const input = must(host.querySelector('input'));
    const describedBy = () => must(input.getAttribute('aria-describedby')).split(' ');
    expect(describedBy().map((id) => document.getElementById(id)?.textContent)).toEqual(['The hint']);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    await render(<Probe problem="Not an address" />);
    expect(describedBy().map((id) => document.getElementById(id)?.textContent)).toEqual(['Not an address']);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});

// R11: one Tooltip.Provider per window, at its root, not one per tooltip.
describe('Tooltip', () => {
  it('has no provider of its own: it reads the one at the window root', async () => {
    const errors = console.error;
    console.error = () => undefined;
    try {
      await expect(
        render(
          <Tooltip content="tip">
            <button type="button">x</button>
          </Tooltip>,
        ),
      ).rejects.toThrow(/TooltipProvider/);
    } finally {
      console.error = errors;
    }
    root = createRoot(host);
    await render(
      <TooltipProvider>
        <Tooltip content="one">
          <button type="button">a</button>
        </Tooltip>
        <Tooltip content="two" delay={0}>
          <button type="button">b</button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(host.querySelectorAll('button')).toHaveLength(2);
  });
});

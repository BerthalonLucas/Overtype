import { useEffect, useState } from 'react';
import { bridge } from '../bridge';
import type { UpdateStatus } from '../types';

// The in-app update as Rust sees it (update.rs): asked once, then every `update-status`.
export function useUpdate(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    let live = true;
    let received = false;
    let off: (() => void) | undefined;
    // The event is newer than any answer of the command still on its way.
    void bridge
      .on<UpdateStatus>('update-status', (next) => {
        if (!live) return;
        received = true;
        setStatus(next);
      })
      .then(
        (unlisten) => {
          if (live) off = unlisten;
          else unlisten();
        },
        () => undefined,
      );
    void bridge.updateStatus().then(
      (next) => {
        if (live && !received) setStatus(next);
      },
      () => undefined,
    );
    return () => {
      live = false;
      off?.();
    };
  }, []);
  return status;
}

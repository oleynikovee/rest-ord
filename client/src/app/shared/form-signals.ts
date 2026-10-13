import type { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { AbstractControl } from '@angular/forms';
import { map } from 'rxjs';

/**
 * Validity as a signal. Templates read it instead of `control.invalid`, so they
 * update under zoneless change detection whatever changed the status
 * (user input, programmatic setValue or validators added at runtime).
 * Must be called in an injection context; `statusChanges` completes with the control.
 */
export function invalidSignal(control: AbstractControl): Signal<boolean> {
  return toSignal(control.statusChanges.pipe(map((status) => status !== 'VALID')), {
    initialValue: control.invalid,
  });
}

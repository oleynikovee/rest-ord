import type { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { AbstractControl } from '@angular/forms';
import { map } from 'rxjs';

export function invalidSignal(control: AbstractControl): Signal<boolean> {
  return toSignal(control.statusChanges.pipe(map((status) => status !== 'VALID')), {
    initialValue: control.invalid,
  });
}

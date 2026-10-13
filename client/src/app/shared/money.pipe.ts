import { Pipe, type PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : formatter.format(cents / 100);
}

@Pipe({
  name: 'money',
})
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    return formatMoney(cents);
  }
}

export const toCents = (value: number): number => Math.round(value * 100);

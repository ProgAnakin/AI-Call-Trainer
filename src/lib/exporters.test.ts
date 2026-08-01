import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './exporters';

describe('csvCell', () => {
  it('wraps values in quotes', () => {
    expect(csvCell('hello')).toBe('"hello"');
    expect(csvCell(42)).toBe('"42"');
  });

  it('escapes embedded quotes by doubling them', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('keeps commas and newlines safe inside the quoted cell', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('neutralizes spreadsheet formula injection', () => {
    expect(csvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`);
    expect(csvCell('+cmd')).toBe(`"'+cmd"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
    expect(csvCell('@x')).toBe(`"'@x"`);
    expect(csvCell('safe=y')).toBe('"safe=y"'); // only a leading formula char is risky
  });
});

describe('toCsv', () => {
  it('joins rows and cells', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('"a","b"\n"1","2"');
  });
});

export function n0(x: number): string {
  if (!isFinite(x)) return '∞';
  const a = Math.abs(x);
  if (a >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(x / 1e3).toFixed(1)}k`;
  return Math.round(x).toLocaleString('en-US');
}

export function n1(x: number): string {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) >= 100) return n0(x);
  return (Math.round(x * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function signed(x: number, digits = 1): string {
  const v = digits === 0 ? n0(x) : n1(x);
  return x > 0.049 ? `+${v}` : v;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "10^x" as text with a superscript exponent (for figures in running text). */
export function pow10(x: number): string {
  const sup: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·', '-': '⁻' };
  const t = (Math.round(x * 10) / 10).toString();
  return `10${t.split('').map((c) => sup[c] ?? c).join('')}`;
}

/**
 * present の `.play` が参照するコードの読み込み。
 *
 * `golang.org/x/tools/present/code.go` の `codeLines` と、
 * その手前のアドレス解決（`args.go` の `addrToByteRange`）に合わせている。
 * ただし現在の Tour コンテンツにアドレス付きの `.play` は無いので、
 * アドレスは代表的な記法（`/re/`, `,`, `$`, 行番号）だけを扱う。
 */

export type AddressRange = {
  lo: number;
  hi: number;
};

/** `/START/,/END/` のようなアドレスを文字オフセットに解決する。 */
export function resolveAddress(address: string, start: number, source: string): AddressRange {
  const trimmed = address.trim();
  if (trimmed === '') {
    return { lo: start, hi: source.length };
  }

  const comma = splitAddress(trimmed);
  if (comma !== null) {
    const [firstAddress, secondAddress] = comma;
    const first =
      firstAddress === '' ? { lo: start, hi: start } : resolveSingle(firstAddress, start, source);
    const second =
      secondAddress === ''
        ? { lo: source.length, hi: source.length }
        : resolveSingle(secondAddress, first.hi, source);
    return { lo: first.lo, hi: second.hi };
  }

  return resolveSingle(trimmed, start, source);
}

/** トップレベルの `,` で 2 つに分ける。`/re,re/` の中のカンマは無視する。 */
function splitAddress(address: string): [string, string] | null {
  let inRegexp = false;
  for (let i = 0; i < address.length; i++) {
    const char = address[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (char === '/') {
      inRegexp = !inRegexp;
      continue;
    }
    if (char === ',' && !inRegexp) {
      return [address.slice(0, i), address.slice(i + 1)];
    }
  }
  return null;
}

function resolveSingle(address: string, start: number, source: string): AddressRange {
  if (address === '') {
    return { lo: start, hi: start };
  }
  if (address === '$') {
    return { lo: source.length, hi: source.length };
  }
  if (address[0] === '/') {
    const close = findRegexpEnd(address);
    if (close < 0) {
      throw new Error(`invalid address ${JSON.stringify(address)}: unterminated regexp`);
    }
    const pattern = address.slice(1, close);
    const rest = address.slice(close + 1);
    if (rest !== '') {
      throw new Error(`unsupported address suffix ${JSON.stringify(rest)}`);
    }
    const regexp = new RegExp(pattern, 'm');
    const forward = regexp.exec(source.slice(start));
    const match = forward ?? regexp.exec(source);
    if (match === null) {
      throw new Error(`no match for address ${JSON.stringify(address)}`);
    }
    const lo = forward !== null ? start + match.index : match.index;
    return { lo, hi: lo + match[0].length };
  }
  if (/^\d+$/.test(address)) {
    return lineRange(Number(address), source);
  }
  throw new Error(`unsupported address ${JSON.stringify(address)}`);
}

function findRegexpEnd(address: string): number {
  for (let i = 1; i < address.length; i++) {
    if (address[i] === '\\') {
      i++;
      continue;
    }
    if (address[i] === '/') {
      return i;
    }
  }
  return -1;
}

function lineRange(lineNumber: number, source: string): AddressRange {
  const lines = source.split('\n');
  const wanted = Math.max(1, lineNumber);
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const end = offset + lines[i].length;
    if (i + 1 === wanted) {
      return { lo: offset, hi: end };
    }
    offset = end + 1;
  }
  throw new Error(`address out of range: line ${lineNumber}`);
}

/**
 * present の `codeLines`。開始・終了位置を行境界に広げたうえで、
 * `OMIT` 行を除き、先頭と末尾の空行を削る。
 */
export function extractCode(source: string, address: string): string {
  let { lo, hi } = resolveAddress(address, 0, source);
  if (lo > hi) {
    [lo, hi] = [hi, lo];
  }

  // Acme のパターンは行の途中で終わることがあるので、両方向に行末まで広げる。
  while (lo > 0 && source[lo - 1] !== '\n') {
    lo--;
  }
  if (hi > 0) {
    while (hi < source.length && source[hi - 1] !== '\n') {
      hi++;
    }
  }

  return codeLines(source.slice(lo, hi));
}

/** present の `codeLines` と同じ OMIT 除去・空行トリム。 */
export function codeLines(segment: string): string {
  if (segment === '') {
    return '';
  }
  const lines = segment.split('\n');
  // Go の bufio.Scanner は末尾の改行に対して空行を返さない。
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const kept = lines.filter((line) => !line.endsWith('OMIT'));
  while (kept.length > 0 && kept[0] === '') {
    kept.shift();
  }
  while (kept.length > 0 && kept[kept.length - 1] === '') {
    kept.pop();
  }
  return kept.length === 0 ? '' : `${kept.join('\n')}\n`;
}

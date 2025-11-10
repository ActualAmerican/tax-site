// src/lib/url/share.ts
// Legacy helpers that bridge older URL routines to the new permalink codec.

import type { ShareInputs } from '../share.ts';
import { decode, encode, mergeModel } from '../share.ts';

export type Inputs = ShareInputs;
export type { ShareInputs, ShareModel, ShareModelPatch } from '../share.ts';
export {
  CANONICAL_KEYS,
  STATE_CODE_TO_FIPS,
  FIPS_TO_STATE_CODE,
  createDefaultModel,
  decode,
  encode,
  encodeToString,
  mergeModel,
  scopeToMask,
  maskToScope,
  filingStatusToCode,
  codeToFilingStatus,
} from '../share.ts';

export function currentURL(): URL {
  return new URL(window.location.href);
}

export function parseNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function readInputsFromURL(u: URL): Inputs {
  return decode(u).inputs;
}

export function writeInputsToURL(u: URL, inputs: Inputs): URL {
  const baseModel = decode(u);
  const merged = mergeModel(baseModel, { inputs });
  return encode(merged, { baseUrl: u });
}

export function buildCompareURL(a: string, b: string, base?: URL): URL {
  const u = base ? new URL(base.href) : currentURL();
  u.searchParams.set('a', a.toUpperCase());
  u.searchParams.set('b', b.toUpperCase());
  return u;
}

export function linkToMainWithInputs(fips: string, base?: URL): URL {
  const source = base ? new URL(base.href) : currentURL();
  const model = decode(source);
  const merged = mergeModel(model, { state: { fips: typeof fips === 'string' ? fips.trim() : fips } });
  return encode(merged, { baseUrl: source });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

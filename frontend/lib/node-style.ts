export type NodeStyleBreakpoint = 'mobile' | 'tablet' | 'desktop';
export type NodeStyleInteractionState = 'default' | 'hover' | 'active' | 'focus';

export const NODE_STYLE_ALLOWED_KEYS = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'display',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'rowGap',
  'columnGap',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignContent',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridAutoFlow',
  'placeItems',
  'placeContent',
  'background',
  'backgroundColor',
  'backgroundImage',
  'backgroundPosition',
  'backgroundSize',
  'backgroundRepeat',
  'border',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'boxShadow',
  'opacity',
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecoration',
  'visibility',
  'whiteSpace',
  'wordBreak',
  'objectFit',
  'objectPosition',
  'overflow',
  'overflowX',
  'overflowY',
  'transform',
  'transformOrigin',
  'filter',
  'backdropFilter',
  'transition',
  'transitionProperty',
  'transitionDuration',
  'transitionTimingFunction',
  'transitionDelay',
  'mixBlendMode',
  'cursor',
  'pointerEvents',
  'userSelect',
] as const;

const NODE_STYLE_ALLOWED_SET = new Set<string>(NODE_STYLE_ALLOWED_KEYS);
const STYLE_STATE_KEYS = new Set<string>(['hover', 'active', 'focus']);

const STYLE_VALUE_DENY_PATTERNS = [
  /javascript\s*:/i,
  /expression\s*\(/i,
  /@import\b/i,
  /<\/?script\b/i,
  /url\s*\(\s*['\"]?\s*javascript\s*:/i,
];

const STYLE_KEY_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;
const MAX_STYLE_ITEMS = 200;
const MAX_STYLE_VALUE_LEN = 240;
const CSS_NUMBER_RE = /^-?\d+(?:\.\d+)?$/;
const CSS_INTEGER_RE = /^-?\d+$/;
const CSS_LENGTH_OR_ZERO_RE = /^(?:0|-?\d+(?:\.\d+)?(?:px|%|rem|vw|vh))$/i;
const CSS_SIZE_RE = /^(?:auto|fit-content|min-content|max-content|none|0|-?\d+(?:\.\d+)?(?:px|%|rem|vw|vh))$/i;
const CSS_COLOR_RE =
  /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab)\([^)]*\)|transparent|currentcolor|inherit|var\(--[a-z0-9-_]+\))$/i;
const CSS_TIMING_RE = /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\([^)]*\)|steps\([^)]*\))$/i;
const CSS_SIMPLE_TOKEN_RE = /^[a-z0-9_#().,%\-+\s/]*$/i;

export type NodeStylePropertyKey = (typeof NODE_STYLE_ALLOWED_KEYS)[number];
export type NodeStyleMap = Partial<Record<NodeStylePropertyKey, string>>;

export type NodeStyle = {
  base?: NodeStyleMap;
  breakpoints?: Partial<Record<Exclude<NodeStyleBreakpoint, 'desktop'>, NodeStyleMap>>;
  states?: Partial<Record<Exclude<NodeStyleInteractionState, 'default'>, NodeStyleMap>>;
  stateBreakpoints?: Partial<
    Record<
      Exclude<NodeStyleInteractionState, 'default'>,
      Partial<Record<Exclude<NodeStyleBreakpoint, 'desktop'>, NodeStyleMap>>
    >
  >;
  advanced?: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeCssValue(raw: unknown): string | undefined {
  let value: string;
  if (typeof raw === 'string') {
    value = raw.trim();
  } else if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return undefined;
    value = String(raw);
  } else {
    return undefined;
  }

  if (!value) return undefined;
  if (value.length > MAX_STYLE_VALUE_LEN) return undefined;
  for (const pat of STYLE_VALUE_DENY_PATTERNS) {
    if (pat.test(value)) return undefined;
  }
  return value;
}

function isCssColor(value: string): boolean {
  return CSS_COLOR_RE.test(value.trim());
}

function isCssSize(value: string): boolean {
  return CSS_SIZE_RE.test(value.trim());
}

function isCssLength(value: string): boolean {
  return CSS_LENGTH_OR_ZERO_RE.test(value.trim());
}

function isCssNumberish(value: string): boolean {
  return CSS_NUMBER_RE.test(value.trim());
}

const STYLE_ENUMS: Partial<Record<NodeStylePropertyKey, Set<string>>> = {
  position: new Set(['static', 'relative', 'absolute', 'fixed', 'sticky']),
  display: new Set([
    'block',
    'inline',
    'inline-block',
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'none',
    'contents',
  ]),
  flexDirection: new Set(['row', 'row-reverse', 'column', 'column-reverse']),
  flexWrap: new Set(['nowrap', 'wrap', 'wrap-reverse']),
  justifyContent: new Set([
    'normal',
    'start',
    'end',
    'center',
    'left',
    'right',
    'flex-start',
    'flex-end',
    'space-between',
    'space-around',
    'space-evenly',
    'stretch',
  ]),
  alignItems: new Set(['normal', 'start', 'end', 'center', 'baseline', 'stretch', 'flex-start', 'flex-end']),
  alignContent: new Set([
    'normal',
    'start',
    'end',
    'center',
    'stretch',
    'space-between',
    'space-around',
    'space-evenly',
    'flex-start',
    'flex-end',
  ]),
  gridAutoFlow: new Set(['row', 'column', 'dense', 'row dense', 'column dense']),
  textAlign: new Set(['left', 'right', 'center', 'justify', 'start', 'end', 'match-parent']),
  textTransform: new Set(['none', 'capitalize', 'uppercase', 'lowercase', 'full-width', 'full-size-kana']),
  textDecoration: new Set(['none', 'underline', 'overline', 'line-through']),
  visibility: new Set(['visible', 'hidden', 'collapse']),
  whiteSpace: new Set(['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces']),
  wordBreak: new Set(['normal', 'break-all', 'keep-all', 'break-word']),
  objectFit: new Set(['fill', 'contain', 'cover', 'none', 'scale-down']),
  overflow: new Set(['visible', 'hidden', 'clip', 'scroll', 'auto']),
  overflowX: new Set(['visible', 'hidden', 'clip', 'scroll', 'auto']),
  overflowY: new Set(['visible', 'hidden', 'clip', 'scroll', 'auto']),
  pointerEvents: new Set(['auto', 'none']),
  userSelect: new Set(['auto', 'none', 'text', 'contain', 'all']),
  cursor: new Set([
    'auto',
    'default',
    'pointer',
    'grab',
    'grabbing',
    'text',
    'move',
    'not-allowed',
    'crosshair',
    'zoom-in',
    'zoom-out',
  ]),
  borderStyle: new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']),
};

function isValidStyleValueForKey(key: string, value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  if (key in STYLE_ENUMS) {
    const allowed = STYLE_ENUMS[key as NodeStylePropertyKey];
    return !!allowed && allowed.has(v.toLowerCase());
  }

  if (key === 'opacity') {
    if (!isCssNumberish(v)) return false;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 1;
  }

  if (key === 'zIndex') return CSS_INTEGER_RE.test(v);

  if (
    key === 'width' ||
    key === 'height' ||
    key === 'minWidth' ||
    key === 'maxWidth' ||
    key === 'minHeight' ||
    key === 'maxHeight' ||
    key === 'top' ||
    key === 'right' ||
    key === 'bottom' ||
    key === 'left'
  ) {
    return isCssSize(v);
  }

  if (
    key === 'margin' ||
    key === 'marginTop' ||
    key === 'marginRight' ||
    key === 'marginBottom' ||
    key === 'marginLeft' ||
    key === 'padding' ||
    key === 'paddingTop' ||
    key === 'paddingRight' ||
    key === 'paddingBottom' ||
    key === 'paddingLeft' ||
    key === 'gap' ||
    key === 'rowGap' ||
    key === 'columnGap' ||
    key === 'borderWidth' ||
    key === 'borderTopWidth' ||
    key === 'borderRightWidth' ||
    key === 'borderBottomWidth' ||
    key === 'borderLeftWidth' ||
    key === 'borderRadius' ||
    key === 'borderTopLeftRadius' ||
    key === 'borderTopRightRadius' ||
    key === 'borderBottomRightRadius' ||
    key === 'borderBottomLeftRadius' ||
    key === 'fontSize' ||
    key === 'lineHeight' ||
    key === 'letterSpacing' ||
    key === 'transitionDuration' ||
    key === 'transitionDelay'
  ) {
    return v.split(/\s+/).every(isCssLength);
  }

  if (
    key === 'color' ||
    key === 'backgroundColor' ||
    key === 'borderColor' ||
    key === 'borderTopColor' ||
    key === 'borderRightColor' ||
    key === 'borderBottomColor' ||
    key === 'borderLeftColor'
  ) {
    return isCssColor(v);
  }

  if (key === 'fontWeight') {
    return CSS_INTEGER_RE.test(v) || ['normal', 'bold', 'lighter', 'bolder'].includes(v.toLowerCase());
  }

  if (key === 'backgroundPosition' || key === 'objectPosition' || key === 'transformOrigin') {
    return v.length <= 80 && CSS_SIMPLE_TOKEN_RE.test(v);
  }

  if (key === 'transitionTimingFunction') return CSS_TIMING_RE.test(v);

  // Composite values remain permissive here, but are still sanitized for
  // dangerous patterns and max length by sanitizeCssValue.
  return true;
}

function sanitizeStyleMap(raw: unknown, allowCustomKeys: boolean): Record<string, string> | undefined {
  if (!isRecord(raw)) return undefined;

  const out: Record<string, string> = {};
  let count = 0;

  for (const [keyRaw, valueRaw] of Object.entries(raw)) {
    if (count >= MAX_STYLE_ITEMS) break;
    const key = keyRaw.trim();
    if (!key) continue;

    if (allowCustomKeys) {
      if (!STYLE_KEY_RE.test(key)) continue;
    } else if (!NODE_STYLE_ALLOWED_SET.has(key)) {
      continue;
    }

    const value = sanitizeCssValue(valueRaw);
    if (!value) continue;
    if (!allowCustomKeys && !isValidStyleValueForKey(key, value)) continue;

    out[key] = value;
    count += 1;
  }

  return Object.keys(out).length ? out : undefined;
}

export function sanitizeNodeStyle(raw: unknown): NodeStyle | undefined {
  if (!isRecord(raw)) return undefined;

  const base = sanitizeStyleMap(raw['base'], false);

  let breakpoints: NodeStyle['breakpoints'] | undefined;
  if (isRecord(raw['breakpoints'])) {
    const bpRaw = raw['breakpoints'] as Record<string, unknown>;
    const mobile = sanitizeStyleMap(bpRaw['mobile'], false);
    const tablet = sanitizeStyleMap(bpRaw['tablet'], false);
    if (mobile || tablet) {
      breakpoints = {};
      if (mobile) breakpoints.mobile = mobile as NodeStyleMap;
      if (tablet) breakpoints.tablet = tablet as NodeStyleMap;
    }
  }

  let states: NodeStyle['states'] | undefined;
  if (isRecord(raw['states'])) {
    const stRaw = raw['states'] as Record<string, unknown>;
    const hover = sanitizeStyleMap(stRaw['hover'], false);
    const active = sanitizeStyleMap(stRaw['active'], false);
    const focus = sanitizeStyleMap(stRaw['focus'], false);
    if (hover || active || focus) {
      states = {};
      if (hover) states.hover = hover as NodeStyleMap;
      if (active) states.active = active as NodeStyleMap;
      if (focus) states.focus = focus as NodeStyleMap;
    }
  }

  let stateBreakpoints: NodeStyle['stateBreakpoints'] | undefined;
  if (isRecord(raw['stateBreakpoints'])) {
    const sbRaw = raw['stateBreakpoints'] as Record<string, unknown>;
    const next: NonNullable<NodeStyle['stateBreakpoints']> = {};

    for (const stateKey of ['hover', 'active', 'focus'] as const) {
      const stateRaw = sbRaw[stateKey];
      if (!isRecord(stateRaw)) continue;
      const mobile = sanitizeStyleMap((stateRaw as Record<string, unknown>)['mobile'], false);
      const tablet = sanitizeStyleMap((stateRaw as Record<string, unknown>)['tablet'], false);
      if (mobile || tablet) {
        next[stateKey] = {
          ...(mobile ? { mobile: mobile as NodeStyleMap } : {}),
          ...(tablet ? { tablet: tablet as NodeStyleMap } : {}),
        };
      }
    }

    if (Object.keys(next).length) stateBreakpoints = next;
  }

  const advanced = sanitizeStyleMap(raw['advanced'], true);

  // Back-compat: if legacy raw style object is flat, interpret as `base`.
  let compatBase = base;
  if (!compatBase && !breakpoints && !states && !stateBreakpoints && !advanced) {
    compatBase = sanitizeStyleMap(raw, false) as NodeStyleMap | undefined;
  }

  const out: NodeStyle = {};
  if (compatBase) out.base = compatBase as NodeStyleMap;
  if (breakpoints) out.breakpoints = breakpoints;
  if (states) out.states = states;
  if (stateBreakpoints) out.stateBreakpoints = stateBreakpoints;
  if (advanced) out.advanced = advanced;

  return Object.keys(out).length ? out : undefined;
}

function mergeInto(target: Record<string, string>, patch?: Record<string, string>) {
  if (!patch) return;
  for (const [k, v] of Object.entries(patch)) target[k] = v;
}

export function resolveNodeStyle(
  style: NodeStyle | undefined,
  breakpoint: NodeStyleBreakpoint,
  interactionState: NodeStyleInteractionState = 'default'
): Record<string, string> {
  if (!style) return {};

  const out: Record<string, string> = {};
  mergeInto(out, style.base as Record<string, string> | undefined);

  if (breakpoint !== 'desktop') {
    mergeInto(out, style.breakpoints?.[breakpoint] as Record<string, string> | undefined);
  }

  if (interactionState !== 'default' && STYLE_STATE_KEYS.has(interactionState)) {
    mergeInto(out, style.states?.[interactionState] as Record<string, string> | undefined);
    if (breakpoint !== 'desktop') {
      mergeInto(
        out,
        style.stateBreakpoints?.[interactionState]?.[breakpoint] as Record<string, string> | undefined
      );
    }
  }

  mergeInto(out, style.advanced);
  return out;
}

export function hasNodeStyleOverride(style: NodeStyle | undefined, key: string, breakpoint: NodeStyleBreakpoint): boolean {
  if (!style || !key) return false;
  if (breakpoint === 'desktop') return !!style.base && key in style.base;
  return !!style.breakpoints?.[breakpoint] && key in (style.breakpoints?.[breakpoint] ?? {});
}


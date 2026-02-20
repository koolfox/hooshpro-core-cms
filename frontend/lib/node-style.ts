export type NodeStyleBreakpoint = 'mobile' | 'tablet' | 'desktop';
export type NodeStyleInteractionState = 'default' | 'hover' | 'active' | 'focus';

export const NODE_STYLE_ALLOWED_KEYS = [
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
  'whiteSpace',
  'wordBreak',
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
  'cursor',
  'pointerEvents',
  'userSelect',
] as const;

const NODE_STYLE_ALLOWED_SET = new Set<string>(NODE_STYLE_ALLOWED_KEYS);
const STYLE_STATE_KEYS = new Set<string>(['hover', 'active', 'focus']);
const BREAKPOINT_KEYS = new Set<string>(['mobile', 'tablet', 'desktop']);

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

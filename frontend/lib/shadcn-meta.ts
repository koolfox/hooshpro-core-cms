import type { ShadcnComponentDocSlug } from '@/lib/shadcn-docs';

export type ShadcnComponentKind =
	| 'wrapper'
	| 'layout'
	| 'overlay'
	| 'navigation'
	| 'input'
	| 'display'
	| 'feedback';

export type ShadcnComponentMeta = {
	slug: string;
	kind: ShadcnComponentKind;
	canWrapChildren: boolean;
};

const WRAPPER = new Set<ShadcnComponentDocSlug>([
	'aspect-ratio',
	'card',
	'resizable',
	'scroll-area',
	'sheet',
	'sidebar',
]);

const OVERLAY = new Set<ShadcnComponentDocSlug>([
	'alert-dialog',
	'context-menu',
	'dialog',
	'drawer',
	'dropdown-menu',
	'hover-card',
	'popover',
	'sonner',
	'toast',
	'tooltip',
]);

const LAYOUT = new Set<ShadcnComponentDocSlug>([
	'accordion',
	'carousel',
	'data-table',
	'tabs',
	'table',
]);

const NAVIGATION = new Set<ShadcnComponentDocSlug>([
	'breadcrumb',
	'menubar',
	'navigation-menu',
	'pagination',
]);

const INPUT = new Set<ShadcnComponentDocSlug>([
	'calendar',
	'checkbox',
	'combobox',
	'command',
	'date-picker',
	'input',
	'input-otp',
	'radio-group',
	'select',
	'slider',
	'switch',
	'textarea',
]);

const FEEDBACK = new Set<ShadcnComponentDocSlug>(['alert', 'progress', 'skeleton', 'spinner']);

function normalizeSlug(value: string): string {
	return value.trim().toLowerCase();
}

export function shadcnComponentMeta(slug: string | null | undefined): ShadcnComponentMeta | null {
	const normalized = normalizeSlug(slug ?? '');
	if (!normalized) return null;

	// Cast is safe: unknown slugs default to display/leaf.
	const key = normalized as ShadcnComponentDocSlug;

	if (WRAPPER.has(key)) return { slug: normalized, kind: 'wrapper', canWrapChildren: true };
	if (OVERLAY.has(key)) return { slug: normalized, kind: 'overlay', canWrapChildren: true };
	if (LAYOUT.has(key)) return { slug: normalized, kind: 'layout', canWrapChildren: true };
	if (NAVIGATION.has(key)) return { slug: normalized, kind: 'navigation', canWrapChildren: true };
	if (INPUT.has(key)) return { slug: normalized, kind: 'input', canWrapChildren: false };
	if (FEEDBACK.has(key)) return { slug: normalized, kind: 'feedback', canWrapChildren: false };

	return { slug: normalized, kind: 'display', canWrapChildren: false };
}


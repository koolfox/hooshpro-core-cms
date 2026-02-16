export type ShadcnQuickField =
	| {
			kind: 'string';
			key: string;
			label: string;
			placeholder?: string;
			multiline?: boolean;
			rows?: number;
		}
	| {
			kind: 'select';
			key: string;
			label: string;
			options: string[];
		}
	| {
			kind: 'boolean';
			key: string;
			label: string;
		}
	| {
			kind: 'string-list';
			key: string;
			label: string;
			placeholder?: string;
			rows?: number;
			showWhen?: { key: string; equals: string };
		};

export type ShadcnQuickPropsSpec = {
	slug: string;
	label: string;
	description?: string;
	fields: ShadcnQuickField[];
};

const TYPOGRAPHY_VARIANTS = [
	'h1',
	'h2',
	'h3',
	'h4',
	'p',
	'blockquote',
	'table',
	'list',
	'code',
	'lead',
	'large',
	'small',
	'muted',
] as const;

const SPECS: Record<string, ShadcnQuickPropsSpec> = {
	typography: {
		slug: 'typography',
		label: 'Typography',
		description: 'Utility-based typography variants (h1/h2/p/list/etc).',
		fields: [
			{ kind: 'select', key: 'variant', label: 'Variant', options: [...TYPOGRAPHY_VARIANTS] },
			{ kind: 'string', key: 'text', label: 'Text', multiline: true, rows: 3, placeholder: 'Text content…' },
			{
				kind: 'string-list',
				key: 'items',
				label: 'List items',
				placeholder: 'One item per line…',
				rows: 5,
				showWhen: { key: 'variant', equals: 'list' },
			},
		],
	},
	button: {
		slug: 'button',
		label: 'Button',
		description: 'Primary CTA button (variant + size + optional link).',
		fields: [
			{ kind: 'string', key: 'label', label: 'Label', placeholder: 'Button' },
			{ kind: 'string', key: 'href', label: 'Href', placeholder: '/path or https://…' },
			{
				kind: 'select',
				key: 'variant',
				label: 'Variant',
				options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
			},
			{
				kind: 'select',
				key: 'size',
				label: 'Size',
				options: ['default', 'sm', 'lg', 'icon'],
			},
		],
	},
	badge: {
		slug: 'badge',
		label: 'Badge',
		fields: [
			{ kind: 'string', key: 'text', label: 'Text', placeholder: 'Badge' },
			{
				kind: 'select',
				key: 'variant',
				label: 'Variant',
				options: ['default', 'secondary', 'outline', 'destructive'],
			},
		],
	},
	alert: {
		slug: 'alert',
		label: 'Alert',
		fields: [
			{
				kind: 'select',
				key: 'variant',
				label: 'Variant',
				options: ['default', 'destructive'],
			},
			{ kind: 'string', key: 'title', label: 'Title', placeholder: 'Heads up' },
			{
				kind: 'string',
				key: 'description',
				label: 'Description',
				multiline: true,
				rows: 3,
				placeholder: 'Alert body…',
			},
		],
	},
};

export function getShadcnQuickPropsSpec(slug: string | null | undefined): ShadcnQuickPropsSpec | null {
	const normalized = (slug ?? '').trim().toLowerCase();
	return SPECS[normalized] ?? null;
}

export function shadcnQuickPropKeys(spec: ShadcnQuickPropsSpec): Set<string> {
	return new Set(spec.fields.map((f) => f.key));
}


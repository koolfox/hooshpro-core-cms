const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

type PublicOptionsResponse = { options?: Record<string, unknown> };
type PublicThemeResponse = { slug?: unknown; vars?: unknown };

export async function fetchPublicOptions(keys: string[]): Promise<Record<string, unknown>> {
	const params = new URLSearchParams();
	if (keys.length > 0) params.set('keys', keys.join(','));

	const qs = params.toString();
	const res = await fetch(`${API_ORIGIN}/api/public/options${qs ? `?${qs}` : ''}`, {
		cache: 'no-store',
	});
	if (!res.ok) return {};

	const data = (await res.json()) as PublicOptionsResponse;
	if (!data || typeof data !== 'object') return {};
	if (!data.options || typeof data.options !== 'object') return {};
	return data.options;
}

export async function fetchFrontPageSlug(): Promise<string> {
	const opts = await fetchPublicOptions(['reading.front_page_slug']);
	const v = opts['reading.front_page_slug'];
	if (typeof v === 'string' && v.trim()) return v.trim();
	return 'home';
}

export async function fetchActiveThemeSlug(): Promise<string> {
	const opts = await fetchPublicOptions(['appearance.active_theme']);
	const v = opts['appearance.active_theme'];
	if (typeof v === 'string' && v.trim()) return v.trim();
	return 'default';
}

export async function fetchThemeVars(): Promise<Record<string, string>> {
	const opts = await fetchPublicOptions(['appearance.theme_vars']);
	const raw = opts['appearance.theme_vars'];
	if (!raw || typeof raw !== 'object') return {};

	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (!k.startsWith('--')) continue;
		if (typeof v === 'string' && v.trim()) {
			out[k] = v.trim();
			continue;
		}
		if (typeof v === 'number' && Number.isFinite(v)) {
			out[k] = String(v);
		}
	}
	return out;
}

export async function fetchPublicTheme(): Promise<{ slug: string; vars: Record<string, string> }> {
	const res = await fetch(`${API_ORIGIN}/api/public/themes/active`, { cache: 'no-store' });
	if (!res.ok) return { slug: 'default', vars: {} };

	const data = (await res.json()) as PublicThemeResponse;
	const slug = typeof data?.slug === 'string' && data.slug.trim() ? data.slug.trim() : 'default';

	const varsRaw = data?.vars;
	const vars: Record<string, string> = {};
	if (varsRaw && typeof varsRaw === 'object' && !Array.isArray(varsRaw)) {
		for (const [k, v] of Object.entries(varsRaw as Record<string, unknown>)) {
			if (!k.startsWith('--')) continue;
			if (typeof v === 'string' && v.trim()) vars[k] = v.trim();
		}
	}

	return { slug, vars };
}

'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ShadcnVariantGroup } from '@/lib/shadcn-variants';

type ShadcnVariantsResponse = {
	slug: string;
	url: string;
	groups: ShadcnVariantGroup[];
	defaults: Record<string, string>;
	error?: string;
};

type ShadcnVariantsState = {
	loading: boolean;
	error: string | null;
	url: string | null;
	groups: ShadcnVariantGroup[];
	defaults: Record<string, string>;
};

const CACHE = new Map<string, ShadcnVariantsState>();

function normalizeSlug(value: string | null): string {
	return (value ?? '').trim().toLowerCase();
}

export function useShadcnVariants(slug: string | null): ShadcnVariantsState {
	const normalized = useMemo(() => normalizeSlug(slug), [slug]);
	const [state, setState] = useState<ShadcnVariantsState>(() => {
		if (!normalized) {
			return { loading: false, error: null, url: null, groups: [], defaults: {} };
		}
		const cached = CACHE.get(normalized);
		return (
			cached ?? { loading: true, error: null, url: null, groups: [], defaults: {} }
		);
	});

	useEffect(() => {
		if (!normalized) {
			setState({ loading: false, error: null, url: null, groups: [], defaults: {} });
			return;
		}

		const cached = CACHE.get(normalized);
		if (cached) {
			setState(cached);
			return;
		}

		let canceled = false;
		setState((prev) => ({ ...prev, loading: true, error: null }));

		async function load() {
			try {
				const res = await fetch(`/shadcn/variants?slug=${encodeURIComponent(normalized)}`, {
					cache: 'force-cache',
				});
				const json = (await res.json()) as ShadcnVariantsResponse;

				if (!res.ok) {
					const msg = json?.error ?? `Failed to load variants (${res.status}).`;
					throw new Error(msg);
				}

				const next: ShadcnVariantsState = {
					loading: false,
					error: null,
					url: json.url ?? null,
					groups: Array.isArray(json.groups) ? json.groups : [],
					defaults: json.defaults ?? {},
				};

				CACHE.set(normalized, next);
				if (!canceled) setState(next);
			} catch (e) {
				if (canceled) return;
				setState({
					loading: false,
					error: e instanceof Error ? e.message : String(e),
					url: null,
					groups: [],
					defaults: {},
				});
			}
		}

		void load();
		return () => {
			canceled = true;
		};
	}, [normalized]);

	return state;
}


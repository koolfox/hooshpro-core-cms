'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/http';
import { formatUiError } from '@/lib/error-message';

type Options = {
	nextPath: string;
	enabled?: boolean;
};

function toErrorMessage(error: unknown): string {
	return formatUiError(error);
}

export function useApiList<T>(url: string, opts: Options) {
	const { nextPath, enabled = true } = opts;

	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState<boolean>(enabled);
	const [error, setError] = useState<string | null>(null);

	const abortRef = useRef<AbortController | null>(null);

	const reload = useCallback(async () => {
		if (!enabled) return;

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setLoading(true);
		setError(null);

		try {
			const out = await apiFetch<T>(url, {
				cache: 'no-store',
				nextPath,
				signal: controller.signal,
			});
			setData(out);
		} catch (e) {
			if (controller.signal.aborted) return;
			setError(toErrorMessage(e));
		} finally {
			if (controller.signal.aborted) return;
			setLoading(false);
		}
	}, [url, nextPath, enabled]);

	useEffect(() => {
		if (!enabled) {
			setLoading(false);
			return;
		}

		void reload();
		return () => abortRef.current?.abort();
	}, [reload, enabled]);

	return { data, loading, error, reload, setData };
}

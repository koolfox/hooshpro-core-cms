import { ApiError } from '@/lib/http';

export function formatUiError(error: unknown): string {
	if (error instanceof ApiError) {
		const message =
			(typeof error.message === 'string' && error.message.trim()) ||
			`Request failed (${error.status})`;
		const tags: string[] = [];
		if (typeof error.errorCode === 'string' && error.errorCode.trim()) {
			tags.push(error.errorCode.trim());
		}
		if (typeof error.traceId === 'string' && error.traceId.trim()) {
			tags.push(`trace:${error.traceId.trim()}`);
		}
		return tags.length > 0 ? `${message} (${tags.join(' · ')})` : message;
	}
	if (error instanceof Error) return error.message || 'Unexpected error.';
	if (typeof error === 'string' && error.trim()) return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

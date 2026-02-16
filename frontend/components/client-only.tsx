'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

function subscribe() {
	return () => {};
}

function getClientSnapshot() {
	return true;
}

function getServerSnapshot() {
	return false;
}

export function ClientOnly({
	children,
	fallback = null,
}: {
	children: ReactNode;
	fallback?: ReactNode;
}) {
	const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
	return mounted ? children : fallback;
}

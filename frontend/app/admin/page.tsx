'use client';

import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export default function AdminHome() {
	const [me, setMe] = useState<{ id: Number; email: string } | null>(null);

	useEffect(() => {
		fetch('/api/auth/me', { credentials: 'include' })
			.then((r) => (r.ok ? r.json() : null))
			.then(setMe);
	}, []);

	async function logout() {
		await fetch('/api/auth/logout', {
			method: 'POST',
			credentials: 'include',
		});
		window.location.href = '/auth/login';
	}

	return (
		<main className='p-6 space-y-4'>
			<h1 className='text-2xl font-semibold'>Hoosh Pro Admin</h1>
			<p className='text-sm text-muted-foreground'>
				Logged in as : {me?.email ?? ''}
			</p>
			<Button onClick={logout}>Logout</Button>
		</main>
	);
}

'use client';

import { useEffect, useState } from 'react';
import { apiGetMe, MeResponse } from '@/lib/api';

export default function MePage() {
	const [user, setUser] = useState<MeResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function load() {
			setLoading(true);
			setError(null);

			const token = localStorage.getItem('hooshpro_token');
			if (!token) {
				setError('token not found. please login.');
				setLoading(false);
				return;
			}

			try {
				const me = await apiGetMe(token);
				setUser(me);
			} catch (err) {
				setError('Fetch user data encountered an error');
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	if (loading) {
		return <p style={{ margin: '2rem' }}>Loading...</p>;
	}

	if (error) {
		return <p style={{ margin: '2rem', color: 'red' }}>{error}</p>;
	}

	if (!user) {
		return <p style={{ margin: '2rem' }}>Nothing to display.</p>;
	}

	return (
		<div style={{ margin: '2rem' }}>
			<h1>USER INFO</h1>
			<p>USER ID: {user.id}</p>
			<p>EMAIL: {user.email}</p>
			<p>REGSITER DATE: {user.created_at}</p>
		</div>
	);
}

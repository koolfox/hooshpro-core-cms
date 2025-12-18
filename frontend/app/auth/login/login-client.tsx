'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginClient() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);

		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ email, password }),
		});

		if (!res.ok) {
			setError('Email or Password is wrong.');
			setLoading(false);
			return;
		}

		const nextParam = searchParams.get('next');
		const nextPath =
			nextParam && nextParam.startsWith('/') ? nextParam : '/admin';
		router.push(nextPath);
	}

	return (
		<main className='min-h-screen flex justify-center items-center p-6'>
			<Card className='w-full max-w-sm'>
				<CardHeader>
					<CardTitle className='text-xl'>Admin Login</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					<form
						onSubmit={onSubmit}
						className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='email'>Email</Label>
							<Input
								id='email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder='yourname@company.com'
							/>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='password'>Password</Label>
							<Input
								id='password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder='password'
							/>
						</div>
						{error ? (
							<p className='text-sm text-red-600'>{error}</p>
						) : null}

						<Button
							className='w-full'
							disabled={loading}>
							{loading ? 'Signing In...' : 'Sign In'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}


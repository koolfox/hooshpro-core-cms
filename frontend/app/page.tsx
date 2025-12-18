import Link from 'next/link';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

export default async function Home() {
	const rest = await fetch(`${API_ORIGIN}/health`, {
		cache: 'no-store',
	});
	try {
		if (!rest.ok) throw new Error('Health check failed');
		const data = await rest.json();

		return (
			<main style={{ padding: 24 }}>
				<h1>Hoosh Pro</h1>
				<p>Backend Status: {data.status}</p>
				<p>
					<Link href='/auth/login'>/auth/login</Link>
				</p>
			</main>
		);
	} catch {
		return (
			<div className='min-h-screen text-center items-center'>
				UNDER MAINTENANCE
			</div>
		);
	}
}

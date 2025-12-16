import Link from 'next/link';

export default async function Home() {
	const rest = await fetch('http://localhost:3000/api/health', {
		cache: 'no-store',
	});
	try {
		const data = await rest.json();

		return (
			<main style={{ padding: 24 }}>
				<h1>Hoosh Pro</h1>
				<p>Backend Status: {data.status}</p>
				<p>
					<Link href='/admin/login'>/admin/login</Link>
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

interface PublicEntry {
	slug: string;
	data: {
		title?: string;
		body?: string;
		seo_title?: string;
		seo_descption?: string;
		[key: string]: any;
	};
}

type PageProps = {
	params: Promise<{ slug: string }>;
};

const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

async function fetchPage(slug: string): Promise<PublicEntry | null> {
	const res = await fetch(`${API_BASE_URL}/api/public-content/page/${slug}`, {
		next: { revalidate: 60 },
	});

	if (!res.ok) {
		return null;
	}

	return res.json();
}

export default async function Page({ params }: PageProps) {
	const { slug } = await params;
	const entry = await fetchPage(slug);

	if (!entry) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<p>Page Not Found</p>
			</div>
		);
	}

	const { title, body } = entry.data;
	return (
		<div className='min-h-screen bg-slate-950 text-slate-50'>
			<main className='max-w-3xl mx-auto py-12 px-4'>
				<h1 className='text-3xl font-semibold mb-6'>
					{title ?? entry.slug}
				</h1>
				{body && (
					<div className='prose prose-invert max-w-none'>
						<p>{body}</p>
					</div>
				)}
			</main>
		</div>
	);
}

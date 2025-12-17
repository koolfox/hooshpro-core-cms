import { redirect } from 'next/navigation';

export default async function AdminEditPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/admin/pages?edit=${encodeURIComponent(id)}`);
}

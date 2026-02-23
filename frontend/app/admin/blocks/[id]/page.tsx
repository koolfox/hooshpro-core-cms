'use client';

import { useParams } from 'next/navigation';

import { BlockEditorScreen } from '@/components/blocks/block-editor-screen';

function parseId(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

export default function AdminBlockEditorPage() {
	const params = useParams();
	const blockId = parseId(params?.['id']);

	if (!blockId) {
		return (
			<div className='p-6'>
				<p className='text-sm text-red-600'>Invalid block id.</p>
			</div>
		);
	}

	return <BlockEditorScreen blockId={blockId} />;
}

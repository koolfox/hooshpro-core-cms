export type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;

	body?: string;

	blocks: unknown;

	published_at?: string | null;
	created_at: string;
	updated_at: string;
};

export type PageListOut = {
	items: Page[];
	total: number;
	limit: number;
	offset: number;
};

export type MediaAsset = {
	id: number;
	url: string;
	original_name: string;
	content_type: string;
	size_bytes: number;
	created_at: string;
};

export type MediaListOut = {
	items: MediaAsset[];
	total: number;
	limit: number;
	offset: number;
};

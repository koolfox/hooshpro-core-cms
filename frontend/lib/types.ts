export type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	blocks: any;
	published_at?: string | null;
	created_at: string;
	updated_at: string;
};

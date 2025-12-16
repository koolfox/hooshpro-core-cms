export type Page = {
	id: number;
	title: string;
	slug: string;
	status: 'draft' | 'published';
	seo_title?: string | null;
	seo_description?: string | null;
	blocks: any;
	created_at: string;
	updated_at: string;
};

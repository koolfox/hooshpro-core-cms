import { redirect } from 'next/navigation';

export default function AdminNewPage() {
	redirect('/admin/pages?new=1');
}

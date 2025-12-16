import { redirect } from 'next/navigation';

export default function PageIdRedirect() {
	redirect('/admin/pages');
}

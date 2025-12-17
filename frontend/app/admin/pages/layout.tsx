import type { ReactNode } from 'react';

export default function PagesLayout({
	children,
	modal,
}: {
	children: ReactNode;
	modal: ReactNode;
}) {
	return (
		<>
			{children}
			{modal}
		</>
	);
}

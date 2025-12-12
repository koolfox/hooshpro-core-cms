import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'hooshpro_session';

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	if (!pathname.startsWith('/admin')) return NextResponse.next();
	if (pathname === '/admin/login') return NextResponse.next();

	const hasSession = req.cookies.get(COOKIE_NAME)?.value;
	if (!hasSession) {
		const url = req.nextUrl.clone();
		url.pathname = '/admin/login';
		return NextResponse.redirect(url);
	}
}
export const config = {
	matcher: ['/admin/:path*'],
};

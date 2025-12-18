import sanitizeHtml from 'sanitize-html';

export function sanitizeRichHtml(input: string) {
	return sanitizeHtml(input ?? '', {
		allowedTags: [
			'p',
			'br',
			'strong',
			'em',
			's',
			'blockquote',
			'code',
			'pre',
			'h1',
			'h2',
			'h3',
			'ul',
			'ol',
			'li',
			'a',
			'img',
		],
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height'],
		},
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', {
				rel: 'noopener noreferrer',
				target: '_blank',
			}),
		},
	});
}

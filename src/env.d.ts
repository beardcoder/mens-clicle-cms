declare module '*.css' {
	const content: string
	export default content
}

// Attributes missing from @kitajs/html's intrinsic element types
declare namespace JSX {
	interface HtmlImageTag {
		sizes?: string
	}
}

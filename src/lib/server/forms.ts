/**
 * A trimmed text field from a form. Browsers submit line breaks as \r\n; they are
 * normalised to \n so stored text compares equal no matter how it was entered.
 */
export const formText = (form: FormData, key: string) =>
	String(form.get(key) ?? '')
		.replace(/\r\n?/g, '\n')
		.trim();

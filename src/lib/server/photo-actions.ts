import { fail } from '@sveltejs/kit';
import { deletePhoto, findPhoto, setCaption } from './photos.ts';
import { formText } from './forms.ts';

type Owner = { kind: 'tour' | 'place'; id: string };

/**
 * Form actions to caption and delete photos, shared by tour and place pages.
 * `mayManage` decides per photo (e.g. tour editors, or the uploader and admins).
 */
export function photoActions(
	owner: (params: Record<string, string>) => Owner,
	mayManage: (
		photo: NonNullable<ReturnType<typeof findPhoto>>,
		locals: App.Locals,
		params: Record<string, string>
	) => boolean
) {
	const load = async (request: Request, params: Record<string, string>, locals: App.Locals) => {
		const form = await request.formData();
		const photo = findPhoto(String(form.get('id') ?? ''));
		const o = owner(params);
		const belongs =
			photo &&
			((photo.kind === 'tour' && o.kind === 'tour' && photo.tourId === o.id) ||
				(photo.kind === 'place' && o.kind === 'place' && photo.placeId === o.id));
		if (!photo || !belongs) return { error: fail(404, { photoError: 'Foto nicht gefunden.' }) };
		if (!mayManage(photo, locals, params)) {
			return { error: fail(403, { photoError: 'Dieses Foto kannst du nicht ändern.' }) };
		}
		return { photo, form };
	};

	return {
		captionPhoto: async ({ request, params, locals }: ActionArgs) => {
			const r = await load(request, params, locals);
			if ('error' in r) return r.error;
			setCaption(r.photo, formText(r.form, 'caption').slice(0, 300) || null);
		},
		deletePhoto: async ({ request, params, locals }: ActionArgs) => {
			const r = await load(request, params, locals);
			if ('error' in r) return r.error;
			await deletePhoto(r.photo);
		}
	};
}

type ActionArgs = { request: Request; params: Record<string, string>; locals: App.Locals };

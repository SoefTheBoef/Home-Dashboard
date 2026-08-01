import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listPhotos, savePhoto, deletePhoto } from '$lib/server/photos';

export const load: PageServerLoad = async () => {
	return { photos: await listPhotos() };
};

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		const form = await request.formData();
		const file = form.get('photo');

		if (!(file instanceof File)) {
			return fail(400, { error: 'Choose an image file.' });
		}

		const result = await savePhoto(file, locals.user!.id);
		if (!result.ok) return fail(400, { error: result.error });

		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) await deletePhoto(id);
		return { success: true };
	}
};

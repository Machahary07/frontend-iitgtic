import { images } from '$lib/data/images';

// A media reference in site content can be one of two things:
//   - an uploaded public URL (or an absolute path / data URI), used as-is;
//   - a legacy key into the bundled image map (e.g. "iitGuwahati"), from before
//     media was editable.
// resolveMedia() turns either into a usable src so the two can coexist while
// content migrates from bundled keys to uploads.

const legacy: Record<string, string> = {
	logo: images.logo,
	ticTextLogo: images.ticTextLogo,
	iitGuwahati: images.associationLogos.iitGuwahati,
	meity: images.associationLogos.meity,
	msme: images.associationLogos.msme,
	startupIndia: images.associationLogos.startupIndia,
	technologyDevelopmentBoard: images.associationLogos.technologyDevelopmentBoard
};

export function resolveMedia(value: string | null | undefined): string {
	if (!value) return '';
	if (/^(https?:)?\/\//.test(value) || value.startsWith('/') || value.startsWith('data:')) {
		return value;
	}
	return legacy[value] ?? '';
}

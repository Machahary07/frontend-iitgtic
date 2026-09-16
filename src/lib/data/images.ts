// Official TIC IITG brand assets from the logo package.
const logo = '/brand/tic-symbol-color.svg';
const favicon = '/brand/tic-symbol-color.svg';
const ticTextLogo = '/brand/tic-iitg-horizontal-color.svg';
const ticHorizontalLogo = '/brand/tic-iitg-horizontal-color.svg';
const ticVerticalLogo = '/brand/tic-iitg-vertical-color.svg';

// Hero Slider Images
import hero1 from '$lib/assets/home-hero-slider/img1.webp';
import hero2 from '$lib/assets/home-hero-slider/img2.webp';
import hero3 from '$lib/assets/home-hero-slider/img3.webp';
import hero4 from '$lib/assets/home-hero-slider/img4.webp';
import hero5 from '$lib/assets/home-hero-slider/img5.webp';

// Association Logos
import iitGuwahatiLogo from '$lib/assets/in-association-logos/iitguwahati_logo.jpg';
import meityLogo from '$lib/assets/in-association-logos/meity_logo.jpg';
import msmeLogo from '$lib/assets/in-association-logos/msme_logo.jpg';
import startupIndiaLogo from '$lib/assets/in-association-logos/startupindia_logo.jpg';
import technologyDevelopmentBoardLogo from '$lib/assets/in-association-logos/technologydevelopmentboard_logo.jpg';

export const images = {
	logo,
	favicon,
	ticTextLogo,
	ticHorizontalLogo,
	ticVerticalLogo,
	hero: [hero1, hero2, hero3, hero4, hero5],
	associationLogos: {
		iitGuwahati: iitGuwahatiLogo,
		meity: meityLogo,
		msme: msmeLogo,
		startupIndia: startupIndiaLogo,
		technologyDevelopmentBoard: technologyDevelopmentBoardLogo
	}
} as const;

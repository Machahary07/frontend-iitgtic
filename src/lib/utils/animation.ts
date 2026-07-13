import { browser } from '$app/environment';

const HOP_EASE = 'M0,0 C0.071,0.505 0.192,0.726 0.318,0.852 0.45,0.984 0.504,1 1,1';

let gsapPromise:
	| Promise<{
			gsap: typeof import('gsap').gsap;
			CustomEase: typeof import('gsap/CustomEase').CustomEase;
	  }>
	| undefined;

let scrollTriggerPromise:
	| Promise<{
			gsap: typeof import('gsap').gsap;
			CustomEase: typeof import('gsap/CustomEase').CustomEase;
			ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
	  }>
	| undefined;

export function prefersReducedMotion() {
	return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function loadGsap() {
	gsapPromise ??= Promise.all([import('gsap'), import('gsap/CustomEase')]).then(
		([{ gsap }, { CustomEase }]) => {
			gsap.registerPlugin(CustomEase);
			if (!CustomEase.get('hop')) CustomEase.create('hop', HOP_EASE);
			return { gsap, CustomEase };
		}
	);

	return gsapPromise;
}

export async function loadScrollGsap() {
	scrollTriggerPromise ??= Promise.all([loadGsap(), import('gsap/ScrollTrigger')]).then(
		([{ gsap, CustomEase }, { ScrollTrigger }]) => {
			gsap.registerPlugin(ScrollTrigger);
			return { gsap, CustomEase, ScrollTrigger };
		}
	);

	return scrollTriggerPromise;
}

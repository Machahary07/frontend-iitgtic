// A made-up startup used to show founders what each layout looks like before
// they choose one. No photos, so every layout shows how it reads on text alone.

import { sanitizeProfile, type ProfileLayout, type StartupProfileData } from '$lib/utils/startupProfile';

const ABOUT = `Every spring, a tea estate in upper Assam decides how much fertiliser to put down. For most of them that decision is a guess. A soil test means a sample in a bag, a trip to a district lab and a wait of three to six weeks. By the time the result comes back, the fertiliser has already gone down — usually too much, often the wrong kind.

Brahmaputra Bio puts the lab in the field. A handheld probe reads nitrogen, phosphorus, potassium, pH and moisture in ninety seconds, and a phone app turns the reading into a dose plan in Assamese, Bengali or English. It works without a signal and remembers every plot, season after season.

The team began with four plots at Assam Agricultural University in 2023. Today eighteen tea estates and twelve hundred farmers use it, and a state pilot is taking it across three districts.`;

export function sampleProfile(layout: ProfileLayout): StartupProfileData {
	return sanitizeProfile({
		layout,
		name: 'Brahmaputra Bio',
		tagline: 'Soil health, read in minutes.',
		oneLiner: 'A handheld soil sensor and app that tells tea and paddy farmers exactly what their soil needs.',
		description: ABOUT,
		headline: 'From a six-week soil test to ninety seconds.',
		summary:
			'A ₹4,000 handheld soil sensor and app for tea and paddy farmers in the North-East, replacing a six-week lab test with a ninety-second field reading.',
		sector: 'Agriculture & Food',
		industry: 'AgriTech · Sensors',
		stage: 'Early revenue',
		foundingYear: '2023',
		hqLocation: 'Guwahati, Assam',
		teamSize: '11',
		website: 'https://example.com',
		contactEmail: 'hello@example.com',
		raising: 'Raising · Pre-Series A',
		trl: '7',
		problem:
			'Soil tests in the North-East take three to six weeks and a trip to a district lab. Fertiliser goes down before the results arrive.',
		solution:
			'A probe reads the soil in ninety seconds; the app turns it into a dose plan in the farmer’s own language, even with no signal.',
		targetMarket: '800+ tea estates and 2.7 million paddy farmers in Assam.',
		marketSize: 'About ₹1,100 crore of fertiliser is bought in Assam every year.',
		businessModel: 'The probe is sold outright, with a yearly seat for each estate manager.',
		features: ['A reading in ninety seconds', 'Advice in Assamese, Bengali and English', 'Works offline, syncs on 2G'],
		founderStory: {
			whatTheyBuilt: 'A probe and an app that put a soil lab in a farmer’s pocket.',
			whatTicContributed: 'Lab space, calibration rigs, mentors and the introductions to the first estates.',
			whereTheyAreNow: 'Eighteen estates, twelve hundred farmers and a state pilot in three districts.'
		},
		traction: [
			{ value: '1,200', label: 'Farmers onboarded' },
			{ value: '18', label: 'Tea estates', note: 'up from 5' },
			{ value: '₹42L', label: 'Revenue FY25' },
			{ value: '23%', label: 'Less fertiliser used' }
		],
		funding: { raised: '₹1.2 Cr seed round, 2025', grants: ['BIRAC BIG · ₹50L', 'NIDHI-PRAYAS · ₹10L'] },
		founders: [
			{ name: 'Rahul Bora', role: 'CEO', bio: 'Eight years an agronomist with the Tea Board.' },
			{ name: 'Ananya Sharma', role: 'CTO', bio: 'M.Tech, IIT Guwahati — low-cost electrochemical sensors.' },
			{ name: 'Meera Das', role: 'Field operations', bio: 'Runs onboarding across the estates.' }
		],
		milestones: [
			{ year: '2023', event: 'Every spring, a guess', text: 'Four plots at AAU Jorhat prove the first prototype.' },
			{ year: '2024', event: 'Incubated at TIC IITG', text: 'Lab space, mentors and a BIRAC BIG grant.' },
			{ year: '2025', event: 'Eighteen estates', text: 'A seed round closes and the numbers start to speak.' },
			{ year: '2027', event: 'Beyond tea', text: 'A paddy model for Bihar and West Bengal.', upcoming: true }
		],
		specs: [
			{ label: 'Time per reading', value: '90 seconds' },
			{ label: 'Accuracy against lab tests', value: '±8%' },
			{ label: 'Cost per test', value: '₹3 (lab: ₹350–600)' }
		],
		ipPatents: ['Temperature-compensated electrode for soil · granted 2025', 'Moisture-normalised nutrient estimation · filed 2024'],
		techStack: ['Screen-printed electrodes', 'nRF52840', 'Kotlin', 'Python'],
		partnerships: ['Assam Agricultural University', 'Tea Board of India'],
		supportedBy: ['BIRAC', 'Startup Assam'],
		sdgAlignment: ['SDG 2 · Zero hunger', 'SDG 12 · Responsible consumption', 'SDG 15 · Life on land'],
		impactCreated: 'Fertiliser use down 23% across the estates using it, with yields holding steady.',
		achievements: ['Assam Startup Award 2025'],
		mediaMentions: [{ title: 'The startup putting a soil lab in a farmer’s pocket', outlet: 'BusinessLine', url: 'https://example.com' }],
		testimonials: [{ quote: 'We cut our fertiliser bill by a fifth in one season.', author: 'Estate manager', role: 'Dibrugarh' }],
		registration: { type: 'Private Limited', dpiit: 'DIPP148203' },
		hiring: { isHiring: true, openRoles: 2 }
	});
}

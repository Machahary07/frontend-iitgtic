<script lang="ts">
	import LegalPage from '$lib/components/LegalPage.svelte';

	// Held here rather than in site_content because it describes exactly what the
	// code does — the cookie inventory has to move only when the code does, not when
	// an editor decides to reword it. Keep it in step with hooks.server.ts (no
	// visitor cookie), the Turnstile widget, and the click-to-load map on /contact.
	const page = {
		title: 'Cookie Policy · IIT Guwahati TIC',
		hero: {
			eyebrow: 'Legal',
			headlineLead: 'Cookie',
			headlineEmphasis: 'Policy.',
			lede: 'This website uses only strictly necessary cookies and similar local storage. It sets no advertising, marketing, or cross-site tracking cookies, and does not build a profile of you.'
		},
		sections: [
			{
				heading: 'What this covers',
				paragraphs: [
					'A cookie is a small piece of data a website stores in your browser. "Local storage" is a related technology that keeps data on your device. This policy covers both, and is written to match what the website actually does.'
				]
			},
			{
				heading: 'What we store, and why',
				paragraphs: ['We limit ourselves to what the website needs to work:'],
				bullets: [
					'Sign-in session (founders and companies): once you log in, your session is kept in your browser’s local storage so you stay signed in until you choose to log out. Strictly necessary.',
					'Administrator session (TIC staff): a secure, browser-only session cookie that keeps a signed-in administrator authenticated. Strictly necessary; it expires within 30 days or when the administrator signs out.',
					'Security (Cloudflare Turnstile): used only on forms, to tell a real person apart from automated abuse. Strictly necessary for protecting the site.',
					'Cookie-notice preference: a small local flag that remembers you have already seen the cookie notice, so it is not shown to you repeatedly.',
					'Application draft: if you begin an incubation application, your progress is saved in your browser’s local storage so you can return to it. It stays on your device and is not sent to us until you submit.'
				]
			},
			{
				heading: 'Analytics',
				paragraphs: [
					'We measure aggregate page views to understand which pages are used. This does not place a persistent identifier in your browser, does not use advertising or cross-site tracking cookies, and does not build a profile of you.',
					'Aggregate, privacy-preserving analytics are provided by Vercel Web Analytics, which is designed to operate without cookies.'
				]
			},
			{
				heading: 'Third-party map',
				paragraphs: [
					'Our contact page can show an interactive map from Google Maps. To keep third-party cookies off the site by default, the map does not load until you choose to load it. When you do, or when you open the map in a new tab, Google may set its own cookies under Google’s privacy policy, over which we have no control.'
				]
			},
			{
				heading: 'Managing cookies',
				paragraphs: [
					'You can clear or block cookies and local storage through your browser settings. Note that blocking strictly necessary cookies may prevent you from signing in or completing forms.'
				]
			},
			{
				heading: 'Changes to this policy',
				paragraphs: [
					'If our use of cookies changes, this page will be updated with the revised date. If we ever introduce non-essential cookies, we will ask for your consent first.'
				]
			},
			{
				heading: 'Contact',
				paragraphs: ['For questions about this Cookie Policy, please contact:'],
				contact: {
					org: 'IITG Technology Incubation Centre',
					addressLines: ['Technology Complex, IIT Guwahati', 'Guwahati – 781039, Assam, India'],
					email: 'tic@iitg.ac.in',
					phone: '+91 0361 2583194 / 2583191'
				}
			}
		]
	};
</script>

<LegalPage {page} />

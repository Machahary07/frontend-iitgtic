<script lang="ts">
	import LegalPage from '$lib/components/LegalPage.svelte';

	// The site takes no payments, so a full refund policy would imply commerce that
	// does not exist. This states the true position and leaves room for a real policy
	// if paid services are ever introduced.
	const page = {
		title: 'Fees & Refunds · IIT Guwahati TIC',
		hero: {
			eyebrow: 'Legal',
			headlineLead: 'Fees &',
			headlineEmphasis: 'Refunds.',
			lede: 'IITG-TIC does not collect any fees or payments through this website, so no refunds arise. This page explains the position and what happens if that ever changes.'
		},
		sections: [
			{
				heading: 'No fees are collected',
				paragraphs: [
					'IITG-TIC does not charge for, or collect any payment through, this website. Incubation applications, event registrations, enquiries, and the other services offered here are free of charge.',
					'This website does not process card payments, subscriptions, or any other transaction, and does not store payment information.'
				]
			},
			{
				heading: 'Refunds',
				paragraphs: [
					'Because no payment is taken through this website, there is nothing to refund and no refund policy applies.'
				]
			},
			{
				heading: 'If this changes in future',
				paragraphs: [
					'Should IITG-TIC introduce any paid service, event fee, or other charge in future, a clear fees, cancellation, and refund policy will be published on this page before any payment is collected.'
				]
			},
			{
				heading: 'Contact',
				paragraphs: ['For any question about fees, please contact:'],
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

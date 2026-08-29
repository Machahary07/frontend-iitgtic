// Demo data for the admin screens, so the dashboard has something to show while
// you are building against it.
//
//   node scripts/demo-data.js seed    add two applications + one pending company
//   node scripts/demo-data.js clear   remove everything this script created
//
// It talks to Supabase with the service-role key from .env.local, so it bypasses
// RLS. Every account it creates uses the @demo-tic.co domain, and `clear` deletes
// exactly those — nothing else is touched.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEMO_DOMAIN = '@demo-tic.co';
const DEMO_PASSWORD = 'demo-password-123';

const env = Object.fromEntries(
	readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.trim().startsWith('#'))
		.map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
);

const url = env.PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

const founders = [
	{
		email: `ada${DEMO_DOMAIN}`,
		name: 'Ada Barua',
		startup: 'Brahmaputra Robotics',
		stage: 'MVP',
		industry: 'Agricultural robotics',
		problem: 'Tea estates in Assam rely on manual plucking that cannot keep pace at harvest peak.',
		solution: 'A lightweight field robot that plucks selectively and maps yield per bush.',
		revenue: '₹4.2L ARR'
	},
	{
		email: `ravi${DEMO_DOMAIN}`,
		name: 'Ravi Kalita',
		startup: 'Loom & Ledger',
		stage: 'Revenue',
		industry: 'Marketplace',
		problem: 'Handloom weavers sell through middlemen who take most of the margin.',
		solution: 'A direct-to-buyer marketplace with provenance tracked per weaver.',
		revenue: '₹11L ARR'
	}
];

function answersFor(person) {
	return {
		fullName: person.name,
		email: person.email,
		phone: '9876543210',
		role: 'Founder & CEO',
		location: 'Guwahati, Assam',
		university: 'IIT Guwahati',
		linkedin: `https://linkedin.com/in/${person.name.split(' ')[0].toLowerCase()}`,
		coFounders: [{ name: 'Rita Das', email: `rita${DEMO_DOMAIN}`, role: 'CTO' }],
		startupName: person.startup,
		stage: person.stage,
		industry: person.industry,
		yearFounded: '2025',
		teamSize: '6',
		website: 'https://example.co',
		incorporation: 'Private Limited',
		problem: person.problem,
		solution: person.solution,
		differentiation: 'Built for smallholder plot sizes rather than plantation scale.',
		whyNow: 'Labour costs have risen 40% in three seasons.',
		productDescription: 'A field unit paired with a grower dashboard.',
		techStack: 'ROS 2, Python, Postgres',
		targetCustomers: 'Smallholder growers across Upper Assam.',
		users: '12 pilot sites',
		revenue: person.revenue,
		demoLink: 'https://example.co/demo',
		partnerships: 'Tocklai Tea Research Institute',
		revenueModel: 'Hardware lease plus a per-hectare subscription.',
		gtmStrategy: 'Through grower cooperatives rather than direct sales.',
		fundingStatus: 'Bootstrapped',
		investmentRequired: '₹1.5Cr',
		useOfFunds: 'Manufacturing run and a field support team.',
		competitors: 'Imported harvesters, priced well above smallholder reach.',
		previousFunding: 'None',
		whyTic: 'Proximity to the mechanical workshop and the tea research network.',
		expectedOutcomes: 'Twenty deployed units and a manufacturing partner.',
		biggestChallenge: 'Serviceability through the monsoon.',
		longTermVision: 'Standard equipment on every smallholder estate in the Northeast.',
		supportNeeded: ['Mentorship', 'Funding access', 'Technical guidance'],
		infoAccurate: true,
		agreeTerms: true,
		allowReview: true
	};
}

async function seed() {
	for (const person of founders) {
		const { data, error } = await admin.auth.admin.createUser({
			email: person.email,
			password: DEMO_PASSWORD,
			email_confirm: true,
			user_metadata: { role: 'founder', full_name: person.name, phone: '9876543210' }
		});
		if (error) {
			console.log(`skipped ${person.startup}: ${error.message}`);
			continue;
		}

		const userId = data.user.id;
		const slug = person.startup.toLowerCase().replace(/\W+/g, '-');
		const path = `${userId}/${Date.now()}-pitchDeck-${slug}.pdf`;
		const pdf = new Blob([`%PDF-1.4 demo deck for ${person.startup}`], {
			type: 'application/pdf'
		});
		await admin.storage.from('application-documents').upload(path, pdf, {
			contentType: 'application/pdf'
		});

		await admin.from('applications').insert({
			user_id: userId,
			full_name: person.name,
			email: person.email,
			startup_name: person.startup,
			answers: answersFor(person),
			documents: { pitchDeck: { path, name: `${person.startup} deck.pdf`, size: pdf.size } }
		});
		console.log(`seeded application · ${person.startup}`);
	}

	const { error: companyError } = await admin.auth.admin.createUser({
		email: `hiring${DEMO_DOMAIN}`,
		password: DEMO_PASSWORD,
		email_confirm: true,
		user_metadata: {
			role: 'company',
			company_name: 'Northeast Robotics',
			website: 'https://example.co',
			contact_name: 'Priya Sen'
		}
	});
	console.log(
		companyError
			? `skipped company: ${companyError.message}`
			: 'seeded company · Northeast Robotics (pending verification)'
	);

	console.log(`\nSign in as any of them with the password: ${DEMO_PASSWORD}`);
}

async function clear() {
	const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
	if (error) throw error;

	const demoUsers = data.users.filter((u) => u.email?.endsWith(DEMO_DOMAIN));
	if (demoUsers.length === 0) {
		console.log('nothing to clear.');
		return;
	}

	for (const user of demoUsers) {
		// Remove uploads first — deleting the user cascades the rows, not the files.
		const { data: files } = await admin.storage.from('application-documents').list(user.id);
		if (files?.length) {
			await admin.storage
				.from('application-documents')
				.remove(files.map((f) => `${user.id}/${f.name}`));
		}
		await admin.auth.admin.deleteUser(user.id);
		console.log(`removed ${user.email}`);
	}
	console.log(`\ncleared ${demoUsers.length} demo account(s).`);
}

const command = process.argv[2];
if (command === 'seed') await seed();
else if (command === 'clear') await clear();
else {
	console.log('usage: node scripts/demo-data.js seed|clear');
	process.exit(1);
}

<script lang="ts">
	import FounderShell from '$lib/components/FounderShell.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Entry = {
		id: string;
		created_at: string;
		actor_label: string | null;
		action: string;
		table_name: string | null;
	};

	const entries = $derived(data.entries as Entry[]);

	// The table a change landed in is the only clue to what it was about, so it
	// is shown as a word rather than as a schema name.
	const SUBJECT: Record<string, string> = {
		jobs: 'Job posting',
		companies: 'Company',
		profiles: 'Team',
		applications: 'Incubation application',
		job_applications: 'Applicant',
		company_profile_changes: 'Company details'
	};

	function when(iso: string) {
		return new Date(iso).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Founder Console · Activity</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Activity"
	eyebrow="History"
>
	<p class="lede">
		Everything that happened to this startup's records — what your team did here, and what TIC did
		in review. The hundred most recent entries.
	</p>

	{#if entries.length === 0}
		<div class="empty"><p>Nothing recorded yet.</p></div>
	{:else}
		<div class="panel">
			<ol class="feed">
				{#each entries as entry (entry.id)}
					<li class="entry">
						<div class="entry__head">
							<p class="entry__action">{entry.action}</p>
							<time class="entry__time">{when(entry.created_at)}</time>
						</div>
						<p class="entry__meta">
							{entry.actor_label || 'System'}
							{#if entry.table_name && SUBJECT[entry.table_name]}
								· {SUBJECT[entry.table_name]}
							{/if}
						</p>
					</li>
				{/each}
			</ol>
		</div>
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.lede {
		margin: 0 0 16px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 76ch;
	}

	.empty {
		@include admin-empty;
	}

	.panel {
		@include admin-panel;
		overflow: hidden;
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.entry {
		padding: 14px 18px;
		border-bottom: 1px solid $admin-line-soft;

		&:last-child {
			border-bottom: 0;
		}
	}

	.entry__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
	}

	.entry__action {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.entry__time {
		font-size: 12px;
		color: $admin-ink-3;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.entry__meta {
		margin: 3px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}
</style>

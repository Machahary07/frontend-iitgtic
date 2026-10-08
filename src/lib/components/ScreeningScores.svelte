<script lang="ts">
	// Every coordinator's screening marks side by side: one row per criterion, one
	// column per coordinator, with their remarks and the average. Read-only —
	// used on Evaluation (admin) and on the application page (admin, CEO).
	import {
		EVALUATION_CRITERIA,
		MAX_CRITERION_SCORE,
		type Marks
	} from '$lib/utils/evaluationCriteria';

	type Person = { userId: string; name: string; submitted: boolean; marks: Marks };
	let { people, submittedOnly = false }: { people: Person[]; submittedOnly?: boolean } = $props();

	const shown = $derived(submittedOnly ? people.filter((p) => p.submitted) : people);

	function average(key: string) {
		const given = shown
			.map((p) => p.marks[key]?.score)
			.filter((s): s is number => s !== null && s !== undefined);
		return given.length ? given.reduce((a, b) => a + b, 0) / given.length : null;
	}

	const total = (marks: Marks) =>
		EVALUATION_CRITERIA.reduce((sum, c) => sum + (marks[c.key]?.score ?? 0), 0);
</script>

{#if shown.length}
	<div class="table-wrap">
		<table class="scores">
			<thead>
				<tr>
					<th>Criterion</th>
					{#each shown as person (person.userId)}
						<th>
							{person.name}
							{#if !submittedOnly}
								<span class="tag" class:tag--good={person.submitted}>
									{person.submitted ? 'submitted' : 'draft'}
								</span>
							{/if}
						</th>
					{/each}
					<th>Avg</th>
				</tr>
			</thead>
			<tbody>
				{#each EVALUATION_CRITERIA as criterion (criterion.key)}
					{@const avg = average(criterion.key)}
					<tr>
						<td class="scores__name">{criterion.name}</td>
						{#each shown as person (person.userId)}
							{@const mark = person.marks[criterion.key]}
							<td>
								<b>{mark?.score ?? '—'}</b>
								{#if mark?.remark}<p class="scores__remark">{mark.remark}</p>{/if}
							</td>
						{/each}
						<td><b>{avg === null ? '—' : avg.toFixed(1)}</b></td>
					</tr>
				{/each}
				<tr class="scores__total">
					<td>Total / {EVALUATION_CRITERIA.length * MAX_CRITERION_SCORE}</td>
					{#each shown as person (person.userId)}
						<td><b>{total(person.marks)}</b></td>
					{/each}
					<td></td>
				</tr>
			</tbody>
		</table>
	</div>
{:else}
	<p class="quiet">No scores yet.</p>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.table-wrap {
		overflow-x: auto;
	}

	.scores {
		width: 100%;
		border-collapse: collapse;
		font-family: $font-family-base;
		font-size: 13px;

		th,
		td {
			padding: 8px 10px;
			text-align: left;
			vertical-align: top;
			border-bottom: 1px solid $admin-line-soft;
		}

		th {
			font-size: 11px;
			font-weight: $font-weight-semibold;
			color: $admin-ink-2;
			white-space: nowrap;
		}

		b {
			color: #111;
		}
	}

	.scores__name {
		font-weight: $font-weight-semibold;
		color: #111;
		white-space: nowrap;
	}

	.scores__remark {
		margin: 3px 0 0;
		max-width: 220px;
		font-size: 11px;
		line-height: 1.45;
		color: $admin-ink-2;
		white-space: pre-wrap;
	}

	.scores__total td {
		border-bottom: 0;
		font-weight: $font-weight-semibold;
	}

	.tag {
		margin-left: 4px;
		padding: 1px 6px;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: 999px;
		background: #fff4d4;
		color: #6a4f00;

		&--good {
			background: #d6f5e1;
			color: #0e6b2c;
		}
	}

	.quiet {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}
</style>

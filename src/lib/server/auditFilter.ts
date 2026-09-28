// Developer activity never appears in the audit trail the console shows — not
// in Activity, not in a founder's feed, not to the assistant. The rows are still
// written (the database keeps them); they are only left out of every read.
//
// Two kinds of row count as a developer's:
//   - anything a developer did: their label reads "Name (Developer…)" on app
//     entries, including "…, viewing as …", and "name (developer)" on trigger
//     entries, so one case-insensitive match covers both;
//   - a change to a developer's own account, which the database records as
//     "system" when it happens outside the app (deleting the auth user, say) —
//     recognised by the role in the row's before or after image.

type Filterable<Q> = {
	not(column: string, operator: string, value: unknown): Q;
	or(filters: string): Q;
};

export function withoutDeveloperActivity<Q extends Filterable<Q>>(query: Q): Q {
	return query
		.not('actor_label', 'ilike', '%(developer%')
		.or('before->>role.is.null,before->>role.neq.developer')
		.or('after->>role.is.null,after->>role.neq.developer');
}

# Database

The schema for Aureal Finance AI, as applied to the Supabase project.

| Migration | What it does |
| --- | --- |
| `…_init_core_schema` | Tables, constraints and indexes |
| `…_init_row_level_security` | RLS enabled everywhere, with per-user policies |
| `…_init_triggers_and_provisioning` | Balance upkeep, `updated_at`, new-user provisioning |
| `…_restrict_security_definer_functions` | Revokes RPC access to the trigger helpers |

## Applying them

With the Supabase CLI linked to the project:

```bash
supabase db push
```

## The two things worth knowing

**Balances are derived, not typed in.** A trigger on `transactions` applies every insert, update and
delete to the affected accounts. A credit account's balance is the amount *owed*, so an expense
raises it and a payment lowers it; scheduled transactions move nothing until they clear. This lives
in the database so a balance is right regardless of which client wrote the transaction.

**Row-level security is the boundary, not the app.** Every table filters on `auth.uid()`. `user_id`
defaults to the caller and the `WITH CHECK` clauses reject a row owned by anyone else, so a
compromised or modified client still cannot read or write another user's data.

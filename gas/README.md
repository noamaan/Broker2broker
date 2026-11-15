# Legacy Apps Script reference — do not deploy

This folder is retained only as a historical reference to the former Google Sheets/Drive backend and its business rules. The active application no longer imports, calls, or depends on Apps Script, Google Sheets, or Google Drive.

**Do not create an Apps Script project, configure Script Properties, run setup functions, authorize scopes, or deploy this code.** The supported backend is the Supabase project described in [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md), with server-side business logic in `../lib/server/backend.ts` and PostgreSQL migrations in `../supabase/migrations/`.

The previously provisioned Google spreadsheet and Drive folders remain separate legacy resources. They have not been imported into Supabase and have not been modified by the migration work.

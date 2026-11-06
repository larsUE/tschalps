// Used only by `npm run auth:schema` to generate src/lib/server/db/auth.schema.ts.
// The Better Auth CLI can't load src/lib/server/auth.ts (SvelteKit-only imports),
// so this mirrors its schema-relevant plugins. Keep the plugin list in sync.
import { betterAuth } from 'better-auth/minimal';
import { admin, emailOTP } from 'better-auth/plugins';

export const auth = betterAuth({
	emailAndPassword: { enabled: false },
	plugins: [emailOTP({ sendVerificationOTP: async () => {} }), admin()]
});

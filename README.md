# flue-codex

Register subscription-backed OpenAI Codex models with Flue using the local Codex CLI OAuth login.

```ts
import { registerCodexProvider } from 'flue-codex';

await registerCodexProvider();
```

After registration, Flue agents can use Codex models by name:

```ts
export default defineAgent(() => ({
  model: 'openai-codex/gpt-5.5',
  instructions: 'Help with the task.',
}));
```

## What It Does

- Reads local Codex CLI OAuth auth from `~/.codex/auth.json`.
- Refreshes stale OAuth tokens when the refresh token is usable.
- Discovers account-visible models from the authenticated Codex model endpoint.
- Registers Flue provider id `openai-codex`.
- Uses Flue/pi-ai's existing `openai-codex-responses` transport.
- Provides a doctor helper and optional tiny live smoke check.

It does not require an OpenAI API key and it does not use Codex as a local machine harness. Codex is used as the subscription-backed model provider.

## API

```ts
import {
  createCodexProvider,
  doctorCodexProvider,
  registerCodexProvider,
} from 'flue-codex';
```

`registerCodexProvider(options?)` creates and registers the provider with Flue.

`createCodexProvider(options?)` returns the provider definition without registering it.
The returned provider definition includes the active bearer token as `registration.apiKey`; treat it as secret-bearing data.

`doctorCodexProvider(options?)` validates auth, refresh readiness, model discovery, and provider construction. Live completion is opt-in.

## Diagnostics

```bash
pnpm exec flue-codex-doctor
pnpm exec flue-codex-doctor --live
```

The live check sends a tiny Flue prompt and should be run deliberately because it uses Codex subscription capacity.

## Auth

Run Codex login first:

```bash
codex login
```

By default the package reads `~/.codex/auth.json`. Override with:

- `authPath`
- `codexHome`
- `CODEX_HOME`

Tokens are not logged intentionally, and errors redact JWTs, `at-` tokens, and `sk-` keys.

Use `baseUrl` and `tokenUrl` overrides only with trusted endpoints because those requests intentionally carry bearer or refresh credentials.

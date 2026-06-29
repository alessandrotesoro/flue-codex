# @sematico/flue-codex

Use local Codex CLI subscription auth as a Flue provider. This lets Flue agents call Codex models without an OpenAI API key.

## Install

```bash
pnpm add @sematico/flue-codex @flue/runtime
```

Log in with Codex first:

```bash
codex login
```

`@sematico/flue-codex` reads `~/.codex/auth.json`, refreshes stale OAuth tokens using metadata from the current Codex login, discovers the account's available Codex models using the installed Codex runtime metadata, and registers them with Flue as `openai-codex/*`.

The package does not ship an OpenAI OAuth client ID or Codex backend version. It infers the OAuth `client_id` from the logged-in access token, discovers the token endpoint from that token's issuer, reads the Codex client version from the local model cache or installed `codex --version`, and resolves the ChatGPT backend URL from Codex runtime configuration.

## Usage

```ts
import { defineAgent } from '@flue/runtime';
import { registerCodexProvider } from '@sematico/flue-codex';

await registerCodexProvider();

export default defineAgent(() => ({
  model: 'openai-codex/gpt-5.5',
  instructions: 'Help with the task.',
}));
```

## Diagnostics

```bash
pnpm exec flue-codex-doctor
pnpm exec flue-codex-doctor --live
```

`--live` sends a tiny real prompt through Flue and Codex.

## API

- `registerCodexProvider(options?)` creates and registers the Flue provider.
- `createCodexProvider(options?)` returns the provider definition without registering it.
- `doctorCodexProvider(options?)` checks auth, model discovery, provider construction, and optional live completion.
- `runCodexLiveSmoke(options)` runs the tiny live completion check.
- `resolveCodexRuntimeConfig(options?)` shows the Codex backend URL and client version inferred from the local install.

## License

MIT. See [LICENSE](./LICENSE).

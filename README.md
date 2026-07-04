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

const provider = await registerCodexProvider();

export default defineAgent(() => ({
  model: provider.defaultModelId,
  instructions: 'Help with the task.',
}));
```

Provider options are grouped by concern:

```ts
await registerCodexProvider({
  auth: { path: '/path/to/auth.json' },
  runtime: { baseUrl: 'https://chatgpt.com/backend-api', clientVersion: '0.203.4' },
  timeouts: { fetchMs: 30_000 },
});
```

## Diagnostics

```bash
pnpm exec flue-codex-doctor
pnpm exec flue-codex-doctor --live
```

`--live` sends a tiny real prompt through Flue and Codex.

## API

- `@sematico/flue-codex` exports `registerCodexProvider(options?)`, safe provider result/types, and `FlueCodexError`.
- `@sematico/flue-codex/provider` exports `createCodexProviderDefinition(options?)` for advanced provider composition. The returned registration contains the Codex access token.
- `@sematico/flue-codex/diagnostics` exports `doctorCodexProvider(options?)` and `runCodexLiveSmoke(options)`.
- `@sematico/flue-codex/auth` exports credential and auth-file resolvers.
- `@sematico/flue-codex/runtime` exports Codex runtime metadata resolvers.
- `@sematico/flue-codex/models` exports Codex model discovery.

## License

MIT. See [LICENSE](./LICENSE).

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

`@sematico/flue-codex` reads `~/.codex/auth.json`, refreshes stale OAuth tokens, discovers the account's available Codex models, and registers them with Flue as `openai-codex/*`.

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

## License

MIT. See [LICENSE](./LICENSE).

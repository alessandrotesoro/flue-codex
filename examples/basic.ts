import { registerCodexProvider } from '@sematico/flue-codex';

const provider = await registerCodexProvider();

console.log(`Registered openai-codex with ${provider.modelIds.length} model(s).`);
console.log(`Default model: ${provider.defaultModelId}`);

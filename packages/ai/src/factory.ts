import { AiError } from "./errors";
import { AiGateway } from "./gateway";
import { GeminiProvider } from "./providers/gemini";
import { OpenAiProvider } from "./providers/openai";
import type {
  AiFactoryConfig,
  AiProvider,
  ProviderConfig,
  ProviderName,
} from "./types";

export function createAiGateway(config: AiFactoryConfig): AiGateway {
  const order = [config.routing.preferred, config.routing.fallback].filter(
    (name, index, values): name is ProviderName =>
      name !== undefined && values.indexOf(name) === index,
  );
  if (config.defaultTimeoutMs !== undefined && config.defaultTimeoutMs <= 0) {
    throw configurationError("defaultTimeoutMs must be greater than zero");
  }

  const providers = order.map((name) => {
    const providerConfig = config.providers[name];
    if (!providerConfig) {
      throw configurationError(`No configuration was supplied for ${name}`);
    }
    validateProviderConfig(name, providerConfig);
    return createProvider(name, providerConfig, config.fetch);
  });
  return new AiGateway(providers, config.defaultTimeoutMs);
}

function createProvider(
  name: ProviderName,
  config: ProviderConfig,
  fetchImplementation: AiFactoryConfig["fetch"],
): AiProvider {
  return name === "openai"
    ? new OpenAiProvider(config, fetchImplementation)
    : new GeminiProvider(config, fetchImplementation);
}

function validateProviderConfig(name: ProviderName, config: ProviderConfig): void {
  if (!config.apiKey.trim() || !config.model.trim()) {
    throw configurationError(`${name} requires a non-empty apiKey and model`);
  }
}

function configurationError(message: string): AiError {
  return new AiError({ code: "CONFIGURATION_ERROR", message });
}

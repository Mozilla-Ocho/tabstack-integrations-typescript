import Tabstack from "@tabstack/sdk";

/**
 * Configuration for constructing a Tabstack client. When a value is omitted the
 * underlying SDK falls back to its own defaults (for example `TABSTACK_API_KEY`
 * from the environment for `apiKey`).
 */
export interface TabstackClientConfig {
  /** Tabstack API key. Defaults to `process.env.TABSTACK_API_KEY` when omitted. */
  apiKey?: string;
  /** Override the API base URL. Defaults to the SDK's configured base URL. */
  baseURL?: string;
}

/** A configured Tabstack SDK client instance. */
export type TabstackClient = Tabstack;

/**
 * Construct a configured Tabstack client. The API key is read from
 * `TABSTACK_API_KEY` by default and can be overridden via `config.apiKey`.
 * Every network call in this package goes through this client.
 */
export function createTabstackClient(config: TabstackClientConfig = {}): TabstackClient {
  return new Tabstack({
    apiKey: config.apiKey ?? process.env.TABSTACK_API_KEY,
    ...(config.baseURL !== undefined ? { baseURL: config.baseURL } : {}),
  });
}

let defaultClient: TabstackClient | undefined;

/**
 * Lazily construct and reuse a single default client. The client is only built
 * on first use, so importing this package never requires an API key to be set.
 */
export function getDefaultClient(): TabstackClient {
  if (defaultClient === undefined) {
    defaultClient = createTabstackClient();
  }
  return defaultClient;
}

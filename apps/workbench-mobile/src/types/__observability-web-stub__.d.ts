declare module '@axi/observability-web' {
  export interface InstallWebOptions {
    service: string;
    env: string;
    ingestUrl: string;
    [extra: string]: unknown;
  }
  export function installWeb(options: InstallWebOptions): () => void;
  const _default: { installWeb: typeof installWeb };
  export default _default;
}

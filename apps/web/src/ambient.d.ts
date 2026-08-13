// Ambient module declarations for Vite asset/worker URL imports used across workspace packages.
// Duplicated here so tsc in apps/web can resolve them when following imports into packages/engine.

declare module "*.wav?url" {
  const url: string;
  export default url;
}

declare module "*?worker&url" {
  const url: string;
  export default url;
}

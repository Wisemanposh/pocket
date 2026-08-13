declare module "*.wav?url" {
  const url: string;
  export default url;
}

declare module "*?worker&url" {
  const url: string;
  export default url;
}

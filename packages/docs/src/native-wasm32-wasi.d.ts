declare module '@stax-xml/native-wasm32-wasi' {
  export interface AggregateResult {
    tier: string;
    inputBytes: number;
    eventCount: number;
    event_count?: number;
    checksum: number;
    attrCountTotal: number;
    objectCount: number;
  }

  export function parseAggregateStringUtf8(input: string, tier: string): AggregateResult;
}

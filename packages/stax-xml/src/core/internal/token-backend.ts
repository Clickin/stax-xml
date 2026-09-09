import { TokenCursor } from "../TokenCursor.js";
import type {
  TokenCursorOptions,
  TokenCursorSpi,
} from "../TokenCursorSpi.js";

export interface TokenInputSessionSpi {
  readonly cursor: TokenCursorSpi;
  pushBytes(bytes: Uint8Array, final?: boolean): void;
  dispose(): void;
}

export interface TokenBackendFactory {
  createStringCursor(
    input: string,
    options: TokenCursorOptions,
  ): TokenCursorSpi;
  createByteSession(
    options: TokenCursorOptions & { encoding: string },
  ): TokenInputSessionSpi;
}

class JsTokenInputSession implements TokenInputSessionSpi {
  readonly cursor: TokenCursor;
  private readonly decoder: TextDecoder;

  constructor(options: TokenCursorOptions & { encoding: string }) {
    this.cursor = new TokenCursor("", false, options);
    this.decoder = new TextDecoder(options.encoding, { fatal: true });
  }

  pushBytes(bytes: Uint8Array, final = false): void {
    this.cursor.push(
      this.decoder.decode(bytes, { stream: !final }),
      final,
    );
  }

  dispose(): void {
    this.cursor.dispose();
  }
}

export const jsTokenBackendFactory: TokenBackendFactory = {
  createStringCursor(input, options) {
    return new TokenCursor(input, true, options);
  },
  createByteSession(options) {
    return new JsTokenInputSession(options);
  },
};

/**
 * Symbol used to carry an experimental backend through existing options
 * objects without adding it to the stable reader/converter option types.
 */
export const tokenBackendFactorySymbol = Symbol.for(
  "stax-xml.experimental.tokenBackendFactory",
);

export function tokenBackendOf(options?: object): TokenBackendFactory {
  const backend =
    options == null
      ? undefined
      : (options as Record<PropertyKey, unknown>)[
          tokenBackendFactorySymbol
        ];
  return isTokenBackendFactory(backend) ? backend : jsTokenBackendFactory;
}

export function withTokenBackend<T extends object>(
  options: T,
  backend: TokenBackendFactory,
): T {
  Object.defineProperty(options, tokenBackendFactorySymbol, {
    configurable: true,
    enumerable: false,
    value: backend,
    writable: true,
  });
  return options;
}

function isTokenBackendFactory(
  value: unknown,
): value is TokenBackendFactory {
  if (!value || typeof value !== "object") return false;
  const factory = value as Partial<TokenBackendFactory>;
  return (
    typeof factory.createStringCursor === "function" &&
    typeof factory.createByteSession === "function"
  );
}

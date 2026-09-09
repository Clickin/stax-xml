import { JsTokenCursor } from "../js/JsTokenCursor.js";
import type {
  TokenBackendFactory,
  TokenCursorOptions,
  TokenInputSessionSpi,
} from "../TokenCursor.js";

class JsTokenInputSession implements TokenInputSessionSpi {
  readonly cursor: JsTokenCursor;
  private readonly decoder: TextDecoder;

  constructor(options: TokenCursorOptions & { encoding: string }) {
    this.cursor = new JsTokenCursor("", false, options);
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
    return new JsTokenCursor(input, true, options);
  },
  apiVersion: 2,
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
  if (backend === undefined) return jsTokenBackendFactory;
  if (!isTokenBackendFactory(backend))
    throw new Error("Experimental token backend must implement API version 2.");
  return backend;
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
    factory.apiVersion === 2 &&
    typeof factory.createStringCursor === "function" &&
    typeof factory.createByteSession === "function"
  );
}

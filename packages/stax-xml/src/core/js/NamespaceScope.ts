/**
 * Immutable namespace binding chain used by the JS batch backend.
 *
 * A node is created only when an element declares (or undeclares) a namespace
 * prefix; ordinary tokens never allocate scope nodes. Lookups walk the chain
 * from the captured head so a slot view resolves a prefix exactly as the
 * producer's namespace map looked when that token was produced, even after the
 * producer parsed further lookahead.
 */

const XML_NAMESPACE_URI = "http://www.w3.org/XML/1998/namespace";

export interface NamespaceScopeNode {
  readonly parent: NamespaceScopeNode | undefined;
  readonly prefix: string;
  readonly uri: string;
}

/** Root chain head holding only the implicit `xml` binding. */
export function rootScopeNode(): NamespaceScopeNode {
  return { parent: undefined, prefix: "xml", uri: XML_NAMESPACE_URI };
}

export function pushScopeNode(
  head: NamespaceScopeNode | undefined,
  prefix: string,
  uri: string,
): NamespaceScopeNode {
  return { parent: head, prefix, uri };
}

/** Resolve a prefix against the chain; undefined when no binding exists. */
export function resolveScopePrefix(
  head: NamespaceScopeNode | undefined,
  prefix: string,
): string | undefined {
  for (let node = head; node !== undefined; node = node.parent) {
    if (node.prefix === prefix) return node.uri;
  }
  return undefined;
}

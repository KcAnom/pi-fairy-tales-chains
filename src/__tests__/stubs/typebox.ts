/** Test stub: pi provides the real typebox at runtime; tools only pass these
 *  descriptors through opaquely, so plain objects suffice for smoke tests. */
export const Type = {
  Object: (props: unknown, opts?: unknown) => ({ kind: "object", props, opts }),
  String: (opts?: unknown) => ({ kind: "string", opts }),
  Optional: (inner: unknown) => ({ kind: "optional", inner }),
  Record: (k: unknown, v: unknown, opts?: unknown) => ({ kind: "record", k, v, opts }),
  Any: () => ({ kind: "any" }),
  Integer: (opts?: unknown) => ({ kind: "integer", opts }),
  Boolean: (opts?: unknown) => ({ kind: "boolean", opts }),
  Array: (inner: unknown, opts?: unknown) => ({ kind: "array", inner, opts }),
};

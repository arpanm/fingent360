/** In-process capability for already-authorized Operations adapters; HTTP cannot supply a Symbol. */
export const INTERNAL_OPERATOR = Symbol('fingent360-internal-operator');
export type OperatorAuthorization = string | typeof INTERNAL_OPERATOR;

/** The HTTP status codes the API answers with, by name. */
export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  internal: 500,
  badGateway: 502,
} as const;

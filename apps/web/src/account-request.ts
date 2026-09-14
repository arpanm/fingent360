export class AccountRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class StaleAccountRead extends Error {}
export type AccountRequest = (
  path?: string,
  body?: unknown,
  method?: string,
) => Promise<unknown>;

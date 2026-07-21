import { Cashfree, CFEnvironment } from "cashfree-pg";

export function getCashfreeInstance() {
  const environment =
    process.env.CASHFREE_ENV === "PROD"
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

  return new Cashfree(
    environment,
    process.env.CASHFREE_APP_ID,
    process.env.CASHFREE_SECRET_KEY,
  );
}

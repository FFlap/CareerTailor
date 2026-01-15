const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!domain) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN is not set in Convex environment variables");
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};

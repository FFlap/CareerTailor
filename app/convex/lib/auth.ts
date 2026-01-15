type CtxWithAuth = {
  auth: {
    getUserIdentity: () => Promise<{ subject: string } | null>
  }
}

export async function requireUserId(ctx: CtxWithAuth) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthorized')
  }
  return identity.subject
}

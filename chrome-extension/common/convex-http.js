async function parseConvexResponse(response) {
  const text = await response.text().catch(() => "");
  if (!response.ok && response.status !== 560) {
    throw new Error(text || `Convex HTTP error (${response.status}).`);
  }
  const payload = text ? JSON.parse(text) : null;
  if (!payload) {
    throw new Error("Convex returned empty response.");
  }
  if (payload.status === "success") {
    return payload.value;
  }
  if (payload.status === "error") {
    throw new Error(payload.errorMessage || "Convex function failed.");
  }
  throw new Error("Unexpected Convex response.");
}

export async function convexMutation({ convexUrl, authToken, path, args }) {
  if (!convexUrl) throw new Error("Missing Convex URL.");
  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "Convex-Client": "resumegen-extension"
    },
    body: JSON.stringify({
      path,
      format: "convex_encoded_json",
      args: [args || {}]
    })
  });
  return await parseConvexResponse(response);
}


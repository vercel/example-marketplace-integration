import type { Resource, ResourceCustomClaims } from "@/lib/vercel/schemas";

export function exampleResourceCustomClaims(
  resource: Pick<Resource, "name">,
): ResourceCustomClaims {
  return {
    roles: ["readonly", "readwrite"],
    defaultRole: "readwrite",
    claimRules: [
      { claims: { database: resource.name, scope: "read" } },
      { when: { role: ["readwrite"] }, claims: { scope: "read write" } },
      {
        when: { role: ["readwrite"], environment: ["production"] },
        claims: { scope: "read write ddl" },
      },
      {
        when: { environment: ["preview", "development"] },
        claims: { branch: "preview" },
      },
    ],
  };
}

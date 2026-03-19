export const E2E_DEFAULTS = {
  workspace: {
    slug: "e2e-workspace",
    displayName: "E2E Workspace",
  },
  team: {
    key: "TES",
    name: "Testers",
  },
  users: {
    primary: {
      email: "e2e@test.com",
      password: "TestPassword1!",
      name: "E2E User",
    },
    secondary: {
      email: "userb@test.com",
      password: "TestPassword1!",
      name: "User B",
    },
    wrongUser: {
      email: "wronguser@test.com",
      password: "TestPassword1!",
      name: "Wrong User",
    },
    other: {
      email: "other@test.com",
      password: "TestPassword1!",
      name: "Other User",
    },
  },
} as const;

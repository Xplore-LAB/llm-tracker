migrate((app) => {
  // This app uses members; close registration/auth on PocketBase's sample users.
  const exampleUsers = app.findCollectionByNameOrId("users");
  exampleUsers.createRule = null;
  exampleUsers.authRule = null;
  app.save(exampleUsers);
  const settings = app.settings();
  // The existing site loads all ~160 paper chunks in parallel. Give those
  // authenticated static reads their own budget; keep password/API limits intact.
  settings.rateLimits.rules.unshift({
    label: "/api/papers/", audience: "@auth", duration: 10, maxRequests: 2000,
  });
  app.save(settings);
});

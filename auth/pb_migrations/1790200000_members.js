migrate((app) => {
  const users = new Collection({
    type: "auth", name: "members",
    listRule: null, viewRule: "id = @request.auth.id && disabled = false",
    createRule: null, updateRule: null, deleteRule: null, manageRule: null,
    authRule: "disabled = false",
    fields: [
      {type: "text", name: "username", required: true, min: 3, max: 40, pattern: "^[a-zA-Z0-9_-]+$"},
      {type: "text", name: "name", max: 80},
      {type: "bool", name: "disabled"},
    ],
    indexes: ["CREATE UNIQUE INDEX idx_members_username ON members (username)"],
    passwordAuth: {enabled: true, identityFields: ["username", "email"]},
    authToken: {duration: 28800},
    authAlert: {enabled: false},
  });
  app.save(users); // PocketBase initializes its system auth fields on first save.
  users.fields.getByName("password").min = 12;
  users.fields.getByName("email").required = false;
  app.save(users);
  const settings = app.settings();
  settings.meta.appName = "大模型情报局 · 账号管理";
  settings.rateLimits.enabled = true;
  app.save(settings);
});

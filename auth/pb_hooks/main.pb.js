// Cookie auth is additional to PocketBase's native bearer-token admin API.
routerUse(new Middleware((e) => {
  e.response.header().set("Cache-Control", "private, no-store");
  e.response.header().set("Referrer-Policy", "same-origin");
  const origin = e.request.header.get("Origin");
  const expected = $os.getenv("TRACKER_ORIGIN");
  if (origin && origin !== expected) throw new ForbiddenError("不允许跨站请求");
  if (!["GET", "HEAD", "OPTIONS"].includes(e.request.method) && !origin &&
      e.request.header.get("Cookie").includes("tracker_session=")) {
    throw new ForbiddenError("缺少请求来源");
  }
  return e.next();
}, -1042));

routerUse(new Middleware((e) => {
  if (!e.auth) {
    try {
      const token = e.request.cookie("tracker_session").value;
      const record = e.app.findAuthRecordByToken(token, "auth");
      if (record.collection().name === "members" && !record.getBool("disabled")) e.auth = record;
    } catch (_) { /* invalid or expired cookie is unauthenticated */ }
  }
  if (e.auth && e.auth.collection().name === "members" && e.auth.getBool("disabled")) e.auth = null;
  return e.next();
}, -1019));

onRecordAuthRequest((e) => {
  if (e.record.getBool("disabled")) throw new ForbiddenError("账号不可用");
  // This cookie adapter supports password-only login. Fail closed if an operator
  // enables MFA; never issue a usable cookie before PocketBase's MFA challenge.
  if (e.collection.mfa.enabled) throw new ForbiddenError("浏览器登录尚未接入多因素验证");
  require(__hooks + "/session.js").cookie(e.requestEvent, e.token, 28800);
  return e.next();
}, "members");

routerAdd("GET", "/auth/login", (e) => e.fileFS($os.dirFS(__hooks + "/../ui"), "login.html"));
routerAdd("GET", "/auth/login.js", (e) => e.fileFS($os.dirFS(__hooks + "/../ui"), "login.js"));
routerAdd("GET", "/auth/style.css", (e) => e.fileFS($os.dirFS(__hooks + "/../pages"), "style.css"));

routerAdd("GET", "/api/tracker/me", (e) => e.json(200, require(__hooks + "/session.js").profile(e)),
  (e) => require(__hooks + "/session.js").requireMember(e));

routerAdd("POST", "/api/tracker/logout", (e) => {
  // PocketBase tokens are stateless. Rotating the key revokes all this user's devices.
  if (require(__hooks + "/session.js").member(e)) {
    e.auth.refreshTokenKey();
    e.app.save(e.auth);
  }
  require(__hooks + "/session.js").cookie(e, "", 0);
  return e.noContent(204);
});

routerAdd("GET", "/auth/session.js", (e) => {
  const profile = JSON.stringify(require(__hooks + "/session.js").profile(e)).replace(/</g, "\\u003c");
  e.response.header().set("Content-Type", "application/javascript; charset=utf-8");
  return e.string(200, "window.trackerUser=" + profile + ";\n" +
    toString($os.readFile(__hooks + "/../ui/session.js")));
}, (e) => require(__hooks + "/session.js").requireMember(e));

// Only an explicitly built site directory is served; never the repository or database.
routerAdd("GET", "/{path...}", $apis.static(__hooks + "/../site", false),
  (e) => require(__hooks + "/session.js").requireMember(e));

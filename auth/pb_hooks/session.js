// PocketBase verifies passwords and tokens; this module only adapts browser cookies.
function cookie(e, value, maxAge) {
  const secure = $os.getenv("TRACKER_ORIGIN").startsWith("https://") ? "; Secure" : "";
  e.response.header().add("Set-Cookie", "tracker_session=" + value +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + secure);
}

function member(e) {
  return e.auth && e.auth.collection().name === "members" && !e.auth.getBool("disabled");
}

function requireMember(e) {
  if (member(e)) return e.next();
  if (e.request.header.get("Accept").includes("text/html")) {
    return e.redirect(303, "/auth/login?next=" + encodeURIComponent(e.request.url.requestURI()));
  }
  return e.json(401, {message: "请先登录"});
}

function profile(e) {
  return {id: e.auth.id, username: e.auth.getString("username"), name: e.auth.getString("name")};
}

module.exports = {cookie, member, requireMember, profile};

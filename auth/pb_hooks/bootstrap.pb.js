// Optional one-time, server-local initialization. No default password is shipped.
onBootstrap((e) => {
  e.next();
  if (!$os.getenv("TRACKER_ADMIN_EMAIL") || !$os.getenv("TRACKER_ADMIN_PASSWORD")) return;
  try {
    e.app.findAuthRecordByEmail("_superusers", $os.getenv("TRACKER_ADMIN_EMAIL"));
    return; // Never overwrite an existing administrator's password.
  } catch (_) { /* explicit initialization of a new administrator */ }
  const record = new Record(e.app.findCollectionByNameOrId("_superusers"));
  record.set("email", $os.getenv("TRACKER_ADMIN_EMAIL"));
  record.set("password", $os.getenv("TRACKER_ADMIN_PASSWORD"));
  e.app.save(record);
});

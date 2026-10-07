---
disable-model-invocation: true
description: Print the command that writes an encrypted backup of the project's local-only harness files, for the user's own terminal
argument-hint: <dir>
---

Give the user the backup command to run in their own terminal; never run it here. The encryptor asks for a passphrase, and that needs a TTY. The backup directory is: `$ARGUMENTS`.

1. If the backup directory above is empty, print `pass the backup directory: /harness:backup <dir>` and stop.
2. Otherwise print this command for him to run from any directory, with `<dir>` replaced by the backup directory exactly as given and `$CLAUDE_PROJECT_DIR` replaced by this project's absolute path:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/backup.mjs" --dir "<dir>" --project "$CLAUDE_PROJECT_DIR"
   ```

3. Tell him what it does. It packs the existing `localOnlyPaths` from the project's `.claude/harness.json` with tar and encrypts the archive with `age --passphrase`, or with `gpg --symmetric --cipher-algo AES256` when `age` is not installed. It writes `<dir>/harness-<YYYY-MM-DD>.tar.gz.age` (or `.gpg`) and keeps the newest 10 backups. With neither encryptor installed it writes nothing and exits 1.

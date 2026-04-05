---
name: mac-release
description: "Build, sign, notarize, and publish a macOS app as a GitHub release with a professional DMG"
category: utility
complexity: intermediate
mcp-servers: []
personas: []
---

# /mac-release - macOS App Release

Builds a signed, notarized macOS `.app`, packages it in a drag-to-install DMG, and publishes it as a GitHub release.

## Usage
```
/mac-release [version] [--project path] [--scheme name] [--team-id id] [--apple-id email] [--notes "release notes"]
```

## Required Setup (one-time)
Store notarization credentials in keychain before first use:
```bash
xcrun notarytool store-credentials "mac-notary" \
  --apple-id "your@email.com" \
  --team-id "YOURTEAMID" \
  --password "app-specific-password"
```
Find your Team ID: `xcrun altool --list-providers -u "your@email.com" --password "app-password"`

Install DMG builder: `brew install create-dmg` and `pip3 install dmgbuild`

## Behavioral Flow

### 1. Resolve Parameters
- **version**: from argument, or read `MARKETING_VERSION` from project.pbxproj, or ask user
- **project**: auto-detect `.xcodeproj` in current directory
- **scheme**: default to project name
- **team-id**: read from existing archive or keychain profile
- **release notes**: from argument, or auto-generate from git log since last tag

### 2. Pre-flight Checks
```bash
# Verify Developer ID certificate exists
security find-identity -v -p codesigning | grep "Developer ID Application"

# Verify keychain profile exists
xcrun notarytool history --keychain-profile "mac-notary" --max 1

# Verify gh CLI is authenticated
gh auth status

# Verify dmgbuild is installed
python3 -m dmgbuild --version
```
Stop and report clearly if any check fails.

### 3. Archive
```bash
xcodebuild archive \
  -project <project>.xcodeproj \
  -scheme <scheme> \
  -configuration Release \
  -archivePath /tmp/<AppName>.xcarchive \
  MARKETING_VERSION=<version> \
  CURRENT_PROJECT_VERSION=<build> \
  -allowProvisioningUpdates
```

### 4. Export with Developer ID
Create `/tmp/ExportOptions.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>developer-id</string>
    <key>teamID</key>
    <string>YOURTEAMID</string>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
```
```bash
xcodebuild -exportArchive \
  -archivePath /tmp/<AppName>.xcarchive \
  -exportPath /tmp/<AppName>Export \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  -allowProvisioningUpdates
```

### 5. Notarize
```bash
ditto -c -k --keepParent /tmp/<AppName>Export/<AppName>.app /tmp/<AppName>.zip

xcrun notarytool submit /tmp/<AppName>.zip \
  --keychain-profile "mac-notary" \
  --wait
```
Must return `status: Accepted`. If rejected, fetch the log:
```bash
xcrun notarytool log <submission-id> --keychain-profile "mac-notary"
```

### 6. Staple
```bash
xcrun stapler staple /tmp/<AppName>Export/<AppName>.app

# Clear extended attributes added by staple — ditto (used by dmgbuild) fails with
# "Operation not permitted" on apps with staple xattrs on macOS 15+
xattr -cr /tmp/<AppName>Export/<AppName>.app
```

### 7. Build DMG (no Finder permissions needed)
Create dmgbuild settings file `/tmp/dmgbuild_settings.py`:
```python
application = '/tmp/<AppName>Export/<AppName>.app'
appname = '<AppName>'

files = [application]
symlinks = {'Applications': '/Applications'}

icon_locations = {
    '<AppName>.app': (160, 180),
    'Applications':  (480, 180),
}

background = 'builtin-arrow'

window_rect = ((200, 120), (660, 400))
icon_size = 128
text_size = 14
```
```bash
# DMG filename is always <AppName>.dmg (no version) for a stable, permanent download URL.
# Example: Clibi.dmg, Dropi.dmg — never Clibi-1.2.0.dmg
python3 -m dmgbuild -s /tmp/dmgbuild_settings.py "<AppName>" /tmp/<AppName>.dmg
```

### 8. Update Sparkle Appcast (if applicable)
If the project has an `appcast.xml` in the repo root, update it for Sparkle auto-updates.

**Detection**: Check if `appcast.xml` exists. If not, skip this step.

**Find Sparkle tools**:
```bash
SIGN_UPDATE=$(find ~/Library/Developer/Xcode/DerivedData -name "sign_update" -type f 2>/dev/null | head -1)
```

**Sign DMG and update appcast using Python** (never use `sed` for multiline XML — it breaks on macOS):
```python
python3 -c "
import sys, subprocess, os
from datetime import datetime, timezone

version = '<version>'
dmg = '/tmp/<AppName>.dmg'
appcast = 'appcast.xml'
sign_update = '$SIGN_UPDATE'
download_url = 'https://github.com/<owner>/<repo>/releases/download/v' + version + '/<AppName>.dmg'

# Get EdDSA signature from Sparkle
sparkle_attrs = subprocess.check_output([sign_update, dmg], text=True).strip()
file_size = os.path.getsize(dmg)
pub_date = datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S %z')

item = f'''    <item>
      <title><AppName> {version}</title>
      <pubDate>{pub_date}</pubDate>
      <enclosure
        url=\"{download_url}\"
        {sparkle_attrs}
        type=\"application/octet-stream\"
        sparkle:version=\"{version}\"
        sparkle:shortVersionString=\"{version}\"
      />
    </item>'''

with open(appcast, 'r') as f:
    content = f.read()
content = content.replace('  </channel>', item + '\n  </channel>')
with open(appcast, 'w') as f:
    f.write(content)
print(f'Appcast updated: v{version} ({file_size} bytes)')
"
```

**Commit and push** so the appcast feed is live before the GitHub release:
```bash
git add appcast.xml && git commit -m "chore: update appcast for v<version>" && git push
```

### 9. Publish GitHub Release
```bash
# The asset name stays <AppName>.dmg across all releases.
# This makes https://github.com/<owner>/<repo>/releases/latest/download/<AppName>.dmg
# a permanent, version-agnostic download link users can bookmark or share.
gh release create v<version> /tmp/<AppName>.dmg \
  --title "<AppName> <version>" \
  --notes "<release notes>"
```

### 10. Cleanup
```bash
rm -rf /tmp/<AppName>.xcarchive /tmp/<AppName>Export /tmp/<AppName>.zip \
       /tmp/<AppName>.dmg /tmp/dmgbuild_settings.py
```

## Output
```
✅ Archive      — signed with Developer ID Application
✅ Notarize     — Apple: Accepted
✅ Staple       — ticket embedded
✅ DMG          — <AppName>.dmg (stable filename, drag-to-install layout)
✅ Appcast      — EdDSA-signed entry added (if appcast.xml exists)
✅ Release      — https://github.com/<owner>/<repo>/releases/tag/v<version>
🔗 Stable link  — https://github.com/<owner>/<repo>/releases/latest/download/<AppName>.dmg
```

## Error Handling
| Error | Fix |
|-------|-----|
| "conflicting provisioning settings" | Remove `CODE_SIGN_IDENTITY` override, use `-allowProvisioningUpdates` |
| notarytool: "Invalid Credentials" | Re-run `store-credentials` with fresh app-specific password |
| notarytool: "Rejected" | Fetch log with `notarytool log`, check for hardened runtime or entitlement issues |
| stapler: "Unable to staple" | Notarization may not have propagated yet, wait 30s and retry |
| dmgbuild: missing module | `pip3 install dmgbuild` |
| gh: not authenticated | `gh auth login` |

## Notes
- **Never use Finder AppleScript** for DMG layout — use `dmgbuild` instead (no permissions required)
- **Keychain profile** `mac-notary` is reusable across all your macOS projects
- Build number (`CURRENT_PROJECT_VERSION`) should increment with each release
- The `.zip` submitted to notarytool is temporary; the stapled `.app` inside the DMG is what users get

#!/bin/zsh
# 打包 Mac 客户端：dist/律台.app 和 dist/LawDesk-<版本>-<架构>.dmg
# 用法：mac/build.sh            只打当前芯片（Apple 芯片或 Intel）
#       ARCH=universal mac/build.sh   同时支持两种芯片（体积约翻倍）
# 需要：Xcode 命令行工具（xcode-select --install）和本机的 node（会被复制进 App）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAC="$ROOT/mac"
DIST="$ROOT/dist"
BUILD="$DIST/build"
APP="$DIST/律台.app"
VERSION="$(node -p "require('$ROOT/package.json').version")"
ARCH="${ARCH:-$(uname -m)}"
NODE_BIN="${NODE_BIN:-$(node -p 'process.execPath')}"
DMG="$DIST/LawDesk-$VERSION-$ARCH.dmg"

echo "› 版本 $VERSION，架构 $ARCH，node 来自 $NODE_BIN"
rm -rf "$BUILD" "$APP" "$DMG"
mkdir -p "$BUILD" "$APP/Contents/MacOS" "$APP/Contents/Resources/app"

echo "› 编译 Swift 外壳"
if [[ "$ARCH" == "universal" ]]; then
  for a in arm64 x86_64; do
    swiftc -O -target "$a-apple-macos12.0" -o "$BUILD/LawDesk-$a" "$MAC/main.swift" -framework Cocoa -framework WebKit
  done
  lipo -create "$BUILD/LawDesk-arm64" "$BUILD/LawDesk-x86_64" -output "$APP/Contents/MacOS/LawDesk"
else
  swiftc -O -target "$ARCH-apple-macos12.0" -o "$APP/Contents/MacOS/LawDesk" "$MAC/main.swift" -framework Cocoa -framework WebKit
fi

echo "› 生成图标"
swiftc -O -o "$BUILD/make-icon" "$MAC/make-icon.swift" -framework Cocoa
"$BUILD/make-icon" "$BUILD/icon.png"
ICONSET="$BUILD/AppIcon.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$BUILD/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$BUILD/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

echo "› 复制程序文件和 node"
cp -R "$ROOT/server.js" "$ROOT/package.json" "$ROOT/lib" "$ROOT/public" "$APP/Contents/Resources/app/"
if [[ "$ARCH" == "universal" ]]; then
  cp "$NODE_BIN" "$APP/Contents/Resources/node"
elif lipo -info "$NODE_BIN" | grep -q "are:"; then
  lipo -thin "$ARCH" "$NODE_BIN" -output "$APP/Contents/Resources/node"
else
  cp "$NODE_BIN" "$APP/Contents/Resources/node"
fi
chmod +x "$APP/Contents/Resources/node"
cp "$ROOT/LICENSE" "$APP/Contents/Resources/LICENSE"
cp "$MAC/NODE_LICENSE" "$APP/Contents/Resources/NODE_LICENSE"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>律台</string>
  <key>CFBundleDisplayName</key><string>律台</string>
  <key>CFBundleIdentifier</key><string>local.lawdesk.app</string>
  <key>CFBundleExecutable</key><string>LawDesk</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSHumanReadableCopyright</key><string>本地运行，无需登录</string>
  <key>NSMicrophoneUsageDescription</key><string>语音输入需要使用麦克风。</string>
  <key>NSSpeechRecognitionUsageDescription</key><string>语音输入需要把语音转成文字。</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
    <key>NSAllowsArbitraryLoadsInWebContent</key><true/>
  </dict>
</dict>
</plist>
PLIST

echo "› 签名（本机自签名）"
codesign --force --sign - "$APP/Contents/Resources/node"
codesign --force --sign - "$APP"
codesign --verify --strict "$APP"

echo "› 打包 dmg"
STAGE="$BUILD/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/应用程序"
hdiutil create -volname "律台" -srcfolder "$STAGE" -fs HFS+ -format UDZO -ov "$DMG" >/dev/null
rm -rf "$BUILD"

echo "✓ 完成：$DMG（$(du -h "$DMG" | cut -f1)）"

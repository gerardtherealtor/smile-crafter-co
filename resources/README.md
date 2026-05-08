# Native App Resources

`@capacitor/assets` reads the source images in this folder and generates
every iOS / Android icon size + splash automatically.

## Files

- `icon.png`            — 1024×1024, square, **no transparency**. Used as the iOS app icon and the Android legacy icon. (Truck logo — already in place.)
- `icon-only.png`       — 1024×1024 foreground-only version for Android adaptive icons.
- `icon-foreground.png` — 1024×1024, same as icon-only; the Android system masks it into a circle/squircle.
- `splash.png` (optional) — 2732×2732, centered logo on solid background, used for launch screen.

## Regenerate after replacing any image

```bash
npx capacitor-assets generate
npx cap sync
```

This rewrites `ios/App/App/Assets.xcassets/AppIcon.appiconset/` and
`android/app/src/main/res/mipmap-*/`, which is what App Store Connect
and Play Console actually display — `public/app-icon.png` is only the
favicon for the web build.

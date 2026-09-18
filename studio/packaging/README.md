# Package Studio for Mac

Build an unsigned `AI Coding Studio.app` and copy it to `~/Applications`.

## Before you start

Use Node 18 or newer on a Mac.

The packager reads `studio/shell` and does not edit that tree.

## Install shell dependencies

```bash
	cd studio/shell
	npm install
```

Stop if `studio/shell/node_modules/electron` is missing.

## Install packaging tools

```bash
	cd studio/packaging
	npm install
```

## Check the recipe

```bash
	npm test
```

The smoke checks `builder.yml` and does not build a `.app`.

## Build the app

From `studio/packaging`, run:

```bash
	npm run package
```

The command writes a DMG and a zip under `dist`.

If `../shell/node_modules/electron` is missing, the command prints a FAIL line and exits without calling electron-builder.

The build emits only a Mac DMG and a zip.

## Install the app

Quit an installed copy of AI Coding Studio before replacing it.

```bash
	mkdir -p ~/Applications
	rm -rf ~/Applications/AI\ Coding\ Studio.app
	ditto -x -k dist/*.zip ~/Applications
```

The install target is `~/Applications`. Leave `/Applications` unused.

You can also open the DMG and drag `AI Coding Studio.app` into `~/Applications`.

## Open the app

```bash
	open ~/Applications/AI\ Coding\ Studio.app
```

The window title is AI Coding Studio.

## If Gatekeeper blocks the app

The build is unsigned.

```bash
	xattr -dr com.apple.quarantine ~/Applications/AI\ Coding\ Studio.app
```

Then open the app again.

Control-click the app in Finder, choose Open, then choose Open again.

# OrangitazSpades

Play partnership spades against the computer. You and your NPC partner (seated across from you) play against two NPC opponents, first to 500 (or 250 for a short game). Runs in any browser and builds as an Android app, the same way as OrangitazCribbage.

## Play it

Open `spades.html` in any browser. It is a single self-contained file with no dependencies, laid out for a phone in portrait.

## Rules

- Four players, two fixed partnerships: you and Partner against West and East. Standard 52-card deck, 13 cards each, spades are trump. Ace is high.
- Everyone bids the number of tricks they expect to take. Your bid and your partner's bid are added together as one team contract.
- You must follow suit if you can. Spades cannot be led until they have been played on an earlier trick ("broken"), unless you hold nothing but spades.
- Made contract: 10 points per trick bid, plus 1 point per extra trick. Each extra trick is a **bag**. Ten bags cost 100 points.
- Set (fewer tricks than bid): lose 10 points per trick bid.
- **Nil** (bid 0): +100 if that player takes no tricks, -100 if they take one. **Blind nil** (optional, offered when you are 100 or more behind): bid nil without looking at your cards, +200 or -200.
- A nil bidder's tricks never count towards their partner's bid; if the nil fails, those tricks become bags.
- First team to the target wins. A team at -200 or lower loses. If both pass the target in the same hand the higher score wins; a tie plays on.

## Features

- Bidding with a Hint button, Nil, and optional Blind Nil
- **Hint button**: suggests the best bid and the best card to play, and explains why
- **Three difficulty levels** (Settings): Easy, Normal and Hard; a change applies from the next game
- **Short game** (Settings): play to 250 instead of 500
- **Hand results** with a line-by-line breakdown (bid made, bags, nil, penalties)
- **Stats**: games, win/loss, streaks, bids made, nil and blind nil record, sets, bags, and results per difficulty. Saved on the device and can be reset
- **Start screen**: Continue (when a game is saved), New game, Settings and Stats; the in-game menu has "Main screen"
- **Save and resume**: the game is saved after every card, so if the app is closed or Android stops it, Continue picks up where you left off
- **Sounds, vibration and score popups** (all switchable), skip-animations option
- **Easier to read**: a four-colour deck (clubs green, diamonds blue) and a larger card text option
- **Android**: the back button asks before leaving (the game is saved), and the screen can be kept on while you play
- In-app update check (see Updates)

## The NPCs

| Level | Bidding | Playing |
|---|---|---|
| Easy | Rough hand estimate with a lot of random noise | Plays at random about half the time, otherwise the rule-of-thumb play |
| Normal | Counts spade honours, long spades, side-suit aces and kings and ruffing; bids nil on very weak hands | Rule of thumb: covers a partner's nil, ducks tricks once the contract is made to avoid bags, tries to set an opponent's nil, leads sure winners |
| Hard | Tries each sensible bid (and nil) on random deals of the unseen cards and keeps the best average score | Guesses the hidden hands from the cards played and who has shown a void, plays out the rest of the hand for every legal card, and picks the best average point difference; may gamble on a blind nil when far behind |

Measured over simulated games to 500 (40 per matchup, so treat these as roughly plus or minus 8 points): Hard beat Easy 40 out of 40 and Hard beat Normal about 90% of the time. Spades has a lot of luck, so even a much better NPC team loses sometimes.

## iPhone and other browsers (web version)

Every push to `main` publishes the game to GitHub Pages (workflow "Publish web version"; needs Settings, Pages, Source = GitHub Actions). On an iPhone, open `https://orangitaz.github.io/OrangitazSpades/` in Safari, tap Share, then **Add to Home Screen**. It then opens full-screen like an app and works offline. It updates itself when you are online. There is no vibration on iPhone, and a game saved in Safari is separate from the home-screen copy, so play from the icon.

## Android

The `app/` folder is a small WebView wrapper (Kotlin, min Android 8.0). At build time `spades.html` is copied in as the app's page, so the game has one source of truth. Links that leave the game, such as the update Download link, open in your browser.

### Get an APK from GitHub

- **On demand:** Actions tab, "Build Android APK", "Run workflow". When it finishes, download the `OrangitazSpades-<version>-apk` artifact from the run page (it is a zip containing the APK).
- **As a release:** bump the version with `scripts/release.sh` (below) and push. GitHub builds the APK and publishes the release by itself, using your release notes as the description.

The workflow runs the tests first and only builds the APK if they pass.

Install the APK on your phone by opening it and allowing installs from your browser or file manager when asked.

### Signing (do this once before your first real release)

Without signing secrets, the APK is signed with a throwaway debug key. It installs, but a later build signed with a different key can't update it in place; you'd have to uninstall first (which also clears your stats). To fix that, make one key and store it as repository secrets (Settings, Secrets and variables, Actions). You can reuse the same key as your other apps if you like:

1. `keytool -genkeypair -v -keystore release.jks -alias spades -keyalg RSA -keysize 2048 -validity 10000`
2. `base64 -w0 release.jks` and save the output as the secret `KEYSTORE_BASE64`
3. Add secrets `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`spades`) and `KEY_PASSWORD`

Keep `release.jks` somewhere safe and never commit it. If you lose it you can't ship updates to existing installs.

## Updates

The app shows its version at the bottom of the screen, checks `version.json` in this repo once a day on launch, and has a "Check for updates" link. When the version in `version.json` is newer than the one in the app, it shows "Update available" with the release notes and a download link.

The repo must be public for the check to work, since the app reads `version.json` from raw.githubusercontent.com. If the repo is private, the app shows "Couldn't check for updates" and keeps working.

### Releasing a new version

```
scripts/release.sh 1.0.1 "What changed, in a sentence"
git push origin main
```

The script sets the version in `spades.html` and `version.json` together, writes your notes into `version.json`, runs the tests and commits. After the push, the "Build Android APK" workflow does the rest:

- **Automatically:** it runs on every push to `main` that changes the game or the app, and also checks every 6 hours as a safety net. If the version has no GitHub Release yet, it runs the tests, builds the signed APK and publishes the release, with the APK attached as `OrangitazSpades-<version>.apk` and as `OrangitazSpades.apk` (a permanent link: `https://github.com/Orangitaz/OrangitazSpades/releases/latest/download/OrangitazSpades.apk`).
- **Right away:** Actions tab, "Build Android APK", "Run workflow", tick **publish**. Running it without the tick only builds a downloadable APK and publishes nothing.
- **By tag:** pushing a tag like `v1.0.1`, or publishing a release in the browser, also works; the build attaches the APK to it.

A release is never published if the version in `spades.html` and `version.json` disagree, or if a tag doesn't match them. GitHub pauses scheduled workflows after 60 days with no activity in the repo; running the workflow once by hand wakes it up again.

## Tests

```
node --test tests/spades.test.js
```

Needs Node 18 or newer, nothing to install. It covers following suit and leading spades, trick winners, scoring (bids, bags, nil, blind nil, set, bag penalty), game end, the AI always playing legal cards, saved-game validation, stats, version comparison, and full simulated games at every difficulty. It also runs in GitHub Actions before every build.

A slower, luck-dependent comparison of the levels is available with `STRENGTH=1 node --test tests/strength.test.js` (`GAMES=100` for more games per matchup).

## Layout of the code

The rules, AI, stats and save-game functions sit between the `==LOGIC==` and `==END LOGIC==` markers in `spades.html` and have no DOM dependencies, so the tests load them directly. `tests/harness.js` also runs the whole game script against a fake DOM for the simulations.

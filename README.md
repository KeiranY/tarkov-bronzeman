# Bronzeman Mode for [Singleplayer Tarkov](https://www.sp-tarkov.com/)

Inspired by [Gudi's OSRS gamemode](https://www.youtube.com/watch?v=GFNfa2saOJg) of the same name, Bronzeman mode is a gamemode that requires players to have "earned" an item through normal means before being able to purchase it.

Upon installing this mod you'll notice that the traders are no longer willing to sell you anything. Once you've successfully completed a raid you will "unlock" all of the items you've extracted with, and will now be able to purchase them from traders.

## Installation

1. Download the latest release.
2. Extract to the folder `user/mods/` in the same folder as your SPT-AKI install.
3. Edit the `config.json` to your liking, configuration options listed below.

## Configuration items

`unlocks.raidRunThrough`, if true allows you to unlock items even if the raid was a "Run Through".

`unlocks.raidDeath`, if true allows you to unlock items even if you died/were MIA.

`unlocks.inventory`, if true will unlock any items already in your player inventory.

`unlocks.quests`, if true unlocks any items receieved as quest rewards.

`unlocks.foundInRaidOnly`, if true will only unlock "Found in raid" items. Affects both raids and inventory unlocks.

`hideItems`, if true will remove locked items from trader inventories, if false will set their stock to 0 instead.

`allTraders`, if true all traders (include those from mods) are affected, otherwise use the next option.

`traders`, a list of trader IDs to restrict. _Default traders can be found in `Aki_Data\Server\database\traders`_

`includeRagfair`, if true will also restrict the flea market/ragfair.

`ignoreCategories`, contains a list of settings that make whole catagories of items available without being unlocked.

`ignoreItems`, items that can be purchased without being unlocked, useful for quest items i.e. the MS200 marker.

`requireUnlockComponents`, if true you'll have to have unlocked every item on a weapon, in a bag, etc. in order to purchase it.

`debug`, if true will display additional debug information in the AKI Server window and in `user/logs`.

## Changelog

## 1.1.0

Features:

- Introduce new `ignoreCategories` list of settings that make whole catagories of items available without being unlocked.

## 1.0.0

Features:

- **Update to SPT AKI 3.8!**
- Complete rewrite from scratch to reflect the new standard for modding
- Added `debug` option to print verbose logging, ​Please use this when reporting issues​, issue template TBC
- Flea market offers are now disabled instead of removed when the player hasn't unlocked them yet

## 0.2.0

Features:

- Rewrite of the unlock config items, they're now held under `unlocks` for a bit of clarity. Docs have been updated to reflect this.
- Add `unlocks.quests` to allow unlocking of items recieved as quest rewards
- Add `unlocks.foundInRaidOnly` to restrict unlocking of items to those found in raid.
  - Note: `unlocks.raidRunThrough` is superseded by this, as any items from a runthrough are marked as not found in raid (unless changed by another mod)
- Minor rewrites and logging changes.

## 0.1.1

Bugfix:

- Fixed an issue trying to unlock items from a profile without any.

### 0.1.0

Features:

- Add `unlockFromInventory` to automatically unlock any items in a players stash on startup/profile load.
- Add `hideItems` to allow you to either hide locked items or set their trader stock to 0.
  - I've tried a few ways to also have "out of stock" trades on flea market/ragfair but it seems AKI stops generating new trades if the stock is set to 0.


### 0.0.4

Bugfix:

- Fixed an issue saving unlocked items when leaving a raid.

### 0.0.3

Bugfix:

- No longer crash when loading trades/offers if the account hasn't yet completed a raid.

### 0.0.2

Added additional logging:

- Message on mod load
  
> [INFO] Loading: Bronzeman : v0.0.2

- Message when removing trades from a trader

> [INFO] [bronzeman] Removing trades for trader 54cb50c76803fa8b248b4571
>
> [INFO] [bronzeman] Removed 123 locked trades

- Message when removing offers from ragfair/flea market

> [INFO] [bronzeman] Removing flea market offers
> 
> [INFO] [bronzeman] Removed 529 locked offers

### 0.0.1

Initial version
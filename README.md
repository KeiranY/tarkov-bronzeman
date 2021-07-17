# Tarkov Bronzeman mode

Inspired by [Gudi's OSRS gamemode|https://www.youtube.com/watch?v=GFNfa2saOJg] of the same name, Bronzeman mode is a gamemode that requires players to have "earned" an item through normal means before being able to purchase it.

Upon installing this mod you'll notice that the traders are no longer willing to sell you anything. Once you've successfully completed a raid you will "unlock" all of the items you've extracted with, and will now be able to purchase them from traders.


## Configuration items

`allowRunThrough`, if true allows you to unlock items even if the raid was a "Run Through".

`allowDeath`, if true allows you to unlock items even if you died/were MIA.

`unlockFromInventory`, if true will unlock any items already in your player inventory.

`hideItems`, if true will remove locked items from trader inventories, if false will set their stock to 0 instead.

`allTraders`, if true all traders (include those from mods) are affected, otherwise use the next option.

`traders`, a list of trader IDs to restrict. _Default traders can be found in `Aki_Data\Server\database\traders`_

`includeRagfair`, if true will also restrict the flea market/ragfair.

`ignoreItems`, items that can be purchased without being unlocked, useful for quest items i.e. the MS200 marker.

`requireUnlockComponents`, if true you'll have to have unlocked every item on a weapon, in a bag, etc. in order to purchase it

## Changelog

### 0.1.0

Features:

- Automatically unlock any items in a players stash on startup profile load.
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
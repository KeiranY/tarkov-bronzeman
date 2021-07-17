"use strict";

const config = require("./config.json");

class Mod
{
    constructor()
    {
        this.package = require('./package.json');
        Logger.info(`Loading: ${this.package.name} : v${this.package.version}`);

        SaveServer.onLoad[this.package.name] = this.loadProfile;
        // When leaving a raid, update our unlocks
        HttpRouter.onStaticRoute["/raid/profile/save"][this.package.name] = this.saveRaidProgress;
        // Filter trader results
        HttpRouter.onDynamicRoute["/client/trading/api/getTraderAssort/"][this.package.name] = this.getTraderAssort;

        if (config.includeRagfair) {
            // Filter flea results
            this.origGetOffers = RagfairController.getOffers;
            RagfairController.getOffers = this.getOffers.bind(this);
        }
    }

    loadProfile(sessionID) {

        let profile = SaveServer.profiles[sessionID];
        if (!('bronzemanItems' in profile)) profile['bronzemanItems'] = [];

        let origUnlocks = profile.bronzemanItems.length;
        for (let item of profile.characters.pmc.Inventory.items) {
            profile.bronzemanItems.push(item._tpl);
        }

        Logger.info(`[bronzeman] Unlocked ${profile.bronzemanItems.length - origUnlocks} items from inventory for player ${sessionID}`)
        return profile;
    }

    saveRaidProgress(url, raid, sessionID, output) {
        if  (raid.exit === "survived" || // Unlock if survived
            (raid.exit === "runner" && config.allowRunThrough) || // Unlock if run through, and enabled
            config.allowDeath) { // Unlock always if death allowed
                Logger.info("[bronzeman] Saving progress for raid session " + sessionID);

                // Get player profile
                let profile = SaveServer.profiles[sessionID];
                if (!('bronzemanItems' in profile)) profile['bronzemanItems'] = [];

                // For each item we ended the raid with
                for (var item of raid.profile.Inventory.items) {
                    // Don't unlock invalid items, or the same item multiple times
                    if (!item._tpl || profile['bronzemanItems'].includes(item._tpl)) continue;

                    // Unlock item
                    profile['bronzemanItems'].push(item._tpl);
                }

                Logger.debug(`[bronzeman] ${ profile['bronzemanItems'].length} total items unlocked`);
        }

        // Don't change anything about the response
        return output;
    }

    getTraderAssort(url, info, sessionID, output) {
        const traderID = url.replace("/client/trading/api/getTraderAssort/", "");
        // If we're not modifying this trader, return the Aki's regular output
        if (!config.traders.includes(traderID) && !config.allTraders) return output;
        TraderController.updateTraders();

        Logger.info("[bronzeman] Removing trades for trader " + traderID);

        let assort = TraderController.getAssort(sessionID, traderID);
        let profile = SaveServer.profiles[sessionID];
        if (!('bronzemanItems' in profile)) profile['bronzemanItems'] = [];

        let toRemove = []
        for (let item of assort.items) {
            // If we don't know the item, and don't have it ignored
            if (!profile.bronzemanItems.includes(item._tpl) && !config.ignoreItems.includes(item._tpl)) {
                // If the item is the main item and not a component/child, remove it
                if (item.parentId === "hideout") {
                    toRemove.push(item._id);
                }
                // If the item is a child, and we require all components be unlocked, remove the parent item
                else if (config.requireUnlockComponents) {
                    toRemove.push(item.parentId)
                }
                item._upd = {"UnlimitedCount":false,"StackObjectsCount":1337}
            }
        }

        Logger.info(`[bronzeman] Removed ${toRemove.length} locked trades`);
        if (config.hideItems) {
            for (let id of toRemove) {
                assort = TraderController.removeItemFromAssort(assort, id);
            }
        } else {
            for (let i in assort.items) {
                if (toRemove.includes(assort.items[i]._id)) {
                    assort.items[i].upd = {"UnlimitedCount":false,"StackObjectsCount":0}
                }
            }
        }

        return HttpResponse.getBody(assort);
    }

    getOffers(sessionID, info) {
        
        Logger.info("[bronzeman] Removing flea market offers");

        let result = this.origGetOffers(sessionID, info);

        let profile = SaveServer.profiles[sessionID];
        if (!('bronzemanItems' in profile)) profile['bronzemanItems'] = [];

        let j = 0;
        // For each offer
        for (let i = 0; i < result.offers.length; i++) {
            let allowed;
            if (config.requireUnlockComponents) {
                allowed = true;
                // For each offer in the item
                for (let item of result.offers[i].items) {
                    // If we've not unlocked it, and aren't ignoring it
                    if (!(profile.bronzemanItems.includes(item._tpl)) && !config.ignoreItems.includes(item._tpl)) {
                        allowed = false;
                        break;
                    }
                }
            } else {
                allowed = false;
                // For each offer in the item
                for (let item of result.offers[i].items) {
                    // If this is the root item AND we've unlocked that item OR are ignoring unlocks for that item
                    if (item._id === result.offers[i].root && 
                        (profile.bronzemanItems.includes(item._tpl) || config.ignoreItems.includes(item._tpl))) {
                        allowed = true;
                        break;
                    }
                }
            }
            if (allowed) {
                // Leave it in the list, in an updated position based on any skipped
                result.offers[j++] = result.offers[i];
            }
        }
        Logger.info(`[bronzeman] Removed ${result.offers.length - j} locked offers`);
        // Update offers array to new length
        result.offers.length = j;

        RagfairController.countCategories(result);

        return result;
    }
}

module.exports = new Mod();
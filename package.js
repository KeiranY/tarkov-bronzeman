"use strict";

const config = require("./config.json");

class Mod
{
    constructor()
    {
        this.package = require('./package.json');
        Logger.info(`Loading: ${this.package.name} : v${this.package.version}`);

        // Unlock from our profile
        if (config.unlocks.inventory) {
            SaveServer.onLoad[this.package.name] = this.loadProfile.bind(this);
        }
        // Unlock items gained from quests
        if (config.unlocks.quests) {
            ItemEventRouter.onEvent["QuestComplete"][this.package.name] = this.questComplete.bind(this);
        }
        // Unlock items extracted from raids
        if (config.unlocks.raid) {        
            HttpRouter.onStaticRoute["/raid/profile/save"][this.package.name] = this.saveRaidProgress.bind(this);
        }

        // Filter trader results
        HttpRouter.onDynamicRoute["/client/trading/api/getTraderAssort/"][this.package.name] = this.getTraderAssort.bind(this);
        // Filter flea results
        if (config.includeRagfair) {    
            this.origGetOffers = RagfairController.getOffers;
            RagfairController.getOffers = this.getOffers.bind(this);
        }
    }

    unlockItems(items, sessionID) {
        // Get player profile
        let profile = SaveServer.profiles[sessionID];
        // Set bronzemanItems to an empty arrar if it's missing (i.e. a fresh account)
        if (!('bronzemanItems' in profile)) profile.bronzemanItems = [];

        let origCount = profile.bronzemanItems.length;
        for (let item of items) {
            // If the item is missing it's template (unlikely), or is already unlocked
            if (!item._tpl || profile.bronzemanItems.includes(item._tpl)) continue;
            // Unlock item
            profile.bronzemanItems.push(item._tpl);
        }
        Logger.info(`[bronzeman] Unlocked ${profile.bronzemanItems.length - origCount} items for player ${profile.info?.username}`)
    }

    questComplete(pmcData, body, sessionID, result) {
        Logger.info(`[bronzeman] Unlocking quest items for session ${sessionID}`);
        let quest = DatabaseServer.tables.templates.quests[body.qid];
        let items = QuestController.getQuestRewardItems(quest, "Success");

        Logger.info(JSON.stringify(items));
        this.unlockItems(items, sessionID);

        return result;
    }

    loadProfile(sessionID) {
        Logger.info("[bronzeman] Unlocking items from stash for session " + sessionID);
        let items = SaveServer.profiles[sessionID]?.characters?.pmc?.Inventory?.items;
        if (items) {
            if (config.unlocks.foundInRaidOnly) {
                Logger.info(JSON.stringify(items.filter(i => i?.upd?.SpawnedInSession == true)));
                this.unlockItems(items.filter(i => i?.upd?.SpawnedInSession == true), sessionID)
            } else {
                this.unlockItems(items, sessionID);
            }
        }
        return SaveServer.profiles[sessionID];
    }

    saveRaidProgress(url, raid, sessionID, output) {
        if (raid.exit === "runner" && !config.unlocks.raidRunThrough) {
            Logger.info("[bronzeman] Not unlocking run-through raid items as unlocks.raidRunThrough is false.");
            return;
        }
        if (raid.exit !== "runner" && raid.exit !== "survived" && !config.unlocks.raidDeath) {
            Logger.info("[bronzeman] Not unlocking death/MIA raid items as unlocks.raidDeath is false.");
            return;
        }
        Logger.info("[bronzeman] Unlocking raid items for session " + sessionID);
        // For each item we ended the raid with
        if (config.unlocks.foundInRaidOnly) {
            Logger.info(JSON.stringify(raid.profile.Inventory.items));
            this.unlockItems(raid.profile.Inventory.items.filter(i => i?.upd?.SpawnedInSession == true), sessionID)
        } else {
            this.unlockItems(raid.profile.Inventory.items, sessionID);
        }
        // Don't change the response
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
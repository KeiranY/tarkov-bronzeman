
import { IPreAkiLoadMod }               from "@spt-aki/models/external/IPreAkiLoadMod";
import { ILogger }                      from "@spt-aki/models/spt/utils/ILogger";
import { LogTextColor }                 from "@spt-aki/models/spt/logging/LogTextColor";
import { LogBackgroundColor }                 from "@spt-aki/models/spt/logging/LogBackgroundColor";
import { IEmptyRequestData }            from "@spt-aki/models/eft/common/IEmptyRequestData";
import { ITraderAssort }                from "@spt-aki/models/eft/common/tables/ITrader";
import { Item }                         from "@spt-aki/models/eft/common/tables/IItem";
import { IPmcData }                     from "@spt-aki/models/eft/common/IPmcData";
import { IAkiProfile }                  from "@spt-aki/models/eft/profile/IAkiProfile";
import { IGetOffersResult }             from "@spt-aki/models/eft/ragfair/IGetOffersResult";
import { IItemEventRouterResponse }     from "@spt-aki/models/eft/itemEvent/IItemEventRouterResponse";
import { ISaveProgressRequestData }     from "@spt-aki/models/eft/inRaid/ISaveProgressRequestData";
import { ICompleteQuestRequestData }    from "@spt-aki/models/eft/quests/ICompleteQuestRequestData";
import { PlayerRaidEndState }           from "@spt-aki/models/enums/PlayerRaidEndState";
import { QuestStatus }                  from "@spt-aki/models/enums/QuestStatus";
import { QuestCallbacks }               from "@spt-aki/callbacks/QuestCallbacks";
import { DatabaseServer }               from "@spt-aki/servers/DatabaseServer";
import { SaveServer }                   from "@spt-aki/servers/SaveServer";
import { QuestHelper }                  from "@spt-aki/helpers/QuestHelper";
import { TraderHelper }                 from "@spt-aki/helpers/TraderHelper";
import { ItemHelper }                   from "@spt-aki/helpers/ItemHelper";
import { QuestController }              from "@spt-aki/controllers/QuestController";
import { RepeatableQuestController }    from "@spt-aki/controllers/RepeatableQuestController";
import type { DynamicRouterModService } from "@spt-aki/services/mod/dynamicRouter/DynamicRouterModService";
import type { StaticRouterModService }  from "@spt-aki/services/mod/staticRouter/StaticRouterModService";
import type { GameController }          from "@spt-aki/controllers/GameController";
import type { HttpResponseUtil }        from "@spt-aki/utils/HttpResponseUtil";
import { DependencyContainer, singleton, inject } from "tsyringe";
import config from "../config.json";

export class Bronzeman implements IPreAkiLoadMod {
    public preAkiLoad(container: DependencyContainer): void {
        // Register our class of mod helper functions
        container.register("BronzemanMod", { useClass: BronzemanMod });

        // Register our override of Quest handling, used to unlock quest rewards
        if (config.unlocks.quests) {
            container.register("BronzemanQuestCallbacks", BronzemanQuestCallbacks);
            container.register("QuestCallbacks", {useToken: "BronzemanQuestCallbacks"});
        }

        const logger = container.resolve<ILogger>("WinstonLogger"); 
        const traderHelper = container.resolve<TraderHelper>("TraderHelper");
        const itemHelper = container.resolve<ItemHelper>("ItemHelper");
        const bronzeman = container.resolve<BronzemanMod>("BronzemanMod")
        
        const staticRouterModService = container.resolve<StaticRouterModService>("StaticRouterModService");
        const dynamicRouterModService = container.resolve<DynamicRouterModService>("DynamicRouterModService");
        const httpResponseUtil = container.resolve<HttpResponseUtil>("HttpResponseUtil");
        
        // Initialise player on game start
        container.afterResolution("GameController", (_, result: GameController) => {
            const originalGameStart = result.gameStart;

            result.gameStart = (url: string, info: IEmptyRequestData, sessionID: string, startTimeStampMS: number) => {
                if (sessionID) {
                    bronzeman.initPlayer(sessionID);
                    if (config.debug) {
                        for (const i of bronzeman.itemCheck(bronzeman.getPlayer(sessionID))) {
                            const name = itemHelper.getItemName(i);
                            logger.logWithColor(`[bronzeman] Existing unlock: (${i}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.BLUE);
                        }
                    }
                }

                originalGameStart.apply(result, [url, info, sessionID, startTimeStampMS]);
            }
        });

        // Handle end of raid
        staticRouterModService.registerStaticRouter("BronzemanRaidEnd", [
            {
                url: "/raid/profile/save",
                action: (url: string, info: ISaveProgressRequestData, sessionID: string, output: string) => {
                    if (info.exit == PlayerRaidEndState.RUNNER) {
                        if (!config.unlocks.raidRunThrough) {
                            logger.info("[bronzeman] Not unlocking run-through raid items as `unlocks.raidRunThrough` is false");
                            return output;
                        }
                    } else if (info.exit != PlayerRaidEndState.SURVIVED) {
                        if (!config.unlocks.raidDeath) {
                            logger.info("[bronzeman] Not unlocking death/MIA raid items as `unlocks.raidDeath` is false.");
                            return output;
                        }
                    }

                    bronzeman.unlockItems(bronzeman.getPlayer(sessionID), info.profile.Inventory.items);
                    return output;
                }
            }
        ], "aki");
        
        // Filter flea market
        if (config.includeRagfair) {
            staticRouterModService.registerStaticRouter("BronzemanStaticRoutes", [
                {
                    url: "/client/ragfair/find",
                    action: (url: string, info: any /*SearchRequestData*/, sessionID: string, output: string) => {

                        const out: IGetOffersResult = JSON.parse(output).data;

                        const profile = bronzeman.getPlayer(sessionID);
                        logger.info(`[bronzeman] Loading flea for ${profile.info.username} (${sessionID})`);

                        const origCount = out.offers.filter(o => !o.notAvailable).length;
                        const available = bronzeman.itemCheck(profile);

                        const toRemove = [];
                        for (const offer of out.offers) {
                            if (offer.notAvailable) continue;
                            if (config.requireUnlockComponents) {
                                for (const item of offer.items) {
                                    if (!available.includes(item._tpl)) {
                                        if (config.ignoreItems.includes(item._tpl)) {
                                            if (config.debug) {
                                                const name = itemHelper.getItemName(item._tpl);
                                                logger.logWithColor(`[bronzeman] Allowlisted flea item: (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.GREEN);
                                            }
                                            continue;
                                        }
                                        if (config.debug) {
                                            for (const root of offer.items) {
                                                if (root._id === offer.root) {
                                                    const rootName = itemHelper.getItemName(root._tpl);
                                                    const name = itemHelper.getItemName(item._tpl);
                                                    logger.logWithColor(`[bronzeman] Filtering offer: (${root._tpl}) ${rootName} w/ component (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.RED);
                                                }
                                            }
                                        }
                                        toRemove.push(offer.root);
                                        break;
                                    }
                                }
                            } else {
                                for (const item of offer.items) {
                                    if (item._id === offer.root) {
                                        if (!available.includes(item._tpl)) {
                                            if (config.ignoreItems.includes(item._tpl)) {
                                                if (config.debug) {
                                                    const name = itemHelper.getItemName(item._tpl);
                                                    logger.logWithColor(`[bronzeman] Allowlisted flea item: (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.GREEN);
                                                }
                                                continue;
                                            }
                                            if (config.debug) {
                                                const name = itemHelper.getItemName(item._tpl);
                                                logger.logWithColor(`[bronzeman] Filtering offer: (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.RED);
                                            }
                                            toRemove.push(offer.root);
                                        }
                                        break;
                                    }
                                }
                            }
                        }

                        out.offers = out.offers.map(offer => {
                            if (!toRemove.includes(offer.root)) return offer;
                            // offer.locked = true; - Sets to "Available after quest completion"
                            // the below sets locked items to "You've reached the personal limit"
                            offer.buyRestrictionMax = 1;
                            offer.buyRestrictionCurrent = 1;
                            return offer;
                        });
                        
                        logger.info(`[bronzeman] Returning ${out.offers.filter(o => o.buyRestrictionMax != 1).length}/${origCount} available offers`);

                        return httpResponseUtil.getBody(out);
                    }
                }
            ], "aki")
        }

        // Filter traders
        dynamicRouterModService.registerDynamicRouter("BronzemanRoutes", [
            {
                url: "/client/trading/api/getTraderAssort",
                action: (url: string, info: IEmptyRequestData, sessionID: string, output: string) => {
                    const profile = bronzeman.getPlayer(sessionID);
                    const trader = traderHelper.getTrader(url.split("/").pop(), sessionID);

                    if (!config.allTraders && !config.traders.includes(trader._id)) {
                        logger.info(`[bronzeman] Skipping filtering ${trader.nickname} as \`config.allTraders\` and trader ID (${trader._id}) is not listed in \`config.traders\``)
                        return output;
                    }
                    logger.info(`[bronzeman] Loading trader ${trader.nickname} (${trader._id}) for ${profile.info.username} (${sessionID})`);

                    const out: ITraderAssort = JSON.parse(output).data;
                    const origCount = out.items.filter(i => i.parentId === "hideout").length;
                    const available = bronzeman.itemCheck(profile);
                    
                    const toRemove = [];
                    for (const item of out.items) {
                        if (!available.includes(item._tpl)) {
                            if (config.ignoreItems.includes(item._tpl)) {
                                if (config.debug) {
                                    const name = itemHelper.getItemName(item._tpl);
                                    logger.logWithColor(`[bronzeman] Allowlisted trader item: (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.GREEN);
                                }
                                continue;
                            }
                            if (item.parentId === "hideout") {
                                // If the item is the main item and not a component/child, remove it
                                toRemove.push(item._id);
                                if (config.debug) {
                                    const name = itemHelper.getItemName(item._tpl);
                                    logger.logWithColor(`[bronzeman] Filtering trader: (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.RED);
                                }
                            } else if (config.requireUnlockComponents) {
                                // If the item is a child, and we require all components be unlocked, remove the parent item
                                toRemove.push(item.parentId)
                                if (config.debug) {
                                    for (const parent of out.items) {
                                        if (parent._id === item.parentId) {
                                            const parentName = itemHelper.getItemName(parent._tpl);
                                            const name = itemHelper.getItemName(item._tpl);
                                            logger.logWithColor(`[bronzeman] Filtering trader: (${parent._tpl}) ${parentName} w/ component (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.RED);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (config.hideItems) {
                        out.items = out.items.filter(i => !toRemove.includes(i._id));
                    } else {
                        out.items = out.items.map(i => {
                            if (!toRemove.includes(i._id)) return i;
                            i.upd = {
                                UnlimitedCount: false,
                                StackObjectsCount: 0,
                                //...i.upd
                            }
                            return i;
                        })
                    }
                    logger.info(`[bronzeman] Returning ${out.items.filter(i => i.parentId === "hideout").length}/${origCount} available items`);
                    return httpResponseUtil.getBody(out);
                }
            }
        ], "aki")
    }
}

@singleton()
class BronzemanMod {
    constructor(
        @inject("WinstonLogger") private logger: ILogger,
        @inject("SaveServer") private saveServer: SaveServer,
        @inject("ItemHelper") private itemHelper: ItemHelper
    ) {}

    public initPlayer(sessionID: string) {
        const profile = this.saveServer.getProfile(sessionID);

        this.itemCheck(profile);
        this.checkInventory(profile);  
    }

    public getPlayer(sessionID: string): IAkiProfile {
        return this.saveServer.getProfile(sessionID);
    }

    public unlockItems(profile: IAkiProfile, items: Item[]) {
        const origCount = profile["bronzemanItems"].length;
        if (config.unlocks.foundInRaidOnly) {
            const itemCount = items.length;
            if (config.debug) {
                for (const item of items.filter(i => !i?.upd?.SpawnedInSession)) {
                    const name = this.itemHelper.getItemName(item._tpl);
                    this.logger.logWithColor(`[bronzeman] Not Unlocking (not FIR): (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.RED);
                }
            }
            items = items.filter(i => i?.upd?.SpawnedInSession);
            const ignoredCount = itemCount - items.length;
            if (ignoredCount > 0) {
                this.logger.info(`[bronzeman] Not unlocking ${itemCount - items.length} items as \`config.unlocks.foundInRaidOnly\` is true`);
            }
        }
        for (const item of items) {
            if (profile["bronzemanItems"].includes(item._tpl)) continue;
            // Unlock item
            profile["bronzemanItems"].push(item._tpl);
            if (config.debug) {
                const name = this.itemHelper.getItemName(item._tpl);
                this.logger.logWithColor(`[bronzeman] Unlocking: (${item._tpl}) ${name}`, LogTextColor.WHITE, LogBackgroundColor.GREEN);
            }
        }
        this.logger.info(`[bronzeman] Unlocked ${profile["bronzemanItems"].length - origCount} items for ${profile.info.username}`)
    }

    public checkInventory(profile: IAkiProfile): void {
        this.unlockItems(profile, profile.characters.pmc.Inventory.items);
    }

    public itemCheck(profile: IAkiProfile): string[] {
        if (!Object.hasOwn(profile, "bronzemanItems")) {
            this.logger.info("[bronzeman] Fresh account, adding bronzemanItems");
            profile["bronzemanItems"] = [];
        } else {
            this.logger.info(`[bronzeman] Loaded ${profile["bronzemanItems"].length} unlocked items`);
        }

        return profile["bronzemanItems"];
    }

}

@singleton()
class BronzemanQuestCallbacks extends QuestCallbacks {
    constructor(@inject("HttpResponseUtil") httpResponse: HttpResponseUtil, 
        @inject("QuestController") questController: QuestController, 
        @inject("RepeatableQuestController") repeatableQuestController: RepeatableQuestController,
        @inject("DatabaseServer") private databaseServer: DatabaseServer,
        @inject("QuestHelper") private questHelper: QuestHelper,
        @inject("ItemHelper") private itemHelper: ItemHelper,
        @inject("WinstonLogger") private logger: ILogger,
        @inject("BronzemanMod") private bronzemanMod: BronzemanMod) {
        super(httpResponse, questController, repeatableQuestController);
    }
    
    public override completeQuest(pmcData: IPmcData, body: ICompleteQuestRequestData, sessionID: string): IItemEventRouterResponse {
        const ret = super.completeQuest(pmcData, body, sessionID);

        const quest = this.databaseServer.getTables().templates.quests[body.qid];
        const items = this.questHelper.getQuestRewardItems(quest, QuestStatus.Success);

        if (items.length == 0) return ret;

        this.logger.info(`[bronzeman] Trying to unlock ${items.length} items from quest rewards for '${quest.QuestName}'`);
        this.bronzemanMod.unlockItems(this.bronzemanMod.getPlayer(sessionID), items)

        return ret;
    }
}

module.exports = { mod: new Bronzeman() }
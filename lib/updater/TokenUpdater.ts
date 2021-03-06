import { Player, PlayerInfo, Ranks } from "hive-api"
import { PlayerInfoLeaderboardUpdater } from "./LeaderboardUpdater"
import { UpdateService } from "./UpdateService"
import { database } from "firebase-admin";

export class TokenUpdater extends PlayerInfoLeaderboardUpdater {
    static readonly BLOCKED_RANKS = [Ranks.VIP, Ranks.DEVELOPER, Ranks.OWNER, Ranks.STAFFMANAGER, Ranks.YOUTUBER, Ranks.STREAMER, Ranks.CONTRIBUTOR];
    get id() { return `leaderboard_tokens`; }

    constructor() {
        super(database().ref("tokenLeaderboard"), "tokens", 200);
    }

    update(info: PlayerInfo) {
        if (TokenUpdater.BLOCKED_RANKS.filter(rank => rank.name == info.rank.name).length == 0 && info.tokens < 100000000) {
            this._dataRef.child(info.uuid).update({
                tokens: info.tokens,
                name: info.name
            });
        } else {
            this._dataRef.child(info.uuid).remove();
        }
    }
}

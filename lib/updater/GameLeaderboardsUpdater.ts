/*
 * Download the Leaderboard Data and the data from 1 day, 3 days, 1 week, 1 month, 6 months, 1 year ago
 * 
 * compare the data and save pos and data changes in properties for each of these dates
 */

import { GameType, Leaderboard, LeaderboardPlace } from "hive-api";
import { database, firestore } from "firebase-admin";
import { compressToBase64 } from "lz-string";
import { CollectionReference, DocumentReference, QuerySnapshot } from "@google-cloud/firestore";
import { config } from '../main';
import { BasicUpdater, Updater } from "lergins-bot-framework";
import { nameUpdater } from "./NameUpdater";

export class GameLeaderboardUpdater extends BasicUpdater {
  private _dataRef: CollectionReference;
  private _ref: CollectionReference;

  constructor(private readonly gameType: GameType) {
    super();

    this._ref = firestore().collection("gameLeaderboards");
    this._dataRef = this._ref.doc(gameType.id).collection("data");
  }

  get configId() {
    return "leaderboard_gametypes";
  }

  get id() {
    return `leaderboard_gametype_${this.gameType.id}`;
  }
 
  private getRefForDatePage(dateOrUtcYear: Date, page: number): DocumentReference;
  private getRefForDatePage(dateOrUtcYear: number, utcMonth: number, utcDate: number, page: number): DocumentReference;
  private getRefForDatePage(dateOrUtcYear: Date | number, utcMonthOrPage: number, utcDate?: number, page?: number): DocumentReference {
    if (typeof dateOrUtcYear === 'number') {
      return this.getRefForDatePage(new Date(Date.UTC(dateOrUtcYear, utcMonthOrPage, utcDate)), page)      
    }else{
      return this._dataRef.doc(`${dateOrUtcYear.toISOString().substr(0, 10)}-${utcMonthOrPage}`) // ISO Date (without time) + page number
    }
  }

  private static removeUnimportantRawData(raw: any){
    delete raw.index;
    delete raw.humanIndex;
    delete raw.UUID;
    delete raw.username;

    // it only makes sense to save numeric values as other values can't change in a way that allowes to show a trend
    Object.entries(raw).filter(([key, val]) => typeof val !== 'number').forEach(([key]) => delete raw[key]);
    
    return raw;
  }

  async updateInfo() {
    try {
      const leaderboard = new Leaderboard(this.gameType);

      // we don't want the data from yesterday as that is already saved (should actually have no effect as the programm should be restarted every day)
      leaderboard.deleteCache();

      const leaderboardPlaces: Map<number, LeaderboardPlace> = await leaderboard.load(0, (await config().get('game_leaderboard_size') || 1000));

      const date = new Date();

      // convert data
      const convData: {uuid: string, name: string, player: number, [key: string]: any}[] = [... leaderboardPlaces.values()].map((place: LeaderboardPlace) => {
        let res: any = GameLeaderboardUpdater.removeUnimportantRawData(place.raw);

        res.uuid = place.player.uuid;
        res.name = place.player.name;
        res.place = place.place;

        return res;
      });

      // paginate data in pages of 100 entries to be able to load multiple places at once to not make to many requests 
      // to firestore while at the same time not requesting to much data
      GameLeaderboardUpdater.paginate(convData, 100)
        // save pages to firestore
        .forEach((page,index) => {
          this.getRefForDatePage(date.getFullYear(), date.getMonth(), date.getDate(), index).create({ a: Buffer.from(compressToBase64(JSON.stringify(page)), 'base64') }).catch(err => {
            if(err.code == 6) return;

            return err;
          });
        });

        convData.forEach(entry => {
          nameUpdater.update(entry.uuid, entry.name)
        })
    } catch (err) {
      Updater.sendError(err, `leaderboard/${this.gameType.id}`);
    }
  }

  /**
   * paginates the given array into an array of arrays that each contain at most an amount of pageSize elements
   * 
   * @param arr the array to paginate
   * @param pageSize amount of elements on each page
   */
  private static paginate<T>(arr: T[], pageSize: number): T[][] {
    return arr.reduce((paginated, data, index) => {
      // create a new array each time all the previously created arrays have the max size so the array is there to be filled
      if (index % pageSize === 0) {
        paginated.push([]);
      }

      // add the data to the current page
      paginated[Math.floor(index / pageSize)].push(data);

      return paginated;
    }, []);
  }
}
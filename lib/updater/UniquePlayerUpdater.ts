import { CountUpdater } from "./CountUpdater";
import { Server } from "hive-api";
import { database } from "firebase-admin";

export class UniquePlayerUpdater extends CountUpdater {
  private _currRef: database.Reference;

  static id = "players_unique";
  get id() { return UniquePlayerUpdater.id; }

  constructor() {
    super(database().ref("uniquePlayers"));

    this._currRef = database().ref("uniquePlayersCurr");
  }

  async updateInfo() {
    return Server.uniquePlayers(this.interval).then(amount => {
        this.sendNotification(amount);
        this._currRef.set(amount);
        return this._ref.child(new Date().getTime().toString()).set(amount);
      }
    );
  }
}
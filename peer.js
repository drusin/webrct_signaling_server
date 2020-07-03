export const HOST_ID = 1;

export default class Peer {
	constructor(webSocket, id) {
        this.webSocket = webSocket;
        this.alias = id.toString();
		this._id = id;
		this.isHost = false;
		this.lobbyId = undefined;
	}
	
	get id() {
		return this.isHost ? HOST_ID : this._id;
    }
}
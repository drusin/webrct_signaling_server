export default class Lobby {
	constructor({ id, game, host, maxPlayers, name, password = '' }) {
		this.id = id;
		this.game = game;
		this.host = host;
		this.maxPlayers = maxPlayers;
		this.name = name;
		this.password = password;
		this.players = new Map();
		this.players.set(host.id, host);
		this.sealed = false;
	}
	
	get hasPassword() {
		return this.password.length > 0;
    }
    
    get isFull() {
        return this.players.size >= this.maxPlayers
    }

    get playerCount() {
        return this.players.size;
    }

	add(peer) {
		this.players.add(peer);
	}

	remove(peer) {
		this.players.delete(peer);
	}

	seal() {
		this.sealed = true;
	}
}
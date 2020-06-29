import WebSocket from 'ws';
import crypto from 'crypto';
import Lobby from './lobby.js';
import Peer, { HOST_ID } from './peer.js';
import MESSAGES from './messages.js';

const PING_INTERVAL = 10000;
const PORT = process.env.PORT || 9081;

const server = new WebSocket.Server({ port: PORT });

/**
 * Exasmple message strucutre:
 * {
 * 	type: MESSAGES.JOIN,
 * 	id: 352114565,
 * 	payload: { lobbyId, game, name, password }
 * }
 */
function createMsg(type, payload) {
	console.log(JSON.stringify({ type, payload }));
	return JSON.stringify({ type, payload });
}

function randomId() {
	return Math.abs(new Int32Array(crypto.randomBytes(4).buffer)[0]);
}

const peers = new Map();
const lobbies = new Map();

server.on('connection', (webSocket) => {
	const peer = new Peer(webSocket, randomId());
	console.log(`A new client connected!: ${peer.id}`);

	peers.set(peer.id, peer);
	updateLobbyList();

	// webSocket.on('message', data => {
	// 	const message = JSON.parse(data)
	// 	switch (message.type) {
	// 		case MESSAGES.START_SERVER:
	// 			peers.delete(peer.id);
	// 			peer.isServer = true;
	// 			peers.set(peer.id, peer);
	// 			webSocket.send(createMsg(MESSAGES.ID, peer.id));
	// 			break;
	// 		case MESSAGES.JOIN_SERVER:
	// 			webSocket.send(createMsg(MESSAGES.ID, peer.id));
	// 			broadcastPeers();
	// 			break;
	// 		case MESSAGES.OFFER:
	// 			//fall through
	// 		case MESSAGES.ANSWER:
	// 			//fall through
	// 		case MESSAGES.CANDIDATE:
	// 			peers.get(message.id).webSocket.send(createMsg(message.type, peer.id, message.payload));
	// 			break;
	// 	}
	// });

		webSocket.on('message', data => {
		const message = JSON.parse(data)
		console.log(message);
		switch (message.type) {
			case MESSAGES.CREATE_LOBBY:
				createNewLobby(peer, message);
				break;
			case MESSAGES.JOIN_LOBBY:
				joinLobby(peer, message);
				break;
			case MESSAGES.SEAL_LOBBY:
				sealLobby(peer, message);
				break;
			case MESSAGES.DELETE_LOBBY:
				deleteLobby(peer);
				break;
			case MESSAGES.OFFER:
				//fall through
			case MESSAGES.ANSWER:
				//fall through
			case MESSAGES.CANDIDATE:
				peers.get(message.payload.id).webSocket.send(
					createMsg(message.type, Object.assign(message.payload, { id: peer.id })));
				break;
		}
	});

	webSocket.on('close', () => {
		console.log(`Client disconnected!: ${peer.id}`);
		deleteLobby(peer);
		peers.delete(peer.id);
	})
});

function createNewLobby(peer, message) {
	peer.isHost = true;
	const lobby = new Lobby({
		id: randomId(),
		game: message.payload.game,
		host: peer,
		maxPlayers: message.payload.maxPlayers,
		name: message.payload.name,
		password: message.payload.password
	});
	peer.lobby = lobby.id;
	lobbies.set(lobby.id, lobby);
	sendPeerId(peer);
	broadcastPeers(lobby);
	lobbyUpdate(lobby);
	updateLobbyList();
}

function sendPeerId(peer) {
	peer.webSocket.send(createMsg(MESSAGES.ID, { id: peer.id }));
}

function broadcastPeers(lobby) {
	for (let peer of lobby.players.values()) {
		for (let id of lobby.players.keys()) {
			if (peer.id !== id) {
				peer.webSocket.send(createMsg(MESSAGES.PEER, id));
				peer.webSocket.send(createMsg(MESSAGES.HOST_ID, HOST_ID))
			}
		}
	}
}

function lobbyUpdate(lobby) {
	Array.from(lobby.players.values()).forEach(player => 
		player.webSocket.send(createMsg(MESSAGES.LOBBY_UPDATE, createLobbyUpdatePayload(lobby)))
	);
}

/**
 * Example payload:
 * {
 * 	id: 8765292390,
 * 	name: 'Awesome Lobby!'
 * 	players: [ { alias: 'Horst', isHost: true } ]
 * }
 */
function createLobbyUpdatePayload(lobby) {
	const payload = {};
	payload.id = lobby.id;
	payload.name = lobby.name;
	payload.players = Array.from(lobby.players.values()).map(player => ({
		alias: player.alias,
		isHost: player.isHost,
		id: player.id
	}));
	return payload;
}

function updateLobbyList() {
	Array.from(peers.values()).forEach(peer => 
		peer.webSocket.send(createMsg(MESSAGES.LOBBY_LIST, createLobbyListPayload()))
	);
}

function createLobbyListPayload() {
	return Array.from(lobbies.values()).map(lobby => ({
			id: lobby.id,
			game: lobby.game,
			name: lobby.name,
			playerCount: lobby.playerCount,
			hasPassword: lobby.hasPassword,
			maxPlayers: lobby.maxPlayers
		}));
}

function joinLobby(peer, message) {
	console.log(peer);
	console.log(message);
}

function sealLobby(peer, message) {
	console.log(peer);
	console.log(message);
}

function deleteLobby(peer) {
	if (peer.lobby) {
		lobbies.delete(peer.lobby);
		updateLobbyList();
	}
}

setInterval(() => {
	server.clients.forEach(ws => ws.ping());
	console.log(server.clients.size);
}, PING_INTERVAL);
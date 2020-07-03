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

	webSocket.on('message', data => {
		const message = JSON.parse(data)
		console.log(message);
		switch (message.type) {
			case MESSAGES.CREATE_LOBBY:
				createNewLobby(peer, message);
				break;
			case MESSAGES.JOIN_LOBBY:
				joinLobby(peer, message.payload.id);
				break;
			case MESSAGES.LEAVE_LOBBY:
				leaveLobby(peer);
				break;
			case MESSAGES.SEAL_LOBBY:
				sealLobby(peer);
				break;
			case MESSAGES.DELETE_LOBBY:
				deleteLobby(peer);
				break;
			case MESSAGES.OFFER:
				//fall through
			case MESSAGES.ANSWER:
				//fall through
			case MESSAGES.CANDIDATE:
				const sendTo = message.payload.id === HOST_ID ? lobbies.get(peer.lobbyId).host : peers.get(message.payload.id)
				sendTo.webSocket.send(
					createMsg(message.type, Object.assign(message.payload, { id: peer.id })));
				break;
		}
	});

	webSocket.on('close', () => {
		deleteLobby(peer);
		peers.delete(peer.id);
		updateLobbyList()
		console.log(`Client disconnected!: ${peer.id}`);
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
	lobbies.set(lobby.id, lobby);
	joinLobby(peer, lobby.id);
}

function sendPeerId(peer) {
	peer.webSocket.send(createMsg(MESSAGES.ID, { id: peer.id }));
}

function broadcastPeers(lobby) {
	for (let peer of lobby.players.values()) {
		for (let id of lobby.players.keys()) {
			if (peer.id !== id) {
				peer.webSocket.send(createMsg(MESSAGES.PEER, { id: id}));
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
 * 	players: [ { alias: 'Horst', isHost: true, id: 12345 } ]
 * }
 */
function createLobbyUpdatePayload(lobby) {
	const payload = {};
	payload.id = lobby.id;
	payload.name = lobby.name;
	payload.hasPassword = lobby.hasPassword
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

function joinLobby(peer, lobbyId) {
	const lobby = lobbies.get(lobbyId);
	if (!lobby || lobby.isFull) {
		console.error('lobby is full');
		return;
	}
	peer.lobbyId = lobby.id;
	lobby.add(peer);
	sendPeerId(peer);
	broadcastPeers(lobby);
	lobbyUpdate(lobby);
	updateLobbyList();
}

function leaveLobby(peer) {
	const lobby = peer.lobbyId && lobbies.get(peer.lobbyId);
	if (lobby) {
		lobby.remove(peer);
		removePeerId(peer, lobby);
		lobbyUpdate(lobbies.get(peer.lobbyId));
		deleteLobby(peer);
		updateLobbyList();
	}
}

function removePeerId(peer, lobby) {
	lobby.players.forEach(player => 
		player.webSocket.send(createMsg(MESSAGES.REMOVE_PEER, { id: peer.id }))
	);
}

function sealLobby(peer) {
	console.log(peer);
}

function deleteLobby(peer) {
	const lobby = peer.lobbyId && lobbies.get(peer.lobbyId);
	if (lobby && peer === lobby.host) {
		lobby.players.forEach(player => 
			player.webSocket.send(createMsg(MESSAGES.DELETE_LOBBY, { id: lobby.id }))
		);
		lobbies.delete(peer.lobbyId);
		peer.lobbyId = undefined;
		peer.isHost = false;
		updateLobbyList();
	}
}

setInterval(() => {
	server.clients.forEach(ws => ws.ping());
	console.log(server.clients.size);
}, PING_INTERVAL);
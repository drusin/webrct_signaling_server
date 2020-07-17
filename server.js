import WebSocket from 'ws';
import crypto from 'crypto';
import Lobby from './lobby.js';
import Peer, { HOST_ID } from './peer.js';
import MESSAGES from './messages.js';

const PING_INTERVAL = 10000;
const PORT = process.env.PORT || 9081;

const server = new WebSocket.Server({ port: PORT });

/**
 * Example message strucutre:
 * {
 * 	type: MESSAGES.JOIN,
 * 	id: 352114565,
 * 	payload: { lobbyId, game, name, password }
 * }
 */
function createMsg(type, payload) {
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

	webSocket.on('message', data => dealWithMessage(peer, JSON.parse(data)));

	webSocket.on('close', () => {
		deleteLobby(peer);
		peers.delete(peer.id);
		updateLobbyList()
		console.log(`Client disconnected!: ${peer.id}`);
	})
});

function dealWithMessage(peer, message) {
	console.log(message);
	switch (message.type) {
		case MESSAGES.SET_ALIAS:
			setAlias(peer, message.payload.alias);
			break;
		case MESSAGES.SET_GAME:
			peer.game = message.payload.game;
			updateLobbyList();
			break;
		case MESSAGES.SET_PLAYER_DATA:
			peer.data = message.payload.data;
			break;
		case MESSAGES.CREATE_LOBBY:
			createNewLobby(peer, message.payload);
			break;
		case MESSAGES.EDIT_LOBBY:
			editLobby(peer, message.payload);
			break;
		case MESSAGES.JOIN_LOBBY:
			joinLobby(peer, message.payload);
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
}

function setAlias(peer, alias) {
	peer.alias = alias;
	if (peer.lobbyId) {
		lobbyUpdate(lobbies.get(peer.lobbyId));
	}
}

function createNewLobby(peer, payload) {
	peer.isHost = true;
	const lobby = new Lobby({
		id: randomId(),
		game: payload.game,
		host: peer,
		maxPlayers: payload.maxPlayers,
		name: payload.name,
		password: payload.password,
		data: payload.data
	});
	lobbies.set(lobby.id, lobby);
	joinLobby(peer, { id: lobby.id, password: lobby.password });
}

function editLobby(peer, payload) {
	const lobby = lobbies.get(payload.id);
	if (!lobby || lobby.host !== peer) {
		console.log('You are not the host!');
	}
	lobby.name = payload.name;
	lobby.password = payload.password;
	lobby.maxPlayers = payload.maxPlayers;
	lobby.data = payload.data;
	lobbyUpdate(lobby);
}

function sendPeerId(peer) {
	peer.webSocket.send(createMsg(MESSAGES.ID, { id: peer.id }));
}

function broadcastPeers(lobby) {
	for (const peer of lobby.players.values()) {
		for (const id of lobby.players.keys()) {
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
 * 	name: 'Awesome Lobby!',
 *  maxPlayers: 4,
 *  hasPassword: false,
 * 	players: [ { alias: 'Horst', isHost: true, id: 12345 } ]
 * }
 */
function createLobbyUpdatePayload(lobby) {
	const payload = {};
	payload.id = lobby.id;
	payload.name = lobby.name;
	payload.hasPassword = lobby.hasPassword;
	payload.maxPlayers = lobby.maxPlayers;
	payload.players = Array.from(lobby.players.values()).map(player => ({
		alias: player.alias,
		isHost: player.isHost,
		id: player.id,
		data: player.data
	}));
	return payload;
}

function updateLobbyList() {
	Array.from(peers.values()).forEach(peer => 
		peer.webSocket.send(createMsg(MESSAGES.LOBBY_LIST, createLobbyListPayload(peer.game)))
	);
}

function createLobbyListPayload(game) {
	return Array.from(lobbies.values())
		.filter(lobby => lobby.game === game)
		.map(lobby => ({
				id: lobby.id,
				game: lobby.game,
				name: lobby.name,
				playerCount: lobby.playerCount,
				hasPassword: lobby.hasPassword,
				maxPlayers: lobby.maxPlayers
			}));
}

function joinLobby(peer, payload) {
	const lobby = lobbies.get(payload.id);
	if (!lobby || lobby.isFull) {
		console.error('lobby is full');
		return;
	}
	if (lobby.password != payload.password) {
		console.error('Wrong password!');
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
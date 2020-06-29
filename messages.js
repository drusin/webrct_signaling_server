const MESSAGES = {
	// identification
	ID: 'ID',
	PEER: 'PEER',
	REMOVE_PEER: 'REMOVE_PEER',
	// webrtc handshake
	OFFER: 'OFFER',
	ANSWER: 'ANSWER',
	CANDIDATE: 'CANDIDATE',
	// lobby related
	CREATE_LOBBY: 'CREATE_LOBBY',
	SEAL_LOBBY: 'SEAL_LOBBY',
    JOIN_LOBBY: 'JOIN_LOBBY',
    DELETE_LOBBY: 'DELETE_LOBBYS',
    LOBBY_UPDATE: 'LOBBY_UPDATE',
	LOBBY_LIST: 'LOBBY_LIST',
	HOST_ID: 'HOST_ID',
	// old, still needed?
	START_SERVER: 'START_SERVER',
	JOIN_SERVER: 'JOIN_SERVER',
	SERVER_ID: 'SERVER_ID',
};

Object.freeze(MESSAGES);

export default MESSAGES;
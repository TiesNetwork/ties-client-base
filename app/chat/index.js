// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const config = require('../../config');
const SimpleSignalClient = require('simple-signal-client');
const _ = require('lodash');

const c_peer_opts = {
    config: {
        iceServers: [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'turn:hosting.krawlly.com', username: 'tiesuser', credential: '9a349aflang8w3'}
        ]
    }
};

/**
 * Usage:
 *      const Chat = require('@ties-network/ties-client-base').Chat;
 *
 * 		let callbacks = {
 * 	        connectPeer: address => console.log(`${address} is online`),
 * 	        disconnectPeer: address => console.log(`${address} is offline`),
 *			message: (from, msg) => {
 *        		document.querySelector('#outgoing').insertAdjacentHTML('beforeEnd', from + ': ' + msg + '\n');
 *			}
 *		}
 *	    let contacts = ['0xabcde', '0x12345', ... ]; //Active contacts or past conversations
 *      let chat = new Chat(nick, callbacks, contacts);
 *
 *      chat.sendMessage(address_to, text);
 *
 *      //on changing user:
 *      chat.destroy(); //Disconnect all peers
 *
 */
class Chat{
    constructor(address, callbacks, contacts) {
        this.address = address;
        this.peers = [];
        this.pendingMessages = {};
        this.contacts = contacts || [];
        this.callbacks = _.assign({
            connectPeer: address => console.log('peer connected: ' + address),
            disconnectPeer: address => console.log('peer disconnected: ' + address),
            message: (from, message) => console.log('message received from ' + address + ': ' + message),
        }, callbacks || {});

        this.initChat();
    }

    addPengingMessage(to, msg){
        let msgs = this.pendingMessages[to];
        if(!msgs)
            msgs = this.pendingMessages[to] = [];
        msgs.push(msg);
    }

    traceSocket(socket){
        socket.on('error', evt => console.log('socket error', evt));
        socket.on('connecting', evt => console.log('socket connecting', evt));
        socket.on('connect', evt => console.log('socket connected', evt));
        socket.on('disconnect', evt => console.log('socket disconnected', evt));
        socket.on('connect_failed', evt => console.log('socket connect_failed', evt));
        socket.on('reconnect', evt => console.log('socket reconnected', evt));
        socket.on('reconnecting', evt => console.log('socket reconnecting', evt));
        socket.on('reconnect_failed', evt => console.log('socket reconnect_failed', evt));

        socket.on('simple-signal[error]', e => console.log('socket signal error', e));
    }

    sendMessage(to, msg){
        let peers = this.peers[to];
        if(!peers || !peers.length){
            if(msg) this.addPengingMessage(to, msg);
            this.signalClient.connect(to, c_peer_opts, {address: this.address});
        }else if(msg){
            peers.forEach(peer => peer.send(msg));
        }
    }

    initChat() {
        let socket = require('socket.io-client')(config.chat.host);
        this.traceSocket(socket);

        const metadata = {address: this.address};
        let signalClient = new SimpleSignalClient(socket, metadata);
        this.signalClient = signalClient;
        const self = this;

        signalClient.on('ready', function () {
            //Connect to all contacts
            self.contacts.forEach(address => {
                self.signalClient.connect(address, c_peer_opts, {address: self.address});
            });
        });

        signalClient.on('request', function (request) {
            request.accept(c_peer_opts, {address: self.address}) // Accept a request to connect
        });

        signalClient.on('peer', function (peer) {
            // Use as you would any SimplePeer object
            peer.on('connect', function () {
                self._addPeer(peer);
                let messages = self.pendingMessages[peer.metadata.address];
                if(messages && messages.length){
                    messages.forEach(msg => {
                        peer.send(msg);
                    });
                }
            });

            peer.on('error', err => console.log('peer error', err));

            peer.on('data', data => {
                self.callbacks.message(peer.metadata.address, data);
            });

            peer.on('close', () => {
                self._removePeer(peer);
            });
        });
    }

    _addPeer(peer){
        let address = peer.metadata.address;
        let peers = this.peers[address];
        if(!peers) peers = this.peers[address] = [];

        peers.push(peer);
        if(peers.length == 1) //Alert only first time
            this.callbacks.connectPeer(address);
    }

    _removePeer(peer){
        let address = peer.metadata.address;
        let peers = this.peers[address];
        _.pull(peers, peer);
        if(peers.length == 0){
            delete(this.peers[address]);
            //Callback only when all peers from this address are offline
            this.callbacks.disconnectPeer(address);
        }
    }

    addContact(address){
        if(this.contacts.indexOf(address) < 0) {
            this.contacts.push(address);
            this.signalClient.connect(address, c_peer_opts, {address: this.address});
        }
    }

    removeContact(address){
        if(this.contacts.indexOf(address) >= 0) {
            _.pull(this.contacts, address);
            let peer = this.peers.find(peer => peer.metadata.address == address);
            if(peer)
                peer.destroy();
        }
    }

    destroy() {
        this.peers.forEach(peer => peer.destroy());
        this.signalClient.socket.close();
    }

    isConnectedTo(address){
        let peer = this.peers.find(peer => peer.metadata.address == address);
        return !!peer;
    }
}

module.exports = Chat;
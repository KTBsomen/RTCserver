const { Peer } = require('peerjs');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const WebRTC = require('wrtc');
const FileReader = require('filereader');
const polyfills = { fetch, WebSocket, WebRTC, FileReader };
const mongoplusplus = require('mongoplusplus');
const admin = require('firebase-admin');

const initializeApp = (serviceAccountPath) => {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
};

// Example usage:
// const serviceAccountPath = './path/to/serviceAccountKey.json';
// initializeApp(serviceAccountPath);

/**
 * @class RTCclient
 * @description A class for establishing and managing WebRTC connections.
 */
class RTCclient {
  static connectionsList = {}
  static server=false;
  static appinitialized = false;
  static errorFCMTokens=[]

  /**
   * @constructor
   * @param {Object} options - The options for the RTCclient instance.
   * @param {string} [options.id] - The ID of the client.
   * @param {Object} [options.metadata] - The metadata associated with the client.
   * @param {string} [options.fcm] - The Firebase Cloud Messaging token of the client.
   * @param {string} [options.serviceAccountPath] - The path to the Firebase service account key file. 
   * @param {Object} [options.config] - config for peerjs configuration like iceServers setup. 
   * @throws {Error} If neither id nor fcm is provided, or if id is provided without metadata, or if fcm is provided without serviceAccountPath.
   */
  constructor({ id, metadata, fcm, serviceAccountPath, config = false }) {
    try {
      if (!id && !fcm) {
        throw new Error("Either id or fcm must be present");
      }

      if (id && !metadata) {
        throw new Error("If id is present, metadata must also be present");
      }

      if (fcm && !serviceAccountPath) {
        throw new Error("If fcm is present, serviceAccountPath must also be present");
      }

      this.id = id;
      this.fcm = fcm || false;
      this.metadata = metadata;
      this.serviceAccountPath = serviceAccountPath;
      this.config = config;
      


      if (RTCclient.appinitialized == false && fcm && serviceAccountPath) {
        initializeApp(serviceAccountPath);
        RTCclient.appinitialized = true;
      }

      if (!RTCclient.server) {
        RTCclient.server = new Peer("server123ukbgfeuvgftyusgt54676w65", {
          polyfills, debug: 3,
          config: this.config || {
            'iceServers': [
              {
                urls: "stun:stun.relay.metered.ca:80",
              },
              {
                urls: "turn:standard.relay.metered.ca:80",
                username: "8dcde2b8c068f9149618f9ff",
                credential: "KEaKo3xt53t59AiN",
              },
              {
                urls: "turn:standard.relay.metered.ca:80?transport=tcp",
                username: "8dcde2b8c068f9149618f9ff",
                credential: "KEaKo3xt53t59AiN",
              },
              {
                urls: "turn:standard.relay.metered.ca:443",
                username: "8dcde2b8c068f9149618f9ff",
                credential: "KEaKo3xt53t59AiN",
              },
              {
                urls: "turns:standard.relay.metered.ca:443?transport=tcp",
                username: "8dcde2b8c068f9149618f9ff",
                credential: "KEaKo3xt53t59AiN",
              },
            ],
          }
        });
      }

      this.peer = RTCclient.server;

      this.connection = RTCclient.connectionsList[this.id] || null;
      this.connectPromise = this.setupConnection
    } catch (error) {
      console.error("Error in constructor:", error);
    }
  }

  /**
   * @method setupConnection
   * @description Sets up the WebRTC connection.
   * @returns {Promise} A Promise that resolves when the connection is established or rejected if an error occurs.
   */
  setupConnection() {
   
    return new Promise((resolve, reject) => {
      try {
        this.peer.on("open", () => {
          RTCclient.server = this.peer;
        })

        this.peer.on("error", (e) => {
          console.log("serverError", e.type)
          try {
            if (e.type == 'network'||e.type=='disconnected') {
              this.peer.reconnect()
            } else if (e.type == "peer-unavailable") {
              reject({ type: "peer-unavailable", message: "peer not available yet try again." });
            }else{
              reject({ type: "server error", message: "peer server not available yet try again." });

            }
          } catch (error) {
            console.error("Error in peer.on('error'):", error);
          }
        })

        console.log('Server: peer id ', this.id);

        if (this.connection == null) {
          const conn = this.peer.connect(this.id, { serialization: "raw", metadata: this.metadata });
          conn.on("error", (r) => {
            console.log("Error", r);
          });

          conn.on('open', () => {
            this.connection = conn;
            RTCclient.connectionsList[this.id] = conn;
            console.log('Client: connection open');
            resolve();
          });

          conn.on('close', () => {
            this.connection = null;
            delete RTCclient.connectionsList[this.id];
            console.log('Client: connection closed');
            resolve();
          });
        } else {
          console.log('Client: existing connection is reused');
          resolve();
        }
      } catch (error) {
        console.error("Error in setupConnection:", error);
        reject(error);
      }
    });
  }


  async _sendRTC(message) {
    try {
      await this.connectPromise();
    } catch (error) {
      console.error("Connection Promise Rejected", error);
    } // Wait for the connection to be established
    try {
      if (RTCclient.connectionsList[this.id]) {
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }
        return RTCclient.connectionsList[this.id].send(message);
      } else {
        throw new Error("No remote connection established.");
      }
    } catch (error) {
      console.error("Error in _sendRTC:", error);
      throw error;
    }
  }
  /**
   * @method sendResponse
   * @description Sends a message to the remote peer.
   * @param {Object|string} message - The message to be sent.
   * @returns {Promise} A Promise that resolves when the message is sent or rejected if an error occurs.
   * @throws {Error} If no remote connection is established.
   */
  async sendResponse(message) {
    console.log("this.fcm", this.fcm)
    try {
      if (this.fcm && RTCclient.errorFCMTokens.includes(this.fcm)==false) {

        const payload = {
          data: {
            title: 'New Message',
            body: message,
          },
          token: this.fcm,
        }
        try {
          const response = await admin.messaging().send(payload)
          return response;
        } catch (error) {
          RTCclient.errorFCMTokens.push(this.fcm)
          console.error("Error at fcm:", error);
          console.log("Error at fcm so entering peer")
          try {
            return await this._sendRTC(message)
          } catch (error) {
            console.error("Error in _sendRTC:", error);
            throw new Error("ServerError.");
          }
        }
      } else {
        console.log("No fcm so using peer")
        try {
          return await this._sendRTC(message)
        } catch (error) {
          console.error("Error in _sendRTC:", error);
          throw new Error("ServerError.");
        }
      }
    } catch (error) {
      console.error("Error in sendResponse:", error);
      throw error;
    }
  }
}

/**
 * @class _initDB_
 * @description A class for initializing and managing the MongoDB database connection.
 */
class _initDB_ {
  /**
   * @constructor
   * @param {string[]} [urls=["mongodb+srv://pxxxxxxxxc:xxxxxxx@cluster0.8e37j.mongodb.net/pushtest"]] - The MongoDB connection URLs.
   */
  constructor(urls = ["mongodb+srv://pxxxxxxxxc:xxxxxx@cluster0.8e37j.mongodb.net/pushtest"]) {
    const mongodb = new mongoplusplus(urls);
    this.mongodb = mongodb;
    (async () => {
      await mongodb.connectToAll();
    })();

    const likeSH = mongodb.Schema({
      user_id: { type: String, required: true, unique: true },
      fcm: { type: String },
      dbIndex: { type: Number, required: true },
      peerid: { type: String, required: true, unique: true }
    });

    this.likes = mongodb.buildModel("pushidentifiers", likeSH)
  }

  /**
   * @method get
   * @description Retrieves user data from the database.
   * @param {string} user_id - The ID of the user.
   * @returns {Promise<Object>} A user data object.
   */
  async getFcm(user_id) {
    const like = await this.likes.findInAllDatabase({
      user_id,
    })
    return like.results[0].fcm;
  }
  async getPeerId(user_id) {
    const like = await this.likes.findInAllDatabase({
      user_id,
    })
    return like.results[0].peerid;
  }
  async _get(user_id) {
    const like = await this.likes.findInAllDatabase({
      user_id,
    })
    return like.results;
  }

  /**
   * @method add
   * @description Adds or updates user data in the database.
   * @param {Object} options - The options for adding or updating user data.
   * @param {string} options.user_id - The ID of the user.
   * @param {string} [options.peerid] - The peer ID of the user.
   * @param {string} [options.fcm] - The Firebase Cloud Messaging token of the user.
   * @returns {Promise<Object[]>} An array of updated or newly created user data objects.
   * @throws {Error} If neither peerid nor fcm is provided, or if only fcm is provided without peerid.
   */
  async add({ user_id, peerid, fcm }) {
    // Get existing user data
    const existingData = await this._get(user_id);

    try {
      if (existingData.length) {
        // If user data exists, update the data
        let updatedData;

        // Check which fields need to be updated
        if (peerid && fcm) {
          console.log("peerid and fcm", peerid, fcm)
          // Update both peerid and fcm
          updatedData = await this.likes.UpdateOneInAllDatabase({ user_id: user_id }, { peerid: peerid, fcm: fcm });
        } else if (peerid) {
          // Update only peerid
          updatedData = await this.likes.UpdateOneInAllDatabase({ user_id: user_id }, { peerid: peerid });
          console.log("peerid is ", peerid)
        } else if (fcm) {
          // Update only fcm
          console.log(" fcm", fcm)
          updatedData = await this.likes.UpdateOneInAllDatabase({ user_id: user_id }, { fcm: fcm });
        }

        return updatedData.results.filter(result => result !== null);
      } else {
        // If user data doesn't exist, create new data
        let newData;

        if (peerid && fcm) {
          // Create new data with both peerid and fcm
          newData = await this.likes.write({ user_id, peerid, fcm });
        } else if (peerid) {
          // Create new data with only peerid
          newData = await this.likes.write({ user_id, peerid });
        } else if (fcm) {
          // Create new data with only fcm
          throw new Error('peerid must be provided,only fcm will not work.');
        } else {
          // Throw an error if neither peerid nor fcm is provided
          throw new Error('Either peerid or fcm must be provided');
        }

        return newData;
      }
    } catch (error) {
      if (error.code == 11000) {
        const dupKey = /dup key: { (.*?) }/.exec(error.message)[1];
        throw new Error(`Duplicate key: ${dupKey}.`);
      }
      console.log(error.code)
      throw error
    }
  }
}

module.exports = { RTCclient, _initDB_ }

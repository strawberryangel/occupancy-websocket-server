"use strict";
const notification_packager_1 = require("../lib/notification-bus/notification-packager");
const debug = require('debug')('app:commandProcessor');
class CommandProcessor {
    constructor(connection, db, notificationBus) {
        this.connection = connection;
        this.db = db;
        this.notificationBus = notificationBus;
        this.notificationBusHandler = (data) => {
            if (data.agent || data.room || data.occupant)
                this.send(data);
        };
        this.closeWebSocketHandler = () => {
            debug("WebSocket connection closed.");
            this.subscription.unsubscribe();
        };
        this.errorWebSocketHandler = (error) => {
            debug("WebSocket connection error: ", error);
        };
        this.messageWebSocketHandler = (message) => {
            let receivedJson;
            try {
                receivedJson = JSON.parse(message);
            }
            catch (e) {
                debug("Failed to parse JSON from WebSocket: ", e.message);
                return;
            }
            if (!receivedJson.command) {
                debug("JSON from WebSocket does not have the required `command` attribute.");
                return;
            }
            this.processCommand(receivedJson);
        };
        this.error = (error) => this.send(this.pack.error(error));
        this.getAgent = (uuid) => {
            this.db.agents.findOne({ uuid: uuid }, (error, agent) => {
                if (error) {
                    this.error(error);
                    return;
                }
                if (agent)
                    this.send(this.pack.agent(agent));
            });
        };
        this.getOccupants = () => {
            this.db.occupants.find({}).each((error, occupant) => {
                if (error) {
                    this.error(error);
                    return;
                }
                if (occupant)
                    this.send(this.pack.occupant(occupant));
            });
        };
        this.getRooms = () => {
            this.db.rooms.find({}).each((error, room) => {
                if (error) {
                    this.error(error);
                    return;
                }
                if (room)
                    this.send(this.pack.room(room));
            });
        };
        this.send = (json) => {
            try {
                this.connection.send(JSON.stringify(json));
            }
            catch (e) {
                debug("Failed to send data to client: ", e.message);
                try {
                    this.connection.send(JSON.stringify({ error: "message" }));
                }
                catch (e) {
                    debug("Failed to send follow-up error message to client: ", e.message);
                }
            }
        };
        this.pack = new notification_packager_1.NotificationPackager();
        this.subscription = this.notificationBus.observable.subscribe(this.notificationBusHandler);
    }
    processCommand(json) {
        let command = json.command;
        if (command === "rooms")
            this.getRooms();
        else if (command === "occupants")
            this.getOccupants();
        else if (command === "agent")
            this.getAgent(json.uuid);
        else
            this.error(`Occupancy WebSocket server doesn't recognize the command "${command}"`);
    }
}
exports.CommandProcessor = CommandProcessor;
//# sourceMappingURL=command-processor.js.map
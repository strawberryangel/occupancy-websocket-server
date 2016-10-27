import {NotificationBusClient} from "../lib/notification-bus/notification-bus-client"
import {CommonDatabaseConnection} from "../lib/common-database-connection"
import {NotificationPackager} from "../lib/notification-bus/notification-packager"

const debug = require('debug')('app:commandProcessor')

export class CommandProcessor {
    private subscription: any
    private pack: NotificationPackager

    constructor(public connection: any,
                private db: CommonDatabaseConnection,
                private notificationBus: NotificationBusClient) {
        this.pack = new NotificationPackager()
        this.subscription = this.notificationBus.observable.subscribe(this.notificationBusHandler)
    }

    private notificationBusHandler = (data) => {
        if (data.agent || data.room || data.occupant)
            this.send(data)
    }

    public closeWebSocketHandler = () => {
        debug("WebSocket connection closed.")
        this.subscription.unsubscribe()
    }

    public errorWebSocketHandler = (error) => {
        debug("WebSocket connection error: ", error)
    }

    public messageWebSocketHandler = (message) => {
        let receivedJson: any
        try {
            receivedJson = JSON.parse(message)
        } catch (e) {
            debug("Failed to parse JSON from WebSocket: ", e.message)
            return
        }

        if (!receivedJson.command) {
            debug("JSON from WebSocket does not have the required `command` attribute.")
            return
        }

        this.processCommand(receivedJson)
    }

    private error = (error) => this.send(this.pack.error(error))

    private getAgent = (uuid: string) => {
        this.db.agents.findOne({uuid: uuid}, (error, agent) => {
            if (error) {
                this.error(error)
                return
            }

            if (agent)
                this.send(this.pack.agent(agent))
        })
    }

    private getOccupants = () => {
        this.db.occupants.find({}).each((error, occupant) => {
            if (error) {
                this.error(error)
                return
            }

            if (occupant)
                this.send(this.pack.occupant(occupant))
        })
    }


    private getRooms = () => {
        this.db.rooms.find({}).each((error, room) => {
            if (error) {
                this.error(error)
                return
            }

            if (room)
                this.send(this.pack.room(room))
        })
    }

    private processCommand(json: any) {
        let command: string = json.command

        if (command === "rooms")
            this.getRooms()

        else if (command === "occupants")
            this.getOccupants()

        else if (command === "agent")
            this.getAgent(json.uuid)

        else
            this.error(`Occupancy WebSocket server doesn't recognize the command "${command}"`)
    }

    public send = (json: any) => {
        try {
            this.connection.send(JSON.stringify(json))
        }
        catch (e) {
            debug("Failed to send data to client: ", e.message)
            try {
                this.connection.send(JSON.stringify({error: "message"}))
            } catch (e) {
                debug("Failed to send follow-up error message to client: ", e.message)
            }
        }
    }
}

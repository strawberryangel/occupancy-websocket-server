/// <reference path="../typings/node.d.ts" />

import {CommandProcessor} from "./command-processor"
import {database} from '../common/db'
import {NotificationBusClient} from "../lib/notification-bus/notification-bus-client"

const debug = require('debug')('app:main')
const nconf = require('nconf')
const WS = require('ws')

////////////////////////////////////////////////////////////////////////////////
//
// Configuration
//
////////////////////////////////////////////////////////////////////////////////

nconf.argv().env().defaults({
    'port': 2999,
    'database': 'mongodb://localhost/sl'
})

const port = nconf.get('port')
const databaseUri = nconf.get('database')

debug('port: ' + port)
debug('database URI: ' + databaseUri)

////////////////////////////////////////////////////////////////////////////////
//
// Set up WebSocket server.
//
////////////////////////////////////////////////////////////////////////////////

const notificationBus = new NotificationBusClient()

database.uri = databaseUri
database.connect()
    .then(() => {
        debug('Connected to the database at ' + databaseUri)

        let server = new WS.Server({port: port})

        server.on("connection", (connection) => {
            const commandProcessor = new CommandProcessor(connection, database, notificationBus)
            debug("Connection received.")

            // Trap the commandProcessor instance in the following closures:

            connection.on("close", () => commandProcessor.closeWebSocketHandler())

            connection.on("error", (error) => commandProcessor.errorWebSocketHandler(error))

            connection.on("message", (message) => {
                debug("Message" + message)
                commandProcessor.messageWebSocketHandler(message)
            })
        })

        server.on("error", (error) => debug("Connection error event: ", error))
    })
    .catch((error) => debug("Failed to connect to the database at " + databaseUri, error))



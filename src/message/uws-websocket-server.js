'use strict'

const C = require('../constants/constants')
const messageParser = require('./message-parser')
const messageBuilder = require('./message-builder')
const SocketWrapper = require('./uws-socket-wrapper')
const events = require('events')
const http = require('http')
const https = require('https')
const uws = require('uws')

const OPEN = 'OPEN'

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 *
 * @constructor
 *
 * @extends events.EventEmitter
 *
 * @param {Object} options the extended default options
 * @param {Function} readyCallback will be invoked once both the ws is ready
 */
module.exports = class UWSWebsocketServer extends events.EventEmitter {
  constructor (options, readyCallback) {
    super()
    this._options = options
    this._readyCallback = readyCallback

    this._wsReady = false
    this._wsServerClosed = false

    this._server = this._createHttpServer()
    this._server.listen(this._options.port, this._options.host)
    this._server.on('request', this._handleHealthCheck.bind(this))
    this._options.logger.log(
      C.LOG_LEVEL.INFO,
      C.EVENT.INFO,
      `Listening for health checks on path ${options.healthCheckPath}`
    )

    this._ws = uws.native.server.group.create(
      0,
      options.maxPayload === undefined ? 1048576 : options.maxPayload
    )
    native.server.group.startAutoPing(
      this._ws, 
      options.heartbeatInterval, 
      messageBuilder.getMsg(C.TOPIC.CONNECTION, C.ACTIONS.PING)
    )

    this._server.once('listening', this._checkReady.bind(this))
    this._ws.on('error', this._onError.bind(this))
    this._ws.on('connection', this._onConnection.bind(this))
  }

  /**
   * Returns the number of currently connected clients. This is used by the
   * cluster module to determine loadbalancing endpoints
   *
   * @public
   * @returns {Number} connectionCount
   */
  getConnectionCount () {
    return this._authenticatedSocketsCounter
  }

  /**
   * Closes the ws server connection. The ConnectionEndpoint
   * will emit a close event once succesfully shut down
   * @public
   * @returns {void}
   */
  close () {
    this._server.removeAllListeners('request')
    this._server.removeAllListener('upgrade');
    this._ws.removeAllListeners('connection')

    this._server.close(() => {
      this._wsServerClosed = true
      this._checkClosed()
    })

    native.server.group.close(this._ws)
  }

  /**
   * Callback for 'connection' event. Receives
   * a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user and
  * subscribes to authentication messages.
   * @param {Websocket} socket
   *
   * @private
   * @returns {void}
   */
  _onConnection (socket) {
    const socketWrapper = new SocketWrapper(socket, this._options)
    const handshakeData = socketWrapper.getHandshakeData()
    const logMsg = `from ${handshakeData.referer} (${handshakeData.remoteAddress})`
    let disconnectTimer

    this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.INCOMING_CONNECTION, logMsg)

    if (this._options.unauthenticatedClientTimeout !== null) {
      disconnectTimer = setTimeout(
        this._processConnectionTimeout.bind(this, socketWrapper),
        this._options.unauthenticatedClientTimeout
      )
      socketWrapper.once('close', clearTimeout.bind(null, disconnectTimer))
    }

    socketWrapper.connectionCallback = this._processConnectionMessage.bind(this, socketWrapper)
    socketWrapper.authCallBack = this._authenticateConnection.bind(
      this,
      socketWrapper,
      disconnectTimer
    )
    socketWrapper.sendMessage(C.TOPIC.CONNECTION, C.ACTIONS.CHALLENGE)
    socket.on('message', socketWrapper.connectionCallback)
  }

  /**
   * Creates an HTTP or HTTPS server for ws to attach itself to,
   * depending on the options the client configured
   *
   * @private
   * @returns {http.HttpServer | http.HttpsServer}
   */
  _createHttpServer () {
    let server
    if (this._isHttpsServer()) {
      const httpsOptions = {
        key: this._options.sslKey,
        cert: this._options.sslCert
      }

      if (this._options.sslCa) {
        httpsOptions.ca = this._options.sslCa
      }

      server = https.createServer(httpsOptions)
    }

    server = http.createServer()

    if (this._options.urlPath[0] !== '/') {
      this._options.urlPath = '/' + this._options.urlPath;
    }

    this.httpServer.on('upgrade', this._upgradeListener = ((request, socket, head) => {
      if (!options.urlPath || options.urlPath == request.url.split('?')[0].split('#')[0]) {
        this.handleUpgrade(request, socket, head, emitConnection);
      } else {
        socket.end('HTTP/1.1 400 URL not supported\r\n\r\n')
      }
    }))

    this.httpServer.on('newListener', (eventName, listener) => {
        if (eventName === 'upgrade') {
            this._lastUpgradeListener = false;
        }
    })
  }


  /**
   * Responds to http health checks.
   * Responds with 200(OK) if deepstream is alive.
   *
   * @private
   * @returns {void}
   */
  _handleHealthCheck (req, res) {
    if (req.method === 'GET' && req.url === this._options.healthCheckPath) {
      res.writeHead(200)
      res.end()
    }
  }

  /**
   * Called whenever either the server itself or one of its sockets
   * is closed. Once everything is closed it will emit a close event
   *
   * @private
   * @returns {void}
   */
  _checkClosed () {
    if (this._wsServerClosed === false) {
      return
    }

    this.emit('close')
  }

  /**
   * Called for the ready event of the ws server.
   *
   * @private
   * @returns {void}
   */
  _checkReady () {
    const address = this._server.address()
    const msg = `Listening for websocket connections on ${address.address}:${address.port}${this._options.urlPath}`
    this._wsReady = true

    this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, msg)
    this._readyCallback()
  }

  /**
  * Returns whether or not sslKey and sslCert have been set to start a https server.
  *
  * @throws Will throw an error if only sslKey or sslCert have been specified
  *
  * @private
  * @returns {boolean}
  */
  _isHttpsServer () {
    let isHttps = false
    if (this._options.sslKey || this._options.sslCert) {
      if (!this._options.sslKey) {
        throw new Error('Must also include sslKey in order to use HTTPS')
      }
      if (!this._options.sslCert) {
        throw new Error('Must also include sslCert in order to use HTTPS')
      }
      isHttps = true
    }
    return isHttps
  }
}

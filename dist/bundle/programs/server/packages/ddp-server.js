Package["core-runtime"].queue("ddp-server", ["meteor", "check", "random", "ejson", "underscore", "retry", "mongo-id", "diff-sequence", "ecmascript", "ddp-common", "ddp-client", "webapp", "routepolicy", "callback-hook", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, id, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function module(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/stream_server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// By default, we use the permessage-deflate extension with default
// configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid
// JSON. If it represents a falsey value, then we do not use permessage-deflate
// at all; otherwise, the JSON value is used as an argument to deflate's
// configure method; see
// https://github.com/faye/permessage-deflate-node/blob/master/README.md
//
// (We do this in an _.once instead of at startup, because we don't want to
// crash the tool during isopacket load if your JSON doesn't parse. This is only
// a problem because the tool has to load the DDP server code just in order to
// be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)
var websocketExtensions = _.once(function () {
  var extensions = [];
  var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
  if (websocketCompressionConfig) {
    extensions.push(Npm.require('permessage-deflate').configure(websocketCompressionConfig));
  }
  return extensions;
});
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";
StreamServer = function () {
  var self = this;
  self.registration_callbacks = [];
  self.open_sockets = [];

  // Because we are installing directly onto WebApp.httpServer instead of using
  // WebApp.app, we have to process the path prefix ourselves.
  self.prefix = pathPrefix + '/sockjs';
  RoutePolicy.declare(self.prefix + '/', 'network');

  // set up sockjs
  var sockjs = Npm.require('sockjs');
  var serverOptions = {
    prefix: self.prefix,
    log: function () {},
    // this is the default, but we code it explicitly because we depend
    // on it in stream_client:HEARTBEAT_TIMEOUT
    heartbeat_delay: 45000,
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU
    // bound for that much time, SockJS might not notice that the user has
    // reconnected because the timer (of disconnect_delay ms) can fire before
    // SockJS processes the new connection. Eventually we'll fix this by not
    // combining CPU-heavy processing with SockJS termination (eg a proxy which
    // converts to Unix sockets) but for now, raise the delay.
    disconnect_delay: 60 * 1000,
    // Set the USE_JSESSIONID environment variable to enable setting the
    // JSESSIONID cookie. This is useful for setting up proxies with
    // session affinity.
    jsessionid: !!process.env.USE_JSESSIONID
  };

  // If you know your server environment (eg, proxies) will prevent websockets
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,
  // browsers) will not waste time attempting to use them.
  // (Your server will still have a /websocket endpoint.)
  if (process.env.DISABLE_WEBSOCKETS) {
    serverOptions.websocket = false;
  } else {
    serverOptions.faye_server_options = {
      extensions: websocketExtensions()
    };
  }
  self.server = sockjs.createServer(serverOptions);

  // Install the sockjs handlers, but we want to keep around our own particular
  // request handler that adjusts idle timeouts while we have an outstanding
  // request.  This compensates for the fact that sockjs removes all listeners
  // for "request" to add its own.
  WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);
  self.server.installHandlers(WebApp.httpServer);
  WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);

  // Support the /websocket endpoint
  self._redirectWebsocketEndpoint();
  self.server.on('connection', function (socket) {
    // sockjs sometimes passes us null instead of a socket object
    // so we need to guard against that. see:
    // https://github.com/sockjs/sockjs-node/issues/121
    // https://github.com/meteor/meteor/issues/10468
    if (!socket) return;

    // We want to make sure that if a client connects to us and does the initial
    // Websocket handshake but never gets to the DDP handshake, that we
    // eventually kill the socket.  Once the DDP handshake happens, DDP
    // heartbeating will work. And before the Websocket handshake, the timeouts
    // we set at the server level in webapp_server.js will work. But
    // faye-websocket calls setTimeout(0) on any socket it takes over, so there
    // is an "in between" state where this doesn't happen.  We work around this
    // by explicitly setting the socket timeout to a relatively large time here,
    // and setting it back to zero when we set up the heartbeat in
    // livedata_server.js.
    socket.setWebsocketTimeout = function (timeout) {
      if ((socket.protocol === 'websocket' || socket.protocol === 'websocket-raw') && socket._session.recv) {
        socket._session.recv.connection.setTimeout(timeout);
      }
    };
    socket.setWebsocketTimeout(45 * 1000);
    socket.send = function (data) {
      socket.write(data);
    };
    socket.on('close', function () {
      self.open_sockets = _.without(self.open_sockets, socket);
    });
    self.open_sockets.push(socket);

    // only to send a message after connection on tests, useful for
    // socket-stream-client/server-tests.js
    if (process.env.TEST_METADATA && process.env.TEST_METADATA !== "{}") {
      socket.send(JSON.stringify({
        testMessageOnConnect: true
      }));
    }

    // call all our callbacks when we get a new socket. they will do the
    // work of setting up handlers and such for specific messages.
    _.each(self.registration_callbacks, function (callback) {
      callback(socket);
    });
  });
};
Object.assign(StreamServer.prototype, {
  // call my callback when a new socket connects.
  // also call it for all current connections.
  register: function (callback) {
    var self = this;
    self.registration_callbacks.push(callback);
    _.each(self.all_sockets(), function (socket) {
      callback(socket);
    });
  },
  // get a list of all sockets
  all_sockets: function () {
    var self = this;
    return _.values(self.open_sockets);
  },
  // Redirect /websocket to /sockjs/websocket in order to not expose
  // sockjs to clients that want to use raw websockets
  _redirectWebsocketEndpoint: function () {
    var self = this;
    // Unfortunately we can't use a connect middleware here since
    // sockjs installs itself prior to all existing listeners
    // (meaning prior to any connect middlewares) so we need to take
    // an approach similar to overshadowListeners in
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee
    ['request', 'upgrade'].forEach(event => {
      var httpServer = WebApp.httpServer;
      var oldHttpServerListeners = httpServer.listeners(event).slice(0);
      httpServer.removeAllListeners(event);

      // request and upgrade have different arguments passed but
      // we only care about the first one which is always request
      var newListener = function (request /*, moreArguments */) {
        // Store arguments for use within the closure below
        var args = arguments;

        // TODO replace with url package
        var url = Npm.require('url');

        // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while
        // preserving query string.
        var parsedUrl = url.parse(request.url);
        if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
          parsedUrl.pathname = self.prefix + '/websocket';
          request.url = url.format(parsedUrl);
        }
        _.each(oldHttpServerListeners, function (oldListener) {
          oldListener.apply(httpServer, args);
        });
      };
      httpServer.addListener(event, newListener);
    });
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/livedata_server.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    DDPServer = {};

    // Publication strategies define how we handle data from published cursors at the collection level
    // This allows someone to:
    // - Choose a trade-off between client-server bandwidth and server memory usage
    // - Implement special (non-mongo) collections like volatile message queues
    const publicationStrategies = {
      // SERVER_MERGE is the default strategy.
      // When using this strategy, the server maintains a copy of all data a connection is subscribed to.
      // This allows us to only send deltas over multiple publications.
      SERVER_MERGE: {
        useCollectionView: true,
        doAccountingForCollection: true
      },
      // The NO_MERGE_NO_HISTORY strategy results in the server sending all publication data
      // directly to the client. It does not remember what it has previously sent
      // to it will not trigger removed messages when a subscription is stopped.
      // This should only be chosen for special use cases like send-and-forget queues.
      NO_MERGE_NO_HISTORY: {
        useCollectionView: false,
        doAccountingForCollection: false
      },
      // NO_MERGE is similar to NO_MERGE_NO_HISTORY but the server will remember the IDs it has
      // sent to the client so it can remove them when a subscription is stopped.
      // This strategy can be used when a collection is only used in a single publication.
      NO_MERGE: {
        useCollectionView: false,
        doAccountingForCollection: true
      }
    };
    DDPServer.publicationStrategies = publicationStrategies;

    // This file contains classes:
    // * Session - The server's connection to a single DDP client
    // * Subscription - A single subscription for a single client
    // * Server - An entire server that may talk to > 1 client. A DDP endpoint.
    //
    // Session and Subscription are file scope. For now, until we freeze
    // the interface, Server is package scope (in the future it should be
    // exported).

    // Represents a single document in a SessionCollectionView
    var SessionDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };

    DDPServer._SessionDocumentView = SessionDocumentView;
    DDPServer._getCurrentFence = function () {
      let currentInvocation = this._CurrentWriteFence.get();
      if (currentInvocation) {
        return currentInvocation;
      }
      currentInvocation = DDP._CurrentMethodInvocation.get();
      return currentInvocation ? currentInvocation.fence : undefined;
    };
    _.extend(SessionDocumentView.prototype, {
      getFields: function () {
        var self = this;
        var ret = {};
        self.dataByKey.forEach(function (precedenceList, key) {
          ret[key] = precedenceList[0].value;
        });
        return ret;
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;
        var precedenceList = self.dataByKey.get(key);

        // It's okay to clear fields that didn't exist. No need to throw
        // an error.
        if (!precedenceList) return;
        var removedValue = undefined;
        for (var i = 0; i < precedenceList.length; i++) {
          var precedence = precedenceList[i];
          if (precedence.subscriptionHandle === subscriptionHandle) {
            // The view's value can only change if this subscription is the one that
            // used to have precedence.
            if (i === 0) removedValue = precedence.value;
            precedenceList.splice(i, 1);
            break;
          }
        }
        if (precedenceList.length === 0) {
          self.dataByKey.delete(key);
          changeCollector[key] = undefined;
        } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
          changeCollector[key] = precedenceList[0].value;
        }
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;

        // Don't share state with the data passed in by the user.
        value = EJSON.clone(value);
        if (!self.dataByKey.has(key)) {
          self.dataByKey.set(key, [{
            subscriptionHandle: subscriptionHandle,
            value: value
          }]);
          changeCollector[key] = value;
          return;
        }
        var precedenceList = self.dataByKey.get(key);
        var elt;
        if (!isAdd) {
          elt = precedenceList.find(function (precedence) {
            return precedence.subscriptionHandle === subscriptionHandle;
          });
        }
        if (elt) {
          if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
            // this subscription is changing the value of this field.
            changeCollector[key] = value;
          }
          elt.value = value;
        } else {
          // this subscription is newly caring about this field
          precedenceList.push({
            subscriptionHandle: subscriptionHandle,
            value: value
          });
        }
      }
    });

    /**
     * Represents a client's view of a single collection
     * @param {String} collectionName Name of the collection it represents
     * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed
     * @class SessionCollectionView
     */
    var SessionCollectionView = function (collectionName, sessionCallbacks) {
      var self = this;
      self.collectionName = collectionName;
      self.documents = new Map();
      self.callbacks = sessionCallbacks;
    };
    DDPServer._SessionCollectionView = SessionCollectionView;
    Object.assign(SessionCollectionView.prototype, {
      isEmpty: function () {
        var self = this;
        return self.documents.size === 0;
      },
      diff: function (previous) {
        var self = this;
        DiffSequence.diffMaps(previous.documents, self.documents, {
          both: _.bind(self.diffDocument, self),
          rightOnly: function (id, nowDV) {
            self.callbacks.added(self.collectionName, id, nowDV.getFields());
          },
          leftOnly: function (id, prevDV) {
            self.callbacks.removed(self.collectionName, id);
          }
        });
      },
      diffDocument: function (id, prevDV, nowDV) {
        var self = this;
        var fields = {};
        DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {
          both: function (key, prev, now) {
            if (!EJSON.equals(prev, now)) fields[key] = now;
          },
          rightOnly: function (key, now) {
            fields[key] = now;
          },
          leftOnly: function (key, prev) {
            fields[key] = undefined;
          }
        });
        self.callbacks.changed(self.collectionName, id, fields);
      },
      added: function (subscriptionHandle, id, fields) {
        var self = this;
        var docView = self.documents.get(id);
        var added = false;
        if (!docView) {
          added = true;
          docView = new SessionDocumentView();
          self.documents.set(id, docView);
        }
        docView.existsIn.add(subscriptionHandle);
        var changeCollector = {};
        _.each(fields, function (value, key) {
          docView.changeField(subscriptionHandle, key, value, changeCollector, true);
        });
        if (added) self.callbacks.added(self.collectionName, id, changeCollector);else self.callbacks.changed(self.collectionName, id, changeCollector);
      },
      changed: function (subscriptionHandle, id, changed) {
        var self = this;
        var changedResult = {};
        var docView = self.documents.get(id);
        if (!docView) throw new Error("Could not find element with id " + id + " to change");
        _.each(changed, function (value, key) {
          if (value === undefined) docView.clearField(subscriptionHandle, key, changedResult);else docView.changeField(subscriptionHandle, key, value, changedResult);
        });
        self.callbacks.changed(self.collectionName, id, changedResult);
      },
      removed: function (subscriptionHandle, id) {
        var self = this;
        var docView = self.documents.get(id);
        if (!docView) {
          var err = new Error("Removed nonexistent document " + id);
          throw err;
        }
        docView.existsIn.delete(subscriptionHandle);
        if (docView.existsIn.size === 0) {
          // it is gone from everyone
          self.callbacks.removed(self.collectionName, id);
          self.documents.delete(id);
        } else {
          var changed = {};
          // remove this subscription from every precedence list
          // and record the changes
          docView.dataByKey.forEach(function (precedenceList, key) {
            docView.clearField(subscriptionHandle, key, changed);
          });
          self.callbacks.changed(self.collectionName, id, changed);
        }
      }
    });

    /******************************************************************************/
    /* Session                                                                    */
    /******************************************************************************/

    var Session = function (server, version, socket, options) {
      var self = this;
      self.id = Random.id();
      self.server = server;
      self.version = version;
      self.initialized = false;
      self.socket = socket;

      // Set to null when the session is destroyed. Multiple places below
      // use this to determine if the session is alive or not.
      self.inQueue = new Meteor._DoubleEndedQueue();
      self.blocked = false;
      self.workerRunning = false;
      self.cachedUnblock = null;

      // Sub objects for active subscriptions
      self._namedSubs = new Map();
      self._universalSubs = [];
      self.userId = null;
      self.collectionViews = new Map();

      // Set this to false to not send messages when collectionViews are
      // modified. This is done when rerunning subs in _setUserId and those messages
      // are calculated via a diff instead.
      self._isSending = true;

      // If this is true, don't start a newly-created universal publisher on this
      // session. The session will take care of starting it when appropriate.
      self._dontStartNewUniversalSubs = false;

      // When we are rerunning subscriptions, any ready messages
      // we want to buffer up for when we are done rerunning subscriptions
      self._pendingReady = [];

      // List of callbacks to call when this connection is closed.
      self._closeCallbacks = [];

      // XXX HACK: If a sockjs connection, save off the URL. This is
      // temporary and will go away in the near future.
      self._socketUrl = socket.url;

      // Allow tests to disable responding to pings.
      self._respondToPings = options.respondToPings;

      // This object is the public interface to the session. In the public
      // API, it is called the `connection` object.  Internally we call it
      // a `connectionHandle` to avoid ambiguity.
      self.connectionHandle = {
        id: self.id,
        close: function () {
          self.close();
        },
        onClose: function (fn) {
          var cb = Meteor.bindEnvironment(fn, "connection onClose callback");
          if (self.inQueue) {
            self._closeCallbacks.push(cb);
          } else {
            // if we're already closed, call the callback.
            Meteor.defer(cb);
          }
        },
        clientAddress: self._clientAddress(),
        httpHeaders: self.socket.headers
      };
      self.send({
        msg: 'connected',
        session: self.id
      });

      // On initial connect, spin up all the universal publishers.
      self.startUniversalSubs();
      if (version !== 'pre1' && options.heartbeatInterval !== 0) {
        // We no longer need the low level timeout because we have heartbeats.
        socket.setWebsocketTimeout(0);
        self.heartbeat = new DDPCommon.Heartbeat({
          heartbeatInterval: options.heartbeatInterval,
          heartbeatTimeout: options.heartbeatTimeout,
          onTimeout: function () {
            self.close();
          },
          sendPing: function () {
            self.send({
              msg: 'ping'
            });
          }
        });
        self.heartbeat.start();
      }
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", 1);
    };
    Object.assign(Session.prototype, {
      _checkPublishPromiseBeforeSend(f) {
        if (!this._publishCursorPromise) {
          f();
          return;
        }
        this._publishCursorPromise.finally(() => f());
      },
      sendReady: function (subscriptionIds) {
        var self = this;
        if (self._isSending) {
          self.send({
            msg: "ready",
            subs: subscriptionIds
          });
        } else {
          _.each(subscriptionIds, function (subscriptionId) {
            self._pendingReady.push(subscriptionId);
          });
        }
      },
      _canSend(collectionName) {
        return this._isSending || !this.server.getPublicationStrategy(collectionName).useCollectionView;
      },
      sendAdded(collectionName, id, fields) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: 'added',
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendChanged(collectionName, id, fields) {
        if (_.isEmpty(fields)) return;
        if (this._canSend(collectionName)) {
          this.send({
            msg: "changed",
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendRemoved(collectionName, id) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: "removed",
            collection: collectionName,
            id
          });
        }
      },
      getSendCallbacks: function () {
        var self = this;
        return {
          added: _.bind(self.sendAdded, self),
          changed: _.bind(self.sendChanged, self),
          removed: _.bind(self.sendRemoved, self)
        };
      },
      getCollectionView: function (collectionName) {
        var self = this;
        var ret = self.collectionViews.get(collectionName);
        if (!ret) {
          ret = new SessionCollectionView(collectionName, self.getSendCallbacks());
          self.collectionViews.set(collectionName, ret);
        }
        return ret;
      },
      added(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.added(subscriptionHandle, id, fields);
        } else {
          this.sendAdded(collectionName, id, fields);
        }
      },
      removed(subscriptionHandle, collectionName, id) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.removed(subscriptionHandle, id);
          if (view.isEmpty()) {
            this.collectionViews.delete(collectionName);
          }
        } else {
          this.sendRemoved(collectionName, id);
        }
      },
      changed(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.changed(subscriptionHandle, id, fields);
        } else {
          this.sendChanged(collectionName, id, fields);
        }
      },
      startUniversalSubs: function () {
        var self = this;
        // Make a shallow copy of the set of universal handlers and start them. If
        // additional universal publishers start while we're running them (due to
        // yielding), they will run separately as part of Server.publish.
        var handlers = _.clone(self.server.universal_publish_handlers);
        _.each(handlers, function (handler) {
          self._startSubscription(handler);
        });
      },
      // Destroy this session and unregister it at the server.
      close: function () {
        var self = this;

        // Destroy this session, even if it's not registered at the
        // server. Stop all processing and tear everything down. If a socket
        // was attached, close it.

        // Already destroyed.
        if (!self.inQueue) return;

        // Drop the merge box data immediately.
        self.inQueue = null;
        self.collectionViews = new Map();
        if (self.heartbeat) {
          self.heartbeat.stop();
          self.heartbeat = null;
        }
        if (self.socket) {
          self.socket.close();
          self.socket._meteorSession = null;
        }
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", -1);
        Meteor.defer(function () {
          // Stop callbacks can yield, so we defer this on close.
          // sub._isDeactivated() detects that we set inQueue to null and
          // treats it as semi-deactivated (it will ignore incoming callbacks, etc).
          self._deactivateAllSubscriptions();

          // Defer calling the close callbacks, so that the caller closing
          // the session isn't waiting for all the callbacks to complete.
          _.each(self._closeCallbacks, function (callback) {
            callback();
          });
        });

        // Unregister the session.
        self.server._removeSession(self);
      },
      // Send a message (doing nothing if no socket is connected right now).
      // It should be a JSON object (it will be stringified).
      send: function (msg) {
        const self = this;
        this._checkPublishPromiseBeforeSend(() => {
          if (self.socket) {
            if (Meteor._printSentDDP) Meteor._debug('Sent DDP', DDPCommon.stringifyDDP(msg));
            self.socket.send(DDPCommon.stringifyDDP(msg));
          }
        });
      },
      // Send a connection error.
      sendError: function (reason, offendingMessage) {
        var self = this;
        var msg = {
          msg: 'error',
          reason: reason
        };
        if (offendingMessage) msg.offendingMessage = offendingMessage;
        self.send(msg);
      },
      // Process 'msg' as an incoming message. As a guard against
      // race conditions during reconnection, ignore the message if
      // 'socket' is not the currently connected socket.
      //
      // We run the messages from the client one at a time, in the order
      // given by the client. The message handler is passed an idempotent
      // function 'unblock' which it may call to allow other messages to
      // begin running in parallel in another fiber (for example, a method
      // that wants to yield). Otherwise, it is automatically unblocked
      // when it returns.
      //
      // Actually, we don't have to 'totally order' the messages in this
      // way, but it's the easiest thing that's correct. (unsub needs to
      // be ordered against sub, methods need to be ordered against each
      // other).
      processMessage: function (msg_in) {
        var self = this;
        if (!self.inQueue)
          // we have been destroyed.
          return;

        // Respond to ping and pong messages immediately without queuing.
        // If the negotiated DDP version is "pre1" which didn't support
        // pings, preserve the "pre1" behavior of responding with a "bad
        // request" for the unknown messages.
        //
        // Fibers are needed because heartbeats use Meteor.setTimeout, which
        // needs a Fiber. We could actually use regular setTimeout and avoid
        // these new fibers, but it is easier to just make everything use
        // Meteor.setTimeout and not think too hard.
        //
        // Any message counts as receiving a pong, as it demonstrates that
        // the client is still alive.
        if (self.heartbeat) {
          self.heartbeat.messageReceived();
        }
        ;
        if (self.version !== 'pre1' && msg_in.msg === 'ping') {
          if (self._respondToPings) self.send({
            msg: "pong",
            id: msg_in.id
          });
          return;
        }
        if (self.version !== 'pre1' && msg_in.msg === 'pong') {
          // Since everything is a pong, there is nothing to do
          return;
        }
        self.inQueue.push(msg_in);
        if (self.workerRunning) return;
        self.workerRunning = true;
        var processNext = function () {
          var msg = self.inQueue && self.inQueue.shift();
          if (!msg) {
            self.workerRunning = false;
            return;
          }
          function runHandlers() {
            var blocked = true;
            var unblock = function () {
              if (!blocked) return; // idempotent
              blocked = false;
              processNext();
            };
            self.server.onMessageHook.each(function (callback) {
              callback(msg, self);
              return true;
            });
            if (_.has(self.protocol_handlers, msg.msg)) {
              const result = self.protocol_handlers[msg.msg].call(self, msg, unblock);
              if (Meteor._isPromise(result)) {
                result.finally(() => unblock());
              } else {
                unblock();
              }
            } else {
              self.sendError('Bad request', msg);
              unblock(); // in case the handler didn't already do it
            }
          }

          runHandlers();
        };
        processNext();
      },
      protocol_handlers: {
        sub: function (msg, unblock) {
          var self = this;

          // cacheUnblock temporarly, so we can capture it later
          // we will use unblock in current eventLoop, so this is safe
          self.cachedUnblock = unblock;

          // reject malformed messages
          if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
            self.sendError("Malformed subscription", msg);
            return;
          }
          if (!self.server.publish_handlers[msg.name]) {
            self.send({
              msg: 'nosub',
              id: msg.id,
              error: new Meteor.Error(404, "Subscription '".concat(msg.name, "' not found"))
            });
            return;
          }
          if (self._namedSubs.has(msg.id))
            // subs are idempotent, or rather, they are ignored if a sub
            // with that id already exists. this is important during
            // reconnect.
            return;

          // XXX It'd be much better if we had generic hooks where any package can
          // hook into subscription handling, but in the mean while we special case
          // ddp-rate-limiter package. This is also done for weak requirements to
          // add the ddp-rate-limiter package in case we don't have Accounts. A
          // user trying to use the ddp-rate-limiter must explicitly require it.
          if (Package['ddp-rate-limiter']) {
            var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
            var rateLimiterInput = {
              userId: self.userId,
              clientAddress: self.connectionHandle.clientAddress,
              type: "subscription",
              name: msg.name,
              connectionId: self.id
            };
            DDPRateLimiter._increment(rateLimiterInput);
            var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
            if (!rateLimitResult.allowed) {
              self.send({
                msg: 'nosub',
                id: msg.id,
                error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                })
              });
              return;
            }
          }
          var handler = self.server.publish_handlers[msg.name];
          self._startSubscription(handler, msg.id, msg.params, msg.name);

          // cleaning cached unblock
          self.cachedUnblock = null;
        },
        unsub: function (msg) {
          var self = this;
          self._stopSubscription(msg.id);
        },
        method: async function (msg, unblock) {
          var self = this;

          // Reject malformed messages.
          // For now, we silently ignore unknown attributes,
          // for forwards compatibility.
          if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
            self.sendError("Malformed method invocation", msg);
            return;
          }
          var randomSeed = msg.randomSeed || null;

          // Set up to mark the method as satisfied once all observers
          // (and subscriptions) have reacted to any writes that were
          // done.
          var fence = new DDPServer._WriteFence();
          fence.onAllCommitted(function () {
            // Retire the fence so that future writes are allowed.
            // This means that callbacks like timers are free to use
            // the fence, and if they fire before it's armed (for
            // example, because the method waits for them) their
            // writes will be included in the fence.
            fence.retire();
            self.send({
              msg: 'updated',
              methods: [msg.id]
            });
          });

          // Find the handler
          var handler = self.server.method_handlers[msg.method];
          if (!handler) {
            self.send({
              msg: 'result',
              id: msg.id,
              error: new Meteor.Error(404, "Method '".concat(msg.method, "' not found"))
            });
            await fence.arm();
            return;
          }
          var setUserId = function (userId) {
            self._setUserId(userId);
          };
          var invocation = new DDPCommon.MethodInvocation({
            isSimulation: false,
            userId: self.userId,
            setUserId: setUserId,
            unblock: unblock,
            connection: self.connectionHandle,
            randomSeed: randomSeed,
            fence
          });
          const promise = new Promise((resolve, reject) => {
            // XXX It'd be better if we could hook into method handlers better but
            // for now, we need to check if the ddp-rate-limiter exists since we
            // have a weak requirement for the ddp-rate-limiter package to be added
            // to our application.
            if (Package['ddp-rate-limiter']) {
              var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
              var rateLimiterInput = {
                userId: self.userId,
                clientAddress: self.connectionHandle.clientAddress,
                type: "method",
                name: msg.method,
                connectionId: self.id
              };
              DDPRateLimiter._increment(rateLimiterInput);
              var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
              if (!rateLimitResult.allowed) {
                reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                }));
                return;
              }
            }
            const getCurrentMethodInvocationResult = () => DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'"), {
              name: 'getCurrentMethodInvocationResult',
              keyName: 'getCurrentMethodInvocationResult'
            });
            resolve(DDPServer._CurrentWriteFence.withValue(fence, getCurrentMethodInvocationResult, {
              name: 'DDPServer._CurrentWriteFence',
              keyName: '_CurrentWriteFence'
            }));
          });
          async function finish() {
            await fence.arm();
            unblock();
          }
          const payload = {
            msg: "result",
            id: msg.id
          };
          return promise.then(async result => {
            await finish();
            if (result !== undefined) {
              payload.result = result;
            }
            self.send(payload);
          }, async exception => {
            await finish();
            payload.error = wrapInternalException(exception, "while invoking method '".concat(msg.method, "'"));
            self.send(payload);
          });
        }
      },
      _eachSub: function (f) {
        var self = this;
        self._namedSubs.forEach(f);
        self._universalSubs.forEach(f);
      },
      _diffCollectionViews: function (beforeCVs) {
        var self = this;
        DiffSequence.diffMaps(beforeCVs, self.collectionViews, {
          both: function (collectionName, leftValue, rightValue) {
            rightValue.diff(leftValue);
          },
          rightOnly: function (collectionName, rightValue) {
            rightValue.documents.forEach(function (docView, id) {
              self.sendAdded(collectionName, id, docView.getFields());
            });
          },
          leftOnly: function (collectionName, leftValue) {
            leftValue.documents.forEach(function (doc, id) {
              self.sendRemoved(collectionName, id);
            });
          }
        });
      },
      // Sets the current user id in all appropriate contexts and reruns
      // all subscriptions
      _setUserId: function (userId) {
        var self = this;
        if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + typeof userId);

        // Prevent newly-created universal subscriptions from being added to our
        // session. They will be found below when we call startUniversalSubs.
        //
        // (We don't have to worry about named subscriptions, because we only add
        // them when we process a 'sub' message. We are currently processing a
        // 'method' message, and the method did not unblock, because it is illegal
        // to call setUserId after unblock. Thus we cannot be concurrently adding a
        // new named subscription).
        self._dontStartNewUniversalSubs = true;

        // Prevent current subs from updating our collectionViews and call their
        // stop callbacks. This may yield.
        self._eachSub(function (sub) {
          sub._deactivate();
        });

        // All subs should now be deactivated. Stop sending messages to the client,
        // save the state of the published collections, reset to an empty view, and
        // update the userId.
        self._isSending = false;
        var beforeCVs = self.collectionViews;
        self.collectionViews = new Map();
        self.userId = userId;

        // _setUserId is normally called from a Meteor method with
        // DDP._CurrentMethodInvocation set. But DDP._CurrentMethodInvocation is not
        // expected to be set inside a publish function, so we temporary unset it.
        // Inside a publish function DDP._CurrentPublicationInvocation is set.
        DDP._CurrentMethodInvocation.withValue(undefined, function () {
          // Save the old named subs, and reset to having no subscriptions.
          var oldNamedSubs = self._namedSubs;
          self._namedSubs = new Map();
          self._universalSubs = [];
          oldNamedSubs.forEach(function (sub, subscriptionId) {
            var newSub = sub._recreate();
            self._namedSubs.set(subscriptionId, newSub);
            // nb: if the handler throws or calls this.error(), it will in fact
            // immediately send its 'nosub'. This is OK, though.
            newSub._runHandler();
          });

          // Allow newly-created universal subs to be started on our connection in
          // parallel with the ones we're spinning up here, and spin up universal
          // subs.
          self._dontStartNewUniversalSubs = false;
          self.startUniversalSubs();
        }, {
          name: '_setUserId'
        });

        // Start sending messages again, beginning with the diff from the previous
        // state of the world to the current state. No yields are allowed during
        // this diff, so that other changes cannot interleave.
        Meteor._noYieldsAllowed(function () {
          self._isSending = true;
          self._diffCollectionViews(beforeCVs);
          if (!_.isEmpty(self._pendingReady)) {
            self.sendReady(self._pendingReady);
            self._pendingReady = [];
          }
        });
      },
      _startSubscription: function (handler, subId, params, name) {
        var self = this;
        var sub = new Subscription(self, handler, subId, params, name);
        let unblockHander = self.cachedUnblock;
        // _startSubscription may call from a lot places
        // so cachedUnblock might be null in somecases
        // assign the cachedUnblock
        sub.unblock = unblockHander || (() => {});
        if (subId) self._namedSubs.set(subId, sub);else self._universalSubs.push(sub);
        sub._runHandler();
      },
      // Tear down specified subscription
      _stopSubscription: function (subId, error) {
        var self = this;
        var subName = null;
        if (subId) {
          var maybeSub = self._namedSubs.get(subId);
          if (maybeSub) {
            subName = maybeSub._name;
            maybeSub._removeAllDocuments();
            maybeSub._deactivate();
            self._namedSubs.delete(subId);
          }
        }
        var response = {
          msg: 'nosub',
          id: subId
        };
        if (error) {
          response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
        }
        self.send(response);
      },
      // Tear down all subscriptions. Note that this does NOT send removed or nosub
      // messages, since we assume the client is gone.
      _deactivateAllSubscriptions: function () {
        var self = this;
        self._namedSubs.forEach(function (sub, id) {
          sub._deactivate();
        });
        self._namedSubs = new Map();
        self._universalSubs.forEach(function (sub) {
          sub._deactivate();
        });
        self._universalSubs = [];
      },
      // Determine the remote client's IP address, based on the
      // HTTP_FORWARDED_COUNT environment variable representing how many
      // proxies the server is behind.
      _clientAddress: function () {
        var self = this;

        // For the reported client address for a connection to be correct,
        // the developer must set the HTTP_FORWARDED_COUNT environment
        // variable to an integer representing the number of hops they
        // expect in the `x-forwarded-for` header. E.g., set to "1" if the
        // server is behind one proxy.
        //
        // This could be computed once at startup instead of every time.
        var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;
        if (httpForwardedCount === 0) return self.socket.remoteAddress;
        var forwardedFor = self.socket.headers["x-forwarded-for"];
        if (!_.isString(forwardedFor)) return null;
        forwardedFor = forwardedFor.trim().split(/\s*,\s*/);

        // Typically the first value in the `x-forwarded-for` header is
        // the original IP address of the client connecting to the first
        // proxy.  However, the end user can easily spoof the header, in
        // which case the first value(s) will be the fake IP address from
        // the user pretending to be a proxy reporting the original IP
        // address value.  By counting HTTP_FORWARDED_COUNT back from the
        // end of the list, we ensure that we get the IP address being
        // reported by *our* first proxy.

        if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length) return null;
        return forwardedFor[forwardedFor.length - httpForwardedCount];
      }
    });

    /******************************************************************************/
    /* Subscription                                                               */
    /******************************************************************************/

    // Ctor for a sub handle: the input to each publish function

    // Instance name is this because it's usually referred to as this inside a
    // publish
    /**
     * @summary The server's side of a subscription
     * @class Subscription
     * @instanceName this
     * @showInstanceName true
     */
    var Subscription = function (session, handler, subscriptionId, params, name) {
      var self = this;
      self._session = session; // type is Session

      /**
       * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
       * @locus Server
       * @name  connection
       * @memberOf Subscription
       * @instance
       */
      self.connection = session.connectionHandle; // public API object

      self._handler = handler;

      // My subscription ID (generated by client, undefined for universal subs).
      self._subscriptionId = subscriptionId;
      // Undefined for universal subs
      self._name = name;
      self._params = params || [];

      // Only named subscriptions have IDs, but we need some sort of string
      // internally to keep track of all subscriptions inside
      // SessionDocumentViews. We use this subscriptionHandle for that.
      if (self._subscriptionId) {
        self._subscriptionHandle = 'N' + self._subscriptionId;
      } else {
        self._subscriptionHandle = 'U' + Random.id();
      }

      // Has _deactivate been called?
      self._deactivated = false;

      // Stop callbacks to g/c this sub.  called w/ zero arguments.
      self._stopCallbacks = [];

      // The set of (collection, documentid) that this subscription has
      // an opinion about.
      self._documents = new Map();

      // Remember if we are ready.
      self._ready = false;

      // Part of the public API: the user of this sub.

      /**
       * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.
       * @locus Server
       * @memberOf Subscription
       * @name  userId
       * @instance
       */
      self.userId = session.userId;

      // For now, the id filter is going to default to
      // the to/from DDP methods on MongoID, to
      // specifically deal with mongo/minimongo ObjectIds.

      // Later, you will be able to make this be "raw"
      // if you want to publish a collection that you know
      // just has strings for keys and no funny business, to
      // a DDP consumer that isn't minimongo.

      self._idFilter = {
        idStringify: MongoID.idStringify,
        idParse: MongoID.idParse
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", 1);
    };
    Object.assign(Subscription.prototype, {
      _runHandler: function () {
        // XXX should we unblock() here? Either before running the publish
        // function, or before running _publishCursor.
        //
        // Right now, each publish function blocks all future publishes and
        // methods waiting on data from Mongo (or whatever else the function
        // blocks on). This probably slows page load in common cases.

        if (!this.unblock) {
          this.unblock = () => {};
        }
        const self = this;
        let resultOrThenable = null;
        try {
          resultOrThenable = DDP._CurrentPublicationInvocation.withValue(self, () => maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),
          // It's OK that this would look weird for universal subscriptions,
          // because they have no arguments so there can never be an
          // audit-argument-checks failure.
          "publisher '" + self._name + "'"), {
            name: self._name
          });
        } catch (e) {
          self.error(e);
          return;
        }

        // Did the handler call this.error or this.stop?
        if (self._isDeactivated()) return;

        // Both conventional and async publish handler functions are supported.
        // If an object is returned with a then() function, it is either a promise
        // or thenable and will be resolved asynchronously.
        const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
        if (isThenable) {
          Promise.resolve(resultOrThenable).then(function () {
            return self._publishHandlerResult.bind(self)(...arguments);
          }, e => self.error(e));
        } else {
          self._publishHandlerResult(resultOrThenable);
        }
      },
      _publishHandlerResult: function (res) {
        // SPECIAL CASE: Instead of writing their own callbacks that invoke
        // this.added/changed/ready/etc, the user can just return a collection
        // cursor or array of cursors from the publish function; we call their
        // _publishCursor method which starts observing the cursor and publishes the
        // results. Note that _publishCursor does NOT call ready().
        //
        // XXX This uses an undocumented interface which only the Mongo cursor
        // interface publishes. Should we make this interface public and encourage
        // users to implement it themselves? Arguably, it's unnecessary; users can
        // already write their own functions like
        //   var publishMyReactiveThingy = function (name, handler) {
        //     Meteor.publish(name, function () {
        //       var reactiveThingy = handler();
        //       reactiveThingy.publishMe();
        //     });
        //   };

        var self = this;
        var isCursor = function (c) {
          return c && c._publishCursor;
        };
        if (isCursor(res)) {
          this._publishCursorPromise = res._publishCursor(self).then(() => {
            // _publishCursor only returns after the initial added callbacks have run.
            // mark subscription as ready.
            self.ready();
          }).catch(e => self.error(e));
        } else if (_.isArray(res)) {
          // Check all the elements are cursors
          if (!_.all(res, isCursor)) {
            self.error(new Error("Publish function returned an array of non-Cursors"));
            return;
          }
          // Find duplicate collection names
          // XXX we should support overlapping cursors, but that would require the
          // merge box to allow overlap within a subscription
          var collectionNames = {};
          for (var i = 0; i < res.length; ++i) {
            var collectionName = res[i]._getCollectionName();
            if (_.has(collectionNames, collectionName)) {
              self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));
              return;
            }
            collectionNames[collectionName] = true;
          }
          ;
          this._publishCursorPromise = Promise.all(res.map(c => c._publishCursor(self))).then(() => {
            self.ready();
          }).catch(e => self.error(e));
        } else if (res) {
          // Truthy values other than cursors or arrays are probably a
          // user mistake (possible returning a Mongo document via, say,
          // `coll.findOne()`).
          self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));
        }
      },
      // This calls all stop callbacks and prevents the handler from updating any
      // SessionCollectionViews further. It's used when the user unsubscribes or
      // disconnects, as well as during setUserId re-runs. It does *NOT* send
      // removed messages for the published objects; if that is necessary, call
      // _removeAllDocuments first.
      _deactivate: function () {
        var self = this;
        if (self._deactivated) return;
        self._deactivated = true;
        self._callStopCallbacks();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", -1);
      },
      _callStopCallbacks: function () {
        var self = this;
        // Tell listeners, so they can clean up
        var callbacks = self._stopCallbacks;
        self._stopCallbacks = [];
        _.each(callbacks, function (callback) {
          callback();
        });
      },
      // Send remove messages for every document.
      _removeAllDocuments: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._documents.forEach(function (collectionDocs, collectionName) {
            collectionDocs.forEach(function (strId) {
              self.removed(collectionName, self._idFilter.idParse(strId));
            });
          });
        });
      },
      // Returns a new Subscription for the same session with the same
      // initial creation parameters. This isn't a clone: it doesn't have
      // the same _documents cache, stopped state or callbacks; may have a
      // different _subscriptionHandle, and gets its userId from the
      // session, not from this object.
      _recreate: function () {
        var self = this;
        return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);
      },
      /**
       * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
       * @locus Server
       * @param {Error} error The error to pass to the client.
       * @instance
       * @memberOf Subscription
       */
      error: function (error) {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId, error);
      },
      // Note that while our DDP client will notice that you've called stop() on the
      // server (and clean up its _subscriptions table) we don't actually provide a
      // mechanism for an app to notice this (the subscribe onError callback only
      // triggers if there is an error).

      /**
       * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
       * @locus Server
       * @instance
       * @memberOf Subscription
       */
      stop: function () {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId);
      },
      /**
       * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {Function} func The callback function
       */
      onStop: function (callback) {
        var self = this;
        callback = Meteor.bindEnvironment(callback, 'onStop callback', self);
        if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);
      },
      // This returns true if the sub has been deactivated, *OR* if the session was
      // destroyed but the deferred call to _deactivateAllSubscriptions hasn't
      // happened yet.
      _isDeactivated: function () {
        var self = this;
        return self._deactivated || self._session.inQueue === null;
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the new document.
       * @param {String} id The new document's ID.
       * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.
       */
      added(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          let ids = this._documents.get(collectionName);
          if (ids == null) {
            ids = new Set();
            this._documents.set(collectionName, ids);
          }
          ids.add(id);
        }
        this._session._publishCursorPromise = this._publishCursorPromise;
        this._session.added(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the changed document.
       * @param {String} id The changed document's ID.
       * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
       */
      changed(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        this._session.changed(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that the document has been removed from.
       * @param {String} id The ID of the document that has been removed.
       */
      removed(collectionName, id) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          // We don't bother to delete sets of things in a collection if the
          // collection is empty.  It could break _removeAllDocuments.
          this._documents.get(collectionName).delete(id);
        }
        this._session.removed(this._subscriptionHandle, collectionName, id);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
       * @locus Server
       * @memberOf Subscription
       * @instance
       */
      ready: function () {
        var self = this;
        if (self._isDeactivated()) return;
        if (!self._subscriptionId) return; // Unnecessary but ignored for universal sub
        if (!self._ready) {
          self._session.sendReady([self._subscriptionId]);
          self._ready = true;
        }
      }
    });

    /******************************************************************************/
    /* Server                                                                     */
    /******************************************************************************/

    Server = function () {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var self = this;

      // The default heartbeat interval is 30 seconds on the server and 35
      // seconds on the client.  Since the client doesn't need to send a
      // ping as long as it is receiving pings, this means that pings
      // normally go from the server to the client.
      //
      // Note: Troposphere depends on the ability to mutate
      // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
      self.options = _objectSpread({
        heartbeatInterval: 15000,
        heartbeatTimeout: 15000,
        // For testing, allow responding to pings to be disabled.
        respondToPings: true,
        defaultPublicationStrategy: publicationStrategies.SERVER_MERGE
      }, options);

      // Map of callbacks to call when a new connection comes in to the
      // server and completes DDP version negotiation. Use an object instead
      // of an array so we can safely remove one from the list while
      // iterating over it.
      self.onConnectionHook = new Hook({
        debugPrintExceptions: "onConnection callback"
      });

      // Map of callbacks to call when a new message comes in.
      self.onMessageHook = new Hook({
        debugPrintExceptions: "onMessage callback"
      });
      self.publish_handlers = {};
      self.universal_publish_handlers = [];
      self.method_handlers = {};
      self._publicationStrategies = {};
      self.sessions = new Map(); // map from id to session

      self.stream_server = new StreamServer();
      self.stream_server.register(function (socket) {
        // socket implements the SockJSConnection interface
        socket._meteorSession = null;
        var sendError = function (reason, offendingMessage) {
          var msg = {
            msg: 'error',
            reason: reason
          };
          if (offendingMessage) msg.offendingMessage = offendingMessage;
          socket.send(DDPCommon.stringifyDDP(msg));
        };
        socket.on('data', function (raw_msg) {
          if (Meteor._printReceivedDDP) {
            Meteor._debug("Received DDP", raw_msg);
          }
          try {
            try {
              var msg = DDPCommon.parseDDP(raw_msg);
            } catch (err) {
              sendError('Parse error');
              return;
            }
            if (msg === null || !msg.msg) {
              sendError('Bad request', msg);
              return;
            }
            if (msg.msg === 'connect') {
              if (socket._meteorSession) {
                sendError("Already connected", msg);
                return;
              }
              self._handleConnect(socket, msg);
              return;
            }
            if (!socket._meteorSession) {
              sendError('Must connect first', msg);
              return;
            }
            socket._meteorSession.processMessage(msg);
          } catch (e) {
            // XXX print stack nicely
            Meteor._debug("Internal exception while processing message", msg, e);
          }
        });
        socket.on('close', function () {
          if (socket._meteorSession) {
            socket._meteorSession.close();
          }
        });
      });
    };
    Object.assign(Server.prototype, {
      /**
       * @summary Register a callback to be called when a new DDP connection is made to the server.
       * @locus Server
       * @param {function} callback The function to call when a new DDP connection is established.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onConnection: function (fn) {
        var self = this;
        return self.onConnectionHook.register(fn);
      },
      /**
       * @summary Set publication strategy for the given collection. Publications strategies are available from `DDPServer.publicationStrategies`. You call this method from `Meteor.server`, like `Meteor.server.setPublicationStrategy()`
       * @locus Server
       * @alias setPublicationStrategy
       * @param collectionName {String}
       * @param strategy {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       */
      setPublicationStrategy(collectionName, strategy) {
        if (!Object.values(publicationStrategies).includes(strategy)) {
          throw new Error("Invalid merge strategy: ".concat(strategy, " \n        for collection ").concat(collectionName));
        }
        this._publicationStrategies[collectionName] = strategy;
      },
      /**
       * @summary Gets the publication strategy for the requested collection. You call this method from `Meteor.server`, like `Meteor.server.getPublicationStrategy()`
       * @locus Server
       * @alias getPublicationStrategy
       * @param collectionName {String}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       * @return {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       */
      getPublicationStrategy(collectionName) {
        return this._publicationStrategies[collectionName] || this.options.defaultPublicationStrategy;
      },
      /**
       * @summary Register a callback to be called when a new DDP message is received.
       * @locus Server
       * @param {function} callback The function to call when a new DDP message is received.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onMessage: function (fn) {
        var self = this;
        return self.onMessageHook.register(fn);
      },
      _handleConnect: function (socket, msg) {
        var self = this;

        // The connect message must specify a version and an array of supported
        // versions, and it must claim to support what it is proposing.
        if (!(typeof msg.version === 'string' && _.isArray(msg.support) && _.all(msg.support, _.isString) && _.contains(msg.support, msg.version))) {
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: DDPCommon.SUPPORTED_DDP_VERSIONS[0]
          }));
          socket.close();
          return;
        }

        // In the future, handle session resumption: something like:
        //  socket._meteorSession = self.sessions[msg.session]
        var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);
        if (msg.version !== version) {
          // The best version to use (according to the client's stated preferences)
          // is not the one the client is trying to use. Inform them about the best
          // version to use.
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: version
          }));
          socket.close();
          return;
        }

        // Yay, version matches! Create a new session.
        // Note: Troposphere depends on the ability to mutate
        // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
        socket._meteorSession = new Session(self, version, socket, self.options);
        self.sessions.set(socket._meteorSession.id, socket._meteorSession);
        self.onConnectionHook.each(function (callback) {
          if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);
          return true;
        });
      },
      /**
       * Register a publish handler function.
       *
       * @param name {String} identifier for query
       * @param handler {Function} publish handler
       * @param options {Object}
       *
       * Server will call handler function on each new subscription,
       * either when receiving DDP sub message for a named subscription, or on
       * DDP connect for a universal subscription.
       *
       * If name is null, this will be a subscription that is
       * automatically established and permanently on for all connected
       * client, instead of a subscription that can be turned on and off
       * with subscribe().
       *
       * options to contain:
       *  - (mostly internal) is_auto: true if generated automatically
       *    from an autopublish hook. this is for cosmetic purposes only
       *    (it lets us determine whether to print a warning suggesting
       *    that you turn off autopublish).
       */

      /**
       * @summary Publish a record set.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @locus Server
       * @param {String|Object} name If String, name of the record set.  If Object, publications Dictionary of publish functions by name.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
       * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
       */
      publish: function (name, handler, options) {
        var self = this;
        if (!_.isObject(name)) {
          options = options || {};
          if (name && name in self.publish_handlers) {
            Meteor._debug("Ignoring duplicate publish named '" + name + "'");
            return;
          }
          if (Package.autopublish && !options.is_auto) {
            // They have autopublish on, yet they're trying to manually
            // pick stuff to publish. They probably should turn off
            // autopublish. (This check isn't perfect -- if you create a
            // publish before you turn on autopublish, it won't catch
            // it, but this will definitely handle the simple case where
            // you've added the autopublish package to your app, and are
            // calling publish from your app code).
            if (!self.warned_about_autopublish) {
              self.warned_about_autopublish = true;
              Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
            }
          }
          if (name) self.publish_handlers[name] = handler;else {
            self.universal_publish_handlers.push(handler);
            // Spin up the new publisher on any existing session too. Run each
            // session's subscription in a new Fiber, so that there's no change for
            // self.sessions to change while we're running this loop.
            self.sessions.forEach(function (session) {
              if (!session._dontStartNewUniversalSubs) {
                session._startSubscription(handler);
              }
            });
          }
        } else {
          _.each(name, function (value, key) {
            self.publish(key, value, {});
          });
        }
      },
      _removeSession: function (session) {
        var self = this;
        self.sessions.delete(session.id);
      },
      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall: function () {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      },
      /**
       * @summary Defines functions that can be invoked over the network by clients.
       * @locus Anywhere
       * @param {Object} methods Dictionary whose keys are method names and values are functions.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      methods: function (methods) {
        var self = this;
        _.each(methods, function (func, name) {
          if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");
          if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");
          self.method_handlers[name] = func;
        });
      },
      call: function (name) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        if (args.length && typeof args[args.length - 1] === "function") {
          // If it's a function, the last argument is the result callback, not
          // a parameter to the remote method.
          var callback = args.pop();
        }
        return this.apply(name, args, callback);
      },
      // A version of the call method that always returns a Promise.
      callAsync: function (name) {
        var _args$;
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        const options = (_args$ = args[0]) !== null && _args$ !== void 0 && _args$.hasOwnProperty('returnStubValue') ? args.shift() : {};
        DDP._CurrentMethodInvocation._set();
        DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);
        const promise = new Promise((resolve, reject) => {
          DDP._CurrentCallAsyncInvocation._set({
            name,
            hasCallAsyncParent: true
          });
          this.applyAsync(name, args, _objectSpread({
            isFromCallAsync: true
          }, options)).then(resolve).catch(reject).finally(() => {
            DDP._CurrentCallAsyncInvocation._set();
          });
        });
        return promise.finally(() => DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false));
      },
      apply: function (name, args, options, callback) {
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        } else {
          options = options || {};
        }
        const promise = this.applyAsync(name, args, options);

        // Return the result in whichever way the caller asked for it. Note that we
        // do NOT block on the write fence in an analogous way to how the client
        // blocks on the relevant data being visible, so you are NOT guaranteed that
        // cursor observe callbacks have fired when your callback is invoked. (We
        // can change this if there's a real use case).
        if (callback) {
          promise.then(result => callback(undefined, result), exception => callback(exception));
        } else {
          return promise;
        }
      },
      // @param options {Optional Object}
      applyAsync: function (name, args, options) {
        // Run the handler
        var handler = this.method_handlers[name];
        if (!handler) {
          return Promise.reject(new Meteor.Error(404, "Method '".concat(name, "' not found")));
        }
        // If this is a method call from within another method or publish function,
        // get the user state from the outer method or publish function, otherwise
        // don't allow setUserId to be called
        var userId = null;
        var setUserId = function () {
          throw new Error("Can't call setUserId on a server initiated method call");
        };
        var connection = null;
        var currentMethodInvocation = DDP._CurrentMethodInvocation.get();
        var currentPublicationInvocation = DDP._CurrentPublicationInvocation.get();
        var randomSeed = null;
        if (currentMethodInvocation) {
          userId = currentMethodInvocation.userId;
          setUserId = function (userId) {
            currentMethodInvocation.setUserId(userId);
          };
          connection = currentMethodInvocation.connection;
          randomSeed = DDPCommon.makeRpcSeed(currentMethodInvocation, name);
        } else if (currentPublicationInvocation) {
          userId = currentPublicationInvocation.userId;
          setUserId = function (userId) {
            currentPublicationInvocation._session._setUserId(userId);
          };
          connection = currentPublicationInvocation.connection;
        }
        var invocation = new DDPCommon.MethodInvocation({
          isSimulation: false,
          userId,
          setUserId,
          connection,
          randomSeed
        });
        return new Promise((resolve, reject) => {
          let result;
          try {
            result = DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'"));
          } catch (e) {
            return reject(e);
          }
          if (!Meteor._isPromise(result)) {
            return resolve(result);
          }
          result.then(r => resolve(r)).catch(reject);
        }).then(EJSON.clone);
      },
      _urlForSession: function (sessionId) {
        var self = this;
        var session = self.sessions.get(sessionId);
        if (session) return session._socketUrl;else return null;
      }
    });
    var calculateVersion = function (clientSupportedVersions, serverSupportedVersions) {
      var correctVersion = _.find(clientSupportedVersions, function (version) {
        return _.contains(serverSupportedVersions, version);
      });
      if (!correctVersion) {
        correctVersion = serverSupportedVersions[0];
      }
      return correctVersion;
    };
    DDPServer._calculateVersion = calculateVersion;

    // "blind" exceptions other than those that were deliberately thrown to signal
    // errors to the client
    var wrapInternalException = function (exception, context) {
      if (!exception) return exception;

      // To allow packages to throw errors intended for the client but not have to
      // depend on the Meteor.Error class, `isClientSafe` can be set to true on any
      // error before it is thrown.
      if (exception.isClientSafe) {
        if (!(exception instanceof Meteor.Error)) {
          const originalMessage = exception.message;
          exception = new Meteor.Error(exception.error, exception.reason, exception.details);
          exception.message = originalMessage;
        }
        return exception;
      }

      // Tests can set the '_expectedByTest' flag on an exception so it won't go to
      // the server log.
      if (!exception._expectedByTest) {
        Meteor._debug("Exception " + context, exception.stack);
        if (exception.sanitizedError) {
          Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError);
          Meteor._debug();
        }
      }

      // Did the error contain more details that could have been useful if caught in
      // server code (or if thrown from non-client-originated code), but also
      // provided a "sanitized" version with more context than 500 Internal server
      // error? Use that.
      if (exception.sanitizedError) {
        if (exception.sanitizedError.isClientSafe) return exception.sanitizedError;
        Meteor._debug("Exception " + context + " provides a sanitizedError that " + "does not have isClientSafe property set; ignoring");
      }
      return new Meteor.Error(500, "Internal server error");
    };

    // Audit argument checks, if the audit-argument-checks package exists (it is a
    // weak dependency of this package).
    var maybeAuditArgumentChecks = function (f, context, args, description) {
      args = args || [];
      if (Package['audit-argument-checks']) {
        return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);
      }
      return f.apply(context, args);
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"writefence.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/writefence.js                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A write fence collects a group of writes, and provides a callback
// when all of the writes are fully committed and propagated (all
// observers have been notified of the write and acknowledged it.)
//
DDPServer._WriteFence = class {
  constructor() {
    this.armed = false;
    this.fired = false;
    this.retired = false;
    this.outstanding_writes = 0;
    this.before_fire_callbacks = [];
    this.completion_callbacks = [];
  }

  // Start tracking a write, and return an object to represent it. The
  // object has a single method, committed(). This method should be
  // called when the write is fully committed and propagated. You can
  // continue to add writes to the WriteFence up until it is triggered
  // (calls its callbacks because all writes have committed.)
  beginWrite() {
    if (this.retired) return {
      committed: function () {}
    };
    if (this.fired) throw new Error("fence has already activated -- too late to add writes");
    this.outstanding_writes++;
    let committed = false;
    const _committedFn = async () => {
      if (committed) throw new Error("committed called twice on the same write");
      committed = true;
      this.outstanding_writes--;
      await this._maybeFire();
    };
    return {
      committed: _committedFn
    };
  }

  // Arm the fence. Once the fence is armed, and there are no more
  // uncommitted writes, it will activate.
  arm() {
    if (this === DDPServer._getCurrentFence()) throw Error("Can't arm the current fence");
    this.armed = true;
    return this._maybeFire();
  }

  // Register a function to be called once before firing the fence.
  // Callback function can add new writes to the fence, in which case
  // it won't fire until those writes are done as well.
  onBeforeFire(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.before_fire_callbacks.push(func);
  }

  // Register a function to be called when the fence fires.
  onAllCommitted(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.completion_callbacks.push(func);
  }
  async _armAndWait() {
    let resolver;
    const returnValue = new Promise(r => resolver = r);
    this.onAllCommitted(resolver);
    await this.arm();
    return returnValue;
  }
  // Convenience function. Arms the fence, then blocks until it fires.
  async armAndWait() {
    return this._armAndWait();
  }
  async _maybeFire() {
    if (this.fired) throw new Error("write fence already activated?");
    if (this.armed && !this.outstanding_writes) {
      const invokeCallback = async func => {
        try {
          await func(this);
        } catch (err) {
          Meteor._debug("exception in write fence callback:", err);
        }
      };
      this.outstanding_writes++;
      while (this.before_fire_callbacks.length > 0) {
        const cb = this.before_fire_callbacks.shift();
        await invokeCallback(cb);
      }
      this.outstanding_writes--;
      if (!this.outstanding_writes) {
        this.fired = true;
        const callbacks = this.completion_callbacks || [];
        this.completion_callbacks = [];
        while (callbacks.length > 0) {
          const cb = callbacks.shift();
          await invokeCallback(cb);
        }
      }
    }
  }

  // Deactivate this fence so that adding more writes has no effect.
  // The fence must have already fired.
  retire() {
    if (!this.fired) throw new Error("Can't retire a fence that hasn't fired.");
    this.retired = true;
  }
};

// The current write fence. When there is a current write fence, code
// that writes to databases should register their writes with it using
// beginWrite().
//
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/crossbar.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.
// See _match for the definition of how a notification matches a trigger.
// All notifications and triggers must have a string key named 'collection'.

DDPServer._Crossbar = function (options) {
  var self = this;
  options = options || {};
  self.nextId = 1;
  // map from collection name (string) -> listener id -> object. each object has
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no
  // collection".
  self.listenersByCollection = {};
  self.listenersByCollectionCount = {};
  self.factPackage = options.factPackage || "livedata";
  self.factName = options.factName || null;
};
_.extend(DDPServer._Crossbar.prototype, {
  // msg is a trigger or a notification
  _collectionForMessage: function (msg) {
    var self = this;
    if (!_.has(msg, 'collection')) {
      return '';
    } else if (typeof msg.collection === 'string') {
      if (msg.collection === '') throw Error("Message has empty collection!");
      return msg.collection;
    } else {
      throw Error("Message has non-string collection!");
    }
  },
  // Listen for notification that match 'trigger'. A notification
  // matches if it has the key-value pairs in trigger as a
  // subset. When a notification matches, call 'callback', passing
  // the actual notification.
  //
  // Returns a listen handle, which is an object with a method
  // stop(). Call stop() to stop listening.
  //
  // XXX It should be legal to call fire() from inside a listen()
  // callback?
  listen: function (trigger, callback) {
    var self = this;
    var id = self.nextId++;
    var collection = self._collectionForMessage(trigger);
    var record = {
      trigger: EJSON.clone(trigger),
      callback: callback
    };
    if (!_.has(self.listenersByCollection, collection)) {
      self.listenersByCollection[collection] = {};
      self.listenersByCollectionCount[collection] = 0;
    }
    self.listenersByCollection[collection][id] = record;
    self.listenersByCollectionCount[collection]++;
    if (self.factName && Package['facts-base']) {
      Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, 1);
    }
    return {
      stop: function () {
        if (self.factName && Package['facts-base']) {
          Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, -1);
        }
        delete self.listenersByCollection[collection][id];
        self.listenersByCollectionCount[collection]--;
        if (self.listenersByCollectionCount[collection] === 0) {
          delete self.listenersByCollection[collection];
          delete self.listenersByCollectionCount[collection];
        }
      }
    };
  },
  // Fire the provided 'notification' (an object whose attribute
  // values are all JSON-compatibile) -- inform all matching listeners
  // (registered with listen()).
  //
  // If fire() is called inside a write fence, then each of the
  // listener callbacks will be called inside the write fence as well.
  //
  // The listeners may be invoked in parallel, rather than serially.
  fire: async function (notification) {
    var self = this;
    var collection = self._collectionForMessage(notification);
    if (!_.has(self.listenersByCollection, collection)) {
      return;
    }
    var listenersForCollection = self.listenersByCollection[collection];
    var callbackIds = [];
    _.each(listenersForCollection, function (l, id) {
      if (self._matches(notification, l.trigger)) {
        callbackIds.push(id);
      }
    });

    // Listener callbacks can yield, so we need to first find all the ones that
    // match in a single iteration over self.listenersByCollection (which can't
    // be mutated during this iteration), and then invoke the matching
    // callbacks, checking before each call to ensure they haven't stopped.
    // Note that we don't have to check that
    // self.listenersByCollection[collection] still === listenersForCollection,
    // because the only way that stops being true is if listenersForCollection
    // first gets reduced down to the empty object (and then never gets
    // increased again).
    for (const id of callbackIds) {
      if (_.has(listenersForCollection, id)) {
        await listenersForCollection[id].callback(notification);
      }
    }
  },
  // A notification matches a trigger if all keys that exist in both are equal.
  //
  // Examples:
  //  N:{collection: "C"} matches T:{collection: "C"}
  //    (a non-targeted write to a collection matches a
  //     non-targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}
  //    (a targeted write to a collection matches a non-targeted query)
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}
  //    (a non-targeted write to a collection matches a
  //     targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}
  //    (a targeted write to a collection matches a targeted query targeted
  //     at the same document)
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}
  //    (a targeted write to a collection does not match a targeted query
  //     targeted at a different document)
  _matches: function (notification, trigger) {
    // Most notifications that use the crossbar have a string `collection` and
    // maybe an `id` that is a string or ObjectID. We're already dividing up
    // triggers by collection, but let's fast-track "nope, different ID" (and
    // avoid the overly generic EJSON.equals). This makes a noticeable
    // performance difference; see https://github.com/meteor/meteor/pull/3697
    if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
      return false;
    }
    if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
      return false;
    }
    return _.all(trigger, function (triggerValue, key) {
      return !_.has(notification, key) || EJSON.equals(triggerValue, notification[key]);
    });
  }
});

// The "invalidation crossbar" is a specific instance used by the DDP server to
// implement write fence notifications. Listener callbacks on this crossbar
// should call beginWrite on the current write fence before they return, if they
// want to delay the write fence from firing (ie, the DDP method-data-updated
// message from being sent).
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({
  factName: "invalidation-crossbar-listeners"
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/server_convenience.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;
}
Meteor.server = new Server();
Meteor.refresh = async function (notification) {
  await DDPServer._InvalidationCrossbar.fire(notification);
};

// Proxy the public methods of Meteor.server so they can
// be called directly on Meteor.
_.each(['publish', 'isAsyncCall', 'methods', 'call', 'callAsync', 'apply', 'applyAsync', 'onConnection', 'onMessage'], function (name) {
  Meteor[name] = _.bind(Meteor.server[name], Meteor.server);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDPServer: DDPServer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-server/stream_server.js",
    "/node_modules/meteor/ddp-server/livedata_server.js",
    "/node_modules/meteor/ddp-server/writefence.js",
    "/node_modules/meteor/ddp-server/crossbar.js",
    "/node_modules/meteor/ddp-server/server_convenience.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/ddp-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9zdHJlYW1fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2xpdmVkYXRhX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci93cml0ZWZlbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2Nyb3NzYmFyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3NlcnZlcl9jb252ZW5pZW5jZS5qcyJdLCJuYW1lcyI6WyJ3ZWJzb2NrZXRFeHRlbnNpb25zIiwiXyIsIm9uY2UiLCJleHRlbnNpb25zIiwid2Vic29ja2V0Q29tcHJlc3Npb25Db25maWciLCJwcm9jZXNzIiwiZW52IiwiU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiIsIkpTT04iLCJwYXJzZSIsInB1c2giLCJOcG0iLCJyZXF1aXJlIiwiY29uZmlndXJlIiwicGF0aFByZWZpeCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsIlN0cmVhbVNlcnZlciIsInNlbGYiLCJyZWdpc3RyYXRpb25fY2FsbGJhY2tzIiwib3Blbl9zb2NrZXRzIiwicHJlZml4IiwiUm91dGVQb2xpY3kiLCJkZWNsYXJlIiwic29ja2pzIiwic2VydmVyT3B0aW9ucyIsImxvZyIsImhlYXJ0YmVhdF9kZWxheSIsImRpc2Nvbm5lY3RfZGVsYXkiLCJqc2Vzc2lvbmlkIiwiVVNFX0pTRVNTSU9OSUQiLCJESVNBQkxFX1dFQlNPQ0tFVFMiLCJ3ZWJzb2NrZXQiLCJmYXllX3NlcnZlcl9vcHRpb25zIiwic2VydmVyIiwiY3JlYXRlU2VydmVyIiwiV2ViQXBwIiwiaHR0cFNlcnZlciIsInJlbW92ZUxpc3RlbmVyIiwiX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrIiwiaW5zdGFsbEhhbmRsZXJzIiwiYWRkTGlzdGVuZXIiLCJfcmVkaXJlY3RXZWJzb2NrZXRFbmRwb2ludCIsIm9uIiwic29ja2V0Iiwic2V0V2Vic29ja2V0VGltZW91dCIsInRpbWVvdXQiLCJwcm90b2NvbCIsIl9zZXNzaW9uIiwicmVjdiIsImNvbm5lY3Rpb24iLCJzZXRUaW1lb3V0Iiwic2VuZCIsImRhdGEiLCJ3cml0ZSIsIndpdGhvdXQiLCJURVNUX01FVEFEQVRBIiwic3RyaW5naWZ5IiwidGVzdE1lc3NhZ2VPbkNvbm5lY3QiLCJlYWNoIiwiY2FsbGJhY2siLCJPYmplY3QiLCJhc3NpZ24iLCJwcm90b3R5cGUiLCJyZWdpc3RlciIsImFsbF9zb2NrZXRzIiwidmFsdWVzIiwiZm9yRWFjaCIsImV2ZW50Iiwib2xkSHR0cFNlcnZlckxpc3RlbmVycyIsImxpc3RlbmVycyIsInNsaWNlIiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwibmV3TGlzdGVuZXIiLCJyZXF1ZXN0IiwiYXJncyIsImFyZ3VtZW50cyIsInVybCIsInBhcnNlZFVybCIsInBhdGhuYW1lIiwiZm9ybWF0Iiwib2xkTGlzdGVuZXIiLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIkREUFNlcnZlciIsInB1YmxpY2F0aW9uU3RyYXRlZ2llcyIsIlNFUlZFUl9NRVJHRSIsInVzZUNvbGxlY3Rpb25WaWV3IiwiZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbiIsIk5PX01FUkdFX05PX0hJU1RPUlkiLCJOT19NRVJHRSIsIlNlc3Npb25Eb2N1bWVudFZpZXciLCJleGlzdHNJbiIsIlNldCIsImRhdGFCeUtleSIsIk1hcCIsIl9TZXNzaW9uRG9jdW1lbnRWaWV3IiwiX2dldEN1cnJlbnRGZW5jZSIsImN1cnJlbnRJbnZvY2F0aW9uIiwiX0N1cnJlbnRXcml0ZUZlbmNlIiwiZ2V0IiwiRERQIiwiX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiZmVuY2UiLCJ1bmRlZmluZWQiLCJleHRlbmQiLCJnZXRGaWVsZHMiLCJyZXQiLCJwcmVjZWRlbmNlTGlzdCIsImtleSIsInZhbHVlIiwiY2xlYXJGaWVsZCIsInN1YnNjcmlwdGlvbkhhbmRsZSIsImNoYW5nZUNvbGxlY3RvciIsInJlbW92ZWRWYWx1ZSIsImkiLCJsZW5ndGgiLCJwcmVjZWRlbmNlIiwic3BsaWNlIiwiZGVsZXRlIiwiRUpTT04iLCJlcXVhbHMiLCJjaGFuZ2VGaWVsZCIsImlzQWRkIiwiY2xvbmUiLCJoYXMiLCJzZXQiLCJlbHQiLCJmaW5kIiwiU2Vzc2lvbkNvbGxlY3Rpb25WaWV3IiwiY29sbGVjdGlvbk5hbWUiLCJzZXNzaW9uQ2FsbGJhY2tzIiwiZG9jdW1lbnRzIiwiY2FsbGJhY2tzIiwiX1Nlc3Npb25Db2xsZWN0aW9uVmlldyIsImlzRW1wdHkiLCJzaXplIiwiZGlmZiIsInByZXZpb3VzIiwiRGlmZlNlcXVlbmNlIiwiZGlmZk1hcHMiLCJib3RoIiwiYmluZCIsImRpZmZEb2N1bWVudCIsInJpZ2h0T25seSIsImlkIiwibm93RFYiLCJhZGRlZCIsImxlZnRPbmx5IiwicHJldkRWIiwicmVtb3ZlZCIsImZpZWxkcyIsImRpZmZPYmplY3RzIiwicHJldiIsIm5vdyIsImNoYW5nZWQiLCJkb2NWaWV3IiwiYWRkIiwiY2hhbmdlZFJlc3VsdCIsIkVycm9yIiwiZXJyIiwiU2Vzc2lvbiIsInZlcnNpb24iLCJvcHRpb25zIiwiUmFuZG9tIiwiaW5pdGlhbGl6ZWQiLCJpblF1ZXVlIiwiTWV0ZW9yIiwiX0RvdWJsZUVuZGVkUXVldWUiLCJibG9ja2VkIiwid29ya2VyUnVubmluZyIsImNhY2hlZFVuYmxvY2siLCJfbmFtZWRTdWJzIiwiX3VuaXZlcnNhbFN1YnMiLCJ1c2VySWQiLCJjb2xsZWN0aW9uVmlld3MiLCJfaXNTZW5kaW5nIiwiX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMiLCJfcGVuZGluZ1JlYWR5IiwiX2Nsb3NlQ2FsbGJhY2tzIiwiX3NvY2tldFVybCIsIl9yZXNwb25kVG9QaW5ncyIsInJlc3BvbmRUb1BpbmdzIiwiY29ubmVjdGlvbkhhbmRsZSIsImNsb3NlIiwib25DbG9zZSIsImZuIiwiY2IiLCJiaW5kRW52aXJvbm1lbnQiLCJkZWZlciIsImNsaWVudEFkZHJlc3MiLCJfY2xpZW50QWRkcmVzcyIsImh0dHBIZWFkZXJzIiwiaGVhZGVycyIsIm1zZyIsInNlc3Npb24iLCJzdGFydFVuaXZlcnNhbFN1YnMiLCJoZWFydGJlYXRJbnRlcnZhbCIsImhlYXJ0YmVhdCIsIkREUENvbW1vbiIsIkhlYXJ0YmVhdCIsImhlYXJ0YmVhdFRpbWVvdXQiLCJvblRpbWVvdXQiLCJzZW5kUGluZyIsInN0YXJ0IiwiUGFja2FnZSIsIkZhY3RzIiwiaW5jcmVtZW50U2VydmVyRmFjdCIsIl9jaGVja1B1Ymxpc2hQcm9taXNlQmVmb3JlU2VuZCIsImYiLCJfcHVibGlzaEN1cnNvclByb21pc2UiLCJmaW5hbGx5Iiwic2VuZFJlYWR5Iiwic3Vic2NyaXB0aW9uSWRzIiwic3VicyIsInN1YnNjcmlwdGlvbklkIiwiX2NhblNlbmQiLCJnZXRQdWJsaWNhdGlvblN0cmF0ZWd5Iiwic2VuZEFkZGVkIiwiY29sbGVjdGlvbiIsInNlbmRDaGFuZ2VkIiwic2VuZFJlbW92ZWQiLCJnZXRTZW5kQ2FsbGJhY2tzIiwiZ2V0Q29sbGVjdGlvblZpZXciLCJ2aWV3IiwiaGFuZGxlcnMiLCJ1bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVycyIsImhhbmRsZXIiLCJfc3RhcnRTdWJzY3JpcHRpb24iLCJzdG9wIiwiX21ldGVvclNlc3Npb24iLCJfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMiLCJfcmVtb3ZlU2Vzc2lvbiIsIl9wcmludFNlbnRERFAiLCJfZGVidWciLCJzdHJpbmdpZnlERFAiLCJzZW5kRXJyb3IiLCJyZWFzb24iLCJvZmZlbmRpbmdNZXNzYWdlIiwicHJvY2Vzc01lc3NhZ2UiLCJtc2dfaW4iLCJtZXNzYWdlUmVjZWl2ZWQiLCJwcm9jZXNzTmV4dCIsInNoaWZ0IiwicnVuSGFuZGxlcnMiLCJ1bmJsb2NrIiwib25NZXNzYWdlSG9vayIsInByb3RvY29sX2hhbmRsZXJzIiwicmVzdWx0IiwiY2FsbCIsIl9pc1Byb21pc2UiLCJzdWIiLCJuYW1lIiwicGFyYW1zIiwiQXJyYXkiLCJwdWJsaXNoX2hhbmRsZXJzIiwiZXJyb3IiLCJjb25jYXQiLCJERFBSYXRlTGltaXRlciIsInJhdGVMaW1pdGVySW5wdXQiLCJ0eXBlIiwiY29ubmVjdGlvbklkIiwiX2luY3JlbWVudCIsInJhdGVMaW1pdFJlc3VsdCIsIl9jaGVjayIsImFsbG93ZWQiLCJnZXRFcnJvck1lc3NhZ2UiLCJ0aW1lVG9SZXNldCIsInVuc3ViIiwiX3N0b3BTdWJzY3JpcHRpb24iLCJtZXRob2QiLCJyYW5kb21TZWVkIiwiX1dyaXRlRmVuY2UiLCJvbkFsbENvbW1pdHRlZCIsInJldGlyZSIsIm1ldGhvZHMiLCJtZXRob2RfaGFuZGxlcnMiLCJhcm0iLCJzZXRVc2VySWQiLCJfc2V0VXNlcklkIiwiaW52b2NhdGlvbiIsIk1ldGhvZEludm9jYXRpb24iLCJpc1NpbXVsYXRpb24iLCJwcm9taXNlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJnZXRDdXJyZW50TWV0aG9kSW52b2NhdGlvblJlc3VsdCIsIndpdGhWYWx1ZSIsIm1heWJlQXVkaXRBcmd1bWVudENoZWNrcyIsImtleU5hbWUiLCJmaW5pc2giLCJwYXlsb2FkIiwidGhlbiIsImV4Y2VwdGlvbiIsIndyYXBJbnRlcm5hbEV4Y2VwdGlvbiIsIl9lYWNoU3ViIiwiX2RpZmZDb2xsZWN0aW9uVmlld3MiLCJiZWZvcmVDVnMiLCJsZWZ0VmFsdWUiLCJyaWdodFZhbHVlIiwiZG9jIiwiX2RlYWN0aXZhdGUiLCJvbGROYW1lZFN1YnMiLCJuZXdTdWIiLCJfcmVjcmVhdGUiLCJfcnVuSGFuZGxlciIsIl9ub1lpZWxkc0FsbG93ZWQiLCJzdWJJZCIsIlN1YnNjcmlwdGlvbiIsInVuYmxvY2tIYW5kZXIiLCJzdWJOYW1lIiwibWF5YmVTdWIiLCJfbmFtZSIsIl9yZW1vdmVBbGxEb2N1bWVudHMiLCJyZXNwb25zZSIsImh0dHBGb3J3YXJkZWRDb3VudCIsInBhcnNlSW50IiwicmVtb3RlQWRkcmVzcyIsImZvcndhcmRlZEZvciIsImlzU3RyaW5nIiwidHJpbSIsInNwbGl0IiwiX2hhbmRsZXIiLCJfc3Vic2NyaXB0aW9uSWQiLCJfcGFyYW1zIiwiX3N1YnNjcmlwdGlvbkhhbmRsZSIsIl9kZWFjdGl2YXRlZCIsIl9zdG9wQ2FsbGJhY2tzIiwiX2RvY3VtZW50cyIsIl9yZWFkeSIsIl9pZEZpbHRlciIsImlkU3RyaW5naWZ5IiwiTW9uZ29JRCIsImlkUGFyc2UiLCJyZXN1bHRPclRoZW5hYmxlIiwiX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24iLCJlIiwiX2lzRGVhY3RpdmF0ZWQiLCJpc1RoZW5hYmxlIiwiX3B1Ymxpc2hIYW5kbGVyUmVzdWx0IiwicmVzIiwiaXNDdXJzb3IiLCJjIiwiX3B1Ymxpc2hDdXJzb3IiLCJyZWFkeSIsImNhdGNoIiwiaXNBcnJheSIsImFsbCIsImNvbGxlY3Rpb25OYW1lcyIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsIm1hcCIsIl9jYWxsU3RvcENhbGxiYWNrcyIsImNvbGxlY3Rpb25Eb2NzIiwic3RySWQiLCJvblN0b3AiLCJpZHMiLCJTZXJ2ZXIiLCJkZWZhdWx0UHVibGljYXRpb25TdHJhdGVneSIsIm9uQ29ubmVjdGlvbkhvb2siLCJIb29rIiwiZGVidWdQcmludEV4Y2VwdGlvbnMiLCJfcHVibGljYXRpb25TdHJhdGVnaWVzIiwic2Vzc2lvbnMiLCJzdHJlYW1fc2VydmVyIiwicmF3X21zZyIsIl9wcmludFJlY2VpdmVkRERQIiwicGFyc2VERFAiLCJfaGFuZGxlQ29ubmVjdCIsIm9uQ29ubmVjdGlvbiIsInNldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJzdHJhdGVneSIsImluY2x1ZGVzIiwib25NZXNzYWdlIiwic3VwcG9ydCIsImNvbnRhaW5zIiwiU1VQUE9SVEVEX0REUF9WRVJTSU9OUyIsImNhbGN1bGF0ZVZlcnNpb24iLCJwdWJsaXNoIiwiaXNPYmplY3QiLCJhdXRvcHVibGlzaCIsImlzX2F1dG8iLCJ3YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2giLCJpc0FzeW5jQ2FsbCIsIl9pc0NhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJmdW5jIiwiX2xlbiIsIl9rZXkiLCJwb3AiLCJjYWxsQXN5bmMiLCJfYXJncyQiLCJfbGVuMiIsIl9rZXkyIiwiaGFzT3duUHJvcGVydHkiLCJfc2V0IiwiX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJfQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24iLCJoYXNDYWxsQXN5bmNQYXJlbnQiLCJhcHBseUFzeW5jIiwiaXNGcm9tQ2FsbEFzeW5jIiwiY3VycmVudE1ldGhvZEludm9jYXRpb24iLCJjdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwibWFrZVJwY1NlZWQiLCJyIiwiX3VybEZvclNlc3Npb24iLCJzZXNzaW9uSWQiLCJjbGllbnRTdXBwb3J0ZWRWZXJzaW9ucyIsInNlcnZlclN1cHBvcnRlZFZlcnNpb25zIiwiY29ycmVjdFZlcnNpb24iLCJfY2FsY3VsYXRlVmVyc2lvbiIsImNvbnRleHQiLCJpc0NsaWVudFNhZmUiLCJvcmlnaW5hbE1lc3NhZ2UiLCJtZXNzYWdlIiwiZGV0YWlscyIsIl9leHBlY3RlZEJ5VGVzdCIsInN0YWNrIiwic2FuaXRpemVkRXJyb3IiLCJkZXNjcmlwdGlvbiIsIk1hdGNoIiwiX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJhc3luYyIsImNvbnN0cnVjdG9yIiwiYXJtZWQiLCJmaXJlZCIsInJldGlyZWQiLCJvdXRzdGFuZGluZ193cml0ZXMiLCJiZWZvcmVfZmlyZV9jYWxsYmFja3MiLCJjb21wbGV0aW9uX2NhbGxiYWNrcyIsImJlZ2luV3JpdGUiLCJjb21taXR0ZWQiLCJfY29tbWl0dGVkRm4iLCJfbWF5YmVGaXJlIiwib25CZWZvcmVGaXJlIiwiX2FybUFuZFdhaXQiLCJyZXNvbHZlciIsInJldHVyblZhbHVlIiwiYXJtQW5kV2FpdCIsImludm9rZUNhbGxiYWNrIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9Dcm9zc2JhciIsIm5leHRJZCIsImxpc3RlbmVyc0J5Q29sbGVjdGlvbiIsImxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50IiwiZmFjdFBhY2thZ2UiLCJmYWN0TmFtZSIsIl9jb2xsZWN0aW9uRm9yTWVzc2FnZSIsImxpc3RlbiIsInRyaWdnZXIiLCJyZWNvcmQiLCJmaXJlIiwibm90aWZpY2F0aW9uIiwibGlzdGVuZXJzRm9yQ29sbGVjdGlvbiIsImNhbGxiYWNrSWRzIiwibCIsIl9tYXRjaGVzIiwiT2JqZWN0SUQiLCJ0cmlnZ2VyVmFsdWUiLCJfSW52YWxpZGF0aW9uQ3Jvc3NiYXIiLCJERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCIsInJlZnJlc2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUlBLG1CQUFtQixHQUFHQyxDQUFDLENBQUNDLElBQUksQ0FBQyxZQUFZO0VBQzNDLElBQUlDLFVBQVUsR0FBRyxFQUFFO0VBRW5CLElBQUlDLDBCQUEwQixHQUFHQyxPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsNEJBQTRCLEdBQ2pFQyxJQUFJLENBQUNDLEtBQUssQ0FBQ0osT0FBTyxDQUFDQyxHQUFHLENBQUNDLDRCQUE0QixDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ2pFLElBQUlILDBCQUEwQixFQUFFO0lBQzlCRCxVQUFVLENBQUNPLElBQUksQ0FBQ0MsR0FBRyxDQUFDQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQ0MsU0FBUyxDQUN6RFQsMEJBQ0YsQ0FBQyxDQUFDO0VBQ0o7RUFFQSxPQUFPRCxVQUFVO0FBQ25CLENBQUMsQ0FBQztBQUVGLElBQUlXLFVBQVUsR0FBR0MseUJBQXlCLENBQUNDLG9CQUFvQixJ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O0VBQ3hESyxRQUFRLEVBQUU7QUFDWixDQUFDLENBQUMsQzs7Ozs7Ozs7Ozs7QUN0S0YsSUFBSS9iLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDNGMsMEJBQTBCLEVBQUU7RUFDMUNuYyx5QkFBeUIsQ0FBQ21jLDBCQUEwQixHQUNsRDdjLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDNGMsMEJBQTBCO0FBQzFDO0FBRUF0UyxNQUFNLENBQUMxSSxNQUFNLEdBQUcsSUFBSXdVLE1BQU0sQ0FBQyxDQUFDO0FBRTVCOUwsTUFBTSxDQUFDdVMsT0FBTyxHQUFHLGdCQUFnQlQsWUFBWSxFQUFFO0VBQzdDLE1BQU1qWCxTQUFTLENBQUN3WCxxQkFBcUIsQ0FBQ1IsSUFBSSxDQUFDQyxZQUFZLENBQUM7QUFDMUQsQ0FBQzs7QUFFRDtBQUNBO0FBQ0F6YyxDQUFDLENBQUMwRCxJQUFJLENBQ0osQ0FDRSxTQUFTLEVBQ1QsYUFBYSxFQUNiLFNBQVMsRUFDVCxNQUFNLEVBQ04sV0FBVyxFQUNYLE9BQU8sRUFDUCxZQUFZLEVBQ1osY0FBYyxFQUNkLFdBQVcsQ0FDWixFQUNELFVBQVNzTSxJQUFJLEVBQUU7RUFDYnJGLE1BQU0sQ0FBQ3FGLElBQUksQ0FBQyxHQUFHaFEsQ0FBQyxDQUFDa0osSUFBSSxDQUFDeUIsTUFBTSxDQUFDMUksTUFBTSxDQUFDK04sSUFBSSxDQUFDLEVBQUVyRixNQUFNLENBQUMxSSxNQUFNLENBQUM7QUFDM0QsQ0FDRixDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1zZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBCeSBkZWZhdWx0LCB3ZSB1c2UgdGhlIHBlcm1lc3NhZ2UtZGVmbGF0ZSBleHRlbnNpb24gd2l0aCBkZWZhdWx0XG4vLyBjb25maWd1cmF0aW9uLiBJZiAkU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiBpcyBzZXQsIHRoZW4gaXQgbXVzdCBiZSB2YWxpZFxuLy8gSlNPTi4gSWYgaXQgcmVwcmVzZW50cyBhIGZhbHNleSB2YWx1ZSwgdGhlbiB3ZSBkbyBub3QgdXNlIHBlcm1lc3NhZ2UtZGVmbGF0ZVxuLy8gYXQgYWxsOyBvdGhlcndpc2UsIHRoZSBKU09OIHZhbHVlIGlzIHVzZWQgYXMgYW4gYXJndW1lbnQgdG8gZGVmbGF0ZSdzXG4vLyBjb25maWd1cmUgbWV0aG9kOyBzZWVcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYXllL3Blcm1lc3NhZ2UtZGVmbGF0ZS1ub2RlL2Jsb2IvbWFzdGVyL1JFQURNRS5tZFxuLy9cbi8vIChXZSBkbyB0aGlzIGluIGFuIF8ub25jZSBpbnN0ZWFkIG9mIGF0IHN0YXJ0dXAsIGJlY2F1c2Ugd2UgZG9uJ3Qgd2FudCB0b1xuLy8gY3Jhc2ggdGhlIHRvb2wgZHVyaW5nIGlzb3BhY2tldCBsb2FkIGlmIHlvdXIgSlNPTiBkb2Vzbid0IHBhcnNlLiBUaGlzIGlzIG9ubHlcbi8vIGEgcHJvYmxlbSBiZWNhdXNlIHRoZSB0b29sIGhhcyB0byBsb2FkIHRoZSBERFAgc2VydmVyIGNvZGUganVzdCBpbiBvcmRlciB0b1xuLy8gYmUgYSBERFAgY2xpZW50OyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzM0NTIgLilcbnZhciB3ZWJzb2NrZXRFeHRlbnNpb25zID0gXy5vbmNlKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGV4dGVuc2lvbnMgPSBbXTtcblxuICB2YXIgd2Vic29ja2V0Q29tcHJlc3Npb25Db25maWcgPSBwcm9jZXNzLmVudi5TRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OXG4gICAgICAgID8gSlNPTi5wYXJzZShwcm9jZXNzLmVudi5TRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OKSA6IHt9O1xuICBpZiAod2Vic29ja2V0Q29tcHJlc3Npb25Db25maWcpIHtcbiAgICBleHRlbnNpb25zLnB1c2goTnBtLnJlcXVpcmUoJ3Blcm1lc3NhZ2UtZGVmbGF0ZScpLmNvbmZpZ3VyZShcbiAgICAgIHdlYnNvY2tldENvbXByZXNzaW9uQ29uZmlnXG4gICAgKSk7XG4gIH1cblxuICByZXR1cm4gZXh0ZW5zaW9ucztcbn0pO1xuXG52YXIgcGF0aFByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfHwgIFwiXCI7XG5cblN0cmVhbVNlcnZlciA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnJlZ2lzdHJhdGlvbl9jYWxsYmFja3MgPSBbXTtcbiAgc2VsZi5vcGVuX3NvY2tldHMgPSBbXTtcblxuICAvLyBCZWNhdXNlIHdlIGFyZSBpbnN0YWxsaW5nIGRpcmVjdGx5IG9udG8gV2ViQXBwLmh0dHBTZXJ2ZXIgaW5zdGVhZCBvZiB1c2luZ1xuICAvLyBXZWJBcHAuYXBwLCB3ZSBoYXZlIHRvIHByb2Nlc3MgdGhlIHBhdGggcHJlZml4IG91cnNlbHZlcy5cbiAgc2VsZi5wcmVmaXggPSBwYXRoUHJlZml4ICsgJy9zb2NranMnO1xuICBSb3V0ZVBvbGljeS5kZWNsYXJlKHNlbGYucHJlZml4ICsgJy8nLCAnbmV0d29yaycpO1xuXG4gIC8vIHNldCB1cCBzb2NranNcbiAgdmFyIHNvY2tqcyA9IE5wbS5yZXF1aXJlKCdzb2NranMnKTtcbiAgdmFyIHNlcnZlck9wdGlvbnMgPSB7XG4gICAgcHJlZml4OiBzZWxmLnByZWZpeCxcbiAgICBsb2c6IGZ1bmN0aW9uKCkge30sXG4gICAgLy8gdGhpcyBpcyB0aGUgZGVmYXVsdCwgYnV0IHdlIGNvZGUgaXQgZXhwbGljaXRseSBiZWNhdXNlIHdlIGRlcGVuZFxuICAgIC8vIG9uIGl0IGluIHN0cmVhbV9jbGllbnQ6SEVBUlRCRUFUX1RJTUVPVVRcbiAgICBoZWFydGJlYXRfZGVsYXk6IDQ1MDAwLFxuICAgIC8vIFRoZSBkZWZhdWx0IGRpc2Nvbm5lY3RfZGVsYXkgaXMgNSBzZWNvbmRzLCBidXQgaWYgdGhlIHNlcnZlciBlbmRzIHVwIENQVVxuICAgIC8vIGJvdW5kIGZvciB0aGF0IG11Y2ggdGltZSwgU29ja0pTIG1pZ2h0IG5vdCBub3RpY2UgdGhhdCB0aGUgdXNlciBoYXNcbiAgICAvLyByZWNvbm5lY3RlZCBiZWNhdXNlIHRoZSB0aW1lciAob2YgZGlzY29ubmVjdF9kZWxheSBtcykgY2FuIGZpcmUgYmVmb3JlXG4gICAgLy8gU29ja0pTIHByb2Nlc3NlcyB0aGUgbmV3IGNvbm5lY3Rpb24uIEV2ZW50dWFsbHkgd2UnbGwgZml4IHRoaXMgYnkgbm90XG4gICAgLy8gY29tYmluaW5nIENQVS1oZWF2eSBwcm9jZXNzaW5nIHdpdGggU29ja0pTIHRlcm1pbmF0aW9uIChlZyBhIHByb3h5IHdoaWNoXG4gICAgLy8gY29udmVydHMgdG8gVW5peCBzb2NrZXRzKSBidXQgZm9yIG5vdywgcmFpc2UgdGhlIGRlbGF5LlxuICAgIGRpc2Nvbm5lY3RfZGVsYXk6IDYwICogMTAwMCxcbiAgICAvLyBTZXQgdGhlIFVTRV9KU0VTU0lPTklEIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGVuYWJsZSBzZXR0aW5nIHRoZVxuICAgIC8vIEpTRVNTSU9OSUQgY29va2llLiBUaGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB1cCBwcm94aWVzIHdpdGhcbiAgICAvLyBzZXNzaW9uIGFmZmluaXR5LlxuICAgIGpzZXNzaW9uaWQ6ICEhcHJvY2Vzcy5lbnYuVVNFX0pTRVNTSU9OSURcbiAgfTtcblxuICAvLyBJZiB5b3Uga25vdyB5b3VyIHNlcnZlciBlbnZpcm9ubWVudCAoZWcsIHByb3hpZXMpIHdpbGwgcHJldmVudCB3ZWJzb2NrZXRzXG4gIC8vIGZyb20gZXZlciB3b3JraW5nLCBzZXQgJERJU0FCTEVfV0VCU09DS0VUUyBhbmQgU29ja0pTIGNsaWVudHMgKGllLFxuICAvLyBicm93c2Vycykgd2lsbCBub3Qgd2FzdGUgdGltZSBhdHRlbXB0aW5nIHRvIHVzZSB0aGVtLlxuICAvLyAoWW91ciBzZXJ2ZXIgd2lsbCBzdGlsbCBoYXZlIGEgL3dlYnNvY2tldCBlbmRwb2ludC4pXG4gIGlmIChwcm9jZXNzLmVudi5ESVNBQkxFX1dFQlNPQ0tFVFMpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLndlYnNvY2tldCA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHNlcnZlck9wdGlvbnMuZmF5ZV9zZXJ2ZXJfb3B0aW9ucyA9IHtcbiAgICAgIGV4dGVuc2lvbnM6IHdlYnNvY2tldEV4dGVuc2lvbnMoKVxuICAgIH07XG4gIH1cblxuICBzZWxmLnNlcnZlciA9IHNvY2tqcy5jcmVhdGVTZXJ2ZXIoc2VydmVyT3B0aW9ucyk7XG5cbiAgLy8gSW5zdGFsbCB0aGUgc29ja2pzIGhhbmRsZXJzLCBidXQgd2Ugd2FudCB0byBrZWVwIGFyb3VuZCBvdXIgb3duIHBhcnRpY3VsYXJcbiAgLy8gcmVxdWVzdCBoYW5kbGVyIHRoYXQgYWRqdXN0cyBpZGxlIHRpbWVvdXRzIHdoaWxlIHdlIGhhdmUgYW4gb3V0c3RhbmRpbmdcbiAgLy8gcmVxdWVzdC4gIFRoaXMgY29tcGVuc2F0ZXMgZm9yIHRoZSBmYWN0IHRoYXQgc29ja2pzIHJlbW92ZXMgYWxsIGxpc3RlbmVyc1xuICAvLyBmb3IgXCJyZXF1ZXN0XCIgdG8gYWRkIGl0cyBvd24uXG4gIFdlYkFwcC5odHRwU2VydmVyLnJlbW92ZUxpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG4gIHNlbGYuc2VydmVyLmluc3RhbGxIYW5kbGVycyhXZWJBcHAuaHR0cFNlcnZlcik7XG4gIFdlYkFwcC5odHRwU2VydmVyLmFkZExpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gU3VwcG9ydCB0aGUgL3dlYnNvY2tldCBlbmRwb2ludFxuICBzZWxmLl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50KCk7XG5cbiAgc2VsZi5zZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCBmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2pzIHNvbWV0aW1lcyBwYXNzZXMgdXMgbnVsbCBpbnN0ZWFkIG9mIGEgc29ja2V0IG9iamVjdFxuICAgIC8vIHNvIHdlIG5lZWQgdG8gZ3VhcmQgYWdhaW5zdCB0aGF0LiBzZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3NvY2tqcy9zb2NranMtbm9kZS9pc3N1ZXMvMTIxXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDY4XG4gICAgaWYgKCFzb2NrZXQpIHJldHVybjtcblxuICAgIC8vIFdlIHdhbnQgdG8gbWFrZSBzdXJlIHRoYXQgaWYgYSBjbGllbnQgY29ubmVjdHMgdG8gdXMgYW5kIGRvZXMgdGhlIGluaXRpYWxcbiAgICAvLyBXZWJzb2NrZXQgaGFuZHNoYWtlIGJ1dCBuZXZlciBnZXRzIHRvIHRoZSBERFAgaGFuZHNoYWtlLCB0aGF0IHdlXG4gICAgLy8gZXZlbnR1YWxseSBraWxsIHRoZSBzb2NrZXQuICBPbmNlIHRoZSBERFAgaGFuZHNoYWtlIGhhcHBlbnMsIEREUFxuICAgIC8vIGhlYXJ0YmVhdGluZyB3aWxsIHdvcmsuIEFuZCBiZWZvcmUgdGhlIFdlYnNvY2tldCBoYW5kc2hha2UsIHRoZSB0aW1lb3V0c1xuICAgIC8vIHdlIHNldCBhdCB0aGUgc2VydmVyIGxldmVsIGluIHdlYmFwcF9zZXJ2ZXIuanMgd2lsbCB3b3JrLiBCdXRcbiAgICAvLyBmYXllLXdlYnNvY2tldCBjYWxscyBzZXRUaW1lb3V0KDApIG9uIGFueSBzb2NrZXQgaXQgdGFrZXMgb3Zlciwgc28gdGhlcmVcbiAgICAvLyBpcyBhbiBcImluIGJldHdlZW5cIiBzdGF0ZSB3aGVyZSB0aGlzIGRvZXNuJ3QgaGFwcGVuLiAgV2Ugd29yayBhcm91bmQgdGhpc1xuICAgIC8vIGJ5IGV4cGxpY2l0bHkgc2V0dGluZyB0aGUgc29ja2V0IHRpbWVvdXQgdG8gYSByZWxhdGl2ZWx5IGxhcmdlIHRpbWUgaGVyZSxcbiAgICAvLyBhbmQgc2V0dGluZyBpdCBiYWNrIHRvIHplcm8gd2hlbiB3ZSBzZXQgdXAgdGhlIGhlYXJ0YmVhdCBpblxuICAgIC8vIGxpdmVkYXRhX3NlcnZlci5qcy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG4gICAgICBpZiAoKHNvY2tldC5wcm90b2NvbCA9PT0gJ3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgc29ja2V0LnByb3RvY29sID09PSAnd2Vic29ja2V0LXJhdycpXG4gICAgICAgICAgJiYgc29ja2V0Ll9zZXNzaW9uLnJlY3YpIHtcbiAgICAgICAgc29ja2V0Ll9zZXNzaW9uLnJlY3YuY29ubmVjdGlvbi5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgfVxuICAgIH07XG4gICAgc29ja2V0LnNldFdlYnNvY2tldFRpbWVvdXQoNDUgKiAxMDAwKTtcblxuICAgIHNvY2tldC5zZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHNvY2tldC53cml0ZShkYXRhKTtcbiAgICB9O1xuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLm9wZW5fc29ja2V0cyA9IF8ud2l0aG91dChzZWxmLm9wZW5fc29ja2V0cywgc29ja2V0KTtcbiAgICB9KTtcbiAgICBzZWxmLm9wZW5fc29ja2V0cy5wdXNoKHNvY2tldCk7XG5cbiAgICAvLyBvbmx5IHRvIHNlbmQgYSBtZXNzYWdlIGFmdGVyIGNvbm5lY3Rpb24gb24gdGVzdHMsIHVzZWZ1bCBmb3JcbiAgICAvLyBzb2NrZXQtc3RyZWFtLWNsaWVudC9zZXJ2ZXItdGVzdHMuanNcbiAgICBpZiAocHJvY2Vzcy5lbnYuVEVTVF9NRVRBREFUQSAmJiBwcm9jZXNzLmVudi5URVNUX01FVEFEQVRBICE9PSBcInt9XCIpIHtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsgdGVzdE1lc3NhZ2VPbkNvbm5lY3Q6IHRydWUgfSkpO1xuICAgIH1cblxuICAgIC8vIGNhbGwgYWxsIG91ciBjYWxsYmFja3Mgd2hlbiB3ZSBnZXQgYSBuZXcgc29ja2V0LiB0aGV5IHdpbGwgZG8gdGhlXG4gICAgLy8gd29yayBvZiBzZXR0aW5nIHVwIGhhbmRsZXJzIGFuZCBzdWNoIGZvciBzcGVjaWZpYyBtZXNzYWdlcy5cbiAgICBfLmVhY2goc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfSk7XG4gIH0pO1xuXG59O1xuXG5PYmplY3QuYXNzaWduKFN0cmVhbVNlcnZlci5wcm90b3R5cGUsIHtcbiAgLy8gY2FsbCBteSBjYWxsYmFjayB3aGVuIGEgbmV3IHNvY2tldCBjb25uZWN0cy5cbiAgLy8gYWxzbyBjYWxsIGl0IGZvciBhbGwgY3VycmVudCBjb25uZWN0aW9ucy5cbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnJlZ2lzdHJhdGlvbl9jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgXy5lYWNoKHNlbGYuYWxsX3NvY2tldHMoKSwgZnVuY3Rpb24gKHNvY2tldCkge1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBnZXQgYSBsaXN0IG9mIGFsbCBzb2NrZXRzXG4gIGFsbF9zb2NrZXRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBfLnZhbHVlcyhzZWxmLm9wZW5fc29ja2V0cyk7XG4gIH0sXG5cbiAgLy8gUmVkaXJlY3QgL3dlYnNvY2tldCB0byAvc29ja2pzL3dlYnNvY2tldCBpbiBvcmRlciB0byBub3QgZXhwb3NlXG4gIC8vIHNvY2tqcyB0byBjbGllbnRzIHRoYXQgd2FudCB0byB1c2UgcmF3IHdlYnNvY2tldHNcbiAgX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHVzZSBhIGNvbm5lY3QgbWlkZGxld2FyZSBoZXJlIHNpbmNlXG4gICAgLy8gc29ja2pzIGluc3RhbGxzIGl0c2VsZiBwcmlvciB0byBhbGwgZXhpc3RpbmcgbGlzdGVuZXJzXG4gICAgLy8gKG1lYW5pbmcgcHJpb3IgdG8gYW55IGNvbm5lY3QgbWlkZGxld2FyZXMpIHNvIHdlIG5lZWQgdG8gdGFrZVxuICAgIC8vIGFuIGFwcHJvYWNoIHNpbWlsYXIgdG8gb3ZlcnNoYWRvd0xpc3RlbmVycyBpblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NranMvc29ja2pzLW5vZGUvYmxvYi9jZjgyMGM1NWFmNmE5OTUzZTE2NTU4NTU1YTMxZGVjZWE1NTRmNzBlL3NyYy91dGlscy5jb2ZmZWVcbiAgICBbJ3JlcXVlc3QnLCAndXBncmFkZSddLmZvckVhY2goKGV2ZW50KSA9PiB7XG4gICAgICB2YXIgaHR0cFNlcnZlciA9IFdlYkFwcC5odHRwU2VydmVyO1xuICAgICAgdmFyIG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMgPSBodHRwU2VydmVyLmxpc3RlbmVycyhldmVudCkuc2xpY2UoMCk7XG4gICAgICBodHRwU2VydmVyLnJlbW92ZUFsbExpc3RlbmVycyhldmVudCk7XG5cbiAgICAgIC8vIHJlcXVlc3QgYW5kIHVwZ3JhZGUgaGF2ZSBkaWZmZXJlbnQgYXJndW1lbnRzIHBhc3NlZCBidXRcbiAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIHdoaWNoIGlzIGFsd2F5cyByZXF1ZXN0XG4gICAgICB2YXIgbmV3TGlzdGVuZXIgPSBmdW5jdGlvbihyZXF1ZXN0IC8qLCBtb3JlQXJndW1lbnRzICovKSB7XG4gICAgICAgIC8vIFN0b3JlIGFyZ3VtZW50cyBmb3IgdXNlIHdpdGhpbiB0aGUgY2xvc3VyZSBiZWxvd1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICAvLyBUT0RPIHJlcGxhY2Ugd2l0aCB1cmwgcGFja2FnZVxuICAgICAgICB2YXIgdXJsID0gTnBtLnJlcXVpcmUoJ3VybCcpO1xuXG4gICAgICAgIC8vIFJld3JpdGUgL3dlYnNvY2tldCBhbmQgL3dlYnNvY2tldC8gdXJscyB0byAvc29ja2pzL3dlYnNvY2tldCB3aGlsZVxuICAgICAgICAvLyBwcmVzZXJ2aW5nIHF1ZXJ5IHN0cmluZy5cbiAgICAgICAgdmFyIHBhcnNlZFVybCA9IHVybC5wYXJzZShyZXF1ZXN0LnVybCk7XG4gICAgICAgIGlmIChwYXJzZWRVcmwucGF0aG5hbWUgPT09IHBhdGhQcmVmaXggKyAnL3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgIHBhcnNlZFVybC5wYXRobmFtZSA9PT0gcGF0aFByZWZpeCArICcvd2Vic29ja2V0LycpIHtcbiAgICAgICAgICBwYXJzZWRVcmwucGF0aG5hbWUgPSBzZWxmLnByZWZpeCArICcvd2Vic29ja2V0JztcbiAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybC5mb3JtYXQocGFyc2VkVXJsKTtcbiAgICAgICAgfVxuICAgICAgICBfLmVhY2gob2xkSHR0cFNlcnZlckxpc3RlbmVycywgZnVuY3Rpb24ob2xkTGlzdGVuZXIpIHtcbiAgICAgICAgICBvbGRMaXN0ZW5lci5hcHBseShodHRwU2VydmVyLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaHR0cFNlcnZlci5hZGRMaXN0ZW5lcihldmVudCwgbmV3TGlzdGVuZXIpO1xuICAgIH0pO1xuICB9XG59KTtcbiIsIkREUFNlcnZlciA9IHt9O1xuXG4vLyBQdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGRlZmluZSBob3cgd2UgaGFuZGxlIGRhdGEgZnJvbSBwdWJsaXNoZWQgY3Vyc29ycyBhdCB0aGUgY29sbGVjdGlvbiBsZXZlbFxuLy8gVGhpcyBhbGxvd3Mgc29tZW9uZSB0bzpcbi8vIC0gQ2hvb3NlIGEgdHJhZGUtb2ZmIGJldHdlZW4gY2xpZW50LXNlcnZlciBiYW5kd2lkdGggYW5kIHNlcnZlciBtZW1vcnkgdXNhZ2Vcbi8vIC0gSW1wbGVtZW50IHNwZWNpYWwgKG5vbi1tb25nbykgY29sbGVjdGlvbnMgbGlrZSB2b2xhdGlsZSBtZXNzYWdlIHF1ZXVlc1xuY29uc3QgcHVibGljYXRpb25TdHJhdGVnaWVzID0ge1xuICAvLyBTRVJWRVJfTUVSR0UgaXMgdGhlIGRlZmF1bHQgc3RyYXRlZ3kuXG4gIC8vIFdoZW4gdXNpbmcgdGhpcyBzdHJhdGVneSwgdGhlIHNlcnZlciBtYWludGFpbnMgYSBjb3B5IG9mIGFsbCBkYXRhIGEgY29ubmVjdGlvbiBpcyBzdWJzY3JpYmVkIHRvLlxuICAvLyBUaGlzIGFsbG93cyB1cyB0byBvbmx5IHNlbmQgZGVsdGFzIG92ZXIgbXVsdGlwbGUgcHVibGljYXRpb25zLlxuICBTRVJWRVJfTUVSR0U6IHtcbiAgICB1c2VDb2xsZWN0aW9uVmlldzogdHJ1ZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiB0cnVlLFxuICB9LFxuICAvLyBUaGUgTk9fTUVSR0VfTk9fSElTVE9SWSBzdHJhdGVneSByZXN1bHRzIGluIHRoZSBzZXJ2ZXIgc2VuZGluZyBhbGwgcHVibGljYXRpb24gZGF0YVxuICAvLyBkaXJlY3RseSB0byB0aGUgY2xpZW50LiBJdCBkb2VzIG5vdCByZW1lbWJlciB3aGF0IGl0IGhhcyBwcmV2aW91c2x5IHNlbnRcbiAgLy8gdG8gaXQgd2lsbCBub3QgdHJpZ2dlciByZW1vdmVkIG1lc3NhZ2VzIHdoZW4gYSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZC5cbiAgLy8gVGhpcyBzaG91bGQgb25seSBiZSBjaG9zZW4gZm9yIHNwZWNpYWwgdXNlIGNhc2VzIGxpa2Ugc2VuZC1hbmQtZm9yZ2V0IHF1ZXVlcy5cbiAgTk9fTUVSR0VfTk9fSElTVE9SWToge1xuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiBmYWxzZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiBmYWxzZSxcbiAgfSxcbiAgLy8gTk9fTUVSR0UgaXMgc2ltaWxhciB0byBOT19NRVJHRV9OT19ISVNUT1JZIGJ1dCB0aGUgc2VydmVyIHdpbGwgcmVtZW1iZXIgdGhlIElEcyBpdCBoYXNcbiAgLy8gc2VudCB0byB0aGUgY2xpZW50IHNvIGl0IGNhbiByZW1vdmUgdGhlbSB3aGVuIGEgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gIC8vIFRoaXMgc3RyYXRlZ3kgY2FuIGJlIHVzZWQgd2hlbiBhIGNvbGxlY3Rpb24gaXMgb25seSB1c2VkIGluIGEgc2luZ2xlIHB1YmxpY2F0aW9uLlxuICBOT19NRVJHRToge1xuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiBmYWxzZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiB0cnVlLFxuICB9XG59O1xuXG5ERFBTZXJ2ZXIucHVibGljYXRpb25TdHJhdGVnaWVzID0gcHVibGljYXRpb25TdHJhdGVnaWVzO1xuXG4vLyBUaGlzIGZpbGUgY29udGFpbnMgY2xhc3Nlczpcbi8vICogU2Vzc2lvbiAtIFRoZSBzZXJ2ZXIncyBjb25uZWN0aW9uIHRvIGEgc2luZ2xlIEREUCBjbGllbnRcbi8vICogU3Vic2NyaXB0aW9uIC0gQSBzaW5nbGUgc3Vic2NyaXB0aW9uIGZvciBhIHNpbmdsZSBjbGllbnRcbi8vICogU2VydmVyIC0gQW4gZW50aXJlIHNlcnZlciB0aGF0IG1heSB0YWxrIHRvID4gMSBjbGllbnQuIEEgRERQIGVuZHBvaW50LlxuLy9cbi8vIFNlc3Npb24gYW5kIFN1YnNjcmlwdGlvbiBhcmUgZmlsZSBzY29wZS4gRm9yIG5vdywgdW50aWwgd2UgZnJlZXplXG4vLyB0aGUgaW50ZXJmYWNlLCBTZXJ2ZXIgaXMgcGFja2FnZSBzY29wZSAoaW4gdGhlIGZ1dHVyZSBpdCBzaG91bGQgYmVcbi8vIGV4cG9ydGVkKS5cblxuLy8gUmVwcmVzZW50cyBhIHNpbmdsZSBkb2N1bWVudCBpbiBhIFNlc3Npb25Db2xsZWN0aW9uVmlld1xudmFyIFNlc3Npb25Eb2N1bWVudFZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5leGlzdHNJbiA9IG5ldyBTZXQoKTsgLy8gc2V0IG9mIHN1YnNjcmlwdGlvbkhhbmRsZVxuICBzZWxmLmRhdGFCeUtleSA9IG5ldyBNYXAoKTsgLy8ga2V5LT4gWyB7c3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZX0gYnkgcHJlY2VkZW5jZV1cbn07XG5cbkREUFNlcnZlci5fU2Vzc2lvbkRvY3VtZW50VmlldyA9IFNlc3Npb25Eb2N1bWVudFZpZXc7XG5cbkREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlID0gZnVuY3Rpb24gKCkge1xuICBsZXQgY3VycmVudEludm9jYXRpb24gPSB0aGlzLl9DdXJyZW50V3JpdGVGZW5jZS5nZXQoKTtcbiAgaWYgKGN1cnJlbnRJbnZvY2F0aW9uKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uO1xuICB9XG4gIGN1cnJlbnRJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uID8gY3VycmVudEludm9jYXRpb24uZmVuY2UgOiB1bmRlZmluZWQ7XG59O1xuXG5fLmV4dGVuZChTZXNzaW9uRG9jdW1lbnRWaWV3LnByb3RvdHlwZSwge1xuXG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0ge307XG4gICAgc2VsZi5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgcmV0W2tleV0gPSBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFB1Ymxpc2ggQVBJIGlnbm9yZXMgX2lkIGlmIHByZXNlbnQgaW4gZmllbGRzXG4gICAgaWYgKGtleSA9PT0gXCJfaWRcIilcbiAgICAgIHJldHVybjtcbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcblxuICAgIC8vIEl0J3Mgb2theSB0byBjbGVhciBmaWVsZHMgdGhhdCBkaWRuJ3QgZXhpc3QuIE5vIG5lZWQgdG8gdGhyb3dcbiAgICAvLyBhbiBlcnJvci5cbiAgICBpZiAoIXByZWNlZGVuY2VMaXN0KVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJlbW92ZWRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWNlZGVuY2VMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcHJlY2VkZW5jZSA9IHByZWNlZGVuY2VMaXN0W2ldO1xuICAgICAgaWYgKHByZWNlZGVuY2Uuc3Vic2NyaXB0aW9uSGFuZGxlID09PSBzdWJzY3JpcHRpb25IYW5kbGUpIHtcbiAgICAgICAgLy8gVGhlIHZpZXcncyB2YWx1ZSBjYW4gb25seSBjaGFuZ2UgaWYgdGhpcyBzdWJzY3JpcHRpb24gaXMgdGhlIG9uZSB0aGF0XG4gICAgICAgIC8vIHVzZWQgdG8gaGF2ZSBwcmVjZWRlbmNlLlxuICAgICAgICBpZiAoaSA9PT0gMClcbiAgICAgICAgICByZW1vdmVkVmFsdWUgPSBwcmVjZWRlbmNlLnZhbHVlO1xuICAgICAgICBwcmVjZWRlbmNlTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlY2VkZW5jZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5kZWxldGUoa2V5KTtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAocmVtb3ZlZFZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICFFSlNPTi5lcXVhbHMocmVtb3ZlZFZhbHVlLCBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZSkpIHtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gcHJlY2VkZW5jZUxpc3RbMF0udmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIGNoYW5nZUZpZWxkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZUNvbGxlY3RvciwgaXNBZGQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHVibGlzaCBBUEkgaWdub3JlcyBfaWQgaWYgcHJlc2VudCBpbiBmaWVsZHNcbiAgICBpZiAoa2V5ID09PSBcIl9pZFwiKVxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gRG9uJ3Qgc2hhcmUgc3RhdGUgd2l0aCB0aGUgZGF0YSBwYXNzZWQgaW4gYnkgdGhlIHVzZXIuXG4gICAgdmFsdWUgPSBFSlNPTi5jbG9uZSh2YWx1ZSk7XG5cbiAgICBpZiAoIXNlbGYuZGF0YUJ5S2V5LmhhcyhrZXkpKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5zZXQoa2V5LCBbe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWV9XSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcbiAgICB2YXIgZWx0O1xuICAgIGlmICghaXNBZGQpIHtcbiAgICAgIGVsdCA9IHByZWNlZGVuY2VMaXN0LmZpbmQoZnVuY3Rpb24gKHByZWNlZGVuY2UpIHtcbiAgICAgICAgICByZXR1cm4gcHJlY2VkZW5jZS5zdWJzY3JpcHRpb25IYW5kbGUgPT09IHN1YnNjcmlwdGlvbkhhbmRsZTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChlbHQpIHtcbiAgICAgIGlmIChlbHQgPT09IHByZWNlZGVuY2VMaXN0WzBdICYmICFFSlNPTi5lcXVhbHModmFsdWUsIGVsdC52YWx1ZSkpIHtcbiAgICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgY2hhbmdpbmcgdGhlIHZhbHVlIG9mIHRoaXMgZmllbGQuXG4gICAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBlbHQudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgbmV3bHkgY2FyaW5nIGFib3V0IHRoaXMgZmllbGRcbiAgICAgIHByZWNlZGVuY2VMaXN0LnB1c2goe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZTogdmFsdWV9KTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNsaWVudCdzIHZpZXcgb2YgYSBzaW5nbGUgY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lIE5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gaXQgcmVwcmVzZW50c1xuICogQHBhcmFtIHtPYmplY3QuPFN0cmluZywgRnVuY3Rpb24+fSBzZXNzaW9uQ2FsbGJhY2tzIFRoZSBjYWxsYmFja3MgZm9yIGFkZGVkLCBjaGFuZ2VkLCByZW1vdmVkXG4gKiBAY2xhc3MgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3XG4gKi9cbnZhciBTZXNzaW9uQ29sbGVjdGlvblZpZXcgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlc3Npb25DYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gIHNlbGYuZG9jdW1lbnRzID0gbmV3IE1hcCgpO1xuICBzZWxmLmNhbGxiYWNrcyA9IHNlc3Npb25DYWxsYmFja3M7XG59O1xuXG5ERFBTZXJ2ZXIuX1Nlc3Npb25Db2xsZWN0aW9uVmlldyA9IFNlc3Npb25Db2xsZWN0aW9uVmlldztcblxuXG5PYmplY3QuYXNzaWduKFNlc3Npb25Db2xsZWN0aW9uVmlldy5wcm90b3R5cGUsIHtcblxuICBpc0VtcHR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLmRvY3VtZW50cy5zaXplID09PSAwO1xuICB9LFxuXG4gIGRpZmY6IGZ1bmN0aW9uIChwcmV2aW91cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMocHJldmlvdXMuZG9jdW1lbnRzLCBzZWxmLmRvY3VtZW50cywge1xuICAgICAgYm90aDogXy5iaW5kKHNlbGYuZGlmZkRvY3VtZW50LCBzZWxmKSxcblxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoaWQsIG5vd0RWKSB7XG4gICAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBub3dEVi5nZXRGaWVsZHMoKSk7XG4gICAgICB9LFxuXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGlkLCBwcmV2RFYpIHtcbiAgICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgZGlmZkRvY3VtZW50OiBmdW5jdGlvbiAoaWQsIHByZXZEViwgbm93RFYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGZpZWxkcyA9IHt9O1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmT2JqZWN0cyhwcmV2RFYuZ2V0RmllbGRzKCksIG5vd0RWLmdldEZpZWxkcygpLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoa2V5LCBwcmV2LCBub3cpIHtcbiAgICAgICAgaWYgKCFFSlNPTi5lcXVhbHMocHJldiwgbm93KSlcbiAgICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChrZXksIG5vdykge1xuICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24oa2V5LCBwcmV2KSB7XG4gICAgICAgIGZpZWxkc1trZXldID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgYWRkZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIHZhciBhZGRlZCA9IGZhbHNlO1xuICAgIGlmICghZG9jVmlldykge1xuICAgICAgYWRkZWQgPSB0cnVlO1xuICAgICAgZG9jVmlldyA9IG5ldyBTZXNzaW9uRG9jdW1lbnRWaWV3KCk7XG4gICAgICBzZWxmLmRvY3VtZW50cy5zZXQoaWQsIGRvY1ZpZXcpO1xuICAgIH1cbiAgICBkb2NWaWV3LmV4aXN0c0luLmFkZChzdWJzY3JpcHRpb25IYW5kbGUpO1xuICAgIHZhciBjaGFuZ2VDb2xsZWN0b3IgPSB7fTtcbiAgICBfLmVhY2goZmllbGRzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgZG9jVmlldy5jaGFuZ2VGaWVsZChcbiAgICAgICAgc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLCBjaGFuZ2VDb2xsZWN0b3IsIHRydWUpO1xuICAgIH0pO1xuICAgIGlmIChhZGRlZClcbiAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VDb2xsZWN0b3IpO1xuICAgIGVsc2VcbiAgICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZUNvbGxlY3Rvcik7XG4gIH0sXG5cbiAgY2hhbmdlZDogZnVuY3Rpb24gKHN1YnNjcmlwdGlvbkhhbmRsZSwgaWQsIGNoYW5nZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGNoYW5nZWRSZXN1bHQgPSB7fTtcbiAgICB2YXIgZG9jVmlldyA9IHNlbGYuZG9jdW1lbnRzLmdldChpZCk7XG4gICAgaWYgKCFkb2NWaWV3KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGZpbmQgZWxlbWVudCB3aXRoIGlkIFwiICsgaWQgKyBcIiB0byBjaGFuZ2VcIik7XG4gICAgXy5lYWNoKGNoYW5nZWQsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZClcbiAgICAgICAgZG9jVmlldy5jbGVhckZpZWxkKHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCBjaGFuZ2VkUmVzdWx0KTtcbiAgICAgIGVsc2VcbiAgICAgICAgZG9jVmlldy5jaGFuZ2VGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgdmFsdWUsIGNoYW5nZWRSZXN1bHQpO1xuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZWRSZXN1bHQpO1xuICB9LFxuXG4gIHJlbW92ZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkb2NWaWV3ID0gc2VsZi5kb2N1bWVudHMuZ2V0KGlkKTtcbiAgICBpZiAoIWRvY1ZpZXcpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoXCJSZW1vdmVkIG5vbmV4aXN0ZW50IGRvY3VtZW50IFwiICsgaWQpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBkb2NWaWV3LmV4aXN0c0luLmRlbGV0ZShzdWJzY3JpcHRpb25IYW5kbGUpO1xuICAgIGlmIChkb2NWaWV3LmV4aXN0c0luLnNpemUgPT09IDApIHtcbiAgICAgIC8vIGl0IGlzIGdvbmUgZnJvbSBldmVyeW9uZVxuICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICBzZWxmLmRvY3VtZW50cy5kZWxldGUoaWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgICAgLy8gcmVtb3ZlIHRoaXMgc3Vic2NyaXB0aW9uIGZyb20gZXZlcnkgcHJlY2VkZW5jZSBsaXN0XG4gICAgICAvLyBhbmQgcmVjb3JkIHRoZSBjaGFuZ2VzXG4gICAgICBkb2NWaWV3LmRhdGFCeUtleS5mb3JFYWNoKGZ1bmN0aW9uIChwcmVjZWRlbmNlTGlzdCwga2V5KSB7XG4gICAgICAgIGRvY1ZpZXcuY2xlYXJGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlZCk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5jYWxsYmFja3MuY2hhbmdlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlZCk7XG4gICAgfVxuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFNlc3Npb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG52YXIgU2Vzc2lvbiA9IGZ1bmN0aW9uIChzZXJ2ZXIsIHZlcnNpb24sIHNvY2tldCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuaWQgPSBSYW5kb20uaWQoKTtcblxuICBzZWxmLnNlcnZlciA9IHNlcnZlcjtcbiAgc2VsZi52ZXJzaW9uID0gdmVyc2lvbjtcblxuICBzZWxmLmluaXRpYWxpemVkID0gZmFsc2U7XG4gIHNlbGYuc29ja2V0ID0gc29ja2V0O1xuXG4gIC8vIFNldCB0byBudWxsIHdoZW4gdGhlIHNlc3Npb24gaXMgZGVzdHJveWVkLiBNdWx0aXBsZSBwbGFjZXMgYmVsb3dcbiAgLy8gdXNlIHRoaXMgdG8gZGV0ZXJtaW5lIGlmIHRoZSBzZXNzaW9uIGlzIGFsaXZlIG9yIG5vdC5cbiAgc2VsZi5pblF1ZXVlID0gbmV3IE1ldGVvci5fRG91YmxlRW5kZWRRdWV1ZSgpO1xuXG4gIHNlbGYuYmxvY2tlZCA9IGZhbHNlO1xuICBzZWxmLndvcmtlclJ1bm5pbmcgPSBmYWxzZTtcblxuICBzZWxmLmNhY2hlZFVuYmxvY2sgPSBudWxsO1xuXG4gIC8vIFN1YiBvYmplY3RzIGZvciBhY3RpdmUgc3Vic2NyaXB0aW9uc1xuICBzZWxmLl9uYW1lZFN1YnMgPSBuZXcgTWFwKCk7XG4gIHNlbGYuX3VuaXZlcnNhbFN1YnMgPSBbXTtcblxuICBzZWxmLnVzZXJJZCA9IG51bGw7XG5cbiAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG5cbiAgLy8gU2V0IHRoaXMgdG8gZmFsc2UgdG8gbm90IHNlbmQgbWVzc2FnZXMgd2hlbiBjb2xsZWN0aW9uVmlld3MgYXJlXG4gIC8vIG1vZGlmaWVkLiBUaGlzIGlzIGRvbmUgd2hlbiByZXJ1bm5pbmcgc3VicyBpbiBfc2V0VXNlcklkIGFuZCB0aG9zZSBtZXNzYWdlc1xuICAvLyBhcmUgY2FsY3VsYXRlZCB2aWEgYSBkaWZmIGluc3RlYWQuXG4gIHNlbGYuX2lzU2VuZGluZyA9IHRydWU7XG5cbiAgLy8gSWYgdGhpcyBpcyB0cnVlLCBkb24ndCBzdGFydCBhIG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHB1Ymxpc2hlciBvbiB0aGlzXG4gIC8vIHNlc3Npb24uIFRoZSBzZXNzaW9uIHdpbGwgdGFrZSBjYXJlIG9mIHN0YXJ0aW5nIGl0IHdoZW4gYXBwcm9wcmlhdGUuXG4gIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSBmYWxzZTtcblxuICAvLyBXaGVuIHdlIGFyZSByZXJ1bm5pbmcgc3Vic2NyaXB0aW9ucywgYW55IHJlYWR5IG1lc3NhZ2VzXG4gIC8vIHdlIHdhbnQgdG8gYnVmZmVyIHVwIGZvciB3aGVuIHdlIGFyZSBkb25lIHJlcnVubmluZyBzdWJzY3JpcHRpb25zXG4gIHNlbGYuX3BlbmRpbmdSZWFkeSA9IFtdO1xuXG4gIC8vIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiB0aGlzIGNvbm5lY3Rpb24gaXMgY2xvc2VkLlxuICBzZWxmLl9jbG9zZUNhbGxiYWNrcyA9IFtdO1xuXG5cbiAgLy8gWFhYIEhBQ0s6IElmIGEgc29ja2pzIGNvbm5lY3Rpb24sIHNhdmUgb2ZmIHRoZSBVUkwuIFRoaXMgaXNcbiAgLy8gdGVtcG9yYXJ5IGFuZCB3aWxsIGdvIGF3YXkgaW4gdGhlIG5lYXIgZnV0dXJlLlxuICBzZWxmLl9zb2NrZXRVcmwgPSBzb2NrZXQudXJsO1xuXG4gIC8vIEFsbG93IHRlc3RzIHRvIGRpc2FibGUgcmVzcG9uZGluZyB0byBwaW5ncy5cbiAgc2VsZi5fcmVzcG9uZFRvUGluZ3MgPSBvcHRpb25zLnJlc3BvbmRUb1BpbmdzO1xuXG4gIC8vIFRoaXMgb2JqZWN0IGlzIHRoZSBwdWJsaWMgaW50ZXJmYWNlIHRvIHRoZSBzZXNzaW9uLiBJbiB0aGUgcHVibGljXG4gIC8vIEFQSSwgaXQgaXMgY2FsbGVkIHRoZSBgY29ubmVjdGlvbmAgb2JqZWN0LiAgSW50ZXJuYWxseSB3ZSBjYWxsIGl0XG4gIC8vIGEgYGNvbm5lY3Rpb25IYW5kbGVgIHRvIGF2b2lkIGFtYmlndWl0eS5cbiAgc2VsZi5jb25uZWN0aW9uSGFuZGxlID0ge1xuICAgIGlkOiBzZWxmLmlkLFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLmNsb3NlKCk7XG4gICAgfSxcbiAgICBvbkNsb3NlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHZhciBjYiA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZm4sIFwiY29ubmVjdGlvbiBvbkNsb3NlIGNhbGxiYWNrXCIpO1xuICAgICAgaWYgKHNlbGYuaW5RdWV1ZSkge1xuICAgICAgICBzZWxmLl9jbG9zZUNhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIHdlJ3JlIGFscmVhZHkgY2xvc2VkLCBjYWxsIHRoZSBjYWxsYmFjay5cbiAgICAgICAgTWV0ZW9yLmRlZmVyKGNiKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuX2NsaWVudEFkZHJlc3MoKSxcbiAgICBodHRwSGVhZGVyczogc2VsZi5zb2NrZXQuaGVhZGVyc1xuICB9O1xuXG4gIHNlbGYuc2VuZCh7IG1zZzogJ2Nvbm5lY3RlZCcsIHNlc3Npb246IHNlbGYuaWQgfSk7XG5cbiAgLy8gT24gaW5pdGlhbCBjb25uZWN0LCBzcGluIHVwIGFsbCB0aGUgdW5pdmVyc2FsIHB1Ymxpc2hlcnMuXG4gIHNlbGYuc3RhcnRVbml2ZXJzYWxTdWJzKCk7XG5cbiAgaWYgKHZlcnNpb24gIT09ICdwcmUxJyAmJiBvcHRpb25zLmhlYXJ0YmVhdEludGVydmFsICE9PSAwKSB7XG4gICAgLy8gV2Ugbm8gbG9uZ2VyIG5lZWQgdGhlIGxvdyBsZXZlbCB0aW1lb3V0IGJlY2F1c2Ugd2UgaGF2ZSBoZWFydGJlYXRzLlxuICAgIHNvY2tldC5zZXRXZWJzb2NrZXRUaW1lb3V0KDApO1xuXG4gICAgc2VsZi5oZWFydGJlYXQgPSBuZXcgRERQQ29tbW9uLkhlYXJ0YmVhdCh7XG4gICAgICBoZWFydGJlYXRJbnRlcnZhbDogb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IG9wdGlvbnMuaGVhcnRiZWF0VGltZW91dCxcbiAgICAgIG9uVGltZW91dDogZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNsb3NlKCk7XG4gICAgICB9LFxuICAgICAgc2VuZFBpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5zZW5kKHttc2c6ICdwaW5nJ30pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuaGVhcnRiZWF0LnN0YXJ0KCk7XG4gIH1cblxuICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgXCJsaXZlZGF0YVwiLCBcInNlc3Npb25zXCIsIDEpO1xufTtcblxuT2JqZWN0LmFzc2lnbihTZXNzaW9uLnByb3RvdHlwZSwge1xuICBfY2hlY2tQdWJsaXNoUHJvbWlzZUJlZm9yZVNlbmQoZikge1xuICAgIGlmICghdGhpcy5fcHVibGlzaEN1cnNvclByb21pc2UpIHtcbiAgICAgIGYoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fcHVibGlzaEN1cnNvclByb21pc2UuZmluYWxseSgoKSA9PiBmKCkpO1xuICB9LFxuICBzZW5kUmVhZHk6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25JZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzU2VuZGluZykge1xuICAgICAgc2VsZi5zZW5kKHttc2c6IFwicmVhZHlcIiwgc3Viczogc3Vic2NyaXB0aW9uSWRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIF8uZWFjaChzdWJzY3JpcHRpb25JZHMsIGZ1bmN0aW9uIChzdWJzY3JpcHRpb25JZCkge1xuICAgICAgICBzZWxmLl9wZW5kaW5nUmVhZHkucHVzaChzdWJzY3JpcHRpb25JZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5faXNTZW5kaW5nIHx8ICF0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldztcbiAgfSxcblxuXG4gIHNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgdGhpcy5zZW5kKHsgbXNnOiAnYWRkZWQnLCBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyB9KTtcbiAgICB9XG4gIH0sXG5cbiAgc2VuZENoYW5nZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAoXy5pc0VtcHR5KGZpZWxkcykpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAodGhpcy5fY2FuU2VuZChjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgIHRoaXMuc2VuZCh7XG4gICAgICAgIG1zZzogXCJjaGFuZ2VkXCIsXG4gICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBpZCxcbiAgICAgICAgZmllbGRzXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgc2VuZFJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIGlkKSB7XG4gICAgaWYgKHRoaXMuX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICB0aGlzLnNlbmQoe21zZzogXCJyZW1vdmVkXCIsIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLCBpZH0pO1xuICAgIH1cbiAgfSxcblxuICBnZXRTZW5kQ2FsbGJhY2tzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogXy5iaW5kKHNlbGYuc2VuZEFkZGVkLCBzZWxmKSxcbiAgICAgIGNoYW5nZWQ6IF8uYmluZChzZWxmLnNlbmRDaGFuZ2VkLCBzZWxmKSxcbiAgICAgIHJlbW92ZWQ6IF8uYmluZChzZWxmLnNlbmRSZW1vdmVkLCBzZWxmKVxuICAgIH07XG4gIH0sXG5cbiAgZ2V0Q29sbGVjdGlvblZpZXc6IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0gc2VsZi5jb2xsZWN0aW9uVmlld3MuZ2V0KGNvbGxlY3Rpb25OYW1lKTtcbiAgICBpZiAoIXJldCkge1xuICAgICAgcmV0ID0gbmV3IFNlc3Npb25Db2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmdldFNlbmRDYWxsYmFja3MoKSk7XG4gICAgICBzZWxmLmNvbGxlY3Rpb25WaWV3cy5zZXQoY29sbGVjdGlvbk5hbWUsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgYWRkZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldykge1xuICAgICAgY29uc3QgdmlldyA9IHRoaXMuZ2V0Q29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgdmlldy5hZGRlZChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gICAgfVxuICB9LFxuXG4gIHJlbW92ZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcucmVtb3ZlZChzdWJzY3JpcHRpb25IYW5kbGUsIGlkKTtcbiAgICAgIGlmICh2aWV3LmlzRW1wdHkoKSkge1xuICAgICAgICAgdGhpcy5jb2xsZWN0aW9uVmlld3MuZGVsZXRlKGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kUmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgIH1cbiAgfSxcblxuICBjaGFuZ2VkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcuY2hhbmdlZChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbmRDaGFuZ2VkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgICB9XG4gIH0sXG5cbiAgc3RhcnRVbml2ZXJzYWxTdWJzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNvcHkgb2YgdGhlIHNldCBvZiB1bml2ZXJzYWwgaGFuZGxlcnMgYW5kIHN0YXJ0IHRoZW0uIElmXG4gICAgLy8gYWRkaXRpb25hbCB1bml2ZXJzYWwgcHVibGlzaGVycyBzdGFydCB3aGlsZSB3ZSdyZSBydW5uaW5nIHRoZW0gKGR1ZSB0b1xuICAgIC8vIHlpZWxkaW5nKSwgdGhleSB3aWxsIHJ1biBzZXBhcmF0ZWx5IGFzIHBhcnQgb2YgU2VydmVyLnB1Ymxpc2guXG4gICAgdmFyIGhhbmRsZXJzID0gXy5jbG9uZShzZWxmLnNlcnZlci51bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVycyk7XG4gICAgXy5lYWNoKGhhbmRsZXJzLCBmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgc2VsZi5fc3RhcnRTdWJzY3JpcHRpb24oaGFuZGxlcik7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gRGVzdHJveSB0aGlzIHNlc3Npb24gYW5kIHVucmVnaXN0ZXIgaXQgYXQgdGhlIHNlcnZlci5cbiAgY2xvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBEZXN0cm95IHRoaXMgc2Vzc2lvbiwgZXZlbiBpZiBpdCdzIG5vdCByZWdpc3RlcmVkIGF0IHRoZVxuICAgIC8vIHNlcnZlci4gU3RvcCBhbGwgcHJvY2Vzc2luZyBhbmQgdGVhciBldmVyeXRoaW5nIGRvd24uIElmIGEgc29ja2V0XG4gICAgLy8gd2FzIGF0dGFjaGVkLCBjbG9zZSBpdC5cblxuICAgIC8vIEFscmVhZHkgZGVzdHJveWVkLlxuICAgIGlmICghIHNlbGYuaW5RdWV1ZSlcbiAgICAgIHJldHVybjtcblxuICAgIC8vIERyb3AgdGhlIG1lcmdlIGJveCBkYXRhIGltbWVkaWF0ZWx5LlxuICAgIHNlbGYuaW5RdWV1ZSA9IG51bGw7XG4gICAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG5cbiAgICBpZiAoc2VsZi5oZWFydGJlYXQpIHtcbiAgICAgIHNlbGYuaGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgIHNlbGYuaGVhcnRiZWF0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5zb2NrZXQpIHtcbiAgICAgIHNlbGYuc29ja2V0LmNsb3NlKCk7XG4gICAgICBzZWxmLnNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG51bGw7XG4gICAgfVxuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInNlc3Npb25zXCIsIC0xKTtcblxuICAgIE1ldGVvci5kZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBTdG9wIGNhbGxiYWNrcyBjYW4geWllbGQsIHNvIHdlIGRlZmVyIHRoaXMgb24gY2xvc2UuXG4gICAgICAvLyBzdWIuX2lzRGVhY3RpdmF0ZWQoKSBkZXRlY3RzIHRoYXQgd2Ugc2V0IGluUXVldWUgdG8gbnVsbCBhbmRcbiAgICAgIC8vIHRyZWF0cyBpdCBhcyBzZW1pLWRlYWN0aXZhdGVkIChpdCB3aWxsIGlnbm9yZSBpbmNvbWluZyBjYWxsYmFja3MsIGV0YykuXG4gICAgICBzZWxmLl9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9ucygpO1xuXG4gICAgICAvLyBEZWZlciBjYWxsaW5nIHRoZSBjbG9zZSBjYWxsYmFja3MsIHNvIHRoYXQgdGhlIGNhbGxlciBjbG9zaW5nXG4gICAgICAvLyB0aGUgc2Vzc2lvbiBpc24ndCB3YWl0aW5nIGZvciBhbGwgdGhlIGNhbGxiYWNrcyB0byBjb21wbGV0ZS5cbiAgICAgIF8uZWFjaChzZWxmLl9jbG9zZUNhbGxiYWNrcywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFVucmVnaXN0ZXIgdGhlIHNlc3Npb24uXG4gICAgc2VsZi5zZXJ2ZXIuX3JlbW92ZVNlc3Npb24oc2VsZik7XG4gIH0sXG5cbiAgLy8gU2VuZCBhIG1lc3NhZ2UgKGRvaW5nIG5vdGhpbmcgaWYgbm8gc29ja2V0IGlzIGNvbm5lY3RlZCByaWdodCBub3cpLlxuICAvLyBJdCBzaG91bGQgYmUgYSBKU09OIG9iamVjdCAoaXQgd2lsbCBiZSBzdHJpbmdpZmllZCkuXG4gIHNlbmQ6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9jaGVja1B1Ymxpc2hQcm9taXNlQmVmb3JlU2VuZCgoKSA9PiB7XG4gICAgICBpZiAoc2VsZi5zb2NrZXQpIHtcbiAgICAgICAgaWYgKE1ldGVvci5fcHJpbnRTZW50RERQKVxuICAgICAgICAgIE1ldGVvci5fZGVidWcoJ1NlbnQgRERQJywgRERQQ29tbW9uLnN0cmluZ2lmeUREUChtc2cpKTtcbiAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNlbmQgYSBjb25uZWN0aW9uIGVycm9yLlxuICBzZW5kRXJyb3I6IGZ1bmN0aW9uIChyZWFzb24sIG9mZmVuZGluZ01lc3NhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG1zZyA9IHttc2c6ICdlcnJvcicsIHJlYXNvbjogcmVhc29ufTtcbiAgICBpZiAob2ZmZW5kaW5nTWVzc2FnZSlcbiAgICAgIG1zZy5vZmZlbmRpbmdNZXNzYWdlID0gb2ZmZW5kaW5nTWVzc2FnZTtcbiAgICBzZWxmLnNlbmQobXNnKTtcbiAgfSxcblxuICAvLyBQcm9jZXNzICdtc2cnIGFzIGFuIGluY29taW5nIG1lc3NhZ2UuIEFzIGEgZ3VhcmQgYWdhaW5zdFxuICAvLyByYWNlIGNvbmRpdGlvbnMgZHVyaW5nIHJlY29ubmVjdGlvbiwgaWdub3JlIHRoZSBtZXNzYWdlIGlmXG4gIC8vICdzb2NrZXQnIGlzIG5vdCB0aGUgY3VycmVudGx5IGNvbm5lY3RlZCBzb2NrZXQuXG4gIC8vXG4gIC8vIFdlIHJ1biB0aGUgbWVzc2FnZXMgZnJvbSB0aGUgY2xpZW50IG9uZSBhdCBhIHRpbWUsIGluIHRoZSBvcmRlclxuICAvLyBnaXZlbiBieSB0aGUgY2xpZW50LiBUaGUgbWVzc2FnZSBoYW5kbGVyIGlzIHBhc3NlZCBhbiBpZGVtcG90ZW50XG4gIC8vIGZ1bmN0aW9uICd1bmJsb2NrJyB3aGljaCBpdCBtYXkgY2FsbCB0byBhbGxvdyBvdGhlciBtZXNzYWdlcyB0b1xuICAvLyBiZWdpbiBydW5uaW5nIGluIHBhcmFsbGVsIGluIGFub3RoZXIgZmliZXIgKGZvciBleGFtcGxlLCBhIG1ldGhvZFxuICAvLyB0aGF0IHdhbnRzIHRvIHlpZWxkKS4gT3RoZXJ3aXNlLCBpdCBpcyBhdXRvbWF0aWNhbGx5IHVuYmxvY2tlZFxuICAvLyB3aGVuIGl0IHJldHVybnMuXG4gIC8vXG4gIC8vIEFjdHVhbGx5LCB3ZSBkb24ndCBoYXZlIHRvICd0b3RhbGx5IG9yZGVyJyB0aGUgbWVzc2FnZXMgaW4gdGhpc1xuICAvLyB3YXksIGJ1dCBpdCdzIHRoZSBlYXNpZXN0IHRoaW5nIHRoYXQncyBjb3JyZWN0LiAodW5zdWIgbmVlZHMgdG9cbiAgLy8gYmUgb3JkZXJlZCBhZ2FpbnN0IHN1YiwgbWV0aG9kcyBuZWVkIHRvIGJlIG9yZGVyZWQgYWdhaW5zdCBlYWNoXG4gIC8vIG90aGVyKS5cbiAgcHJvY2Vzc01lc3NhZ2U6IGZ1bmN0aW9uIChtc2dfaW4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLmluUXVldWUpIC8vIHdlIGhhdmUgYmVlbiBkZXN0cm95ZWQuXG4gICAgICByZXR1cm47XG5cbiAgICAvLyBSZXNwb25kIHRvIHBpbmcgYW5kIHBvbmcgbWVzc2FnZXMgaW1tZWRpYXRlbHkgd2l0aG91dCBxdWV1aW5nLlxuICAgIC8vIElmIHRoZSBuZWdvdGlhdGVkIEREUCB2ZXJzaW9uIGlzIFwicHJlMVwiIHdoaWNoIGRpZG4ndCBzdXBwb3J0XG4gICAgLy8gcGluZ3MsIHByZXNlcnZlIHRoZSBcInByZTFcIiBiZWhhdmlvciBvZiByZXNwb25kaW5nIHdpdGggYSBcImJhZFxuICAgIC8vIHJlcXVlc3RcIiBmb3IgdGhlIHVua25vd24gbWVzc2FnZXMuXG4gICAgLy9cbiAgICAvLyBGaWJlcnMgYXJlIG5lZWRlZCBiZWNhdXNlIGhlYXJ0YmVhdHMgdXNlIE1ldGVvci5zZXRUaW1lb3V0LCB3aGljaFxuICAgIC8vIG5lZWRzIGEgRmliZXIuIFdlIGNvdWxkIGFjdHVhbGx5IHVzZSByZWd1bGFyIHNldFRpbWVvdXQgYW5kIGF2b2lkXG4gICAgLy8gdGhlc2UgbmV3IGZpYmVycywgYnV0IGl0IGlzIGVhc2llciB0byBqdXN0IG1ha2UgZXZlcnl0aGluZyB1c2VcbiAgICAvLyBNZXRlb3Iuc2V0VGltZW91dCBhbmQgbm90IHRoaW5rIHRvbyBoYXJkLlxuICAgIC8vXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIGNsaWVudCBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAoc2VsZi5oZWFydGJlYXQpIHtcbiAgICAgIHNlbGYuaGVhcnRiZWF0Lm1lc3NhZ2VSZWNlaXZlZCgpO1xuICAgIH07XG5cbiAgICBpZiAoc2VsZi52ZXJzaW9uICE9PSAncHJlMScgJiYgbXNnX2luLm1zZyA9PT0gJ3BpbmcnKSB7XG4gICAgICBpZiAoc2VsZi5fcmVzcG9uZFRvUGluZ3MpXG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiBcInBvbmdcIiwgaWQ6IG1zZ19pbi5pZH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc2VsZi52ZXJzaW9uICE9PSAncHJlMScgJiYgbXNnX2luLm1zZyA9PT0gJ3BvbmcnKSB7XG4gICAgICAvLyBTaW5jZSBldmVyeXRoaW5nIGlzIGEgcG9uZywgdGhlcmUgaXMgbm90aGluZyB0byBkb1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuaW5RdWV1ZS5wdXNoKG1zZ19pbik7XG4gICAgaWYgKHNlbGYud29ya2VyUnVubmluZylcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLndvcmtlclJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIHByb2Nlc3NOZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG1zZyA9IHNlbGYuaW5RdWV1ZSAmJiBzZWxmLmluUXVldWUuc2hpZnQoKTtcbiAgICAgIGlmICghbXNnKSB7XG4gICAgICAgIHNlbGYud29ya2VyUnVubmluZyA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHJ1bkhhbmRsZXJzKCkge1xuICAgICAgICB2YXIgYmxvY2tlZCA9IHRydWU7XG5cbiAgICAgICAgdmFyIHVuYmxvY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKCFibG9ja2VkKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBpZGVtcG90ZW50XG4gICAgICAgICAgYmxvY2tlZCA9IGZhbHNlO1xuICAgICAgICAgIHByb2Nlc3NOZXh0KCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5zZXJ2ZXIub25NZXNzYWdlSG9vay5lYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgIGNhbGxiYWNrKG1zZywgc2VsZik7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChfLmhhcyhzZWxmLnByb3RvY29sX2hhbmRsZXJzLCBtc2cubXNnKSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHNlbGYucHJvdG9jb2xfaGFuZGxlcnNbbXNnLm1zZ10uY2FsbChcbiAgICAgICAgICAgIHNlbGYsXG4gICAgICAgICAgICBtc2csXG4gICAgICAgICAgICB1bmJsb2NrXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICAgICAgcmVzdWx0LmZpbmFsbHkoKCkgPT4gdW5ibG9jaygpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5ibG9jaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxmLnNlbmRFcnJvcignQmFkIHJlcXVlc3QnLCBtc2cpO1xuICAgICAgICAgIHVuYmxvY2soKTsgLy8gaW4gY2FzZSB0aGUgaGFuZGxlciBkaWRuJ3QgYWxyZWFkeSBkbyBpdFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJ1bkhhbmRsZXJzKCk7XG4gICAgfTtcblxuICAgIHByb2Nlc3NOZXh0KCk7XG4gIH0sXG5cbiAgcHJvdG9jb2xfaGFuZGxlcnM6IHtcbiAgICBzdWI6IGZ1bmN0aW9uIChtc2csIHVuYmxvY2spIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgLy8gY2FjaGVVbmJsb2NrIHRlbXBvcmFybHksIHNvIHdlIGNhbiBjYXB0dXJlIGl0IGxhdGVyXG4gICAgICAvLyB3ZSB3aWxsIHVzZSB1bmJsb2NrIGluIGN1cnJlbnQgZXZlbnRMb29wLCBzbyB0aGlzIGlzIHNhZmVcbiAgICAgIHNlbGYuY2FjaGVkVW5ibG9jayA9IHVuYmxvY2s7XG5cbiAgICAgIC8vIHJlamVjdCBtYWxmb3JtZWQgbWVzc2FnZXNcbiAgICAgIGlmICh0eXBlb2YgKG1zZy5pZCkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICB0eXBlb2YgKG1zZy5uYW1lKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgICgoJ3BhcmFtcycgaW4gbXNnKSAmJiAhKG1zZy5wYXJhbXMgaW5zdGFuY2VvZiBBcnJheSkpKSB7XG4gICAgICAgIHNlbGYuc2VuZEVycm9yKFwiTWFsZm9ybWVkIHN1YnNjcmlwdGlvblwiLCBtc2cpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghc2VsZi5zZXJ2ZXIucHVibGlzaF9oYW5kbGVyc1ttc2cubmFtZV0pIHtcbiAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICBtc2c6ICdub3N1YicsIGlkOiBtc2cuaWQsXG4gICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDA0LCBgU3Vic2NyaXB0aW9uICcke21zZy5uYW1lfScgbm90IGZvdW5kYCl9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fbmFtZWRTdWJzLmhhcyhtc2cuaWQpKVxuICAgICAgICAvLyBzdWJzIGFyZSBpZGVtcG90ZW50LCBvciByYXRoZXIsIHRoZXkgYXJlIGlnbm9yZWQgaWYgYSBzdWJcbiAgICAgICAgLy8gd2l0aCB0aGF0IGlkIGFscmVhZHkgZXhpc3RzLiB0aGlzIGlzIGltcG9ydGFudCBkdXJpbmdcbiAgICAgICAgLy8gcmVjb25uZWN0LlxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIFhYWCBJdCdkIGJlIG11Y2ggYmV0dGVyIGlmIHdlIGhhZCBnZW5lcmljIGhvb2tzIHdoZXJlIGFueSBwYWNrYWdlIGNhblxuICAgICAgLy8gaG9vayBpbnRvIHN1YnNjcmlwdGlvbiBoYW5kbGluZywgYnV0IGluIHRoZSBtZWFuIHdoaWxlIHdlIHNwZWNpYWwgY2FzZVxuICAgICAgLy8gZGRwLXJhdGUtbGltaXRlciBwYWNrYWdlLiBUaGlzIGlzIGFsc28gZG9uZSBmb3Igd2VhayByZXF1aXJlbWVudHMgdG9cbiAgICAgIC8vIGFkZCB0aGUgZGRwLXJhdGUtbGltaXRlciBwYWNrYWdlIGluIGNhc2Ugd2UgZG9uJ3QgaGF2ZSBBY2NvdW50cy4gQVxuICAgICAgLy8gdXNlciB0cnlpbmcgdG8gdXNlIHRoZSBkZHAtcmF0ZS1saW1pdGVyIG11c3QgZXhwbGljaXRseSByZXF1aXJlIGl0LlxuICAgICAgaWYgKFBhY2thZ2VbJ2RkcC1yYXRlLWxpbWl0ZXInXSkge1xuICAgICAgICB2YXIgRERQUmF0ZUxpbWl0ZXIgPSBQYWNrYWdlWydkZHAtcmF0ZS1saW1pdGVyJ10uRERQUmF0ZUxpbWl0ZXI7XG4gICAgICAgIHZhciByYXRlTGltaXRlcklucHV0ID0ge1xuICAgICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQsXG4gICAgICAgICAgY2xpZW50QWRkcmVzczogc2VsZi5jb25uZWN0aW9uSGFuZGxlLmNsaWVudEFkZHJlc3MsXG4gICAgICAgICAgdHlwZTogXCJzdWJzY3JpcHRpb25cIixcbiAgICAgICAgICBuYW1lOiBtc2cubmFtZSxcbiAgICAgICAgICBjb25uZWN0aW9uSWQ6IHNlbGYuaWRcbiAgICAgICAgfTtcblxuICAgICAgICBERFBSYXRlTGltaXRlci5faW5jcmVtZW50KHJhdGVMaW1pdGVySW5wdXQpO1xuICAgICAgICB2YXIgcmF0ZUxpbWl0UmVzdWx0ID0gRERQUmF0ZUxpbWl0ZXIuX2NoZWNrKHJhdGVMaW1pdGVySW5wdXQpO1xuICAgICAgICBpZiAoIXJhdGVMaW1pdFJlc3VsdC5hbGxvd2VkKSB7XG4gICAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICAgIG1zZzogJ25vc3ViJywgaWQ6IG1zZy5pZCxcbiAgICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICAndG9vLW1hbnktcmVxdWVzdHMnLFxuICAgICAgICAgICAgICBERFBSYXRlTGltaXRlci5nZXRFcnJvck1lc3NhZ2UocmF0ZUxpbWl0UmVzdWx0KSxcbiAgICAgICAgICAgICAge3RpbWVUb1Jlc2V0OiByYXRlTGltaXRSZXN1bHQudGltZVRvUmVzZXR9KVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgaGFuZGxlciA9IHNlbGYuc2VydmVyLnB1Ymxpc2hfaGFuZGxlcnNbbXNnLm5hbWVdO1xuXG4gICAgICBzZWxmLl9zdGFydFN1YnNjcmlwdGlvbihoYW5kbGVyLCBtc2cuaWQsIG1zZy5wYXJhbXMsIG1zZy5uYW1lKTtcblxuICAgICAgLy8gY2xlYW5pbmcgY2FjaGVkIHVuYmxvY2tcbiAgICAgIHNlbGYuY2FjaGVkVW5ibG9jayA9IG51bGw7XG4gICAgfSxcblxuICAgIHVuc3ViOiBmdW5jdGlvbiAobXNnKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgIHNlbGYuX3N0b3BTdWJzY3JpcHRpb24obXNnLmlkKTtcbiAgICB9LFxuXG4gICAgbWV0aG9kOiBhc3luYyBmdW5jdGlvbiAobXNnLCB1bmJsb2NrKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgIC8vIFJlamVjdCBtYWxmb3JtZWQgbWVzc2FnZXMuXG4gICAgICAvLyBGb3Igbm93LCB3ZSBzaWxlbnRseSBpZ25vcmUgdW5rbm93biBhdHRyaWJ1dGVzLFxuICAgICAgLy8gZm9yIGZvcndhcmRzIGNvbXBhdGliaWxpdHkuXG4gICAgICBpZiAodHlwZW9mIChtc2cuaWQpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgdHlwZW9mIChtc2cubWV0aG9kKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgICgoJ3BhcmFtcycgaW4gbXNnKSAmJiAhKG1zZy5wYXJhbXMgaW5zdGFuY2VvZiBBcnJheSkpIHx8XG4gICAgICAgICAgKCgncmFuZG9tU2VlZCcgaW4gbXNnKSAmJiAodHlwZW9mIG1zZy5yYW5kb21TZWVkICE9PSBcInN0cmluZ1wiKSkpIHtcbiAgICAgICAgc2VsZi5zZW5kRXJyb3IoXCJNYWxmb3JtZWQgbWV0aG9kIGludm9jYXRpb25cIiwgbXNnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgcmFuZG9tU2VlZCA9IG1zZy5yYW5kb21TZWVkIHx8IG51bGw7XG5cbiAgICAgIC8vIFNldCB1cCB0byBtYXJrIHRoZSBtZXRob2QgYXMgc2F0aXNmaWVkIG9uY2UgYWxsIG9ic2VydmVyc1xuICAgICAgLy8gKGFuZCBzdWJzY3JpcHRpb25zKSBoYXZlIHJlYWN0ZWQgdG8gYW55IHdyaXRlcyB0aGF0IHdlcmVcbiAgICAgIC8vIGRvbmUuXG4gICAgICB2YXIgZmVuY2UgPSBuZXcgRERQU2VydmVyLl9Xcml0ZUZlbmNlO1xuICAgICAgZmVuY2Uub25BbGxDb21taXR0ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBSZXRpcmUgdGhlIGZlbmNlIHNvIHRoYXQgZnV0dXJlIHdyaXRlcyBhcmUgYWxsb3dlZC5cbiAgICAgICAgLy8gVGhpcyBtZWFucyB0aGF0IGNhbGxiYWNrcyBsaWtlIHRpbWVycyBhcmUgZnJlZSB0byB1c2VcbiAgICAgICAgLy8gdGhlIGZlbmNlLCBhbmQgaWYgdGhleSBmaXJlIGJlZm9yZSBpdCdzIGFybWVkIChmb3JcbiAgICAgICAgLy8gZXhhbXBsZSwgYmVjYXVzZSB0aGUgbWV0aG9kIHdhaXRzIGZvciB0aGVtKSB0aGVpclxuICAgICAgICAvLyB3cml0ZXMgd2lsbCBiZSBpbmNsdWRlZCBpbiB0aGUgZmVuY2UuXG4gICAgICAgIGZlbmNlLnJldGlyZSgpO1xuICAgICAgICBzZWxmLnNlbmQoe21zZzogJ3VwZGF0ZWQnLCBtZXRob2RzOiBbbXNnLmlkXX0pO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmQgdGhlIGhhbmRsZXJcbiAgICAgIHZhciBoYW5kbGVyID0gc2VsZi5zZXJ2ZXIubWV0aG9kX2hhbmRsZXJzW21zZy5tZXRob2RdO1xuICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgIHNlbGYuc2VuZCh7XG4gICAgICAgICAgbXNnOiAncmVzdWx0JywgaWQ6IG1zZy5pZCxcbiAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDQsIGBNZXRob2QgJyR7bXNnLm1ldGhvZH0nIG5vdCBmb3VuZGApfSk7XG4gICAgICAgIGF3YWl0IGZlbmNlLmFybSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBzZXRVc2VySWQgPSBmdW5jdGlvbih1c2VySWQpIHtcbiAgICAgICAgc2VsZi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICB9O1xuXG4gICAgICB2YXIgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICAgIGlzU2ltdWxhdGlvbjogZmFsc2UsXG4gICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQsXG4gICAgICAgIHNldFVzZXJJZDogc2V0VXNlcklkLFxuICAgICAgICB1bmJsb2NrOiB1bmJsb2NrLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLmNvbm5lY3Rpb25IYW5kbGUsXG4gICAgICAgIHJhbmRvbVNlZWQ6IHJhbmRvbVNlZWQsXG4gICAgICAgIGZlbmNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFhYWCBJdCdkIGJlIGJldHRlciBpZiB3ZSBjb3VsZCBob29rIGludG8gbWV0aG9kIGhhbmRsZXJzIGJldHRlciBidXRcbiAgICAgICAgLy8gZm9yIG5vdywgd2UgbmVlZCB0byBjaGVjayBpZiB0aGUgZGRwLXJhdGUtbGltaXRlciBleGlzdHMgc2luY2Ugd2VcbiAgICAgICAgLy8gaGF2ZSBhIHdlYWsgcmVxdWlyZW1lbnQgZm9yIHRoZSBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UgdG8gYmUgYWRkZWRcbiAgICAgICAgLy8gdG8gb3VyIGFwcGxpY2F0aW9uLlxuICAgICAgICBpZiAoUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddKSB7XG4gICAgICAgICAgdmFyIEREUFJhdGVMaW1pdGVyID0gUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddLkREUFJhdGVMaW1pdGVyO1xuICAgICAgICAgIHZhciByYXRlTGltaXRlcklucHV0ID0ge1xuICAgICAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuY29ubmVjdGlvbkhhbmRsZS5jbGllbnRBZGRyZXNzLFxuICAgICAgICAgICAgdHlwZTogXCJtZXRob2RcIixcbiAgICAgICAgICAgIG5hbWU6IG1zZy5tZXRob2QsXG4gICAgICAgICAgICBjb25uZWN0aW9uSWQ6IHNlbGYuaWRcbiAgICAgICAgICB9O1xuICAgICAgICAgIEREUFJhdGVMaW1pdGVyLl9pbmNyZW1lbnQocmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgICAgdmFyIHJhdGVMaW1pdFJlc3VsdCA9IEREUFJhdGVMaW1pdGVyLl9jaGVjayhyYXRlTGltaXRlcklucHV0KVxuICAgICAgICAgIGlmICghcmF0ZUxpbWl0UmVzdWx0LmFsbG93ZWQpIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICBcInRvby1tYW55LXJlcXVlc3RzXCIsXG4gICAgICAgICAgICAgIEREUFJhdGVMaW1pdGVyLmdldEVycm9yTWVzc2FnZShyYXRlTGltaXRSZXN1bHQpLFxuICAgICAgICAgICAgICB7dGltZVRvUmVzZXQ6IHJhdGVMaW1pdFJlc3VsdC50aW1lVG9SZXNldH1cbiAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0ID0gKCkgPT5cbiAgICAgICAgICBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZShcbiAgICAgICAgICAgIGludm9jYXRpb24sXG4gICAgICAgICAgICAoKSA9PlxuICAgICAgICAgICAgICBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICAgICAgaGFuZGxlcixcbiAgICAgICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgICAgIG1zZy5wYXJhbXMsXG4gICAgICAgICAgICAgICAgXCJjYWxsIHRvICdcIiArIG1zZy5tZXRob2QgKyBcIidcIlxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnZ2V0Q3VycmVudE1ldGhvZEludm9jYXRpb25SZXN1bHQnLFxuICAgICAgICAgICAgICBrZXlOYW1lOiAnZ2V0Q3VycmVudE1ldGhvZEludm9jYXRpb25SZXN1bHQnLFxuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZS53aXRoVmFsdWUoXG4gICAgICAgICAgICBmZW5jZSxcbiAgICAgICAgICAgIGdldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZScsXG4gICAgICAgICAgICAgIGtleU5hbWU6ICdfQ3VycmVudFdyaXRlRmVuY2UnLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBhc3luYyBmdW5jdGlvbiBmaW5pc2goKSB7XG4gICAgICAgIGF3YWl0IGZlbmNlLmFybSgpO1xuICAgICAgICB1bmJsb2NrKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgIG1zZzogXCJyZXN1bHRcIixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfTtcbiAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgYXdhaXQgZmluaXNoKCk7XG4gICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBheWxvYWQucmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuc2VuZChwYXlsb2FkKTtcbiAgICAgIH0sIGFzeW5jIChleGNlcHRpb24pID0+IHtcbiAgICAgICAgYXdhaXQgZmluaXNoKCk7XG4gICAgICAgIHBheWxvYWQuZXJyb3IgPSB3cmFwSW50ZXJuYWxFeGNlcHRpb24oXG4gICAgICAgICAgZXhjZXB0aW9uLFxuICAgICAgICAgIGB3aGlsZSBpbnZva2luZyBtZXRob2QgJyR7bXNnLm1ldGhvZH0nYFxuICAgICAgICApO1xuICAgICAgICBzZWxmLnNlbmQocGF5bG9hZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgX2VhY2hTdWI6IGZ1bmN0aW9uIChmKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX25hbWVkU3Vicy5mb3JFYWNoKGYpO1xuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMuZm9yRWFjaChmKTtcbiAgfSxcblxuICBfZGlmZkNvbGxlY3Rpb25WaWV3czogZnVuY3Rpb24gKGJlZm9yZUNWcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMoYmVmb3JlQ1ZzLCBzZWxmLmNvbGxlY3Rpb25WaWV3cywge1xuICAgICAgYm90aDogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBsZWZ0VmFsdWUsIHJpZ2h0VmFsdWUpIHtcbiAgICAgICAgcmlnaHRWYWx1ZS5kaWZmKGxlZnRWYWx1ZSk7XG4gICAgICB9LFxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHJpZ2h0VmFsdWUpIHtcbiAgICAgICAgcmlnaHRWYWx1ZS5kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoZG9jVmlldywgaWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGRvY1ZpZXcuZ2V0RmllbGRzKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBsZWZ0VmFsdWUpIHtcbiAgICAgICAgbGVmdFZhbHVlLmRvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgICAgc2VsZi5zZW5kUmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLyBTZXRzIHRoZSBjdXJyZW50IHVzZXIgaWQgaW4gYWxsIGFwcHJvcHJpYXRlIGNvbnRleHRzIGFuZCByZXJ1bnNcbiAgLy8gYWxsIHN1YnNjcmlwdGlvbnNcbiAgX3NldFVzZXJJZDogZnVuY3Rpb24odXNlcklkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHVzZXJJZCAhPT0gbnVsbCAmJiB0eXBlb2YgdXNlcklkICE9PSBcInN0cmluZ1wiKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwic2V0VXNlcklkIG11c3QgYmUgY2FsbGVkIG9uIHN0cmluZyBvciBudWxsLCBub3QgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiB1c2VySWQpO1xuXG4gICAgLy8gUHJldmVudCBuZXdseS1jcmVhdGVkIHVuaXZlcnNhbCBzdWJzY3JpcHRpb25zIGZyb20gYmVpbmcgYWRkZWQgdG8gb3VyXG4gICAgLy8gc2Vzc2lvbi4gVGhleSB3aWxsIGJlIGZvdW5kIGJlbG93IHdoZW4gd2UgY2FsbCBzdGFydFVuaXZlcnNhbFN1YnMuXG4gICAgLy9cbiAgICAvLyAoV2UgZG9uJ3QgaGF2ZSB0byB3b3JyeSBhYm91dCBuYW1lZCBzdWJzY3JpcHRpb25zLCBiZWNhdXNlIHdlIG9ubHkgYWRkXG4gICAgLy8gdGhlbSB3aGVuIHdlIHByb2Nlc3MgYSAnc3ViJyBtZXNzYWdlLiBXZSBhcmUgY3VycmVudGx5IHByb2Nlc3NpbmcgYVxuICAgIC8vICdtZXRob2QnIG1lc3NhZ2UsIGFuZCB0aGUgbWV0aG9kIGRpZCBub3QgdW5ibG9jaywgYmVjYXVzZSBpdCBpcyBpbGxlZ2FsXG4gICAgLy8gdG8gY2FsbCBzZXRVc2VySWQgYWZ0ZXIgdW5ibG9jay4gVGh1cyB3ZSBjYW5ub3QgYmUgY29uY3VycmVudGx5IGFkZGluZyBhXG4gICAgLy8gbmV3IG5hbWVkIHN1YnNjcmlwdGlvbikuXG4gICAgc2VsZi5fZG9udFN0YXJ0TmV3VW5pdmVyc2FsU3VicyA9IHRydWU7XG5cbiAgICAvLyBQcmV2ZW50IGN1cnJlbnQgc3VicyBmcm9tIHVwZGF0aW5nIG91ciBjb2xsZWN0aW9uVmlld3MgYW5kIGNhbGwgdGhlaXJcbiAgICAvLyBzdG9wIGNhbGxiYWNrcy4gVGhpcyBtYXkgeWllbGQuXG4gICAgc2VsZi5fZWFjaFN1YihmdW5jdGlvbiAoc3ViKSB7XG4gICAgICBzdWIuX2RlYWN0aXZhdGUoKTtcbiAgICB9KTtcblxuICAgIC8vIEFsbCBzdWJzIHNob3VsZCBub3cgYmUgZGVhY3RpdmF0ZWQuIFN0b3Agc2VuZGluZyBtZXNzYWdlcyB0byB0aGUgY2xpZW50LFxuICAgIC8vIHNhdmUgdGhlIHN0YXRlIG9mIHRoZSBwdWJsaXNoZWQgY29sbGVjdGlvbnMsIHJlc2V0IHRvIGFuIGVtcHR5IHZpZXcsIGFuZFxuICAgIC8vIHVwZGF0ZSB0aGUgdXNlcklkLlxuICAgIHNlbGYuX2lzU2VuZGluZyA9IGZhbHNlO1xuICAgIHZhciBiZWZvcmVDVnMgPSBzZWxmLmNvbGxlY3Rpb25WaWV3cztcbiAgICBzZWxmLmNvbGxlY3Rpb25WaWV3cyA9IG5ldyBNYXAoKTtcbiAgICBzZWxmLnVzZXJJZCA9IHVzZXJJZDtcblxuICAgIC8vIF9zZXRVc2VySWQgaXMgbm9ybWFsbHkgY2FsbGVkIGZyb20gYSBNZXRlb3IgbWV0aG9kIHdpdGhcbiAgICAvLyBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIHNldC4gQnV0IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gaXMgbm90XG4gICAgLy8gZXhwZWN0ZWQgdG8gYmUgc2V0IGluc2lkZSBhIHB1Ymxpc2ggZnVuY3Rpb24sIHNvIHdlIHRlbXBvcmFyeSB1bnNldCBpdC5cbiAgICAvLyBJbnNpZGUgYSBwdWJsaXNoIGZ1bmN0aW9uIEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiBpcyBzZXQuXG4gICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUodW5kZWZpbmVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBTYXZlIHRoZSBvbGQgbmFtZWQgc3VicywgYW5kIHJlc2V0IHRvIGhhdmluZyBubyBzdWJzY3JpcHRpb25zLlxuICAgICAgdmFyIG9sZE5hbWVkU3VicyA9IHNlbGYuX25hbWVkU3VicztcbiAgICAgIHNlbGYuX25hbWVkU3VicyA9IG5ldyBNYXAoKTtcbiAgICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMgPSBbXTtcblxuICAgICAgb2xkTmFtZWRTdWJzLmZvckVhY2goZnVuY3Rpb24gKHN1Yiwgc3Vic2NyaXB0aW9uSWQpIHtcbiAgICAgICAgdmFyIG5ld1N1YiA9IHN1Yi5fcmVjcmVhdGUoKTtcbiAgICAgICAgc2VsZi5fbmFtZWRTdWJzLnNldChzdWJzY3JpcHRpb25JZCwgbmV3U3ViKTtcbiAgICAgICAgLy8gbmI6IGlmIHRoZSBoYW5kbGVyIHRocm93cyBvciBjYWxscyB0aGlzLmVycm9yKCksIGl0IHdpbGwgaW4gZmFjdFxuICAgICAgICAvLyBpbW1lZGlhdGVseSBzZW5kIGl0cyAnbm9zdWInLiBUaGlzIGlzIE9LLCB0aG91Z2guXG4gICAgICAgIG5ld1N1Yi5fcnVuSGFuZGxlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFsbG93IG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHN1YnMgdG8gYmUgc3RhcnRlZCBvbiBvdXIgY29ubmVjdGlvbiBpblxuICAgICAgLy8gcGFyYWxsZWwgd2l0aCB0aGUgb25lcyB3ZSdyZSBzcGlubmluZyB1cCBoZXJlLCBhbmQgc3BpbiB1cCB1bml2ZXJzYWxcbiAgICAgIC8vIHN1YnMuXG4gICAgICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gZmFsc2U7XG4gICAgICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuICAgIH0sIHsgbmFtZTogJ19zZXRVc2VySWQnIH0pO1xuXG4gICAgLy8gU3RhcnQgc2VuZGluZyBtZXNzYWdlcyBhZ2FpbiwgYmVnaW5uaW5nIHdpdGggdGhlIGRpZmYgZnJvbSB0aGUgcHJldmlvdXNcbiAgICAvLyBzdGF0ZSBvZiB0aGUgd29ybGQgdG8gdGhlIGN1cnJlbnQgc3RhdGUuIE5vIHlpZWxkcyBhcmUgYWxsb3dlZCBkdXJpbmdcbiAgICAvLyB0aGlzIGRpZmYsIHNvIHRoYXQgb3RoZXIgY2hhbmdlcyBjYW5ub3QgaW50ZXJsZWF2ZS5cbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9pc1NlbmRpbmcgPSB0cnVlO1xuICAgICAgc2VsZi5fZGlmZkNvbGxlY3Rpb25WaWV3cyhiZWZvcmVDVnMpO1xuICAgICAgaWYgKCFfLmlzRW1wdHkoc2VsZi5fcGVuZGluZ1JlYWR5KSkge1xuICAgICAgICBzZWxmLnNlbmRSZWFkeShzZWxmLl9wZW5kaW5nUmVhZHkpO1xuICAgICAgICBzZWxmLl9wZW5kaW5nUmVhZHkgPSBbXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBfc3RhcnRTdWJzY3JpcHRpb246IGZ1bmN0aW9uIChoYW5kbGVyLCBzdWJJZCwgcGFyYW1zLCBuYW1lKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHN1YiA9IG5ldyBTdWJzY3JpcHRpb24oXG4gICAgICBzZWxmLCBoYW5kbGVyLCBzdWJJZCwgcGFyYW1zLCBuYW1lKTtcblxuICAgIGxldCB1bmJsb2NrSGFuZGVyID0gc2VsZi5jYWNoZWRVbmJsb2NrO1xuICAgIC8vIF9zdGFydFN1YnNjcmlwdGlvbiBtYXkgY2FsbCBmcm9tIGEgbG90IHBsYWNlc1xuICAgIC8vIHNvIGNhY2hlZFVuYmxvY2sgbWlnaHQgYmUgbnVsbCBpbiBzb21lY2FzZXNcbiAgICAvLyBhc3NpZ24gdGhlIGNhY2hlZFVuYmxvY2tcbiAgICBzdWIudW5ibG9jayA9IHVuYmxvY2tIYW5kZXIgfHwgKCgpID0+IHt9KTtcblxuICAgIGlmIChzdWJJZClcbiAgICAgIHNlbGYuX25hbWVkU3Vicy5zZXQoc3ViSWQsIHN1Yik7XG4gICAgZWxzZVxuICAgICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5wdXNoKHN1Yik7XG5cbiAgICBzdWIuX3J1bkhhbmRsZXIoKTtcbiAgfSxcblxuICAvLyBUZWFyIGRvd24gc3BlY2lmaWVkIHN1YnNjcmlwdGlvblxuICBfc3RvcFN1YnNjcmlwdGlvbjogZnVuY3Rpb24gKHN1YklkLCBlcnJvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBzdWJOYW1lID0gbnVsbDtcbiAgICBpZiAoc3ViSWQpIHtcbiAgICAgIHZhciBtYXliZVN1YiA9IHNlbGYuX25hbWVkU3Vicy5nZXQoc3ViSWQpO1xuICAgICAgaWYgKG1heWJlU3ViKSB7XG4gICAgICAgIHN1Yk5hbWUgPSBtYXliZVN1Yi5fbmFtZTtcbiAgICAgICAgbWF5YmVTdWIuX3JlbW92ZUFsbERvY3VtZW50cygpO1xuICAgICAgICBtYXliZVN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgICAgICBzZWxmLl9uYW1lZFN1YnMuZGVsZXRlKHN1YklkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcmVzcG9uc2UgPSB7bXNnOiAnbm9zdWInLCBpZDogc3ViSWR9O1xuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICByZXNwb25zZS5lcnJvciA9IHdyYXBJbnRlcm5hbEV4Y2VwdGlvbihcbiAgICAgICAgZXJyb3IsXG4gICAgICAgIHN1Yk5hbWUgPyAoXCJmcm9tIHN1YiBcIiArIHN1Yk5hbWUgKyBcIiBpZCBcIiArIHN1YklkKVxuICAgICAgICAgIDogKFwiZnJvbSBzdWIgaWQgXCIgKyBzdWJJZCkpO1xuICAgIH1cblxuICAgIHNlbGYuc2VuZChyZXNwb25zZSk7XG4gIH0sXG5cbiAgLy8gVGVhciBkb3duIGFsbCBzdWJzY3JpcHRpb25zLiBOb3RlIHRoYXQgdGhpcyBkb2VzIE5PVCBzZW5kIHJlbW92ZWQgb3Igbm9zdWJcbiAgLy8gbWVzc2FnZXMsIHNpbmNlIHdlIGFzc3VtZSB0aGUgY2xpZW50IGlzIGdvbmUuXG4gIF9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9uczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHNlbGYuX25hbWVkU3Vicy5mb3JFYWNoKGZ1bmN0aW9uIChzdWIsIGlkKSB7XG4gICAgICBzdWIuX2RlYWN0aXZhdGUoKTtcbiAgICB9KTtcbiAgICBzZWxmLl9uYW1lZFN1YnMgPSBuZXcgTWFwKCk7XG5cbiAgICBzZWxmLl91bml2ZXJzYWxTdWJzLmZvckVhY2goZnVuY3Rpb24gKHN1Yikge1xuICAgICAgc3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgfSk7XG4gICAgc2VsZi5fdW5pdmVyc2FsU3VicyA9IFtdO1xuICB9LFxuXG4gIC8vIERldGVybWluZSB0aGUgcmVtb3RlIGNsaWVudCdzIElQIGFkZHJlc3MsIGJhc2VkIG9uIHRoZVxuICAvLyBIVFRQX0ZPUldBUkRFRF9DT1VOVCBlbnZpcm9ubWVudCB2YXJpYWJsZSByZXByZXNlbnRpbmcgaG93IG1hbnlcbiAgLy8gcHJveGllcyB0aGUgc2VydmVyIGlzIGJlaGluZC5cbiAgX2NsaWVudEFkZHJlc3M6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBGb3IgdGhlIHJlcG9ydGVkIGNsaWVudCBhZGRyZXNzIGZvciBhIGNvbm5lY3Rpb24gdG8gYmUgY29ycmVjdCxcbiAgICAvLyB0aGUgZGV2ZWxvcGVyIG11c3Qgc2V0IHRoZSBIVFRQX0ZPUldBUkRFRF9DT1VOVCBlbnZpcm9ubWVudFxuICAgIC8vIHZhcmlhYmxlIHRvIGFuIGludGVnZXIgcmVwcmVzZW50aW5nIHRoZSBudW1iZXIgb2YgaG9wcyB0aGV5XG4gICAgLy8gZXhwZWN0IGluIHRoZSBgeC1mb3J3YXJkZWQtZm9yYCBoZWFkZXIuIEUuZy4sIHNldCB0byBcIjFcIiBpZiB0aGVcbiAgICAvLyBzZXJ2ZXIgaXMgYmVoaW5kIG9uZSBwcm94eS5cbiAgICAvL1xuICAgIC8vIFRoaXMgY291bGQgYmUgY29tcHV0ZWQgb25jZSBhdCBzdGFydHVwIGluc3RlYWQgb2YgZXZlcnkgdGltZS5cbiAgICB2YXIgaHR0cEZvcndhcmRlZENvdW50ID0gcGFyc2VJbnQocHJvY2Vzcy5lbnZbJ0hUVFBfRk9SV0FSREVEX0NPVU5UJ10pIHx8IDA7XG5cbiAgICBpZiAoaHR0cEZvcndhcmRlZENvdW50ID09PSAwKVxuICAgICAgcmV0dXJuIHNlbGYuc29ja2V0LnJlbW90ZUFkZHJlc3M7XG5cbiAgICB2YXIgZm9yd2FyZGVkRm9yID0gc2VsZi5zb2NrZXQuaGVhZGVyc1tcIngtZm9yd2FyZGVkLWZvclwiXTtcbiAgICBpZiAoISBfLmlzU3RyaW5nKGZvcndhcmRlZEZvcikpXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBmb3J3YXJkZWRGb3IgPSBmb3J3YXJkZWRGb3IudHJpbSgpLnNwbGl0KC9cXHMqLFxccyovKTtcblxuICAgIC8vIFR5cGljYWxseSB0aGUgZmlyc3QgdmFsdWUgaW4gdGhlIGB4LWZvcndhcmRlZC1mb3JgIGhlYWRlciBpc1xuICAgIC8vIHRoZSBvcmlnaW5hbCBJUCBhZGRyZXNzIG9mIHRoZSBjbGllbnQgY29ubmVjdGluZyB0byB0aGUgZmlyc3RcbiAgICAvLyBwcm94eS4gIEhvd2V2ZXIsIHRoZSBlbmQgdXNlciBjYW4gZWFzaWx5IHNwb29mIHRoZSBoZWFkZXIsIGluXG4gICAgLy8gd2hpY2ggY2FzZSB0aGUgZmlyc3QgdmFsdWUocykgd2lsbCBiZSB0aGUgZmFrZSBJUCBhZGRyZXNzIGZyb21cbiAgICAvLyB0aGUgdXNlciBwcmV0ZW5kaW5nIHRvIGJlIGEgcHJveHkgcmVwb3J0aW5nIHRoZSBvcmlnaW5hbCBJUFxuICAgIC8vIGFkZHJlc3MgdmFsdWUuICBCeSBjb3VudGluZyBIVFRQX0ZPUldBUkRFRF9DT1VOVCBiYWNrIGZyb20gdGhlXG4gICAgLy8gZW5kIG9mIHRoZSBsaXN0LCB3ZSBlbnN1cmUgdGhhdCB3ZSBnZXQgdGhlIElQIGFkZHJlc3MgYmVpbmdcbiAgICAvLyByZXBvcnRlZCBieSAqb3VyKiBmaXJzdCBwcm94eS5cblxuICAgIGlmIChodHRwRm9yd2FyZGVkQ291bnQgPCAwIHx8IGh0dHBGb3J3YXJkZWRDb3VudCA+IGZvcndhcmRlZEZvci5sZW5ndGgpXG4gICAgICByZXR1cm4gbnVsbDtcblxuICAgIHJldHVybiBmb3J3YXJkZWRGb3JbZm9yd2FyZGVkRm9yLmxlbmd0aCAtIGh0dHBGb3J3YXJkZWRDb3VudF07XG4gIH1cbn0pO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLyogU3Vic2NyaXB0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vIEN0b3IgZm9yIGEgc3ViIGhhbmRsZTogdGhlIGlucHV0IHRvIGVhY2ggcHVibGlzaCBmdW5jdGlvblxuXG4vLyBJbnN0YW5jZSBuYW1lIGlzIHRoaXMgYmVjYXVzZSBpdCdzIHVzdWFsbHkgcmVmZXJyZWQgdG8gYXMgdGhpcyBpbnNpZGUgYVxuLy8gcHVibGlzaFxuLyoqXG4gKiBAc3VtbWFyeSBUaGUgc2VydmVyJ3Mgc2lkZSBvZiBhIHN1YnNjcmlwdGlvblxuICogQGNsYXNzIFN1YnNjcmlwdGlvblxuICogQGluc3RhbmNlTmFtZSB0aGlzXG4gKiBAc2hvd0luc3RhbmNlTmFtZSB0cnVlXG4gKi9cbnZhciBTdWJzY3JpcHRpb24gPSBmdW5jdGlvbiAoXG4gICAgc2Vzc2lvbiwgaGFuZGxlciwgc3Vic2NyaXB0aW9uSWQsIHBhcmFtcywgbmFtZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuX3Nlc3Npb24gPSBzZXNzaW9uOyAvLyB0eXBlIGlzIFNlc3Npb25cblxuICAvKipcbiAgICogQHN1bW1hcnkgQWNjZXNzIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gVGhlIGluY29taW5nIFtjb25uZWN0aW9uXSgjbWV0ZW9yX29uY29ubmVjdGlvbikgZm9yIHRoaXMgc3Vic2NyaXB0aW9uLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBuYW1lICBjb25uZWN0aW9uXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqL1xuICBzZWxmLmNvbm5lY3Rpb24gPSBzZXNzaW9uLmNvbm5lY3Rpb25IYW5kbGU7IC8vIHB1YmxpYyBBUEkgb2JqZWN0XG5cbiAgc2VsZi5faGFuZGxlciA9IGhhbmRsZXI7XG5cbiAgLy8gTXkgc3Vic2NyaXB0aW9uIElEIChnZW5lcmF0ZWQgYnkgY2xpZW50LCB1bmRlZmluZWQgZm9yIHVuaXZlcnNhbCBzdWJzKS5cbiAgc2VsZi5fc3Vic2NyaXB0aW9uSWQgPSBzdWJzY3JpcHRpb25JZDtcbiAgLy8gVW5kZWZpbmVkIGZvciB1bml2ZXJzYWwgc3Vic1xuICBzZWxmLl9uYW1lID0gbmFtZTtcblxuICBzZWxmLl9wYXJhbXMgPSBwYXJhbXMgfHwgW107XG5cbiAgLy8gT25seSBuYW1lZCBzdWJzY3JpcHRpb25zIGhhdmUgSURzLCBidXQgd2UgbmVlZCBzb21lIHNvcnQgb2Ygc3RyaW5nXG4gIC8vIGludGVybmFsbHkgdG8ga2VlcCB0cmFjayBvZiBhbGwgc3Vic2NyaXB0aW9ucyBpbnNpZGVcbiAgLy8gU2Vzc2lvbkRvY3VtZW50Vmlld3MuIFdlIHVzZSB0aGlzIHN1YnNjcmlwdGlvbkhhbmRsZSBmb3IgdGhhdC5cbiAgaWYgKHNlbGYuX3N1YnNjcmlwdGlvbklkKSB7XG4gICAgc2VsZi5fc3Vic2NyaXB0aW9uSGFuZGxlID0gJ04nICsgc2VsZi5fc3Vic2NyaXB0aW9uSWQ7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5fc3Vic2NyaXB0aW9uSGFuZGxlID0gJ1UnICsgUmFuZG9tLmlkKCk7XG4gIH1cblxuICAvLyBIYXMgX2RlYWN0aXZhdGUgYmVlbiBjYWxsZWQ/XG4gIHNlbGYuX2RlYWN0aXZhdGVkID0gZmFsc2U7XG5cbiAgLy8gU3RvcCBjYWxsYmFja3MgdG8gZy9jIHRoaXMgc3ViLiAgY2FsbGVkIHcvIHplcm8gYXJndW1lbnRzLlxuICBzZWxmLl9zdG9wQ2FsbGJhY2tzID0gW107XG5cbiAgLy8gVGhlIHNldCBvZiAoY29sbGVjdGlvbiwgZG9jdW1lbnRpZCkgdGhhdCB0aGlzIHN1YnNjcmlwdGlvbiBoYXNcbiAgLy8gYW4gb3BpbmlvbiBhYm91dC5cbiAgc2VsZi5fZG9jdW1lbnRzID0gbmV3IE1hcCgpO1xuXG4gIC8vIFJlbWVtYmVyIGlmIHdlIGFyZSByZWFkeS5cbiAgc2VsZi5fcmVhZHkgPSBmYWxzZTtcblxuICAvLyBQYXJ0IG9mIHRoZSBwdWJsaWMgQVBJOiB0aGUgdXNlciBvZiB0aGlzIHN1Yi5cblxuICAvKipcbiAgICogQHN1bW1hcnkgQWNjZXNzIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gVGhlIGlkIG9mIHRoZSBsb2dnZWQtaW4gdXNlciwgb3IgYG51bGxgIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQG5hbWUgIHVzZXJJZFxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHNlbGYudXNlcklkID0gc2Vzc2lvbi51c2VySWQ7XG5cbiAgLy8gRm9yIG5vdywgdGhlIGlkIGZpbHRlciBpcyBnb2luZyB0byBkZWZhdWx0IHRvXG4gIC8vIHRoZSB0by9mcm9tIEREUCBtZXRob2RzIG9uIE1vbmdvSUQsIHRvXG4gIC8vIHNwZWNpZmljYWxseSBkZWFsIHdpdGggbW9uZ28vbWluaW1vbmdvIE9iamVjdElkcy5cblxuICAvLyBMYXRlciwgeW91IHdpbGwgYmUgYWJsZSB0byBtYWtlIHRoaXMgYmUgXCJyYXdcIlxuICAvLyBpZiB5b3Ugd2FudCB0byBwdWJsaXNoIGEgY29sbGVjdGlvbiB0aGF0IHlvdSBrbm93XG4gIC8vIGp1c3QgaGFzIHN0cmluZ3MgZm9yIGtleXMgYW5kIG5vIGZ1bm55IGJ1c2luZXNzLCB0b1xuICAvLyBhIEREUCBjb25zdW1lciB0aGF0IGlzbid0IG1pbmltb25nby5cblxuICBzZWxmLl9pZEZpbHRlciA9IHtcbiAgICBpZFN0cmluZ2lmeTogTW9uZ29JRC5pZFN0cmluZ2lmeSxcbiAgICBpZFBhcnNlOiBNb25nb0lELmlkUGFyc2VcbiAgfTtcblxuICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgXCJsaXZlZGF0YVwiLCBcInN1YnNjcmlwdGlvbnNcIiwgMSk7XG59O1xuXG5PYmplY3QuYXNzaWduKFN1YnNjcmlwdGlvbi5wcm90b3R5cGUsIHtcbiAgX3J1bkhhbmRsZXI6IGZ1bmN0aW9uKCkge1xuICAgIC8vIFhYWCBzaG91bGQgd2UgdW5ibG9jaygpIGhlcmU/IEVpdGhlciBiZWZvcmUgcnVubmluZyB0aGUgcHVibGlzaFxuICAgIC8vIGZ1bmN0aW9uLCBvciBiZWZvcmUgcnVubmluZyBfcHVibGlzaEN1cnNvci5cbiAgICAvL1xuICAgIC8vIFJpZ2h0IG5vdywgZWFjaCBwdWJsaXNoIGZ1bmN0aW9uIGJsb2NrcyBhbGwgZnV0dXJlIHB1Ymxpc2hlcyBhbmRcbiAgICAvLyBtZXRob2RzIHdhaXRpbmcgb24gZGF0YSBmcm9tIE1vbmdvIChvciB3aGF0ZXZlciBlbHNlIHRoZSBmdW5jdGlvblxuICAgIC8vIGJsb2NrcyBvbikuIFRoaXMgcHJvYmFibHkgc2xvd3MgcGFnZSBsb2FkIGluIGNvbW1vbiBjYXNlcy5cblxuICAgIGlmICghdGhpcy51bmJsb2NrKSB7XG4gICAgICB0aGlzLnVuYmxvY2sgPSAoKSA9PiB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBsZXQgcmVzdWx0T3JUaGVuYWJsZSA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdE9yVGhlbmFibGUgPSBERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24ud2l0aFZhbHVlKFxuICAgICAgICBzZWxmLFxuICAgICAgICAoKSA9PlxuICAgICAgICAgIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyhcbiAgICAgICAgICAgIHNlbGYuX2hhbmRsZXIsXG4gICAgICAgICAgICBzZWxmLFxuICAgICAgICAgICAgRUpTT04uY2xvbmUoc2VsZi5fcGFyYW1zKSxcbiAgICAgICAgICAgIC8vIEl0J3MgT0sgdGhhdCB0aGlzIHdvdWxkIGxvb2sgd2VpcmQgZm9yIHVuaXZlcnNhbCBzdWJzY3JpcHRpb25zLFxuICAgICAgICAgICAgLy8gYmVjYXVzZSB0aGV5IGhhdmUgbm8gYXJndW1lbnRzIHNvIHRoZXJlIGNhbiBuZXZlciBiZSBhblxuICAgICAgICAgICAgLy8gYXVkaXQtYXJndW1lbnQtY2hlY2tzIGZhaWx1cmUuXG4gICAgICAgICAgICBcInB1Ymxpc2hlciAnXCIgKyBzZWxmLl9uYW1lICsgXCInXCJcbiAgICAgICAgICApLFxuICAgICAgICB7IG5hbWU6IHNlbGYuX25hbWUgfVxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzZWxmLmVycm9yKGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIERpZCB0aGUgaGFuZGxlciBjYWxsIHRoaXMuZXJyb3Igb3IgdGhpcy5zdG9wP1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpIHJldHVybjtcblxuICAgIC8vIEJvdGggY29udmVudGlvbmFsIGFuZCBhc3luYyBwdWJsaXNoIGhhbmRsZXIgZnVuY3Rpb25zIGFyZSBzdXBwb3J0ZWQuXG4gICAgLy8gSWYgYW4gb2JqZWN0IGlzIHJldHVybmVkIHdpdGggYSB0aGVuKCkgZnVuY3Rpb24sIGl0IGlzIGVpdGhlciBhIHByb21pc2VcbiAgICAvLyBvciB0aGVuYWJsZSBhbmQgd2lsbCBiZSByZXNvbHZlZCBhc3luY2hyb25vdXNseS5cbiAgICBjb25zdCBpc1RoZW5hYmxlID1cbiAgICAgIHJlc3VsdE9yVGhlbmFibGUgJiYgdHlwZW9mIHJlc3VsdE9yVGhlbmFibGUudGhlbiA9PT0gJ2Z1bmN0aW9uJztcbiAgICBpZiAoaXNUaGVuYWJsZSkge1xuICAgICAgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdE9yVGhlbmFibGUpLnRoZW4oXG4gICAgICAgICguLi5hcmdzKSA9PiBzZWxmLl9wdWJsaXNoSGFuZGxlclJlc3VsdC5iaW5kKHNlbGYpKC4uLmFyZ3MpLFxuICAgICAgICBlID0+IHNlbGYuZXJyb3IoZSlcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hIYW5kbGVyUmVzdWx0KHJlc3VsdE9yVGhlbmFibGUpO1xuICAgIH1cblxuICB9LFxuXG4gIF9wdWJsaXNoSGFuZGxlclJlc3VsdDogZnVuY3Rpb24gKHJlcykge1xuICAgIC8vIFNQRUNJQUwgQ0FTRTogSW5zdGVhZCBvZiB3cml0aW5nIHRoZWlyIG93biBjYWxsYmFja3MgdGhhdCBpbnZva2VcbiAgICAvLyB0aGlzLmFkZGVkL2NoYW5nZWQvcmVhZHkvZXRjLCB0aGUgdXNlciBjYW4ganVzdCByZXR1cm4gYSBjb2xsZWN0aW9uXG4gICAgLy8gY3Vyc29yIG9yIGFycmF5IG9mIGN1cnNvcnMgZnJvbSB0aGUgcHVibGlzaCBmdW5jdGlvbjsgd2UgY2FsbCB0aGVpclxuICAgIC8vIF9wdWJsaXNoQ3Vyc29yIG1ldGhvZCB3aGljaCBzdGFydHMgb2JzZXJ2aW5nIHRoZSBjdXJzb3IgYW5kIHB1Ymxpc2hlcyB0aGVcbiAgICAvLyByZXN1bHRzLiBOb3RlIHRoYXQgX3B1Ymxpc2hDdXJzb3IgZG9lcyBOT1QgY2FsbCByZWFkeSgpLlxuICAgIC8vXG4gICAgLy8gWFhYIFRoaXMgdXNlcyBhbiB1bmRvY3VtZW50ZWQgaW50ZXJmYWNlIHdoaWNoIG9ubHkgdGhlIE1vbmdvIGN1cnNvclxuICAgIC8vIGludGVyZmFjZSBwdWJsaXNoZXMuIFNob3VsZCB3ZSBtYWtlIHRoaXMgaW50ZXJmYWNlIHB1YmxpYyBhbmQgZW5jb3VyYWdlXG4gICAgLy8gdXNlcnMgdG8gaW1wbGVtZW50IGl0IHRoZW1zZWx2ZXM/IEFyZ3VhYmx5LCBpdCdzIHVubmVjZXNzYXJ5OyB1c2VycyBjYW5cbiAgICAvLyBhbHJlYWR5IHdyaXRlIHRoZWlyIG93biBmdW5jdGlvbnMgbGlrZVxuICAgIC8vICAgdmFyIHB1Ymxpc2hNeVJlYWN0aXZlVGhpbmd5ID0gZnVuY3Rpb24gKG5hbWUsIGhhbmRsZXIpIHtcbiAgICAvLyAgICAgTWV0ZW9yLnB1Ymxpc2gobmFtZSwgZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICAgIHZhciByZWFjdGl2ZVRoaW5neSA9IGhhbmRsZXIoKTtcbiAgICAvLyAgICAgICByZWFjdGl2ZVRoaW5neS5wdWJsaXNoTWUoKTtcbiAgICAvLyAgICAgfSk7XG4gICAgLy8gICB9O1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBpc0N1cnNvciA9IGZ1bmN0aW9uIChjKSB7XG4gICAgICByZXR1cm4gYyAmJiBjLl9wdWJsaXNoQ3Vyc29yO1xuICAgIH07XG4gICAgaWYgKGlzQ3Vyc29yKHJlcykpIHtcbiAgICAgIHRoaXMuX3B1Ymxpc2hDdXJzb3JQcm9taXNlID0gcmVzLl9wdWJsaXNoQ3Vyc29yKHNlbGYpLnRoZW4oKCkgPT4ge1xuICAgICAgICAvLyBfcHVibGlzaEN1cnNvciBvbmx5IHJldHVybnMgYWZ0ZXIgdGhlIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzIGhhdmUgcnVuLlxuICAgICAgICAvLyBtYXJrIHN1YnNjcmlwdGlvbiBhcyByZWFkeS5cbiAgICAgICAgc2VsZi5yZWFkeSgpO1xuICAgICAgfSkuY2F0Y2goKGUpID0+IHNlbGYuZXJyb3IoZSkpO1xuICAgIH0gZWxzZSBpZiAoXy5pc0FycmF5KHJlcykpIHtcbiAgICAgIC8vIENoZWNrIGFsbCB0aGUgZWxlbWVudHMgYXJlIGN1cnNvcnNcbiAgICAgIGlmICghIF8uYWxsKHJlcywgaXNDdXJzb3IpKSB7XG4gICAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFwiUHVibGlzaCBmdW5jdGlvbiByZXR1cm5lZCBhbiBhcnJheSBvZiBub24tQ3Vyc29yc1wiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgZHVwbGljYXRlIGNvbGxlY3Rpb24gbmFtZXNcbiAgICAgIC8vIFhYWCB3ZSBzaG91bGQgc3VwcG9ydCBvdmVybGFwcGluZyBjdXJzb3JzLCBidXQgdGhhdCB3b3VsZCByZXF1aXJlIHRoZVxuICAgICAgLy8gbWVyZ2UgYm94IHRvIGFsbG93IG92ZXJsYXAgd2l0aGluIGEgc3Vic2NyaXB0aW9uXG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0ge307XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSByZXNbaV0uX2dldENvbGxlY3Rpb25OYW1lKCk7XG4gICAgICAgIGlmIChfLmhhcyhjb2xsZWN0aW9uTmFtZXMsIGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFxuICAgICAgICAgICAgXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIG11bHRpcGxlIGN1cnNvcnMgZm9yIGNvbGxlY3Rpb24gXCIgK1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZSkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb2xsZWN0aW9uTmFtZXNbY29sbGVjdGlvbk5hbWVdID0gdHJ1ZTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX3B1Ymxpc2hDdXJzb3JQcm9taXNlID0gUHJvbWlzZS5hbGwoXG4gICAgICAgIHJlcy5tYXAoYyA9PiBjLl9wdWJsaXNoQ3Vyc29yKHNlbGYpKVxuICAgICAgKVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgc2VsZi5yZWFkeSgpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGUpID0+IHNlbGYuZXJyb3IoZSkpO1xuICAgIH0gZWxzZSBpZiAocmVzKSB7XG4gICAgICAvLyBUcnV0aHkgdmFsdWVzIG90aGVyIHRoYW4gY3Vyc29ycyBvciBhcnJheXMgYXJlIHByb2JhYmx5IGFcbiAgICAgIC8vIHVzZXIgbWlzdGFrZSAocG9zc2libGUgcmV0dXJuaW5nIGEgTW9uZ28gZG9jdW1lbnQgdmlhLCBzYXksXG4gICAgICAvLyBgY29sbC5maW5kT25lKClgKS5cbiAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFwiUHVibGlzaCBmdW5jdGlvbiBjYW4gb25seSByZXR1cm4gYSBDdXJzb3Igb3IgXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICsgXCJhbiBhcnJheSBvZiBDdXJzb3JzXCIpKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gVGhpcyBjYWxscyBhbGwgc3RvcCBjYWxsYmFja3MgYW5kIHByZXZlbnRzIHRoZSBoYW5kbGVyIGZyb20gdXBkYXRpbmcgYW55XG4gIC8vIFNlc3Npb25Db2xsZWN0aW9uVmlld3MgZnVydGhlci4gSXQncyB1c2VkIHdoZW4gdGhlIHVzZXIgdW5zdWJzY3JpYmVzIG9yXG4gIC8vIGRpc2Nvbm5lY3RzLCBhcyB3ZWxsIGFzIGR1cmluZyBzZXRVc2VySWQgcmUtcnVucy4gSXQgZG9lcyAqTk9UKiBzZW5kXG4gIC8vIHJlbW92ZWQgbWVzc2FnZXMgZm9yIHRoZSBwdWJsaXNoZWQgb2JqZWN0czsgaWYgdGhhdCBpcyBuZWNlc3NhcnksIGNhbGxcbiAgLy8gX3JlbW92ZUFsbERvY3VtZW50cyBmaXJzdC5cbiAgX2RlYWN0aXZhdGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fZGVhY3RpdmF0ZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fZGVhY3RpdmF0ZWQgPSB0cnVlO1xuICAgIHNlbGYuX2NhbGxTdG9wQ2FsbGJhY2tzKCk7XG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInN1YnNjcmlwdGlvbnNcIiwgLTEpO1xuICB9LFxuXG4gIF9jYWxsU3RvcENhbGxiYWNrczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBUZWxsIGxpc3RlbmVycywgc28gdGhleSBjYW4gY2xlYW4gdXBcbiAgICB2YXIgY2FsbGJhY2tzID0gc2VsZi5fc3RvcENhbGxiYWNrcztcbiAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzID0gW107XG4gICAgXy5lYWNoKGNhbGxiYWNrcywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNlbmQgcmVtb3ZlIG1lc3NhZ2VzIGZvciBldmVyeSBkb2N1bWVudC5cbiAgX3JlbW92ZUFsbERvY3VtZW50czogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoY29sbGVjdGlvbkRvY3MsIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGNvbGxlY3Rpb25Eb2NzLmZvckVhY2goZnVuY3Rpb24gKHN0cklkKSB7XG4gICAgICAgICAgc2VsZi5yZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBzZWxmLl9pZEZpbHRlci5pZFBhcnNlKHN0cklkKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gUmV0dXJucyBhIG5ldyBTdWJzY3JpcHRpb24gZm9yIHRoZSBzYW1lIHNlc3Npb24gd2l0aCB0aGUgc2FtZVxuICAvLyBpbml0aWFsIGNyZWF0aW9uIHBhcmFtZXRlcnMuIFRoaXMgaXNuJ3QgYSBjbG9uZTogaXQgZG9lc24ndCBoYXZlXG4gIC8vIHRoZSBzYW1lIF9kb2N1bWVudHMgY2FjaGUsIHN0b3BwZWQgc3RhdGUgb3IgY2FsbGJhY2tzOyBtYXkgaGF2ZSBhXG4gIC8vIGRpZmZlcmVudCBfc3Vic2NyaXB0aW9uSGFuZGxlLCBhbmQgZ2V0cyBpdHMgdXNlcklkIGZyb20gdGhlXG4gIC8vIHNlc3Npb24sIG5vdCBmcm9tIHRoaXMgb2JqZWN0LlxuICBfcmVjcmVhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBTdWJzY3JpcHRpb24oXG4gICAgICBzZWxmLl9zZXNzaW9uLCBzZWxmLl9oYW5kbGVyLCBzZWxmLl9zdWJzY3JpcHRpb25JZCwgc2VsZi5fcGFyYW1zLFxuICAgICAgc2VsZi5fbmFtZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgU3RvcHMgdGhpcyBjbGllbnQncyBzdWJzY3JpcHRpb24sIHRyaWdnZXJpbmcgYSBjYWxsIG9uIHRoZSBjbGllbnQgdG8gdGhlIGBvblN0b3BgIGNhbGxiYWNrIHBhc3NlZCB0byBbYE1ldGVvci5zdWJzY3JpYmVgXSgjbWV0ZW9yX3N1YnNjcmliZSksIGlmIGFueS4gSWYgYGVycm9yYCBpcyBub3QgYSBbYE1ldGVvci5FcnJvcmBdKCNtZXRlb3JfZXJyb3IpLCBpdCB3aWxsIGJlIFtzYW5pdGl6ZWRdKCNtZXRlb3JfZXJyb3IpLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIFRoZSBlcnJvciB0byBwYXNzIHRvIHRoZSBjbGllbnQuXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqL1xuICBlcnJvcjogZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc2Vzc2lvbi5fc3RvcFN1YnNjcmlwdGlvbihzZWxmLl9zdWJzY3JpcHRpb25JZCwgZXJyb3IpO1xuICB9LFxuXG4gIC8vIE5vdGUgdGhhdCB3aGlsZSBvdXIgRERQIGNsaWVudCB3aWxsIG5vdGljZSB0aGF0IHlvdSd2ZSBjYWxsZWQgc3RvcCgpIG9uIHRoZVxuICAvLyBzZXJ2ZXIgKGFuZCBjbGVhbiB1cCBpdHMgX3N1YnNjcmlwdGlvbnMgdGFibGUpIHdlIGRvbid0IGFjdHVhbGx5IHByb3ZpZGUgYVxuICAvLyBtZWNoYW5pc20gZm9yIGFuIGFwcCB0byBub3RpY2UgdGhpcyAodGhlIHN1YnNjcmliZSBvbkVycm9yIGNhbGxiYWNrIG9ubHlcbiAgLy8gdHJpZ2dlcnMgaWYgdGhlcmUgaXMgYW4gZXJyb3IpLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIFN0b3BzIHRoaXMgY2xpZW50J3Mgc3Vic2NyaXB0aW9uIGFuZCBpbnZva2VzIHRoZSBjbGllbnQncyBgb25TdG9wYCBjYWxsYmFjayB3aXRoIG5vIGVycm9yLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqL1xuICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc2Vzc2lvbi5fc3RvcFN1YnNjcmlwdGlvbihzZWxmLl9zdWJzY3JpcHRpb25JZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgUmVnaXN0ZXJzIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuIHdoZW4gdGhlIHN1YnNjcmlwdGlvbiBpcyBzdG9wcGVkLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAqL1xuICBvblN0b3A6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjYWxsYmFjayA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2ssICdvblN0b3AgY2FsbGJhY2snLCBzZWxmKTtcbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgY2FsbGJhY2soKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICB9LFxuXG4gIC8vIFRoaXMgcmV0dXJucyB0cnVlIGlmIHRoZSBzdWIgaGFzIGJlZW4gZGVhY3RpdmF0ZWQsICpPUiogaWYgdGhlIHNlc3Npb24gd2FzXG4gIC8vIGRlc3Ryb3llZCBidXQgdGhlIGRlZmVycmVkIGNhbGwgdG8gX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zIGhhc24ndFxuICAvLyBoYXBwZW5lZCB5ZXQuXG4gIF9pc0RlYWN0aXZhdGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9kZWFjdGl2YXRlZCB8fCBzZWxmLl9zZXNzaW9uLmluUXVldWUgPT09IG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGEgZG9jdW1lbnQgaGFzIGJlZW4gYWRkZWQgdG8gdGhlIHJlY29yZCBzZXQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCBjb250YWlucyB0aGUgbmV3IGRvY3VtZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIG5ldyBkb2N1bWVudCdzIElELlxuICAgKiBAcGFyYW0ge09iamVjdH0gZmllbGRzIFRoZSBmaWVsZHMgaW4gdGhlIG5ldyBkb2N1bWVudC4gIElmIGBfaWRgIGlzIHByZXNlbnQgaXQgaXMgaWdub3JlZC5cbiAgICovXG4gIGFkZGVkIChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG5cbiAgICBpZiAodGhpcy5fc2Vzc2lvbi5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkuZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbikge1xuICAgICAgbGV0IGlkcyA9IHRoaXMuX2RvY3VtZW50cy5nZXQoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgaWYgKGlkcyA9PSBudWxsKSB7XG4gICAgICAgIGlkcyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fZG9jdW1lbnRzLnNldChjb2xsZWN0aW9uTmFtZSwgaWRzKTtcbiAgICAgIH1cbiAgICAgIGlkcy5hZGQoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Nlc3Npb24uX3B1Ymxpc2hDdXJzb3JQcm9taXNlID0gdGhpcy5fcHVibGlzaEN1cnNvclByb21pc2U7XG4gICAgdGhpcy5fc2Vzc2lvbi5hZGRlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBpbiB0aGUgcmVjb3JkIHNldCBoYXMgYmVlbiBtb2RpZmllZC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29sbGVjdGlvbiBUaGUgbmFtZSBvZiB0aGUgY29sbGVjdGlvbiB0aGF0IGNvbnRhaW5zIHRoZSBjaGFuZ2VkIGRvY3VtZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIGNoYW5nZWQgZG9jdW1lbnQncyBJRC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGZpZWxkcyBUaGUgZmllbGRzIGluIHRoZSBkb2N1bWVudCB0aGF0IGhhdmUgY2hhbmdlZCwgdG9nZXRoZXIgd2l0aCB0aGVpciBuZXcgdmFsdWVzLiAgSWYgYSBmaWVsZCBpcyBub3QgcHJlc2VudCBpbiBgZmllbGRzYCBpdCB3YXMgbGVmdCB1bmNoYW5nZWQ7IGlmIGl0IGlzIHByZXNlbnQgaW4gYGZpZWxkc2AgYW5kIGhhcyBhIHZhbHVlIG9mIGB1bmRlZmluZWRgIGl0IHdhcyByZW1vdmVkIGZyb20gdGhlIGRvY3VtZW50LiAgSWYgYF9pZGAgaXMgcHJlc2VudCBpdCBpcyBpZ25vcmVkLlxuICAgKi9cbiAgY2hhbmdlZCAoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuICAgIHRoaXMuX3Nlc3Npb24uY2hhbmdlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIHJlY29yZCBzZXQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCB0aGUgZG9jdW1lbnQgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIElEIG9mIHRoZSBkb2N1bWVudCB0aGF0IGhhcyBiZWVuIHJlbW92ZWQuXG4gICAqL1xuICByZW1vdmVkIChjb2xsZWN0aW9uTmFtZSwgaWQpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuXG4gICAgaWYgKHRoaXMuX3Nlc3Npb24uc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLmRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb24pIHtcbiAgICAgIC8vIFdlIGRvbid0IGJvdGhlciB0byBkZWxldGUgc2V0cyBvZiB0aGluZ3MgaW4gYSBjb2xsZWN0aW9uIGlmIHRoZVxuICAgICAgLy8gY29sbGVjdGlvbiBpcyBlbXB0eS4gIEl0IGNvdWxkIGJyZWFrIF9yZW1vdmVBbGxEb2N1bWVudHMuXG4gICAgICB0aGlzLl9kb2N1bWVudHMuZ2V0KGNvbGxlY3Rpb25OYW1lKS5kZWxldGUoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Nlc3Npb24ucmVtb3ZlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGFuIGluaXRpYWwsIGNvbXBsZXRlIHNuYXBzaG90IG9mIHRoZSByZWNvcmQgc2V0IGhhcyBiZWVuIHNlbnQuICBUaGlzIHdpbGwgdHJpZ2dlciBhIGNhbGwgb24gdGhlIGNsaWVudCB0byB0aGUgYG9uUmVhZHlgIGNhbGxiYWNrIHBhc3NlZCB0byAgW2BNZXRlb3Iuc3Vic2NyaWJlYF0oI21ldGVvcl9zdWJzY3JpYmUpLCBpZiBhbnkuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHJlYWR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWYgKCFzZWxmLl9zdWJzY3JpcHRpb25JZClcbiAgICAgIHJldHVybjsgIC8vIFVubmVjZXNzYXJ5IGJ1dCBpZ25vcmVkIGZvciB1bml2ZXJzYWwgc3ViXG4gICAgaWYgKCFzZWxmLl9yZWFkeSkge1xuICAgICAgc2VsZi5fc2Vzc2lvbi5zZW5kUmVhZHkoW3NlbGYuX3N1YnNjcmlwdGlvbklkXSk7XG4gICAgICBzZWxmLl9yZWFkeSA9IHRydWU7XG4gICAgfVxuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFNlcnZlciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5TZXJ2ZXIgPSBmdW5jdGlvbiAob3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUaGUgZGVmYXVsdCBoZWFydGJlYXQgaW50ZXJ2YWwgaXMgMzAgc2Vjb25kcyBvbiB0aGUgc2VydmVyIGFuZCAzNVxuICAvLyBzZWNvbmRzIG9uIHRoZSBjbGllbnQuICBTaW5jZSB0aGUgY2xpZW50IGRvZXNuJ3QgbmVlZCB0byBzZW5kIGFcbiAgLy8gcGluZyBhcyBsb25nIGFzIGl0IGlzIHJlY2VpdmluZyBwaW5ncywgdGhpcyBtZWFucyB0aGF0IHBpbmdzXG4gIC8vIG5vcm1hbGx5IGdvIGZyb20gdGhlIHNlcnZlciB0byB0aGUgY2xpZW50LlxuICAvL1xuICAvLyBOb3RlOiBUcm9wb3NwaGVyZSBkZXBlbmRzIG9uIHRoZSBhYmlsaXR5IHRvIG11dGF0ZVxuICAvLyBNZXRlb3Iuc2VydmVyLm9wdGlvbnMuaGVhcnRiZWF0VGltZW91dCEgVGhpcyBpcyBhIGhhY2ssIGJ1dCBpdCdzIGxpZmUuXG4gIHNlbGYub3B0aW9ucyA9IHtcbiAgICBoZWFydGJlYXRJbnRlcnZhbDogMTUwMDAsXG4gICAgaGVhcnRiZWF0VGltZW91dDogMTUwMDAsXG4gICAgLy8gRm9yIHRlc3RpbmcsIGFsbG93IHJlc3BvbmRpbmcgdG8gcGluZ3MgdG8gYmUgZGlzYWJsZWQuXG4gICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k6IHB1YmxpY2F0aW9uU3RyYXRlZ2llcy5TRVJWRVJfTUVSR0UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcblxuICAvLyBNYXAgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiBhIG5ldyBjb25uZWN0aW9uIGNvbWVzIGluIHRvIHRoZVxuICAvLyBzZXJ2ZXIgYW5kIGNvbXBsZXRlcyBERFAgdmVyc2lvbiBuZWdvdGlhdGlvbi4gVXNlIGFuIG9iamVjdCBpbnN0ZWFkXG4gIC8vIG9mIGFuIGFycmF5IHNvIHdlIGNhbiBzYWZlbHkgcmVtb3ZlIG9uZSBmcm9tIHRoZSBsaXN0IHdoaWxlXG4gIC8vIGl0ZXJhdGluZyBvdmVyIGl0LlxuICBzZWxmLm9uQ29ubmVjdGlvbkhvb2sgPSBuZXcgSG9vayh7XG4gICAgZGVidWdQcmludEV4Y2VwdGlvbnM6IFwib25Db25uZWN0aW9uIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgLy8gTWFwIG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gYSBuZXcgbWVzc2FnZSBjb21lcyBpbi5cbiAgc2VsZi5vbk1lc3NhZ2VIb29rID0gbmV3IEhvb2soe1xuICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiBcIm9uTWVzc2FnZSBjYWxsYmFja1wiXG4gIH0pO1xuXG4gIHNlbGYucHVibGlzaF9oYW5kbGVycyA9IHt9O1xuICBzZWxmLnVuaXZlcnNhbF9wdWJsaXNoX2hhbmRsZXJzID0gW107XG5cbiAgc2VsZi5tZXRob2RfaGFuZGxlcnMgPSB7fTtcblxuICBzZWxmLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXMgPSB7fTtcblxuICBzZWxmLnNlc3Npb25zID0gbmV3IE1hcCgpOyAvLyBtYXAgZnJvbSBpZCB0byBzZXNzaW9uXG5cbiAgc2VsZi5zdHJlYW1fc2VydmVyID0gbmV3IFN0cmVhbVNlcnZlcigpO1xuXG4gIHNlbGYuc3RyZWFtX3NlcnZlci5yZWdpc3RlcihmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2V0IGltcGxlbWVudHMgdGhlIFNvY2tKU0Nvbm5lY3Rpb24gaW50ZXJmYWNlXG4gICAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gbnVsbDtcblxuICAgIHZhciBzZW5kRXJyb3IgPSBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgICB2YXIgbXNnID0ge21zZzogJ2Vycm9yJywgcmVhc29uOiByZWFzb259O1xuICAgICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICAgIG1zZy5vZmZlbmRpbmdNZXNzYWdlID0gb2ZmZW5kaW5nTWVzc2FnZTtcbiAgICAgIHNvY2tldC5zZW5kKEREUENvbW1vbi5zdHJpbmdpZnlERFAobXNnKSk7XG4gICAgfTtcblxuICAgIHNvY2tldC5vbignZGF0YScsIGZ1bmN0aW9uIChyYXdfbXNnKSB7XG4gICAgICBpZiAoTWV0ZW9yLl9wcmludFJlY2VpdmVkRERQKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJSZWNlaXZlZCBERFBcIiwgcmF3X21zZyk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHNlbmRFcnJvcignUGFyc2UgZXJyb3InKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgICAgIHNlbmRFcnJvcignQmFkIHJlcXVlc3QnLCBtc2cpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtc2cubXNnID09PSAnY29ubmVjdCcpIHtcbiAgICAgICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoXCJBbHJlYWR5IGNvbm5lY3RlZFwiLCBtc2cpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNlbGYuX2hhbmRsZUNvbm5lY3Qoc29ja2V0LCBtc2cpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgICBzZW5kRXJyb3IoJ011c3QgY29ubmVjdCBmaXJzdCcsIG1zZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbi5wcm9jZXNzTWVzc2FnZShtc2cpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBYWFggcHJpbnQgc3RhY2sgbmljZWx5XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJbnRlcm5hbCBleGNlcHRpb24gd2hpbGUgcHJvY2Vzc2luZyBtZXNzYWdlXCIsIG1zZywgZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBzb2NrZXQub24oJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNvY2tldC5fbWV0ZW9yU2Vzc2lvbikge1xuICAgICAgICBzb2NrZXQuX21ldGVvclNlc3Npb24uY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59O1xuXG5PYmplY3QuYXNzaWduKFNlcnZlci5wcm90b3R5cGUsIHtcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBtYWRlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbkNvbm5lY3Rpb246IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbkNvbm5lY3Rpb25Ib29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgZ2l2ZW4gY29sbGVjdGlvbi4gUHVibGljYXRpb25zIHN0cmF0ZWdpZXMgYXJlIGF2YWlsYWJsZSBmcm9tIGBERFBTZXJ2ZXIucHVibGljYXRpb25TdHJhdGVnaWVzYC4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuc2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBzZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgKiBAcGFyYW0gc3RyYXRlZ3kge3t1c2VDb2xsZWN0aW9uVmlldzogYm9vbGVhbiwgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogYm9vbGVhbn19XG4gICAqIEBtZW1iZXJPZiBNZXRlb3Iuc2VydmVyXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIHNldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUsIHN0cmF0ZWd5KSB7XG4gICAgaWYgKCFPYmplY3QudmFsdWVzKHB1YmxpY2F0aW9uU3RyYXRlZ2llcykuaW5jbHVkZXMoc3RyYXRlZ3kpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWVyZ2Ugc3RyYXRlZ3k6ICR7c3RyYXRlZ3l9IFxuICAgICAgICBmb3IgY29sbGVjdGlvbiAke2NvbGxlY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdID0gc3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgdGhlIHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgcmVxdWVzdGVkIGNvbGxlY3Rpb24uIFlvdSBjYWxsIHRoaXMgbWV0aG9kIGZyb20gYE1ldGVvci5zZXJ2ZXJgLCBsaWtlIGBNZXRlb3Iuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koKWBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAYWxpYXMgZ2V0UHVibGljYXRpb25TdHJhdGVneVxuICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICogQG1lbWJlck9mIE1ldGVvci5zZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAcmV0dXJuIHt7dXNlQ29sbGVjdGlvblZpZXc6IGJvb2xlYW4sIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGJvb2xlYW59fVxuICAgKi9cbiAgZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkge1xuICAgIHJldHVybiB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdXG4gICAgICB8fCB0aGlzLm9wdGlvbnMuZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gYSBuZXcgRERQIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbk1lc3NhZ2U6IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbk1lc3NhZ2VIb29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICBfaGFuZGxlQ29ubmVjdDogZnVuY3Rpb24gKHNvY2tldCwgbXNnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gVGhlIGNvbm5lY3QgbWVzc2FnZSBtdXN0IHNwZWNpZnkgYSB2ZXJzaW9uIGFuZCBhbiBhcnJheSBvZiBzdXBwb3J0ZWRcbiAgICAvLyB2ZXJzaW9ucywgYW5kIGl0IG11c3QgY2xhaW0gdG8gc3VwcG9ydCB3aGF0IGl0IGlzIHByb3Bvc2luZy5cbiAgICBpZiAoISh0eXBlb2YgKG1zZy52ZXJzaW9uKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICBfLmlzQXJyYXkobXNnLnN1cHBvcnQpICYmXG4gICAgICAgICAgXy5hbGwobXNnLnN1cHBvcnQsIF8uaXNTdHJpbmcpICYmXG4gICAgICAgICAgXy5jb250YWlucyhtc2cuc3VwcG9ydCwgbXNnLnZlcnNpb24pKSkge1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7bXNnOiAnZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlNbMF19KSk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGUgZnV0dXJlLCBoYW5kbGUgc2Vzc2lvbiByZXN1bXB0aW9uOiBzb21ldGhpbmcgbGlrZTpcbiAgICAvLyAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gc2VsZi5zZXNzaW9uc1ttc2cuc2Vzc2lvbl1cbiAgICB2YXIgdmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb24obXNnLnN1cHBvcnQsIEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TKTtcblxuICAgIGlmIChtc2cudmVyc2lvbiAhPT0gdmVyc2lvbikge1xuICAgICAgLy8gVGhlIGJlc3QgdmVyc2lvbiB0byB1c2UgKGFjY29yZGluZyB0byB0aGUgY2xpZW50J3Mgc3RhdGVkIHByZWZlcmVuY2VzKVxuICAgICAgLy8gaXMgbm90IHRoZSBvbmUgdGhlIGNsaWVudCBpcyB0cnlpbmcgdG8gdXNlLiBJbmZvcm0gdGhlbSBhYm91dCB0aGUgYmVzdFxuICAgICAgLy8gdmVyc2lvbiB0byB1c2UuXG4gICAgICBzb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKHttc2c6ICdmYWlsZWQnLCB2ZXJzaW9uOiB2ZXJzaW9ufSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWWF5LCB2ZXJzaW9uIG1hdGNoZXMhIENyZWF0ZSBhIG5ldyBzZXNzaW9uLlxuICAgIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gICAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNlbGYsIHZlcnNpb24sIHNvY2tldCwgc2VsZi5vcHRpb25zKTtcbiAgICBzZWxmLnNlc3Npb25zLnNldChzb2NrZXQuX21ldGVvclNlc3Npb24uaWQsIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbik7XG4gICAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKVxuICAgICAgICBjYWxsYmFjayhzb2NrZXQuX21ldGVvclNlc3Npb24uY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfSBpZGVudGlmaWVyIGZvciBxdWVyeVxuICAgKiBAcGFyYW0gaGFuZGxlciB7RnVuY3Rpb259IHB1Ymxpc2ggaGFuZGxlclxuICAgKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxuICAgKlxuICAgKiBTZXJ2ZXIgd2lsbCBjYWxsIGhhbmRsZXIgZnVuY3Rpb24gb24gZWFjaCBuZXcgc3Vic2NyaXB0aW9uLFxuICAgKiBlaXRoZXIgd2hlbiByZWNlaXZpbmcgRERQIHN1YiBtZXNzYWdlIGZvciBhIG5hbWVkIHN1YnNjcmlwdGlvbiwgb3Igb25cbiAgICogRERQIGNvbm5lY3QgZm9yIGEgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbi5cbiAgICpcbiAgICogSWYgbmFtZSBpcyBudWxsLCB0aGlzIHdpbGwgYmUgYSBzdWJzY3JpcHRpb24gdGhhdCBpc1xuICAgKiBhdXRvbWF0aWNhbGx5IGVzdGFibGlzaGVkIGFuZCBwZXJtYW5lbnRseSBvbiBmb3IgYWxsIGNvbm5lY3RlZFxuICAgKiBjbGllbnQsIGluc3RlYWQgb2YgYSBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdHVybmVkIG9uIGFuZCBvZmZcbiAgICogd2l0aCBzdWJzY3JpYmUoKS5cbiAgICpcbiAgICogb3B0aW9ucyB0byBjb250YWluOlxuICAgKiAgLSAobW9zdGx5IGludGVybmFsKSBpc19hdXRvOiB0cnVlIGlmIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5XG4gICAqICAgIGZyb20gYW4gYXV0b3B1Ymxpc2ggaG9vay4gdGhpcyBpcyBmb3IgY29zbWV0aWMgcHVycG9zZXMgb25seVxuICAgKiAgICAoaXQgbGV0cyB1cyBkZXRlcm1pbmUgd2hldGhlciB0byBwcmludCBhIHdhcm5pbmcgc3VnZ2VzdGluZ1xuICAgKiAgICB0aGF0IHlvdSB0dXJuIG9mZiBhdXRvcHVibGlzaCkuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQdWJsaXNoIGEgcmVjb3JkIHNldC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBuYW1lIElmIFN0cmluZywgbmFtZSBvZiB0aGUgcmVjb3JkIHNldC4gIElmIE9iamVjdCwgcHVibGljYXRpb25zIERpY3Rpb25hcnkgb2YgcHVibGlzaCBmdW5jdGlvbnMgYnkgbmFtZS4gIElmIGBudWxsYCwgdGhlIHNldCBoYXMgbm8gbmFtZSwgYW5kIHRoZSByZWNvcmQgc2V0IGlzIGF1dG9tYXRpY2FsbHkgc2VudCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgRnVuY3Rpb24gY2FsbGVkIG9uIHRoZSBzZXJ2ZXIgZWFjaCB0aW1lIGEgY2xpZW50IHN1YnNjcmliZXMuICBJbnNpZGUgdGhlIGZ1bmN0aW9uLCBgdGhpc2AgaXMgdGhlIHB1Ymxpc2ggaGFuZGxlciBvYmplY3QsIGRlc2NyaWJlZCBiZWxvdy4gIElmIHRoZSBjbGllbnQgcGFzc2VkIGFyZ3VtZW50cyB0byBgc3Vic2NyaWJlYCwgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cy5cbiAgICovXG4gIHB1Ymxpc2g6IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCEgXy5pc09iamVjdChuYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgIGlmIChuYW1lICYmIG5hbWUgaW4gc2VsZi5wdWJsaXNoX2hhbmRsZXJzKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJZ25vcmluZyBkdXBsaWNhdGUgcHVibGlzaCBuYW1lZCAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlLmF1dG9wdWJsaXNoICYmICFvcHRpb25zLmlzX2F1dG8pIHtcbiAgICAgICAgLy8gVGhleSBoYXZlIGF1dG9wdWJsaXNoIG9uLCB5ZXQgdGhleSdyZSB0cnlpbmcgdG8gbWFudWFsbHlcbiAgICAgICAgLy8gcGljayBzdHVmZiB0byBwdWJsaXNoLiBUaGV5IHByb2JhYmx5IHNob3VsZCB0dXJuIG9mZlxuICAgICAgICAvLyBhdXRvcHVibGlzaC4gKFRoaXMgY2hlY2sgaXNuJ3QgcGVyZmVjdCAtLSBpZiB5b3UgY3JlYXRlIGFcbiAgICAgICAgLy8gcHVibGlzaCBiZWZvcmUgeW91IHR1cm4gb24gYXV0b3B1Ymxpc2gsIGl0IHdvbid0IGNhdGNoXG4gICAgICAgIC8vIGl0LCBidXQgdGhpcyB3aWxsIGRlZmluaXRlbHkgaGFuZGxlIHRoZSBzaW1wbGUgY2FzZSB3aGVyZVxuICAgICAgICAvLyB5b3UndmUgYWRkZWQgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2UgdG8geW91ciBhcHAsIGFuZCBhcmVcbiAgICAgICAgLy8gY2FsbGluZyBwdWJsaXNoIGZyb20geW91ciBhcHAgY29kZSkuXG4gICAgICAgIGlmICghc2VsZi53YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2gpIHtcbiAgICAgICAgICBzZWxmLndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCA9IHRydWU7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICBcIioqIFlvdSd2ZSBzZXQgdXAgc29tZSBkYXRhIHN1YnNjcmlwdGlvbnMgd2l0aCBNZXRlb3IucHVibGlzaCgpLCBidXRcXG5cIiArXG4gICAgXCIqKiB5b3Ugc3RpbGwgaGF2ZSBhdXRvcHVibGlzaCB0dXJuZWQgb24uIEJlY2F1c2UgYXV0b3B1Ymxpc2ggaXMgc3RpbGxcXG5cIiArXG4gICAgXCIqKiBvbiwgeW91ciBNZXRlb3IucHVibGlzaCgpIGNhbGxzIHdvbid0IGhhdmUgbXVjaCBlZmZlY3QuIEFsbCBkYXRhXFxuXCIgK1xuICAgIFwiKiogd2lsbCBzdGlsbCBiZSBzZW50IHRvIGFsbCBjbGllbnRzLlxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogVHVybiBvZmYgYXV0b3B1Ymxpc2ggYnkgcmVtb3ZpbmcgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2U6XFxuXCIgK1xuICAgIFwiKipcXG5cIiArXG4gICAgXCIqKiAgICQgbWV0ZW9yIHJlbW92ZSBhdXRvcHVibGlzaFxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogLi4gYW5kIG1ha2Ugc3VyZSB5b3UgaGF2ZSBNZXRlb3IucHVibGlzaCgpIGFuZCBNZXRlb3Iuc3Vic2NyaWJlKCkgY2FsbHNcXG5cIiArXG4gICAgXCIqKiBmb3IgZWFjaCBjb2xsZWN0aW9uIHRoYXQgeW91IHdhbnQgY2xpZW50cyB0byBzZWUuXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lKVxuICAgICAgICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgLy8gU3BpbiB1cCB0aGUgbmV3IHB1Ymxpc2hlciBvbiBhbnkgZXhpc3Rpbmcgc2Vzc2lvbiB0b28uIFJ1biBlYWNoXG4gICAgICAgIC8vIHNlc3Npb24ncyBzdWJzY3JpcHRpb24gaW4gYSBuZXcgRmliZXIsIHNvIHRoYXQgdGhlcmUncyBubyBjaGFuZ2UgZm9yXG4gICAgICAgIC8vIHNlbGYuc2Vzc2lvbnMgdG8gY2hhbmdlIHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhpcyBsb29wLlxuICAgICAgICBzZWxmLnNlc3Npb25zLmZvckVhY2goZnVuY3Rpb24gKHNlc3Npb24pIHtcbiAgICAgICAgICBpZiAoIXNlc3Npb24uX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMpIHtcbiAgICAgICAgICAgIHNlc3Npb24uX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICBfLmVhY2gobmFtZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICBzZWxmLnB1Ymxpc2goa2V5LCB2YWx1ZSwge30pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9yZW1vdmVTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgVGVsbHMgaWYgdGhlIG1ldGhvZCBjYWxsIGNhbWUgZnJvbSBhIGNhbGwgb3IgYSBjYWxsQXN5bmMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQHJldHVybnMgYm9vbGVhblxuICAgKi9cbiAgaXNBc3luY0NhbGw6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IERlZmluZXMgZnVuY3Rpb25zIHRoYXQgY2FuIGJlIGludm9rZWQgb3ZlciB0aGUgbmV0d29yayBieSBjbGllbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1ldGhvZHMgRGljdGlvbmFyeSB3aG9zZSBrZXlzIGFyZSBtZXRob2QgbmFtZXMgYW5kIHZhbHVlcyBhcmUgZnVuY3Rpb25zLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG1ldGhvZHM6IGZ1bmN0aW9uIChtZXRob2RzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIF8uZWFjaChtZXRob2RzLCBmdW5jdGlvbiAoZnVuYywgbmFtZSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICBpZiAoc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9LFxuXG4gIGNhbGw6IGZ1bmN0aW9uIChuYW1lLCAuLi5hcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gSWYgaXQncyBhIGZ1bmN0aW9uLCB0aGUgbGFzdCBhcmd1bWVudCBpcyB0aGUgcmVzdWx0IGNhbGxiYWNrLCBub3RcbiAgICAgIC8vIGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHBseShuYW1lLCBhcmdzLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gQSB2ZXJzaW9uIG9mIHRoZSBjYWxsIG1ldGhvZCB0aGF0IGFsd2F5cyByZXR1cm5zIGEgUHJvbWlzZS5cbiAgY2FsbEFzeW5jOiBmdW5jdGlvbiAobmFtZSwgLi4uYXJncykge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdPy5oYXNPd25Qcm9wZXJ0eSgncmV0dXJuU3R1YlZhbHVlJylcbiAgICAgID8gYXJncy5zaGlmdCgpXG4gICAgICA6IHt9O1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpO1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIEREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24uX3NldCh7IG5hbWUsIGhhc0NhbGxBc3luY1BhcmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAudGhlbihyZXNvbHZlKVxuICAgICAgICAuY2F0Y2gocmVqZWN0KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5fc2V0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT5cbiAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcoZmFsc2UpXG4gICAgKTtcbiAgfSxcblxuICBhcHBseTogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgfVxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmFwcGx5QXN5bmMobmFtZSwgYXJncywgb3B0aW9ucyk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdCBpbiB3aGljaGV2ZXIgd2F5IHRoZSBjYWxsZXIgYXNrZWQgZm9yIGl0LiBOb3RlIHRoYXQgd2VcbiAgICAvLyBkbyBOT1QgYmxvY2sgb24gdGhlIHdyaXRlIGZlbmNlIGluIGFuIGFuYWxvZ291cyB3YXkgdG8gaG93IHRoZSBjbGllbnRcbiAgICAvLyBibG9ja3Mgb24gdGhlIHJlbGV2YW50IGRhdGEgYmVpbmcgdmlzaWJsZSwgc28geW91IGFyZSBOT1QgZ3VhcmFudGVlZCB0aGF0XG4gICAgLy8gY3Vyc29yIG9ic2VydmUgY2FsbGJhY2tzIGhhdmUgZmlyZWQgd2hlbiB5b3VyIGNhbGxiYWNrIGlzIGludm9rZWQuIChXZVxuICAgIC8vIGNhbiBjaGFuZ2UgdGhpcyBpZiB0aGVyZSdzIGEgcmVhbCB1c2UgY2FzZSkuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgIHJlc3VsdCA9PiBjYWxsYmFjayh1bmRlZmluZWQsIHJlc3VsdCksXG4gICAgICAgIGV4Y2VwdGlvbiA9PiBjYWxsYmFjayhleGNlcHRpb24pXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09wdGlvbmFsIE9iamVjdH1cbiAgYXBwbHlBc3luYzogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIGhhbmRsZXJcbiAgICB2YXIgaGFuZGxlciA9IHRoaXMubWV0aG9kX2hhbmRsZXJzW25hbWVdO1xuXG4gICAgaWYgKCEgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHtuYW1lfScgbm90IGZvdW5kYClcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIElmIHRoaXMgaXMgYSBtZXRob2QgY2FsbCBmcm9tIHdpdGhpbiBhbm90aGVyIG1ldGhvZCBvciBwdWJsaXNoIGZ1bmN0aW9uLFxuICAgIC8vIGdldCB0aGUgdXNlciBzdGF0ZSBmcm9tIHRoZSBvdXRlciBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbiwgb3RoZXJ3aXNlXG4gICAgLy8gZG9uJ3QgYWxsb3cgc2V0VXNlcklkIHRvIGJlIGNhbGxlZFxuICAgIHZhciB1c2VySWQgPSBudWxsO1xuICAgIHZhciBzZXRVc2VySWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNhbGwgc2V0VXNlcklkIG9uIGEgc2VydmVyIGluaXRpYXRlZCBtZXRob2QgY2FsbFwiKTtcbiAgICB9O1xuICAgIHZhciBjb25uZWN0aW9uID0gbnVsbDtcbiAgICB2YXIgY3VycmVudE1ldGhvZEludm9jYXRpb24gPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgIHZhciBjdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uID0gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLmdldCgpO1xuICAgIHZhciByYW5kb21TZWVkID0gbnVsbDtcbiAgICBpZiAoY3VycmVudE1ldGhvZEludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnVzZXJJZDtcbiAgICAgIHNldFVzZXJJZCA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuICAgICAgICBjdXJyZW50TWV0aG9kSW52b2NhdGlvbi5zZXRVc2VySWQodXNlcklkKTtcbiAgICAgIH07XG4gICAgICBjb25uZWN0aW9uID0gY3VycmVudE1ldGhvZEludm9jYXRpb24uY29ubmVjdGlvbjtcbiAgICAgIHJhbmRvbVNlZWQgPSBERFBDb21tb24ubWFrZVJwY1NlZWQoY3VycmVudE1ldGhvZEludm9jYXRpb24sIG5hbWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbikge1xuICAgICAgdXNlcklkID0gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi51c2VySWQ7XG4gICAgICBzZXRVc2VySWQgPSBmdW5jdGlvbih1c2VySWQpIHtcbiAgICAgICAgY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5fc2Vzc2lvbi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICB9O1xuICAgICAgY29ubmVjdGlvbiA9IGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24uY29ubmVjdGlvbjtcbiAgICB9XG5cbiAgICB2YXIgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICBpc1NpbXVsYXRpb246IGZhbHNlLFxuICAgICAgdXNlcklkLFxuICAgICAgc2V0VXNlcklkLFxuICAgICAgY29ubmVjdGlvbixcbiAgICAgIHJhbmRvbVNlZWRcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVzdWx0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoaW52b2NhdGlvbiwgKCkgPT5cbiAgICAgICAgICBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICBoYW5kbGVyLFxuICAgICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAgIEVKU09OLmNsb25lKGFyZ3MpLFxuICAgICAgICAgICAgXCJpbnRlcm5hbCBjYWxsIHRvICdcIiArIG5hbWUgKyBcIidcIlxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIGlmICghTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0LnRoZW4ociA9PiByZXNvbHZlKHIpKS5jYXRjaChyZWplY3QpO1xuICAgIH0pLnRoZW4oRUpTT04uY2xvbmUpO1xuICB9LFxuXG4gIF91cmxGb3JTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbklkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBzZXNzaW9uID0gc2VsZi5zZXNzaW9ucy5nZXQoc2Vzc2lvbklkKTtcbiAgICBpZiAoc2Vzc2lvbilcbiAgICAgIHJldHVybiBzZXNzaW9uLl9zb2NrZXRVcmw7XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn0pO1xuXG52YXIgY2FsY3VsYXRlVmVyc2lvbiA9IGZ1bmN0aW9uIChjbGllbnRTdXBwb3J0ZWRWZXJzaW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlclN1cHBvcnRlZFZlcnNpb25zKSB7XG4gIHZhciBjb3JyZWN0VmVyc2lvbiA9IF8uZmluZChjbGllbnRTdXBwb3J0ZWRWZXJzaW9ucywgZnVuY3Rpb24gKHZlcnNpb24pIHtcbiAgICByZXR1cm4gXy5jb250YWlucyhzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucywgdmVyc2lvbik7XG4gIH0pO1xuICBpZiAoIWNvcnJlY3RWZXJzaW9uKSB7XG4gICAgY29ycmVjdFZlcnNpb24gPSBzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9uc1swXTtcbiAgfVxuICByZXR1cm4gY29ycmVjdFZlcnNpb247XG59O1xuXG5ERFBTZXJ2ZXIuX2NhbGN1bGF0ZVZlcnNpb24gPSBjYWxjdWxhdGVWZXJzaW9uO1xuXG5cbi8vIFwiYmxpbmRcIiBleGNlcHRpb25zIG90aGVyIHRoYW4gdGhvc2UgdGhhdCB3ZXJlIGRlbGliZXJhdGVseSB0aHJvd24gdG8gc2lnbmFsXG4vLyBlcnJvcnMgdG8gdGhlIGNsaWVudFxudmFyIHdyYXBJbnRlcm5hbEV4Y2VwdGlvbiA9IGZ1bmN0aW9uIChleGNlcHRpb24sIGNvbnRleHQpIHtcbiAgaWYgKCFleGNlcHRpb24pIHJldHVybiBleGNlcHRpb247XG5cbiAgLy8gVG8gYWxsb3cgcGFja2FnZXMgdG8gdGhyb3cgZXJyb3JzIGludGVuZGVkIGZvciB0aGUgY2xpZW50IGJ1dCBub3QgaGF2ZSB0b1xuICAvLyBkZXBlbmQgb24gdGhlIE1ldGVvci5FcnJvciBjbGFzcywgYGlzQ2xpZW50U2FmZWAgY2FuIGJlIHNldCB0byB0cnVlIG9uIGFueVxuICAvLyBlcnJvciBiZWZvcmUgaXQgaXMgdGhyb3duLlxuICBpZiAoZXhjZXB0aW9uLmlzQ2xpZW50U2FmZSkge1xuICAgIGlmICghKGV4Y2VwdGlvbiBpbnN0YW5jZW9mIE1ldGVvci5FcnJvcikpIHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsTWVzc2FnZSA9IGV4Y2VwdGlvbi5tZXNzYWdlO1xuICAgICAgZXhjZXB0aW9uID0gbmV3IE1ldGVvci5FcnJvcihleGNlcHRpb24uZXJyb3IsIGV4Y2VwdGlvbi5yZWFzb24sIGV4Y2VwdGlvbi5kZXRhaWxzKTtcbiAgICAgIGV4Y2VwdGlvbi5tZXNzYWdlID0gb3JpZ2luYWxNZXNzYWdlO1xuICAgIH1cbiAgICByZXR1cm4gZXhjZXB0aW9uO1xuICB9XG5cbiAgLy8gVGVzdHMgY2FuIHNldCB0aGUgJ19leHBlY3RlZEJ5VGVzdCcgZmxhZyBvbiBhbiBleGNlcHRpb24gc28gaXQgd29uJ3QgZ28gdG9cbiAgLy8gdGhlIHNlcnZlciBsb2cuXG4gIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgIE1ldGVvci5fZGVidWcoXCJFeGNlcHRpb24gXCIgKyBjb250ZXh0LCBleGNlcHRpb24uc3RhY2spO1xuICAgIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJTYW5pdGl6ZWQgYW5kIHJlcG9ydGVkIHRvIHRoZSBjbGllbnQgYXM6XCIsIGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcik7XG4gICAgICBNZXRlb3IuX2RlYnVnKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRGlkIHRoZSBlcnJvciBjb250YWluIG1vcmUgZGV0YWlscyB0aGF0IGNvdWxkIGhhdmUgYmVlbiB1c2VmdWwgaWYgY2F1Z2h0IGluXG4gIC8vIHNlcnZlciBjb2RlIChvciBpZiB0aHJvd24gZnJvbSBub24tY2xpZW50LW9yaWdpbmF0ZWQgY29kZSksIGJ1dCBhbHNvXG4gIC8vIHByb3ZpZGVkIGEgXCJzYW5pdGl6ZWRcIiB2ZXJzaW9uIHdpdGggbW9yZSBjb250ZXh0IHRoYW4gNTAwIEludGVybmFsIHNlcnZlclxuICAvLyBlcnJvcj8gVXNlIHRoYXQuXG4gIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IpIHtcbiAgICBpZiAoZXhjZXB0aW9uLnNhbml0aXplZEVycm9yLmlzQ2xpZW50U2FmZSlcbiAgICAgIHJldHVybiBleGNlcHRpb24uc2FuaXRpemVkRXJyb3I7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkV4Y2VwdGlvbiBcIiArIGNvbnRleHQgKyBcIiBwcm92aWRlcyBhIHNhbml0aXplZEVycm9yIHRoYXQgXCIgK1xuICAgICAgICAgICAgICAgICAgXCJkb2VzIG5vdCBoYXZlIGlzQ2xpZW50U2FmZSBwcm9wZXJ0eSBzZXQ7IGlnbm9yaW5nXCIpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBNZXRlb3IuRXJyb3IoNTAwLCBcIkludGVybmFsIHNlcnZlciBlcnJvclwiKTtcbn07XG5cblxuLy8gQXVkaXQgYXJndW1lbnQgY2hlY2tzLCBpZiB0aGUgYXVkaXQtYXJndW1lbnQtY2hlY2tzIHBhY2thZ2UgZXhpc3RzIChpdCBpcyBhXG4vLyB3ZWFrIGRlcGVuZGVuY3kgb2YgdGhpcyBwYWNrYWdlKS5cbnZhciBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MgPSBmdW5jdGlvbiAoZiwgY29udGV4dCwgYXJncywgZGVzY3JpcHRpb24pIHtcbiAgYXJncyA9IGFyZ3MgfHwgW107XG4gIGlmIChQYWNrYWdlWydhdWRpdC1hcmd1bWVudC1jaGVja3MnXSkge1xuICAgIHJldHVybiBNYXRjaC5fZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZChcbiAgICAgIGYsIGNvbnRleHQsIGFyZ3MsIGRlc2NyaXB0aW9uKTtcbiAgfVxuICByZXR1cm4gZi5hcHBseShjb250ZXh0LCBhcmdzKTtcbn07XG4iLCIvLyBBIHdyaXRlIGZlbmNlIGNvbGxlY3RzIGEgZ3JvdXAgb2Ygd3JpdGVzLCBhbmQgcHJvdmlkZXMgYSBjYWxsYmFja1xuLy8gd2hlbiBhbGwgb2YgdGhlIHdyaXRlcyBhcmUgZnVsbHkgY29tbWl0dGVkIGFuZCBwcm9wYWdhdGVkIChhbGxcbi8vIG9ic2VydmVycyBoYXZlIGJlZW4gbm90aWZpZWQgb2YgdGhlIHdyaXRlIGFuZCBhY2tub3dsZWRnZWQgaXQuKVxuLy9cbkREUFNlcnZlci5fV3JpdGVGZW5jZSA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5hcm1lZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlyZWQgPSBmYWxzZTtcbiAgICB0aGlzLnJldGlyZWQgPSBmYWxzZTtcbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcyA9IDA7XG4gICAgdGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gIH1cblxuICAvLyBTdGFydCB0cmFja2luZyBhIHdyaXRlLCBhbmQgcmV0dXJuIGFuIG9iamVjdCB0byByZXByZXNlbnQgaXQuIFRoZVxuICAvLyBvYmplY3QgaGFzIGEgc2luZ2xlIG1ldGhvZCwgY29tbWl0dGVkKCkuIFRoaXMgbWV0aG9kIHNob3VsZCBiZVxuICAvLyBjYWxsZWQgd2hlbiB0aGUgd3JpdGUgaXMgZnVsbHkgY29tbWl0dGVkIGFuZCBwcm9wYWdhdGVkLiBZb3UgY2FuXG4gIC8vIGNvbnRpbnVlIHRvIGFkZCB3cml0ZXMgdG8gdGhlIFdyaXRlRmVuY2UgdXAgdW50aWwgaXQgaXMgdHJpZ2dlcmVkXG4gIC8vIChjYWxscyBpdHMgY2FsbGJhY2tzIGJlY2F1c2UgYWxsIHdyaXRlcyBoYXZlIGNvbW1pdHRlZC4pXG4gIGJlZ2luV3JpdGUoKSB7XG4gICAgaWYgKHRoaXMucmV0aXJlZClcbiAgICAgIHJldHVybiB7IGNvbW1pdHRlZDogZnVuY3Rpb24gKCkge30gfTtcblxuICAgIGlmICh0aGlzLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmVuY2UgaGFzIGFscmVhZHkgYWN0aXZhdGVkIC0tIHRvbyBsYXRlIHRvIGFkZCB3cml0ZXNcIik7XG5cbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgIGxldCBjb21taXR0ZWQgPSBmYWxzZTtcbiAgICBjb25zdCBfY29tbWl0dGVkRm4gPSBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoY29tbWl0dGVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjb21taXR0ZWQgY2FsbGVkIHR3aWNlIG9uIHRoZSBzYW1lIHdyaXRlXCIpO1xuICAgICAgY29tbWl0dGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzLS07XG4gICAgICBhd2FpdCB0aGlzLl9tYXliZUZpcmUoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1pdHRlZDogX2NvbW1pdHRlZEZuLFxuICAgIH07XG4gIH1cblxuICAvLyBBcm0gdGhlIGZlbmNlLiBPbmNlIHRoZSBmZW5jZSBpcyBhcm1lZCwgYW5kIHRoZXJlIGFyZSBubyBtb3JlXG4gIC8vIHVuY29tbWl0dGVkIHdyaXRlcywgaXQgd2lsbCBhY3RpdmF0ZS5cbiAgYXJtKCkge1xuXG4gICAgaWYgKHRoaXMgPT09IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCkpXG4gICAgICB0aHJvdyBFcnJvcihcIkNhbid0IGFybSB0aGUgY3VycmVudCBmZW5jZVwiKTtcbiAgICB0aGlzLmFybWVkID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5fbWF5YmVGaXJlKCk7XG4gIH1cblxuICAvLyBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbmNlIGJlZm9yZSBmaXJpbmcgdGhlIGZlbmNlLlxuICAvLyBDYWxsYmFjayBmdW5jdGlvbiBjYW4gYWRkIG5ldyB3cml0ZXMgdG8gdGhlIGZlbmNlLCBpbiB3aGljaCBjYXNlXG4gIC8vIGl0IHdvbid0IGZpcmUgdW50aWwgdGhvc2Ugd3JpdGVzIGFyZSBkb25lIGFzIHdlbGwuXG4gIG9uQmVmb3JlRmlyZShmdW5jKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gXCIgK1xuICAgICAgICAgIFwiYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgdGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MucHVzaChmdW5jKTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gdGhlIGZlbmNlIGZpcmVzLlxuICBvbkFsbENvbW1pdHRlZChmdW5jKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gXCIgK1xuICAgICAgICAgIFwiYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgdGhpcy5jb21wbGV0aW9uX2NhbGxiYWNrcy5wdXNoKGZ1bmMpO1xuICB9XG5cbiAgYXN5bmMgX2FybUFuZFdhaXQoKSB7XG4gICAgbGV0IHJlc29sdmVyO1xuICAgIGNvbnN0IHJldHVyblZhbHVlID0gbmV3IFByb21pc2UociA9PiByZXNvbHZlciA9IHIpO1xuICAgIHRoaXMub25BbGxDb21taXR0ZWQocmVzb2x2ZXIpO1xuICAgIGF3YWl0IHRoaXMuYXJtKCk7XG5cbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gIH1cbiAgLy8gQ29udmVuaWVuY2UgZnVuY3Rpb24uIEFybXMgdGhlIGZlbmNlLCB0aGVuIGJsb2NrcyB1bnRpbCBpdCBmaXJlcy5cbiAgYXN5bmMgYXJtQW5kV2FpdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXJtQW5kV2FpdCgpO1xuICB9XG5cbiAgYXN5bmMgX21heWJlRmlyZSgpIHtcbiAgICBpZiAodGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIndyaXRlIGZlbmNlIGFscmVhZHkgYWN0aXZhdGVkP1wiKTtcbiAgICBpZiAodGhpcy5hcm1lZCAmJiAhdGhpcy5vdXRzdGFuZGluZ193cml0ZXMpIHtcbiAgICAgIGNvbnN0IGludm9rZUNhbGxiYWNrID0gYXN5bmMgKGZ1bmMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBmdW5jKHRoaXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBNZXRlb3IuX2RlYnVnKFwiZXhjZXB0aW9uIGluIHdyaXRlIGZlbmNlIGNhbGxiYWNrOlwiLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgICAgd2hpbGUgKHRoaXMuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY2IgPSB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcy5zaGlmdCgpO1xuICAgICAgICBhd2FpdCBpbnZva2VDYWxsYmFjayhjYik7XG4gICAgICB9XG4gICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcy0tO1xuXG4gICAgICBpZiAoIXRoaXMub3V0c3RhbmRpbmdfd3JpdGVzKSB7XG4gICAgICAgIHRoaXMuZmlyZWQgPSB0cnVlO1xuICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzIHx8IFtdO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gICAgICAgIHdoaWxlIChjYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IGNiID0gY2FsbGJhY2tzLnNoaWZ0KCk7XG4gICAgICAgICAgYXdhaXQgaW52b2tlQ2FsbGJhY2soY2IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRGVhY3RpdmF0ZSB0aGlzIGZlbmNlIHNvIHRoYXQgYWRkaW5nIG1vcmUgd3JpdGVzIGhhcyBubyBlZmZlY3QuXG4gIC8vIFRoZSBmZW5jZSBtdXN0IGhhdmUgYWxyZWFkeSBmaXJlZC5cbiAgcmV0aXJlKCkge1xuICAgIGlmICghdGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHJldGlyZSBhIGZlbmNlIHRoYXQgaGFzbid0IGZpcmVkLlwiKTtcbiAgICB0aGlzLnJldGlyZWQgPSB0cnVlO1xuICB9XG59O1xuXG4vLyBUaGUgY3VycmVudCB3cml0ZSBmZW5jZS4gV2hlbiB0aGVyZSBpcyBhIGN1cnJlbnQgd3JpdGUgZmVuY2UsIGNvZGVcbi8vIHRoYXQgd3JpdGVzIHRvIGRhdGFiYXNlcyBzaG91bGQgcmVnaXN0ZXIgdGhlaXIgd3JpdGVzIHdpdGggaXQgdXNpbmdcbi8vIGJlZ2luV3JpdGUoKS5cbi8vXG5ERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlO1xuIiwiLy8gQSBcImNyb3NzYmFyXCIgaXMgYSBjbGFzcyB0aGF0IHByb3ZpZGVzIHN0cnVjdHVyZWQgbm90aWZpY2F0aW9uIHJlZ2lzdHJhdGlvbi5cbi8vIFNlZSBfbWF0Y2ggZm9yIHRoZSBkZWZpbml0aW9uIG9mIGhvdyBhIG5vdGlmaWNhdGlvbiBtYXRjaGVzIGEgdHJpZ2dlci5cbi8vIEFsbCBub3RpZmljYXRpb25zIGFuZCB0cmlnZ2VycyBtdXN0IGhhdmUgYSBzdHJpbmcga2V5IG5hbWVkICdjb2xsZWN0aW9uJy5cblxuRERQU2VydmVyLl9Dcm9zc2JhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgc2VsZi5uZXh0SWQgPSAxO1xuICAvLyBtYXAgZnJvbSBjb2xsZWN0aW9uIG5hbWUgKHN0cmluZykgLT4gbGlzdGVuZXIgaWQgLT4gb2JqZWN0LiBlYWNoIG9iamVjdCBoYXNcbiAgLy8ga2V5cyAndHJpZ2dlcicsICdjYWxsYmFjaycuICBBcyBhIGhhY2ssIHRoZSBlbXB0eSBzdHJpbmcgbWVhbnMgXCJub1xuICAvLyBjb2xsZWN0aW9uXCIuXG4gIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uID0ge307XG4gIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnQgPSB7fTtcbiAgc2VsZi5mYWN0UGFja2FnZSA9IG9wdGlvbnMuZmFjdFBhY2thZ2UgfHwgXCJsaXZlZGF0YVwiO1xuICBzZWxmLmZhY3ROYW1lID0gb3B0aW9ucy5mYWN0TmFtZSB8fCBudWxsO1xufTtcblxuXy5leHRlbmQoRERQU2VydmVyLl9Dcm9zc2Jhci5wcm90b3R5cGUsIHtcbiAgLy8gbXNnIGlzIGEgdHJpZ2dlciBvciBhIG5vdGlmaWNhdGlvblxuICBfY29sbGVjdGlvbkZvck1lc3NhZ2U6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgXy5oYXMobXNnLCAnY29sbGVjdGlvbicpKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YobXNnLmNvbGxlY3Rpb24pID09PSAnc3RyaW5nJykge1xuICAgICAgaWYgKG1zZy5jb2xsZWN0aW9uID09PSAnJylcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJNZXNzYWdlIGhhcyBlbXB0eSBjb2xsZWN0aW9uIVwiKTtcbiAgICAgIHJldHVybiBtc2cuY29sbGVjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoXCJNZXNzYWdlIGhhcyBub24tc3RyaW5nIGNvbGxlY3Rpb24hXCIpO1xuICAgIH1cbiAgfSxcblxuICAvLyBMaXN0ZW4gZm9yIG5vdGlmaWNhdGlvbiB0aGF0IG1hdGNoICd0cmlnZ2VyJy4gQSBub3RpZmljYXRpb25cbiAgLy8gbWF0Y2hlcyBpZiBpdCBoYXMgdGhlIGtleS12YWx1ZSBwYWlycyBpbiB0cmlnZ2VyIGFzIGFcbiAgLy8gc3Vic2V0LiBXaGVuIGEgbm90aWZpY2F0aW9uIG1hdGNoZXMsIGNhbGwgJ2NhbGxiYWNrJywgcGFzc2luZ1xuICAvLyB0aGUgYWN0dWFsIG5vdGlmaWNhdGlvbi5cbiAgLy9cbiAgLy8gUmV0dXJucyBhIGxpc3RlbiBoYW5kbGUsIHdoaWNoIGlzIGFuIG9iamVjdCB3aXRoIGEgbWV0aG9kXG4gIC8vIHN0b3AoKS4gQ2FsbCBzdG9wKCkgdG8gc3RvcCBsaXN0ZW5pbmcuXG4gIC8vXG4gIC8vIFhYWCBJdCBzaG91bGQgYmUgbGVnYWwgdG8gY2FsbCBmaXJlKCkgZnJvbSBpbnNpZGUgYSBsaXN0ZW4oKVxuICAvLyBjYWxsYmFjaz9cbiAgbGlzdGVuOiBmdW5jdGlvbiAodHJpZ2dlciwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGlkID0gc2VsZi5uZXh0SWQrKztcblxuICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5fY29sbGVjdGlvbkZvck1lc3NhZ2UodHJpZ2dlcik7XG4gICAgdmFyIHJlY29yZCA9IHt0cmlnZ2VyOiBFSlNPTi5jbG9uZSh0cmlnZ2VyKSwgY2FsbGJhY2s6IGNhbGxiYWNrfTtcbiAgICBpZiAoISBfLmhhcyhzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiwgY29sbGVjdGlvbikpIHtcbiAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dID0ge307XG4gICAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dID0gMDtcbiAgICB9XG4gICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl1baWRdID0gcmVjb3JkO1xuICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0rKztcblxuICAgIGlmIChzZWxmLmZhY3ROYW1lICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSkge1xuICAgICAgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIHNlbGYuZmFjdFBhY2thZ2UsIHNlbGYuZmFjdE5hbWUsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzZWxmLmZhY3ROYW1lICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSkge1xuICAgICAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICAgICAgc2VsZi5mYWN0UGFja2FnZSwgc2VsZi5mYWN0TmFtZSwgLTEpO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXVtpZF07XG4gICAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0tLTtcbiAgICAgICAgaWYgKHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0gPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl07XG4gICAgICAgICAgZGVsZXRlIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9LFxuXG4gIC8vIEZpcmUgdGhlIHByb3ZpZGVkICdub3RpZmljYXRpb24nIChhbiBvYmplY3Qgd2hvc2UgYXR0cmlidXRlXG4gIC8vIHZhbHVlcyBhcmUgYWxsIEpTT04tY29tcGF0aWJpbGUpIC0tIGluZm9ybSBhbGwgbWF0Y2hpbmcgbGlzdGVuZXJzXG4gIC8vIChyZWdpc3RlcmVkIHdpdGggbGlzdGVuKCkpLlxuICAvL1xuICAvLyBJZiBmaXJlKCkgaXMgY2FsbGVkIGluc2lkZSBhIHdyaXRlIGZlbmNlLCB0aGVuIGVhY2ggb2YgdGhlXG4gIC8vIGxpc3RlbmVyIGNhbGxiYWNrcyB3aWxsIGJlIGNhbGxlZCBpbnNpZGUgdGhlIHdyaXRlIGZlbmNlIGFzIHdlbGwuXG4gIC8vXG4gIC8vIFRoZSBsaXN0ZW5lcnMgbWF5IGJlIGludm9rZWQgaW4gcGFyYWxsZWwsIHJhdGhlciB0aGFuIHNlcmlhbGx5LlxuICBmaXJlOiBhc3luYyBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jb2xsZWN0aW9uRm9yTWVzc2FnZShub3RpZmljYXRpb24pO1xuXG4gICAgaWYgKCEgXy5oYXMoc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24sIGNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGxpc3RlbmVyc0ZvckNvbGxlY3Rpb24gPSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXTtcbiAgICB2YXIgY2FsbGJhY2tJZHMgPSBbXTtcbiAgICBfLmVhY2gobGlzdGVuZXJzRm9yQ29sbGVjdGlvbiwgZnVuY3Rpb24gKGwsIGlkKSB7XG4gICAgICBpZiAoc2VsZi5fbWF0Y2hlcyhub3RpZmljYXRpb24sIGwudHJpZ2dlcikpIHtcbiAgICAgICAgY2FsbGJhY2tJZHMucHVzaChpZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMaXN0ZW5lciBjYWxsYmFja3MgY2FuIHlpZWxkLCBzbyB3ZSBuZWVkIHRvIGZpcnN0IGZpbmQgYWxsIHRoZSBvbmVzIHRoYXRcbiAgICAvLyBtYXRjaCBpbiBhIHNpbmdsZSBpdGVyYXRpb24gb3ZlciBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiAod2hpY2ggY2FuJ3RcbiAgICAvLyBiZSBtdXRhdGVkIGR1cmluZyB0aGlzIGl0ZXJhdGlvbiksIGFuZCB0aGVuIGludm9rZSB0aGUgbWF0Y2hpbmdcbiAgICAvLyBjYWxsYmFja3MsIGNoZWNraW5nIGJlZm9yZSBlYWNoIGNhbGwgdG8gZW5zdXJlIHRoZXkgaGF2ZW4ndCBzdG9wcGVkLlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCBoYXZlIHRvIGNoZWNrIHRoYXRcbiAgICAvLyBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXSBzdGlsbCA9PT0gbGlzdGVuZXJzRm9yQ29sbGVjdGlvbixcbiAgICAvLyBiZWNhdXNlIHRoZSBvbmx5IHdheSB0aGF0IHN0b3BzIGJlaW5nIHRydWUgaXMgaWYgbGlzdGVuZXJzRm9yQ29sbGVjdGlvblxuICAgIC8vIGZpcnN0IGdldHMgcmVkdWNlZCBkb3duIHRvIHRoZSBlbXB0eSBvYmplY3QgKGFuZCB0aGVuIG5ldmVyIGdldHNcbiAgICAvLyBpbmNyZWFzZWQgYWdhaW4pLlxuICAgIGZvciAoY29uc3QgaWQgb2YgY2FsbGJhY2tJZHMpIHtcbiAgICAgIGlmIChfLmhhcyhsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLCBpZCkpIHtcbiAgICAgICAgYXdhaXQgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbltpZF0uY2FsbGJhY2sobm90aWZpY2F0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gQSBub3RpZmljYXRpb24gbWF0Y2hlcyBhIHRyaWdnZXIgaWYgYWxsIGtleXMgdGhhdCBleGlzdCBpbiBib3RoIGFyZSBlcXVhbC5cbiAgLy9cbiAgLy8gRXhhbXBsZXM6XG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIn1cbiAgLy8gICAgKGEgbm9uLXRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGFcbiAgLy8gICAgIG5vbi10YXJnZXRlZCBxdWVyeSlcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGEgbm9uLXRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn1cbiAgLy8gICAgKGEgbm9uLXRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGFcbiAgLy8gICAgIHRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifVxuICAvLyAgICAoYSB0YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gbWF0Y2hlcyBhIHRhcmdldGVkIHF1ZXJ5IHRhcmdldGVkXG4gIC8vICAgICBhdCB0aGUgc2FtZSBkb2N1bWVudClcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IGRvZXMgbm90IG1hdGNoIFQ6e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJZXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBkb2VzIG5vdCBtYXRjaCBhIHRhcmdldGVkIHF1ZXJ5XG4gIC8vICAgICB0YXJnZXRlZCBhdCBhIGRpZmZlcmVudCBkb2N1bWVudClcbiAgX21hdGNoZXM6IGZ1bmN0aW9uIChub3RpZmljYXRpb24sIHRyaWdnZXIpIHtcbiAgICAvLyBNb3N0IG5vdGlmaWNhdGlvbnMgdGhhdCB1c2UgdGhlIGNyb3NzYmFyIGhhdmUgYSBzdHJpbmcgYGNvbGxlY3Rpb25gIGFuZFxuICAgIC8vIG1heWJlIGFuIGBpZGAgdGhhdCBpcyBhIHN0cmluZyBvciBPYmplY3RJRC4gV2UncmUgYWxyZWFkeSBkaXZpZGluZyB1cFxuICAgIC8vIHRyaWdnZXJzIGJ5IGNvbGxlY3Rpb24sIGJ1dCBsZXQncyBmYXN0LXRyYWNrIFwibm9wZSwgZGlmZmVyZW50IElEXCIgKGFuZFxuICAgIC8vIGF2b2lkIHRoZSBvdmVybHkgZ2VuZXJpYyBFSlNPTi5lcXVhbHMpLiBUaGlzIG1ha2VzIGEgbm90aWNlYWJsZVxuICAgIC8vIHBlcmZvcm1hbmNlIGRpZmZlcmVuY2U7IHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9wdWxsLzM2OTdcbiAgICBpZiAodHlwZW9mKG5vdGlmaWNhdGlvbi5pZCkgPT09ICdzdHJpbmcnICYmXG4gICAgICAgIHR5cGVvZih0cmlnZ2VyLmlkKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgbm90aWZpY2F0aW9uLmlkICE9PSB0cmlnZ2VyLmlkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChub3RpZmljYXRpb24uaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEICYmXG4gICAgICAgIHRyaWdnZXIuaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEICYmXG4gICAgICAgICEgbm90aWZpY2F0aW9uLmlkLmVxdWFscyh0cmlnZ2VyLmlkKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBfLmFsbCh0cmlnZ2VyLCBmdW5jdGlvbiAodHJpZ2dlclZhbHVlLCBrZXkpIHtcbiAgICAgIHJldHVybiAhXy5oYXMobm90aWZpY2F0aW9uLCBrZXkpIHx8XG4gICAgICAgIEVKU09OLmVxdWFscyh0cmlnZ2VyVmFsdWUsIG5vdGlmaWNhdGlvbltrZXldKTtcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIFRoZSBcImludmFsaWRhdGlvbiBjcm9zc2JhclwiIGlzIGEgc3BlY2lmaWMgaW5zdGFuY2UgdXNlZCBieSB0aGUgRERQIHNlcnZlciB0b1xuLy8gaW1wbGVtZW50IHdyaXRlIGZlbmNlIG5vdGlmaWNhdGlvbnMuIExpc3RlbmVyIGNhbGxiYWNrcyBvbiB0aGlzIGNyb3NzYmFyXG4vLyBzaG91bGQgY2FsbCBiZWdpbldyaXRlIG9uIHRoZSBjdXJyZW50IHdyaXRlIGZlbmNlIGJlZm9yZSB0aGV5IHJldHVybiwgaWYgdGhleVxuLy8gd2FudCB0byBkZWxheSB0aGUgd3JpdGUgZmVuY2UgZnJvbSBmaXJpbmcgKGllLCB0aGUgRERQIG1ldGhvZC1kYXRhLXVwZGF0ZWRcbi8vIG1lc3NhZ2UgZnJvbSBiZWluZyBzZW50KS5cbkREUFNlcnZlci5fSW52YWxpZGF0aW9uQ3Jvc3NiYXIgPSBuZXcgRERQU2VydmVyLl9Dcm9zc2Jhcih7XG4gIGZhY3ROYW1lOiBcImludmFsaWRhdGlvbi1jcm9zc2Jhci1saXN0ZW5lcnNcIlxufSk7XG4iLCJpZiAocHJvY2Vzcy5lbnYuRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwpIHtcbiAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCA9XG4gICAgcHJvY2Vzcy5lbnYuRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkw7XG59XG5cbk1ldGVvci5zZXJ2ZXIgPSBuZXcgU2VydmVyKCk7XG5cbk1ldGVvci5yZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICBhd2FpdCBERFBTZXJ2ZXIuX0ludmFsaWRhdGlvbkNyb3NzYmFyLmZpcmUobm90aWZpY2F0aW9uKTtcbn07XG5cbi8vIFByb3h5IHRoZSBwdWJsaWMgbWV0aG9kcyBvZiBNZXRlb3Iuc2VydmVyIHNvIHRoZXkgY2FuXG4vLyBiZSBjYWxsZWQgZGlyZWN0bHkgb24gTWV0ZW9yLlxuXy5lYWNoKFxuICBbXG4gICAgJ3B1Ymxpc2gnLFxuICAgICdpc0FzeW5jQ2FsbCcsXG4gICAgJ21ldGhvZHMnLFxuICAgICdjYWxsJyxcbiAgICAnY2FsbEFzeW5jJyxcbiAgICAnYXBwbHknLFxuICAgICdhcHBseUFzeW5jJyxcbiAgICAnb25Db25uZWN0aW9uJyxcbiAgICAnb25NZXNzYWdlJyxcbiAgXSxcbiAgZnVuY3Rpb24obmFtZSkge1xuICAgIE1ldGVvcltuYW1lXSA9IF8uYmluZChNZXRlb3Iuc2VydmVyW25hbWVdLCBNZXRlb3Iuc2VydmVyKTtcbiAgfVxuKTtcbiJdfQ==

Package["core-runtime"].queue("ddp-client", ["meteor", "check", "random", "ejson", "tracker", "retry", "id-map", "ecmascript", "callback-hook", "ddp-common", "reload", "socket-stream-client", "diff-sequence", "mongo-id", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, callback, args, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/server/server.js                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("../common/namespace.js", {
      DDP: "DDP"
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/MethodInvoker.js                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  default: () => MethodInvoker
});
class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || (() => {});
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

    // If we're re-sending it, it doesn't matter if data was written the first
    // time.
    this._dataVisible = false;
    this.sentMessage = true;

    // If this is a wait method, make all data messages be buffered until it is
    // done.
    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

    // Actually send the message.
    this._connection._send(this._message);
  }
  // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]);

      // Forget about this method.
      delete this._connection._methodInvokers[this.methodId];

      // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.
      this._connection._outstandingMethodFinished();
    }
  }
  // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];
    this._onResultReceived(err, result);
    this._maybeInvokeCallback();
  }
  // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  dataVisible() {
    this._dataVisible = true;
    this._maybeInvokeCallback();
  }
  // True if receiveResult has been called.
  gotResult() {
    return !!this._methodResult;
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/livedata_connection.js                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    const _excluded = ["stubInvocation", "invocation"],
      _excluded2 = ["stubInvocation", "invocation"];
    module.export({
      Connection: () => Connection
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 1);
    let Tracker;
    module.link("meteor/tracker", {
      Tracker(v) {
        Tracker = v;
      }
    }, 2);
    let EJSON;
    module.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 3);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 4);
    let Hook;
    module.link("meteor/callback-hook", {
      Hook(v) {
        Hook = v;
      }
    }, 5);
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 6);
    let DDP;
    module.link("./namespace.js", {
      DDP(v) {
        DDP = v;
      }
    }, 7);
    let MethodInvoker;
    module.link("./MethodInvoker.js", {
      default(v) {
        MethodInvoker = v;
      }
    }, 8);
    let hasOwn, slice, keys, isEmpty, last;
    module.link("meteor/ddp-common/utils.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      slice(v) {
        slice = v;
      },
      keys(v) {
        keys = v;
      },
      isEmpty(v) {
        isEmpty = v;
      },
      last(v) {
        last = v;
      }
    }, 9);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class MongoIDMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    }

    // @param url {String|Object} URL to Meteor app,
    //   or an object as a test hook (see code)
    // Options:
    //   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
    //   headers: extra headers to send on the websockets connection, for
    //     server-to-server DDP only
    //   _sockjsOptions: Specifies options to pass through to the sockjs client
    //   onDDPNegotiationVersionFailure: callback when version negotiation fails.
    //
    // XXX There should be a way to destroy a DDP connection, causing all
    // outstanding method calls to fail.
    //
    // XXX Our current way of handling failure and reconnection is great
    // for an app (where we want to tolerate being disconnected as an
    // expect state, and keep trying forever to reconnect) but cumbersome
    // for something like a command line tool that wants to make a
    // connection, call a method, and print an error if connection
    // fails. We should have better usability in the latter case (while
    // still transparently reconnecting if it's just a transient failure
    // or the server migrating us).
    class Connection {
      constructor(url, options) {
        const self = this;
        this.options = options = _objectSpread({
          onConnected() {},
          onDDPVersionNegotiationFailure(description) {
            Meteor._debug(description);
          },
          heartbeatInterval: 17500,
          heartbeatTimeout: 15000,
          npmFayeOptions: Object.create(null),
          // These options are only for testing.
          reloadWithOutstanding: false,
          supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
          retry: true,
          respondToPings: true,
          // When updates are coming within this ms interval, batch them together.
          bufferedWritesInterval: 5,
          // Flush buffers immediately if writes are happening continuously for more than this many ms.
          bufferedWritesMaxAge: 500
        }, options);

        // If set, called when we reconnect, queuing method calls _before_ the
        // existing outstanding ones.
        // NOTE: This feature has been preserved for backwards compatibility. The
        // preferred method of setting a callback on reconnect is to use
        // DDP.onReconnect.
        self.onReconnect = null;

        // as a test hook, allow passing a stream instead of a url.
        if (typeof url === 'object') {
          self._stream = url;
        } else {
          const {
            ClientStream
          } = require("meteor/socket-stream-client");
          self._stream = new ClientStream(url, {
            retry: options.retry,
            ConnectionError: DDP.ConnectionError,
            headers: options.headers,
            _sockjsOptions: options._sockjsOptions,
            // Used to keep some tests quiet, or for other cases in which
            // the right thing to do with connection errors is to silently
            // fail (e.g. sending package usage stats). At some point we
            // should have a real API for handling client-stream-level
            // errors.
            _dontPrintErrors: options._dontPrintErrors,
            connectTimeoutMs: options.connectTimeoutMs,
            npmFayeOptions: options.npmFayeOptions
          });
        }
        self._lastSessionId = null;
        self._versionSuggestion = null; // The last proposed DDP version.
        self._version = null; // The DDP version agreed on by client and server.
        self._stores = Object.create(null); // name -> object with methods
        self._methodHandlers = Object.create(null); // name -> func
        self._nextMethodId = 1;
        self._supportedDDPVersions = options.supportedDDPVersions;
        self._heartbeatInterval = options.heartbeatInterval;
        self._heartbeatTimeout = options.heartbeatTimeout;

        // Tracks methods which the user has tried to call but which have not yet
        // called their user callback (ie, they are waiting on their result or for all
        // of their writes to be written to the local cache). Map from method ID to
        // MethodInvoker object.
        self._methodInvokers = Object.create(null);

        // Tracks methods which the user has called but whose result messages have not
        // arrived yet.
        //
        // _outstandingMethodBlocks is an array of blocks of methods. Each block
        // represents a set of methods that can run at the same time. The first block
        // represents the methods which are currently in flight; subsequent blocks
        // must wait for previous blocks to be fully finished before they can be sent
        // to the server.
        //
        // Each block is an object with the following fields:
        // - methods: a list of MethodInvoker objects
        // - wait: a boolean; if true, this block had a single method invoked with
        //         the "wait" option
        //
        // There will never be adjacent blocks with wait=false, because the only thing
        // that makes methods need to be serialized is a wait method.
        //
        // Methods are removed from the first block when their "result" is
        // received. The entire first block is only removed when all of the in-flight
        // methods have received their results (so the "methods" list is empty) *AND*
        // all of the data written by those methods are visible in the local cache. So
        // it is possible for the first block's methods list to be empty, if we are
        // still waiting for some objects to quiesce.
        //
        // Example:
        //  _outstandingMethodBlocks = [
        //    {wait: false, methods: []},
        //    {wait: true, methods: [<MethodInvoker for 'login'>]},
        //    {wait: false, methods: [<MethodInvoker for 'foo'>,
        //                            <MethodInvoker for 'bar'>]}]
        // This means that there were some methods which were sent to the server and
        // which have returned their results, but some of the data written by
        // the methods may not be visible in the local cache. Once all that data is
        // visible, we will send a 'login' method. Once the login method has returned
        // and all the data is visible (including re-running subs if userId changes),
        // we will send the 'foo' and 'bar' methods in parallel.
        self._outstandingMethodBlocks = [];

        // method ID -> array of objects with keys 'collection' and 'id', listing
        // documents written by a given method's stub. keys are associated with
        // methods whose stub wrote at least one document, and whose data-done message
        // has not yet been received.
        self._documentsWrittenByStub = {};
        // collection -> IdMap of "server document" object. A "server document" has:
        // - "document": the version of the document according the
        //   server (ie, the snapshot before a stub wrote it, amended by any changes
        //   received from the server)
        //   It is undefined if we think the document does not exist
        // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
        //   whose "data done" messages have not yet been processed
        self._serverDocuments = {};

        // Array of callbacks to be called after the next update of the local
        // cache. Used for:
        //  - Calling methodInvoker.dataVisible and sub ready callbacks after
        //    the relevant data is flushed.
        //  - Invoking the callbacks of "half-finished" methods after reconnect
        //    quiescence. Specifically, methods whose result was received over the old
        //    connection (so we don't re-send it) but whose data had not been made
        //    visible.
        self._afterUpdateCallbacks = [];

        // In two contexts, we buffer all incoming data messages and then process them
        // all at once in a single update:
        //   - During reconnect, we buffer all data messages until all subs that had
        //     been ready before reconnect are ready again, and all methods that are
        //     active have returned their "data done message"; then
        //   - During the execution of a "wait" method, we buffer all data messages
        //     until the wait method gets its "data done" message. (If the wait method
        //     occurs during reconnect, it doesn't get any special handling.)
        // all data messages are processed in one update.
        //
        // The following fields are used for this "quiescence" process.

        // This buffers the messages that aren't being processed yet.
        self._messagesBufferedUntilQuiescence = [];
        // Map from method ID -> true. Methods are removed from this when their
        // "data done" message is received, and we will not quiesce until it is
        // empty.
        self._methodsBlockingQuiescence = {};
        // map from sub ID -> true for subs that were ready (ie, called the sub
        // ready callback) before reconnect but haven't become ready again yet
        self._subsBeingRevived = {}; // map from sub._id -> true
        // if true, the next data update should reset all stores. (set during
        // reconnect.)
        self._resetStores = false;

        // name -> array of updates for (yet to be created) collections
        self._updatesForUnknownStores = {};
        // if we're blocking a migration, the retry func
        self._retryMigrate = null;
        self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self);
        // Collection name -> array of messages.
        self._bufferedWrites = {};
        // When current buffer of updates must be flushed at, in ms timestamp.
        self._bufferedWritesFlushAt = null;
        // Timeout handle for the next processing of all pending writes
        self._bufferedWritesFlushHandle = null;
        self._bufferedWritesInterval = options.bufferedWritesInterval;
        self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

        // metadata for subscriptions.  Map from sub ID to object with keys:
        //   - id
        //   - name
        //   - params
        //   - inactive (if true, will be cleaned up if not reused in re-run)
        //   - ready (has the 'ready' message been received?)
        //   - readyCallback (an optional callback to call when ready)
        //   - errorCallback (an optional callback to call if the sub terminates with
        //                    an error, XXX COMPAT WITH 1.0.3.1)
        //   - stopCallback (an optional callback to call when the sub terminates
        //     for any reason, with an error argument if an error triggered the stop)
        self._subscriptions = {};

        // Reactive userId.
        self._userId = null;
        self._userIdDeps = new Tracker.Dependency();

        // Block auto-reload while we're waiting for method responses.
        if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
          Package.reload.Reload._onMigrate(retry => {
            if (!self._readyToMigrate()) {
              self._retryMigrate = retry;
              return [false];
            } else {
              return [true];
            }
          });
        }
        const onDisconnect = () => {
          if (self._heartbeat) {
            self._heartbeat.stop();
            self._heartbeat = null;
          }
        };
        if (Meteor.isServer) {
          self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));
          self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));
          self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
        } else {
          self._stream.on('message', this.onMessage.bind(this));
          self._stream.on('reset', this.onReset.bind(this));
          self._stream.on('disconnect', onDisconnect);
        }
      }

      // 'name' is the name of the data on the wire that should go in the
      // store. 'wrappedStore' should be an object with methods beginUpdate, update,
      // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
      createStoreMethods(name, wrappedStore) {
        const self = this;
        if (name in self._stores) return false;

        // Wrap the input object in an object which makes any store method not
        // implemented by 'store' into a no-op.
        const store = Object.create(null);
        const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
        keysOfStore.forEach(method => {
          store[method] = function () {
            if (wrappedStore[method]) {
              return wrappedStore[method](...arguments);
            }
          };
        });
        self._stores[name] = store;
        return store;
      }
      registerStoreClient(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          store.beginUpdate(queued.length, false);
          queued.forEach(msg => {
            store.update(msg);
          });
          store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }
      async registerStoreServer(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          await store.beginUpdate(queued.length, false);
          for (const msg of queued) {
            await store.update(msg);
          }
          await store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.subscribe
       * @summary Subscribe to a record set.  Returns a handle that provides
       * `stop()` and `ready()` methods.
       * @locus Client
       * @param {String} name Name of the subscription.  Matches the name of the
       * server's `publish()` call.
       * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
       * function on server.
       * @param {Function|Object} [callbacks] Optional. May include `onStop`
       * and `onReady` callbacks. If there is an error, it is passed as an
       * argument to `onStop`. If a function is passed instead of an object, it
       * is interpreted as an `onReady` callback.
       */
      subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
        const self = this;
        const params = slice.call(arguments, 1);
        let callbacks = Object.create(null);
        if (params.length) {
          const lastParam = params[params.length - 1];
          if (typeof lastParam === 'function') {
            callbacks.onReady = params.pop();
          } else if (lastParam && [lastParam.onReady,
          // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
          // onStop with an error callback instead.
          lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
            callbacks = params.pop();
          }
        }

        // Is there an existing sub with the same name and param, run in an
        // invalidated Computation? This will happen if we are rerunning an
        // existing computation.
        //
        // For example, consider a rerun of:
        //
        //     Tracker.autorun(function () {
        //       Meteor.subscribe("foo", Session.get("foo"));
        //       Meteor.subscribe("bar", Session.get("bar"));
        //     });
        //
        // If "foo" has changed but "bar" has not, we will match the "bar"
        // subcribe to an existing inactive subscription in order to not
        // unsub and resub the subscription unnecessarily.
        //
        // We only look for one such sub; if there are N apparently-identical subs
        // being invalidated, we will require N matching subscribe calls to keep
        // them all active.
        const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
        let id;
        if (existing) {
          id = existing.id;
          existing.inactive = false; // reactivate

          if (callbacks.onReady) {
            // If the sub is not already ready, replace any ready callback with the
            // one provided now. (It's not really clear what users would expect for
            // an onReady callback inside an autorun; the semantics we provide is
            // that at the time the sub first becomes ready, we call the last
            // onReady callback provided, if any.)
            // If the sub is already ready, run the ready callback right away.
            // It seems that users would expect an onReady callback inside an
            // autorun to trigger once the the sub first becomes ready and also
            // when re-subs happens.
            if (existing.ready) {
              callbacks.onReady();
            } else {
              existing.readyCallback = callbacks.onReady;
            }
          }

          // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
          // onStop with an optional error argument
          if (callbacks.onError) {
            // Replace existing callback if any, so that errors aren't
            // double-reported.
            existing.errorCallback = callbacks.onError;
          }
          if (callbacks.onStop) {
            existing.stopCallback = callbacks.onStop;
          }
        } else {
          // New sub! Generate an id, save it locally, and send message.
          id = Random.id();
          self._subscriptions[id] = {
            id: id,
            name: name,
            params: EJSON.clone(params),
            inactive: false,
            ready: false,
            readyDeps: new Tracker.Dependency(),
            readyCallback: callbacks.onReady,
            // XXX COMPAT WITH 1.0.3.1 #errorCallback
            errorCallback: callbacks.onError,
            stopCallback: callbacks.onStop,
            connection: self,
            remove() {
              delete this.connection._subscriptions[this.id];
              this.ready && this.readyDeps.changed();
            },
            stop() {
              this.connection._send({
                msg: 'unsub',
                id: id
              });
              this.remove();
              if (callbacks.onStop) {
                callbacks.onStop();
              }
            }
          };
          self._send({
            msg: 'sub',
            id: id,
            name: name,
            params: params
          });
        }

        // return a handle to the application.
        const handle = {
          stop() {
            if (!hasOwn.call(self._subscriptions, id)) {
              return;
            }
            self._subscriptions[id].stop();
          },
          ready() {
            // return false if we've unsubscribed.
            if (!hasOwn.call(self._subscriptions, id)) {
              return false;
            }
            const record = self._subscriptions[id];
            record.readyDeps.depend();
            return record.ready;
          },
          subscriptionId: id
        };
        if (Tracker.active) {
          // We're in a reactive computation, so we'd like to unsubscribe when the
          // computation is invalidated... but not if the rerun just re-subscribes
          // to the same subscription!  When a rerun happens, we use onInvalidate
          // as a change to mark the subscription "inactive" so that it can
          // be reused from the rerun.  If it isn't reused, it's killed from
          // an afterFlush.
          Tracker.onInvalidate(c => {
            if (hasOwn.call(self._subscriptions, id)) {
              self._subscriptions[id].inactive = true;
            }
            Tracker.afterFlush(() => {
              if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
                handle.stop();
              }
            });
          });
        }
        return handle;
      }

      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @alias Meteor.isAsyncCall
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall() {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }
      methods(methods) {
        Object.entries(methods).forEach(_ref => {
          let [name, func] = _ref;
          if (typeof func !== 'function') {
            throw new Error("Method '" + name + "' must be a function");
          }
          if (this._methodHandlers[name]) {
            throw new Error("A method named '" + name + "' is already defined");
          }
          this._methodHandlers[name] = func;
        });
      }
      _getIsSimulation(_ref2) {
        let {
          isFromCallAsync,
          alreadyInSimulation
        } = _ref2;
        if (!isFromCallAsync) {
          return alreadyInSimulation;
        }
        return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.call
       * @summary Invokes a method with a sync stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
       */
      call(name /* .. [arguments] .. callback */) {
        // if it's a function, the last argument is the result callback,
        // not a parameter to the remote method.
        const args = slice.call(arguments, 1);
        let callback;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        return this.apply(name, args, callback);
      }
      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.callAsync
       * @summary Invokes a method with an async stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @returns {Promise}
       */
      async callAsync(name /* .. [arguments] .. */) {
        const args = slice.call(arguments, 1);
        if (args.length && typeof args[args.length - 1] === 'function') {
          throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
        }
        const applyOptions = ['returnStubValue', 'returnServerResultPromise', 'returnServerPromise'];
        const defaultOptions = {
          returnServerResultPromise: true
        };
        const options = _objectSpread(_objectSpread({}, defaultOptions), applyOptions.some(o => {
          var _args$;
          return (_args$ = args[0]) === null || _args$ === void 0 ? void 0 : _args$.hasOwnProperty(o);
        }) ? args.shift() : {});
        const invocation = DDP._CurrentCallAsyncInvocation.get();
        if (invocation !== null && invocation !== void 0 && invocation.hasCallAsyncParent) {
          return this.applyAsync(name, args, _objectSpread(_objectSpread({}, options), {}, {
            isFromCallAsync: true
          }));
        }

        /*
        * This is necessary because when you call a Promise.then, you're actually calling a bound function by Meteor.
        *
        * This is done by this code https://github.com/meteor/meteor/blob/17673c66878d3f7b1d564a4215eb0633fa679017/npm-packages/meteor-promise/promise_client.js#L1-L16. (All the logic below can be removed in the future, when we stop overwriting the
        * Promise.)
        *
        * When you call a ".then()", like "Meteor.callAsync().then()", the global context (inside currentValues)
        * will be from the call of Meteor.callAsync(), and not the context after the promise is done.
        *
        * This means that without this code if you call a stub inside the ".then()", this stub will act as a simulation
        * and won't reach the server.
        *
        * Inside the function _getIsSimulation(), if isFromCallAsync is false, we continue to consider just the
        * alreadyInSimulation, otherwise, isFromCallAsync is true, we also check the value of callAsyncMethodRunning (by
        * calling DDP._CurrentMethodInvocation._isCallAsyncMethodRunning()).
        *
        * With this, if a stub is running inside a ".then()", it'll know it's not a simulation, because callAsyncMethodRunning
        * will be false.
        *
        * DDP._CurrentMethodInvocation._set() is important because without it, if you have a code like:
        *
        * Meteor.callAsync("m1").then(() => {
        *   Meteor.callAsync("m2")
        * })
        *
        * The call the method m2 will act as a simulation and won't reach the server. That's why we reset the context here
        * before calling everything else.
        *
        * */
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
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.apply
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
       */
      apply(name, args, options, callback) {
        const _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall,
          stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return this._apply(name, stubOptions, args, options, callback);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.applyAsync
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       */
      async applyAsync(name, args, options) {
        let callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
        const _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall2,
          stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            /*
             * The code below follows the same logic as the function withValues().
             *
             * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
             * such as, the async/await.
             *
             * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
             */
            const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
            try {
              stubOptions.stubReturnValue = await stubInvocation();
            } catch (e) {
              stubOptions.exception = e;
            } finally {
              DDP._CurrentMethodInvocation._set(currentContext);
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return this._apply(name, stubOptions, args, options, callback);
      }
      _apply(name, stubCallValue, args, options, callback) {
        const self = this;
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = Object.create(null);
        }
        options = options || Object.create(null);
        if (callback) {
          // XXX would it be better form to do the binding in stream.on,
          // or caller, instead of here?
          // XXX improve error message (and how we report it)
          callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
        }
        const {
          hasStub,
          exception,
          stubReturnValue,
          alreadyInSimulation,
          randomSeed
        } = stubCallValue;

        // Keep our args safe from mutation (eg if we don't send the message for a
        // while because of a wait method).
        args = EJSON.clone(args);
        // If we're in a simulation, stop and return the result we have,
        // rather than going on to do an RPC. If there was no stub,
        // we'll end up returning undefined.
        if (this._getIsSimulation({
          alreadyInSimulation,
          isFromCallAsync: stubCallValue.isFromCallAsync
        })) {
          if (callback) {
            callback(exception, stubReturnValue);
            return undefined;
          }
          if (exception) throw exception;
          return stubReturnValue;
        }

        // We only create the methodId here because we don't actually need one if
        // we're already in a simulation
        const methodId = '' + self._nextMethodId++;
        if (hasStub) {
          self._retrieveAndStoreOriginals(methodId);
        }

        // Generate the DDP message for the method call. Note that on the client,
        // it is important that the stub have finished before we send the RPC, so
        // that we know we have a complete list of which local documents the stub
        // wrote.
        const message = {
          msg: 'method',
          id: methodId,
          method: name,
          params: args
        };

        // If an exception occurred in a stub, and we're ignoring it
        // because we're doing an RPC and want to use what the server
        // returns instead, log it so the developer knows
        // (unless they explicitly ask to see the error).
        //
        // Tests can set the '_expectedByTest' flag on an exception so it won't
        // go to log.
        if (exception) {
          if (options.throwStubExceptions) {
            throw exception;
          } else if (!exception._expectedByTest) {
            Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
          }
        }

        // At this point we're definitely doing an RPC, and we're going to
        // return the value of the RPC to the caller.

        // If the caller didn't give a callback, decide what to do.
        let future;
        if (!callback) {
          if (Meteor.isClient && !options.returnServerResultPromise && (!options.isFromCallAsync || options.returnStubValue)) {
            // On the client, we don't have fibers, so we can't block. The
            // only thing we can do is to return undefined and discard the
            // result of the RPC. If an error occurred then print the error
            // to the console.
            callback = err => {
              err && Meteor._debug("Error invoking Method '" + name + "'", err);
            };
          } else {
            // On the server, make the function synchronous. Throw on
            // errors, return on success.
            future = new Promise((resolve, reject) => {
              callback = function () {
                for (var _len = arguments.length, allArgs = new Array(_len), _key = 0; _key < _len; _key++) {
                  allArgs[_key] = arguments[_key];
                }
                let args = Array.from(allArgs);
                let err = args.shift();
                if (err) {
                  reject(err);
                  return;
                }
                resolve(...args);
              };
            });
          }
        }

        // Send the randomSeed only if we used it
        if (randomSeed.value !== null) {
          message.randomSeed = randomSeed.value;
        }
        const methodInvoker = new MethodInvoker({
          methodId,
          callback: callback,
          connection: self,
          onResultReceived: options.onResultReceived,
          wait: !!options.wait,
          message: message,
          noRetry: !!options.noRetry
        });
        if (options.wait) {
          // It's a wait method! Wait methods go in their own block.
          self._outstandingMethodBlocks.push({
            wait: true,
            methods: [methodInvoker]
          });
        } else {
          // Not a wait method. Start a new block if the previous block was a wait
          // block, and add it to the last block of methods.
          if (isEmpty(self._outstandingMethodBlocks) || last(self._outstandingMethodBlocks).wait) {
            self._outstandingMethodBlocks.push({
              wait: false,
              methods: []
            });
          }
          last(self._outstandingMethodBlocks).methods.push(methodInvoker);
        }

        // If we added it to the first block, send it out now.
        if (self._outstandingMethodBlocks.length === 1) methodInvoker.sendMessage();

        // If we're using the default callback on the server,
        // block waiting for the result.
        if (future) {
          if (options.returnServerPromise) {
            return future;
          }
          return options.returnStubValue ? future.then(() => stubReturnValue) : {
            stubValuePromise: future
          };
        }
        return options.returnStubValue ? stubReturnValue : undefined;
      }
      _stubCall(name, args, options) {
        // Run the stub, if we have one. The stub is supposed to make some
        // temporary writes to the database to give the user a smooth experience
        // until the actual result of executing the method comes back from the
        // server (whereupon the temporary writes to the database will be reversed
        // during the beginUpdate/endUpdate process.)
        //
        // Normally, we ignore the return value of the stub (even if it is an
        // exception), in favor of the real return value from the server. The
        // exception is if the *caller* is a stub. In that case, we're not going
        // to do a RPC, so we use the return value of the stub as our return
        // value.
        const self = this;
        const enclosing = DDP._CurrentMethodInvocation.get();
        const stub = self._methodHandlers[name];
        const alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
        const isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
        const randomSeed = {
          value: null
        };
        const defaultReturn = {
          alreadyInSimulation,
          randomSeed,
          isFromCallAsync
        };
        if (!stub) {
          return _objectSpread(_objectSpread({}, defaultReturn), {}, {
            hasStub: false
          });
        }

        // Lazily generate a randomSeed, only if it is requested by the stub.
        // The random streams only have utility if they're used on both the client
        // and the server; if the client doesn't generate any 'random' values
        // then we don't expect the server to generate any either.
        // Less commonly, the server may perform different actions from the client,
        // and may in fact generate values where the client did not, but we don't
        // have any client-side values to match, so even here we may as well just
        // use a random seed on the server.  In that case, we don't pass the
        // randomSeed to save bandwidth, and we don't even generate it to save a
        // bit of CPU and to avoid consuming entropy.

        const randomSeedGenerator = () => {
          if (randomSeed.value === null) {
            randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
          }
          return randomSeed.value;
        };
        const setUserId = userId => {
          self.setUserId(userId);
        };
        const invocation = new DDPCommon.MethodInvocation({
          isSimulation: true,
          userId: self.userId(),
          isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
          setUserId: setUserId,
          randomSeed() {
            return randomSeedGenerator();
          }
        });

        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        const stubInvocation = () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        };
        return _objectSpread(_objectSpread({}, defaultReturn), {}, {
          hasStub: true,
          stubInvocation,
          invocation
        });
      }

      // Before calling a method stub, prepare all stores to track changes and allow
      // _retrieveAndStoreOriginals to get the original versions of changed
      // documents.
      _saveOriginals() {
        if (!this._waitingForQuiescence()) {
          this._flushBufferedWritesClient();
        }
        Object.values(this._stores).forEach(store => {
          store.saveOriginals();
        });
      }

      // Retrieves the original versions of all documents modified by the stub for
      // method 'methodId' from all stores and saves them to _serverDocuments (keyed
      // by document) and _documentsWrittenByStub (keyed by method ID).
      _retrieveAndStoreOriginals(methodId) {
        const self = this;
        if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
        const docsWritten = [];
        Object.entries(self._stores).forEach(_ref3 => {
          let [collection, store] = _ref3;
          const originals = store.retrieveOriginals();
          // not all stores define retrieveOriginals
          if (!originals) return;
          originals.forEach((doc, id) => {
            docsWritten.push({
              collection,
              id
            });
            if (!hasOwn.call(self._serverDocuments, collection)) {
              self._serverDocuments[collection] = new MongoIDMap();
            }
            const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
            if (serverDoc.writtenByStubs) {
              // We're not the first stub to write this doc. Just add our method ID
              // to the record.
              serverDoc.writtenByStubs[methodId] = true;
            } else {
              // First stub! Save the original value and our method ID.
              serverDoc.document = doc;
              serverDoc.flushCallbacks = [];
              serverDoc.writtenByStubs = Object.create(null);
              serverDoc.writtenByStubs[methodId] = true;
            }
          });
        });
        if (!isEmpty(docsWritten)) {
          self._documentsWrittenByStub[methodId] = docsWritten;
        }
      }

      // This is very much a private function we use to make the tests
      // take up fewer server resources after they complete.
      _unsubscribeAll() {
        Object.values(this._subscriptions).forEach(sub => {
          // Avoid killing the autoupdate subscription so that developers
          // still get hot code pushes when writing tests.
          //
          // XXX it's a hack to encode knowledge about autoupdate here,
          // but it doesn't seem worth it yet to have a special API for
          // subscriptions to preserve after unit tests.
          if (sub.name !== 'meteor_autoupdate_clientVersions') {
            sub.stop();
          }
        });
      }

      // Sends the DDP stringification of the given message object
      _send(obj) {
        this._stream.send(DDPCommon.stringifyDDP(obj));
      }

      // We detected via DDP-level heartbeats that we've lost the
      // connection.  Unlike `disconnect` or `close`, a lost connection
      // will be automatically retried.
      _lostConnection(error) {
        this._stream._lostConnection(error);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.status
       * @summary Get the current connection status. A reactive data source.
       * @locus Client
       */
      status() {
        return this._stream.status(...arguments);
      }

      /**
       * @summary Force an immediate reconnection attempt if the client is not connected to the server.
       This method does nothing if the client is already connected.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.reconnect
       * @locus Client
       */
      reconnect() {
        return this._stream.reconnect(...arguments);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.disconnect
       * @summary Disconnect the client from the server.
       * @locus Client
       */
      disconnect() {
        return this._stream.disconnect(...arguments);
      }
      close() {
        return this._stream.disconnect({
          _permanent: true
        });
      }

      ///
      /// Reactive user system
      ///
      userId() {
        if (this._userIdDeps) this._userIdDeps.depend();
        return this._userId;
      }
      setUserId(userId) {
        // Avoid invalidating dependents if setUserId is called with current value.
        if (this._userId === userId) return;
        this._userId = userId;
        if (this._userIdDeps) this._userIdDeps.changed();
      }

      // Returns true if we are in a state after reconnect of waiting for subs to be
      // revived or early methods to finish their data, or we are waiting for a
      // "wait" method to finish.
      _waitingForQuiescence() {
        return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
      }

      // Returns true if any method whose message has been sent to the server has
      // not yet invoked its user callback.
      _anyMethodsAreOutstanding() {
        const invokers = this._methodInvokers;
        return Object.values(invokers).some(invoker => !!invoker.sentMessage);
      }
      async _livedata_connected(msg) {
        const self = this;
        if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
          self._heartbeat = new DDPCommon.Heartbeat({
            heartbeatInterval: self._heartbeatInterval,
            heartbeatTimeout: self._heartbeatTimeout,
            onTimeout() {
              self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
            },
            sendPing() {
              self._send({
                msg: 'ping'
              });
            }
          });
          self._heartbeat.start();
        }

        // If this is a reconnect, we'll have to reset all stores.
        if (self._lastSessionId) self._resetStores = true;
        let reconnectedToPreviousSession;
        if (typeof msg.session === 'string') {
          reconnectedToPreviousSession = self._lastSessionId === msg.session;
          self._lastSessionId = msg.session;
        }
        if (reconnectedToPreviousSession) {
          // Successful reconnection -- pick up where we left off.  Note that right
          // now, this never happens: the server never connects us to a previous
          // session, because DDP doesn't provide enough data for the server to know
          // what messages the client has processed. We need to improve DDP to make
          // this possible, at which point we'll probably need more code here.
          return;
        }

        // Server doesn't have our data any more. Re-sync a new session.

        // Forget about messages we were buffering for unknown collections. They'll
        // be resent if still relevant.
        self._updatesForUnknownStores = Object.create(null);
        if (self._resetStores) {
          // Forget about the effects of stubs. We'll be resetting all collections
          // anyway.
          self._documentsWrittenByStub = Object.create(null);
          self._serverDocuments = Object.create(null);
        }

        // Clear _afterUpdateCallbacks.
        self._afterUpdateCallbacks = [];

        // Mark all named subscriptions which are ready (ie, we already called the
        // ready callback) as needing to be revived.
        // XXX We should also block reconnect quiescence until unnamed subscriptions
        //     (eg, autopublish) are done re-publishing to avoid flicker!
        self._subsBeingRevived = Object.create(null);
        Object.entries(self._subscriptions).forEach(_ref4 => {
          let [id, sub] = _ref4;
          if (sub.ready) {
            self._subsBeingRevived[id] = true;
          }
        });

        // Arrange for "half-finished" methods to have their callbacks run, and
        // track methods that were sent on this connection so that we don't
        // quiesce until they are all done.
        //
        // Start by clearing _methodsBlockingQuiescence: methods sent before
        // reconnect don't matter, and any "wait" methods sent on the new connection
        // that we drop here will be restored by the loop below.
        self._methodsBlockingQuiescence = Object.create(null);
        if (self._resetStores) {
          const invokers = self._methodInvokers;
          keys(invokers).forEach(id => {
            const invoker = invokers[id];
            if (invoker.gotResult()) {
              // This method already got its result, but it didn't call its callback
              // because its data didn't become visible. We did not resend the
              // method RPC. We'll call its callback when we get a full quiesce,
              // since that's as close as we'll get to "data must be visible".
              self._afterUpdateCallbacks.push(function () {
                return invoker.dataVisible(...arguments);
              });
            } else if (invoker.sentMessage) {
              // This method has been sent on this connection (maybe as a resend
              // from the last connection, maybe from onReconnect, maybe just very
              // quickly before processing the connected message).
              //
              // We don't need to do anything special to ensure its callbacks get
              // called, but we'll count it as a method which is preventing
              // reconnect quiescence. (eg, it might be a login method that was run
              // from onReconnect, and we don't want to see flicker by seeing a
              // logged-out state.)
              self._methodsBlockingQuiescence[invoker.methodId] = true;
            }
          });
        }
        self._messagesBufferedUntilQuiescence = [];

        // If we're not waiting on any methods or subs, we can reset the stores and
        // call the callbacks immediately.
        if (!self._waitingForQuiescence()) {
          if (self._resetStores) {
            for (const store of Object.values(self._stores)) {
              await store.beginUpdate(0, true);
              await store.endUpdate();
            }
            self._resetStores = false;
          }
          self._runAfterUpdateCallbacks();
        }
      }
      async _processOneDataMessage(msg, updates) {
        const messageType = msg.msg;

        // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']
        if (messageType === 'added') {
          await this._process_added(msg, updates);
        } else if (messageType === 'changed') {
          this._process_changed(msg, updates);
        } else if (messageType === 'removed') {
          this._process_removed(msg, updates);
        } else if (messageType === 'ready') {
          this._process_ready(msg, updates);
        } else if (messageType === 'updated') {
          this._process_updated(msg, updates);
        } else if (messageType === 'nosub') {
          // ignore this
        } else {
          Meteor._debug('discarding unknown livedata data message type', msg);
        }
      }
      async _livedata_data(msg) {
        const self = this;
        if (self._waitingForQuiescence()) {
          self._messagesBufferedUntilQuiescence.push(msg);
          if (msg.msg === 'nosub') {
            delete self._subsBeingRevived[msg.id];
          }
          if (msg.subs) {
            msg.subs.forEach(subId => {
              delete self._subsBeingRevived[subId];
            });
          }
          if (msg.methods) {
            msg.methods.forEach(methodId => {
              delete self._methodsBlockingQuiescence[methodId];
            });
          }
          if (self._waitingForQuiescence()) {
            return;
          }

          // No methods or subs are blocking quiescence!
          // We'll now process and all of our buffered messages, reset all stores,
          // and apply them all at once.

          const bufferedMessages = self._messagesBufferedUntilQuiescence;
          for (const bufferedMessage of Object.values(bufferedMessages)) {
            await self._processOneDataMessage(bufferedMessage, self._bufferedWrites);
          }
          self._messagesBufferedUntilQuiescence = [];
        } else {
          await self._processOneDataMessage(msg, self._bufferedWrites);
        }

        // Immediately flush writes when:
        //  1. Buffering is disabled. Or;
        //  2. any non-(added/changed/removed) message arrives.
        const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
        if (self._bufferedWritesInterval === 0 || !standardWrite) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushAt === null) {
          self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
        } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
        }
        self._bufferedWritesFlushHandle = setTimeout(() => {
          // __flushBufferedWrites is a promise, so with this we can wait the promise to finish
          // before doing something
          self._liveDataWritesPromise = self.__flushBufferedWrites();
          if (Meteor._isPromise(self._liveDataWritesPromise)) {
            self._liveDataWritesPromise.finally(() => self._liveDataWritesPromise = undefined);
          }
        }, self._bufferedWritesInterval);
      }
      _prepareBuffersToFlush() {
        const self = this;
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
          self._bufferedWritesFlushHandle = null;
        }
        self._bufferedWritesFlushAt = null;
        // We need to clear the buffer before passing it to
        //  performWrites. As there's no guarantee that it
        //  will exit cleanly.
        const writes = self._bufferedWrites;
        self._bufferedWrites = Object.create(null);
        return writes;
      }
      async _flushBufferedWritesServer() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        await self._performWritesServer(writes);
      }
      _flushBufferedWritesClient() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        self._performWritesClient(writes);
      }
      _flushBufferedWrites() {
        const self = this;
        return Meteor.isClient ? self._flushBufferedWritesClient() : self._flushBufferedWritesServer();
      }
      async _performWritesServer(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            await store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                await store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            await store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }
      _performWritesClient(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }

      // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
      // relevant docs have been flushed, as well as dataVisible callbacks at
      // reconnect-quiescence time.
      _runAfterUpdateCallbacks() {
        const self = this;
        const callbacks = self._afterUpdateCallbacks;
        self._afterUpdateCallbacks = [];
        callbacks.forEach(c => {
          c();
        });
      }
      _pushUpdate(updates, collection, msg) {
        if (!hasOwn.call(updates, collection)) {
          updates[collection] = [];
        }
        updates[collection].push(msg);
      }
      _getServerDoc(collection, id) {
        const self = this;
        if (!hasOwn.call(self._serverDocuments, collection)) {
          return null;
        }
        const serverDocsForCollection = self._serverDocuments[collection];
        return serverDocsForCollection.get(id) || null;
      }
      async _process_added(msg, updates) {
        const self = this;
        const id = MongoID.idParse(msg.id);
        const serverDoc = self._getServerDoc(msg.collection, id);
        if (serverDoc) {
          // Some outstanding stub wrote here.
          const isExisting = serverDoc.document !== undefined;
          serverDoc.document = msg.fields || Object.create(null);
          serverDoc.document._id = id;
          if (self._resetStores) {
            // During reconnect the server is sending adds for existing ids.
            // Always push an update so that document stays in the store after
            // reset. Use current version of the document for this update, so
            // that stub-written values are preserved.
            const currentDoc = await self._stores[msg.collection].getDoc(msg.id);
            if (currentDoc !== undefined) msg.fields = currentDoc;
            self._pushUpdate(updates, msg.collection, msg);
          } else if (isExisting) {
            throw new Error('Server sent add for existing id: ' + msg.id);
          }
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_changed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
          DiffSequence.applyChanges(serverDoc.document, msg.fields);
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_removed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          // Some outstanding stub wrote here.
          if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
          serverDoc.document = undefined;
        } else {
          self._pushUpdate(updates, msg.collection, {
            msg: 'removed',
            collection: msg.collection,
            id: msg.id
          });
        }
      }
      _process_updated(msg, updates) {
        const self = this;
        // Process "method done" messages.

        msg.methods.forEach(methodId => {
          const docs = self._documentsWrittenByStub[methodId] || {};
          Object.values(docs).forEach(written => {
            const serverDoc = self._getServerDoc(written.collection, written.id);
            if (!serverDoc) {
              throw new Error('Lost serverDoc for ' + JSON.stringify(written));
            }
            if (!serverDoc.writtenByStubs[methodId]) {
              throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
            }
            delete serverDoc.writtenByStubs[methodId];
            if (isEmpty(serverDoc.writtenByStubs)) {
              // All methods whose stubs wrote this method have completed! We can
              // now copy the saved document to the database (reverting the stub's
              // change if the server did not write to this object, or applying the
              // server's writes if it did).

              // This is a fake ddp 'replace' message.  It's just for talking
              // between livedata connections and minimongo.  (We have to stringify
              // the ID because it's supposed to look like a wire message.)
              self._pushUpdate(updates, written.collection, {
                msg: 'replace',
                id: MongoID.idStringify(written.id),
                replace: serverDoc.document
              });
              // Call all flush callbacks.

              serverDoc.flushCallbacks.forEach(c => {
                c();
              });

              // Delete this completed serverDocument. Don't bother to GC empty
              // IdMaps inside self._serverDocuments, since there probably aren't
              // many collections and they'll be written repeatedly.
              self._serverDocuments[written.collection].remove(written.id);
            }
          });
          delete self._documentsWrittenByStub[methodId];

          // We want to call the data-written callback, but we can't do so until all
          // currently buffered messages are flushed.
          const callbackInvoker = self._methodInvokers[methodId];
          if (!callbackInvoker) {
            throw new Error('No callback invoker for method ' + methodId);
          }
          self._runWhenAllServerDocsAreFlushed(function () {
            return callbackInvoker.dataVisible(...arguments);
          });
        });
      }
      _process_ready(msg, updates) {
        const self = this;
        // Process "sub ready" messages. "sub ready" messages don't take effect
        // until all current server documents have been flushed to the local
        // database. We can use a write fence to implement this.

        msg.subs.forEach(subId => {
          self._runWhenAllServerDocsAreFlushed(() => {
            const subRecord = self._subscriptions[subId];
            // Did we already unsubscribe?
            if (!subRecord) return;
            // Did we already receive a ready message? (Oops!)
            if (subRecord.ready) return;
            subRecord.ready = true;
            subRecord.readyCallback && subRecord.readyCallback();
            subRecord.readyDeps.changed();
          });
        });
      }

      // Ensures that "f" will be called after all documents currently in
      // _serverDocuments have been written to the local cache. f will not be called
      // if the connection is lost before then!
      _runWhenAllServerDocsAreFlushed(f) {
        const self = this;
        const runFAfterUpdates = () => {
          self._afterUpdateCallbacks.push(f);
        };
        let unflushedServerDocCount = 0;
        const onServerDocFlush = () => {
          --unflushedServerDocCount;
          if (unflushedServerDocCount === 0) {
            // This was the last doc to flush! Arrange to run f after the updates
            // have been applied.
            runFAfterUpdates();
          }
        };
        Object.values(self._serverDocuments).forEach(serverDocuments => {
          serverDocuments.forEach(serverDoc => {
            const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
              const invoker = self._methodInvokers[methodId];
              return invoker && invoker.sentMessage;
            });
            if (writtenByStubForAMethodWithSentMessage) {
              ++unflushedServerDocCount;
              serverDoc.flushCallbacks.push(onServerDocFlush);
            }
          });
        });
        if (unflushedServerDocCount === 0) {
          // There aren't any buffered docs --- we can call f as soon as the current
          // round of updates is applied!
          runFAfterUpdates();
        }
      }
      async _livedata_nosub(msg) {
        const self = this;

        // First pass it through _livedata_data, which only uses it to help get
        // towards quiescence.
        await self._livedata_data(msg);

        // Do the rest of our processing immediately, with no
        // buffering-until-quiescence.

        // we weren't subbed anyway, or we initiated the unsub.
        if (!hasOwn.call(self._subscriptions, msg.id)) {
          return;
        }

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        const errorCallback = self._subscriptions[msg.id].errorCallback;
        const stopCallback = self._subscriptions[msg.id].stopCallback;
        self._subscriptions[msg.id].remove();
        const meteorErrorFromMsg = msgArg => {
          return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
        };

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        if (errorCallback && msg.error) {
          errorCallback(meteorErrorFromMsg(msg));
        }
        if (stopCallback) {
          stopCallback(meteorErrorFromMsg(msg));
        }
      }
      async _livedata_result(msg) {
        // id, result or error. error has error (code), reason, details

        const self = this;

        // Lets make sure there are no buffered writes before returning result.
        if (!isEmpty(self._bufferedWrites)) {
          await self._flushBufferedWrites();
        }

        // find the outstanding request
        // should be O(1) in nearly all realistic use cases
        if (isEmpty(self._outstandingMethodBlocks)) {
          Meteor._debug('Received method result but no methods outstanding');
          return;
        }
        const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
        let i;
        const m = currentMethodBlock.find((method, idx) => {
          const found = method.methodId === msg.id;
          if (found) i = idx;
          return found;
        });
        if (!m) {
          Meteor._debug("Can't match method response to original method call", msg);
          return;
        }

        // Remove from current method block. This may leave the block empty, but we
        // don't move on to the next block until the callback has been delivered, in
        // _outstandingMethodFinished.
        currentMethodBlock.splice(i, 1);
        if (hasOwn.call(msg, 'error')) {
          m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
        } else {
          // msg.result may be undefined if the method didn't return a
          // value
          m.receiveResult(undefined, msg.result);
        }
      }

      // Called by MethodInvoker after a method's callback is invoked.  If this was
      // the last outstanding method in the current block, runs the next block. If
      // there are no more methods, consider accepting a hot code push.
      _outstandingMethodFinished() {
        const self = this;
        if (self._anyMethodsAreOutstanding()) return;

        // No methods are outstanding. This should mean that the first block of
        // methods is empty. (Or it might not exist, if this was a method that
        // half-finished before disconnect/reconnect.)
        if (!isEmpty(self._outstandingMethodBlocks)) {
          const firstBlock = self._outstandingMethodBlocks.shift();
          if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

          // Send the outstanding methods now in the first block.
          if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
        }

        // Maybe accept a hot code push.
        self._maybeMigrate();
      }

      // Sends messages for all the methods in the first block in
      // _outstandingMethodBlocks.
      _sendOutstandingMethods() {
        const self = this;
        if (isEmpty(self._outstandingMethodBlocks)) {
          return;
        }
        self._outstandingMethodBlocks[0].methods.forEach(m => {
          m.sendMessage();
        });
      }
      _livedata_error(msg) {
        Meteor._debug('Received error from server: ', msg.reason);
        if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
      }
      _callOnReconnectAndSendAppropriateOutstandingMethods() {
        const self = this;
        const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
        self._outstandingMethodBlocks = [];
        self.onReconnect && self.onReconnect();
        DDP._reconnectHook.each(callback => {
          callback(self);
          return true;
        });
        if (isEmpty(oldOutstandingMethodBlocks)) return;

        // We have at least one block worth of old outstanding methods to try
        // again. First: did onReconnect actually send anything? If not, we just
        // restore all outstanding methods and run the first block.
        if (isEmpty(self._outstandingMethodBlocks)) {
          self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
          self._sendOutstandingMethods();
          return;
        }

        // OK, there are blocks on both sides. Special case: merge the last block of
        // the reconnect methods with the first block of the original methods, if
        // neither of them are "wait" blocks.
        if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
          oldOutstandingMethodBlocks[0].methods.forEach(m => {
            last(self._outstandingMethodBlocks).methods.push(m);

            // If this "last block" is also the first block, send the message.
            if (self._outstandingMethodBlocks.length === 1) {
              m.sendMessage();
            }
          });
          oldOutstandingMethodBlocks.shift();
        }

        // Now add the rest of the original blocks on.
        self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
      }

      // We can accept a hot code push if there are no methods in flight.
      _readyToMigrate() {
        return isEmpty(this._methodInvokers);
      }

      // If we were blocking a migration, see if it's now possible to continue.
      // Call whenever the set of outstanding/blocked methods shrinks.
      _maybeMigrate() {
        const self = this;
        if (self._retryMigrate && self._readyToMigrate()) {
          self._retryMigrate();
          self._retryMigrate = null;
        }
      }
      async onMessage(raw_msg) {
        let msg;
        try {
          msg = DDPCommon.parseDDP(raw_msg);
        } catch (e) {
          Meteor._debug('Exception while parsing DDP', e);
          return;
        }

        // Any message counts as receiving a pong, as it demonstrates that
        // the server is still alive.
        if (this._heartbeat) {
          this._heartbeat.messageReceived();
        }
        if (msg === null || !msg.msg) {
          if (!msg || !msg.testMessageOnConnect) {
            if (Object.keys(msg).length === 1 && msg.server_id) return;
            Meteor._debug('discarding invalid livedata message', msg);
          }
          return;
        }
        if (msg.msg === 'connected') {
          this._version = this._versionSuggestion;
          await this._livedata_connected(msg);
          this.options.onConnected();
        } else if (msg.msg === 'failed') {
          if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
            this._versionSuggestion = msg.version;
            this._stream.reconnect({
              _force: true
            });
          } else {
            const description = 'DDP version negotiation failed; server requested version ' + msg.version;
            this._stream.disconnect({
              _permanent: true,
              _error: description
            });
            this.options.onDDPVersionNegotiationFailure(description);
          }
        } else if (msg.msg === 'ping' && this.options.respondToPings) {
          this._send({
            msg: 'pong',
            id: msg.id
          });
        } else if (msg.msg === 'pong') {
          // noop, as we assume everything's a pong
        } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
          await this._livedata_data(msg);
        } else if (msg.msg === 'nosub') {
          await this._livedata_nosub(msg);
        } else if (msg.msg === 'result') {
          await this._livedata_result(msg);
        } else if (msg.msg === 'error') {
          this._livedata_error(msg);
        } else {
          Meteor._debug('discarding unknown livedata message type', msg);
        }
      }
      onReset() {
        // Send a connect message at the beginning of the stream.
        // NOTE: reset is called even on the first connection, so this is
        // the only place we send this message.
        const msg = {
          msg: 'connect'
        };
        if (this._lastSessionId) msg.session = this._lastSessionId;
        msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
        this._versionSuggestion = msg.version;
        msg.support = this._supportedDDPVersions;
        this._send(msg);

        // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
        // current block is pretty important to making sure that quiescence is properly calculated, as
        // well as possibly moving on to another useful block.

        // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
        // we are connecting for the first time.
        if (this._outstandingMethodBlocks.length > 0) {
          // If there is an outstanding method block, we only care about the first one as that is the
          // one that could have already sent messages with no response, that are not allowed to retry.
          const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
          this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
            // Methods with 'noRetry' option set are not allowed to re-send after
            // recovering dropped connection.
            if (methodInvoker.sentMessage && methodInvoker.noRetry) {
              // Make sure that the method is told that it failed.
              methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
            }

            // Only keep a method if it wasn't sent or it's allowed to retry.
            // This may leave the block empty, but we don't move on to the next
            // block until the callback has been delivered, in _outstandingMethodFinished.
            return !(methodInvoker.sentMessage && methodInvoker.noRetry);
          });
        }

        // Now, to minimize setup latency, go ahead and blast out all of
        // our pending methods ands subscriptions before we've even taken
        // the necessary RTT to know if we successfully reconnected. (1)
        // They're supposed to be idempotent, and where they are not,
        // they can block retry in apply; (2) even if we did reconnect,
        // we're not sure what messages might have gotten lost
        // (in either direction) since we were disconnected (TCP being
        // sloppy about that.)

        // If the current block of methods all got their results (but didn't all get
        // their data visible), discard the empty block now.
        if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
          this._outstandingMethodBlocks.shift();
        }

        // Mark all messages as unsent, they have not yet been sent on this
        // connection.
        keys(this._methodInvokers).forEach(id => {
          this._methodInvokers[id].sentMessage = false;
        });

        // If an `onReconnect` handler is set, call it first. Go through
        // some hoops to ensure that methods that are called from within
        // `onReconnect` get executed _before_ ones that were originally
        // outstanding (since `onReconnect` is used to re-establish auth
        // certificates)
        this._callOnReconnectAndSendAppropriateOutstandingMethods();

        // add new subscriptions at the end. this way they take effect after
        // the handlers and we don't see flicker.
        Object.entries(this._subscriptions).forEach(_ref5 => {
          let [id, sub] = _ref5;
          this._send({
            msg: 'sub',
            id: id,
            name: sub.name,
            params: sub.params
          });
        });
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/namespace.js                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DDP: () => DDP
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let Connection;
    module.link("./livedata_connection.js", {
      Connection(v) {
        Connection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // This array allows the `_allSubscriptionsReady` method below, which
    // is used by the `spiderable` package, to keep track of whether all
    // data is ready.
    const allConnections = [];

    /**
     * @namespace DDP
     * @summary Namespace for DDP-related methods/classes.
     */
    const DDP = {};
    // This is private but it's used in a few places. accounts-base uses
    // it to get the current user. Meteor.setTimeout and friends clear
    // it. We can probably find a better way to factor this.
    DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
    DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

    // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
    DDP._CurrentInvocation = DDP._CurrentMethodInvocation;
    DDP._CurrentCallAsyncInvocation = new Meteor.EnvironmentVariable();

    // This is passed into a weird `makeErrorType` function that expects its thing
    // to be a constructor
    function connectionErrorConstructor(message) {
      this.message = message;
    }
    DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
    DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {});

    // Returns the named sequence of pseudo-random values.
    // The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
    // consistent values for method calls on the client and server.
    DDP.randomStream = name => {
      const scope = DDP._CurrentMethodInvocation.get();
      return DDPCommon.RandomStream.get(scope, name);
    };

    // @param url {String} URL to Meteor app,
    //     e.g.:
    //     "subdomain.meteor.com",
    //     "http://subdomain.meteor.com",
    //     "/",
    //     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

    /**
     * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
     * @locus Anywhere
     * @param {String} url The URL of another Meteor application.
     * @param {Object} [options]
     * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
     * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
     * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
     * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
     */
    DDP.connect = (url, options) => {
      const ret = new Connection(url, options);
      allConnections.push(ret); // hack. see below.
      return ret;
    };
    DDP._reconnectHook = new Hook({
      bindEnvironment: false
    });

    /**
     * @summary Register a function to call as the first step of
     * reconnecting. This function can call methods which will be executed before
     * any other outstanding methods. For example, this can be used to re-establish
     * the appropriate authentication context on the connection.
     * @locus Anywhere
     * @param {Function} callback The function to call. It will be called with a
     * single argument, the [connection object](#ddp_connect) that is reconnecting.
     */
    DDP.onReconnect = callback => DDP._reconnectHook.register(callback);

    // Hack for `spiderable` package: a way to see if the page is done
    // loading all the data it needs.
    //
    DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDP: DDP
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-client/server/server.js"
  ],
  mainModulePath: "/node_modules/meteor/ddp-client/server/server.js"
}});

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiZGVmYXVsdCIsIk1ldGhvZEludm9rZXIiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJtZXRob2RJZCIsInNlbnRNZXNzYWdlIiwiX2NhbGxiYWNrIiwiY2FsbGJhY2siLCJfY29ubmVjdGlvbiIsImNvbm5lY3Rpb24iLCJfbWVzc2FnZSIsIm1lc3NhZ2UiLCJfb25SZXN1bHRSZWNlaXZlZCIsIm9uUmVzdWx0UmVjZWl2ZWQiLCJfd2FpdCIsIndhaXQiLCJub1JldHJ5IiwiX21ldGhvZFJlc3VsdCIsIl9kYXRhVmlzaWJsZSIsIl9tZXRob2RJbnZva2VycyIsInNlbmRNZXNzYWdlIiwiZ290UmVzdWx0IiwiRXJyb3IiLCJfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSIsIl9zZW5kIiwiX21heWJlSW52b2tlQ2FsbGJhY2siLCJfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCIsInJlY2VpdmVSZXN1bHQiLCJlcnIiLCJyZXN1bHQiLCJkYXRhVmlzaWJsZSIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsInYiLCJfb2JqZWN0U3ByZWFkIiwiX2V4Y2x1ZGVkIiwiX2V4Y2x1ZGVkMiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiTW9uZ29JRE1hcCIsIklkTWFwIiwiaWRTdHJpbmdpZnkiLCJpZFBhcnNlIiwidXJsIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsInJlcXVpcmUiLCJDb25uZWN0aW9uRXJyb3IiLCJoZWFkZXJzIiwiX3NvY2tqc09wdGlvbnMiLCJfZG9udFByaW50RXJyb3JzIiwiY29ubmVjdFRpbWVvdXRNcyIsIl9sYXN0U2Vzc2lvbklkIiwiX3ZlcnNpb25TdWdnZXN0aW9uIiwiX3ZlcnNpb24iLCJfc3RvcmVzIiwiX21ldGhvZEhhbmRsZXJzIiwiX25leHRNZXRob2RJZCIsIl9zdXBwb3J0ZWRERFBWZXJzaW9ucyIsIl9oZWFydGJlYXRJbnRlcnZhbCIsIl9oZWFydGJlYXRUaW1lb3V0IiwiX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIiLCJfc2VydmVyRG9jdW1lbnRzIiwiX2FmdGVyVXBkYXRlQ2FsbGJhY2tzIiwiX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UiLCJfc3Vic0JlaW5nUmV2aXZlZCIsIl9yZXNldFN0b3JlcyIsIl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyIsIl9yZXRyeU1pZ3JhdGUiLCJfX2ZsdXNoQnVmZmVyZWRXcml0ZXMiLCJiaW5kRW52aXJvbm1lbnQiLCJfZmx1c2hCdWZmZXJlZFdyaXRlcyIsIl9idWZmZXJlZFdyaXRlcyIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQiLCJfYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSIsIl9idWZmZXJlZFdyaXRlc0ludGVydmFsIiwiX2J1ZmZlcmVkV3JpdGVzTWF4QWdlIiwiX3N1YnNjcmlwdGlvbnMiLCJfdXNlcklkIiwiX3VzZXJJZERlcHMiLCJEZXBlbmRlbmN5IiwiaXNDbGllbnQiLCJQYWNrYWdlIiwicmVsb2FkIiwiUmVsb2FkIiwiX29uTWlncmF0ZSIsIl9yZWFkeVRvTWlncmF0ZSIsIm9uRGlzY29ubmVjdCIsIl9oZWFydGJlYXQiLCJzdG9wIiwiaXNTZXJ2ZXIiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwiY3JlYXRlU3RvcmVNZXRob2RzIiwibmFtZSIsIndyYXBwZWRTdG9yZSIsInN0b3JlIiwia2V5c09mU3RvcmUiLCJmb3JFYWNoIiwibWV0aG9kIiwiYXJndW1lbnRzIiwicmVnaXN0ZXJTdG9yZUNsaWVudCIsInF1ZXVlZCIsIkFycmF5IiwiaXNBcnJheSIsImJlZ2luVXBkYXRlIiwibGVuZ3RoIiwibXNnIiwidXBkYXRlIiwiZW5kVXBkYXRlIiwicmVnaXN0ZXJTdG9yZVNlcnZlciIsInN1YnNjcmliZSIsInBhcmFtcyIsImNhbGwiLCJjYWxsYmFja3MiLCJsYXN0UGFyYW0iLCJvblJlYWR5IiwicG9wIiwib25FcnJvciIsIm9uU3RvcCIsInNvbWUiLCJmIiwiZXhpc3RpbmciLCJ2YWx1ZXMiLCJmaW5kIiwic3ViIiwiaW5hY3RpdmUiLCJlcXVhbHMiLCJpZCIsInJlYWR5IiwicmVhZHlDYWxsYmFjayIsImVycm9yQ2FsbGJhY2siLCJzdG9wQ2FsbGJhY2siLCJjbG9uZSIsInJlYWR5RGVwcyIsInJlbW92ZSIsImNoYW5nZWQiLCJoYW5kbGUiLCJyZWNvcmQiLCJkZXBlbmQiLCJzdWJzY3JpcHRpb25JZCIsImFjdGl2ZSIsIm9uSW52YWxpZGF0ZSIsImMiLCJhZnRlckZsdXNoIiwiaXNBc3luY0NhbGwiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJfaXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwibWV0aG9kcyIsImVudHJpZXMiLCJfcmVmIiwiZnVuYyIsIl9nZXRJc1NpbXVsYXRpb24iLCJfcmVmMiIsImlzRnJvbUNhbGxBc3luYyIsImFscmVhZHlJblNpbXVsYXRpb24iLCJhcmdzIiwiYXBwbHkiLCJjYWxsQXN5bmMiLCJhcHBseU9wdGlvbnMiLCJkZWZhdWx0T3B0aW9ucyIsInJldHVyblNlcnZlclJlc3VsdFByb21pc2UiLCJvIiwiX2FyZ3MkIiwiaGFzT3duUHJvcGVydHkiLCJzaGlmdCIsImludm9jYXRpb24iLCJfQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24iLCJnZXQiLCJoYXNDYWxsQXN5bmNQYXJlbnQiLCJhcHBseUFzeW5jIiwiX3NldCIsIl9zZXRDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwidGhlbiIsImNhdGNoIiwiZmluYWxseSIsIl90aGlzJF9zdHViQ2FsbCIsIl9zdHViQ2FsbCIsInN0dWJJbnZvY2F0aW9uIiwic3R1Yk9wdGlvbnMiLCJoYXNTdHViIiwiX3NhdmVPcmlnaW5hbHMiLCJzdHViUmV0dXJuVmFsdWUiLCJ3aXRoVmFsdWUiLCJlIiwiZXhjZXB0aW9uIiwiX2FwcGx5IiwidW5kZWZpbmVkIiwiX3RoaXMkX3N0dWJDYWxsMiIsImN1cnJlbnRDb250ZXh0IiwiX3NldE5ld0NvbnRleHRBbmRHZXRDdXJyZW50Iiwic3R1YkNhbGxWYWx1ZSIsInJhbmRvbVNlZWQiLCJfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyIsInRocm93U3R1YkV4Y2VwdGlvbnMiLCJfZXhwZWN0ZWRCeVRlc3QiLCJmdXR1cmUiLCJyZXR1cm5TdHViVmFsdWUiLCJfbGVuIiwiYWxsQXJncyIsIl9rZXkiLCJmcm9tIiwidmFsdWUiLCJtZXRob2RJbnZva2VyIiwicHVzaCIsInJldHVyblNlcnZlclByb21pc2UiLCJzdHViVmFsdWVQcm9taXNlIiwiZW5jbG9zaW5nIiwic3R1YiIsImlzU2ltdWxhdGlvbiIsIl9pc0Zyb21DYWxsQXN5bmMiLCJkZWZhdWx0UmV0dXJuIiwicmFuZG9tU2VlZEdlbmVyYXRvciIsIm1ha2VScGNTZWVkIiwic2V0VXNlcklkIiwidXNlcklkIiwiTWV0aG9kSW52b2NhdGlvbiIsIl9ub1lpZWxkc0FsbG93ZWQiLCJfd2FpdGluZ0ZvclF1aWVzY2VuY2UiLCJfZmx1c2hCdWZmZXJlZFdyaXRlc0NsaWVudCIsInNhdmVPcmlnaW5hbHMiLCJkb2NzV3JpdHRlbiIsIl9yZWYzIiwiY29sbGVjdGlvbiIsIm9yaWdpbmFscyIsInJldHJpZXZlT3JpZ2luYWxzIiwiZG9jIiwic2VydmVyRG9jIiwic2V0RGVmYXVsdCIsIndyaXR0ZW5CeVN0dWJzIiwiZG9jdW1lbnQiLCJmbHVzaENhbGxiYWNrcyIsIl91bnN1YnNjcmliZUFsbCIsIm9iaiIsInNlbmQiLCJzdHJpbmdpZnlERFAiLCJfbG9zdENvbm5lY3Rpb24iLCJlcnJvciIsInN0YXR1cyIsInJlY29ubmVjdCIsImRpc2Nvbm5lY3QiLCJjbG9zZSIsIl9wZXJtYW5lbnQiLCJfYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nIiwiaW52b2tlcnMiLCJpbnZva2VyIiwiX2xpdmVkYXRhX2Nvbm5lY3RlZCIsIkhlYXJ0YmVhdCIsIm9uVGltZW91dCIsInNlbmRQaW5nIiwic3RhcnQiLCJyZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uIiwic2Vzc2lvbiIsIl9yZWY0IiwiX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzIiwiX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZSIsInVwZGF0ZXMiLCJtZXNzYWdlVHlwZSIsIl9wcm9jZXNzX2FkZGVkIiwiX3Byb2Nlc3NfY2hhbmdlZCIsIl9wcm9jZXNzX3JlbW92ZWQiLCJfcHJvY2Vzc19yZWFkeSIsIl9wcm9jZXNzX3VwZGF0ZWQiLCJfbGl2ZWRhdGFfZGF0YSIsInN1YnMiLCJzdWJJZCIsImJ1ZmZlcmVkTWVzc2FnZXMiLCJidWZmZXJlZE1lc3NhZ2UiLCJzdGFuZGFyZFdyaXRlIiwiRGF0ZSIsInZhbHVlT2YiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiX2xpdmVEYXRhV3JpdGVzUHJvbWlzZSIsIl9pc1Byb21pc2UiLCJfcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoIiwid3JpdGVzIiwiX2ZsdXNoQnVmZmVyZWRXcml0ZXNTZXJ2ZXIiLCJfcGVyZm9ybVdyaXRlc1NlcnZlciIsIl9wZXJmb3JtV3JpdGVzQ2xpZW50Iiwic3RvcmVOYW1lIiwidXBkYXRlTWVzc2FnZXMiLCJ1cGRhdGVNZXNzYWdlIiwiX3B1c2hVcGRhdGUiLCJfZ2V0U2VydmVyRG9jIiwic2VydmVyRG9jc0ZvckNvbGxlY3Rpb24iLCJpc0V4aXN0aW5nIiwiZmllbGRzIiwiX2lkIiwiY3VycmVudERvYyIsImdldERvYyIsIkRpZmZTZXF1ZW5jZSIsImFwcGx5Q2hhbmdlcyIsImRvY3MiLCJ3cml0dGVuIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlcGxhY2UiLCJjYWxsYmFja0ludm9rZXIiLCJfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIiwic3ViUmVjb3JkIiwicnVuRkFmdGVyVXBkYXRlcyIsInVuZmx1c2hlZFNlcnZlckRvY0NvdW50Iiwib25TZXJ2ZXJEb2NGbHVzaCIsInNlcnZlckRvY3VtZW50cyIsIndyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlIiwiX2xpdmVkYXRhX25vc3ViIiwibWV0ZW9yRXJyb3JGcm9tTXNnIiwibXNnQXJnIiwicmVhc29uIiwiZGV0YWlscyIsIl9saXZlZGF0YV9yZXN1bHQiLCJjdXJyZW50TWV0aG9kQmxvY2siLCJpIiwibSIsImlkeCIsImZvdW5kIiwic3BsaWNlIiwiZmlyc3RCbG9jayIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzIiwiX21heWJlTWlncmF0ZSIsIl9saXZlZGF0YV9lcnJvciIsIm9mZmVuZGluZ01lc3NhZ2UiLCJfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzIiwib2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfcmVjb25uZWN0SG9vayIsImVhY2giLCJyYXdfbXNnIiwicGFyc2VERFAiLCJtZXNzYWdlUmVjZWl2ZWQiLCJ0ZXN0TWVzc2FnZU9uQ29ubmVjdCIsInNlcnZlcl9pZCIsImluZGV4T2YiLCJ2ZXJzaW9uIiwiX2ZvcmNlIiwiX2Vycm9yIiwiaW5jbHVkZXMiLCJzdXBwb3J0IiwiZmlsdGVyIiwiX3JlZjUiLCJhbGxDb25uZWN0aW9ucyIsIkVudmlyb25tZW50VmFyaWFibGUiLCJfQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsIl9DdXJyZW50SW52b2NhdGlvbiIsImNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yIiwibWFrZUVycm9yVHlwZSIsIkZvcmNlZFJlY29ubmVjdEVycm9yIiwicmFuZG9tU3RyZWFtIiwic2NvcGUiLCJSYW5kb21TdHJlYW0iLCJjb25uZWN0IiwicmV0IiwicmVnaXN0ZXIiLCJfYWxsU3Vic2NyaXB0aW9uc1JlYWR5IiwiZXZlcnkiLCJjb25uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLElBQUksQ0FBQyx3QkFBd0IsRUFBQztNQUFDQyxHQUFHLEVBQUM7SUFBSyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFBQ0Msc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRzs7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QUVEeFksR0FBRyxDQUFDOFcsY0FBYyxHQUFHLElBQUk3VCxJQUFJLENBQUM7TUFBRXdELGVBQWUsRUFBRTtJQUFNLENBQUMsQ0FBQzs7SUFFekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0F6RyxHQUFHLENBQUM2RSxXQUFXLEdBQUcvRCxRQUFRLElBQUlkLEdBQUcsQ0FBQzhXLGNBQWMsQ0FBQzJCLFFBQVEsQ0FBQzNYLFFBQVEsQ0FBQzs7SUFFbkU7SUFDQTtJQUNBO0lBQ0FkLEdBQUcsQ0FBQzBZLHNCQUFzQixHQUFHLE1BQU1iLGNBQWMsQ0FBQ2MsS0FBSyxDQUNyREMsSUFBSSxJQUFJeFUsTUFBTSxDQUFDNEYsTUFBTSxDQUFDNE8sSUFBSSxDQUFDNVIsY0FBYyxDQUFDLENBQUMyUixLQUFLLENBQUN6TyxHQUFHLElBQUlBLEdBQUcsQ0FBQ0ksS0FBSyxDQUNuRSxDQUFDO0lBQUNwSyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9kZHAtY2xpZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHsgRERQIH0gZnJvbSAnLi4vY29tbW9uL25hbWVzcGFjZS5qcyc7XG4iLCIvLyBBIE1ldGhvZEludm9rZXIgbWFuYWdlcyBzZW5kaW5nIGEgbWV0aG9kIHRvIHRoZSBzZXJ2ZXIgYW5kIGNhbGxpbmcgdGhlIHVzZXInc1xuLy8gY2FsbGJhY2tzLiBPbiBjb25zdHJ1Y3Rpb24sIGl0IHJlZ2lzdGVycyBpdHNlbGYgaW4gdGhlIGNvbm5lY3Rpb24nc1xuLy8gX21ldGhvZEludm9rZXJzIG1hcDsgaXQgcmVtb3ZlcyBpdHNlbGYgb25jZSB0aGUgbWV0aG9kIGlzIGZ1bGx5IGZpbmlzaGVkIGFuZFxuLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQuIFRoaXMgb2NjdXJzIHdoZW4gaXQgaGFzIGJvdGggcmVjZWl2ZWQgYSByZXN1bHQsXG4vLyBhbmQgdGhlIGRhdGEgd3JpdHRlbiBieSBpdCBpcyBmdWxseSB2aXNpYmxlLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0aG9kSW52b2tlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBQdWJsaWMgKHdpdGhpbiB0aGlzIGZpbGUpIGZpZWxkcy5cbiAgICB0aGlzLm1ldGhvZElkID0gb3B0aW9ucy5tZXRob2RJZDtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gZmFsc2U7XG5cbiAgICB0aGlzLl9jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgICB0aGlzLl9tZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQgPSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLl93YWl0ID0gb3B0aW9ucy53YWl0O1xuICAgIHRoaXMubm9SZXRyeSA9IG9wdGlvbnMubm9SZXRyeTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBudWxsO1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAvLyBSZWdpc3RlciB3aXRoIHRoZSBjb25uZWN0aW9uLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdID0gdGhpcztcbiAgfVxuICAvLyBTZW5kcyB0aGUgbWV0aG9kIG1lc3NhZ2UgdG8gdGhlIHNlcnZlci4gTWF5IGJlIGNhbGxlZCBhZGRpdGlvbmFsIHRpbWVzIGlmXG4gIC8vIHdlIGxvc2UgdGhlIGNvbm5lY3Rpb24gYW5kIHJlY29ubmVjdCBiZWZvcmUgcmVjZWl2aW5nIGEgcmVzdWx0LlxuICBzZW5kTWVzc2FnZSgpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgc2VuZGluZyBhIG1ldGhvZCAoaW5jbHVkaW5nIHJlc2VuZGluZyBvblxuICAgIC8vIHJlY29ubmVjdCkuIFdlIHNob3VsZCBvbmx5IChyZSlzZW5kIG1ldGhvZHMgd2hlcmUgd2UgZG9uJ3QgYWxyZWFkeSBoYXZlIGFcbiAgICAvLyByZXN1bHQhXG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRpbmdNZXRob2QgaXMgY2FsbGVkIG9uIG1ldGhvZCB3aXRoIHJlc3VsdCcpO1xuXG4gICAgLy8gSWYgd2UncmUgcmUtc2VuZGluZyBpdCwgaXQgZG9lc24ndCBtYXR0ZXIgaWYgZGF0YSB3YXMgd3JpdHRlbiB0aGUgZmlyc3RcbiAgICAvLyB0aW1lLlxuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5zZW50TWVzc2FnZSA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgd2FpdCBtZXRob2QsIG1ha2UgYWxsIGRhdGEgbWVzc2FnZXMgYmUgYnVmZmVyZWQgdW50aWwgaXQgaXNcbiAgICAvLyBkb25lLlxuICAgIGlmICh0aGlzLl93YWl0KVxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVt0aGlzLm1ldGhvZElkXSA9IHRydWU7XG5cbiAgICAvLyBBY3R1YWxseSBzZW5kIHRoZSBtZXNzYWdlLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3NlbmQodGhpcy5fbWVzc2FnZSk7XG4gIH1cbiAgLy8gSW52b2tlIHRoZSBjYWxsYmFjaywgaWYgd2UgaGF2ZSBib3RoIGEgcmVzdWx0IGFuZCBrbm93IHRoYXQgYWxsIGRhdGEgaGFzXG4gIC8vIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuXG4gIF9tYXliZUludm9rZUNhbGxiYWNrKCkge1xuICAgIGlmICh0aGlzLl9tZXRob2RSZXN1bHQgJiYgdGhpcy5fZGF0YVZpc2libGUpIHtcbiAgICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrLiAoVGhpcyB3b24ndCB0aHJvdzogdGhlIGNhbGxiYWNrIHdhcyB3cmFwcGVkIHdpdGhcbiAgICAgIC8vIGJpbmRFbnZpcm9ubWVudC4pXG4gICAgICB0aGlzLl9jYWxsYmFjayh0aGlzLl9tZXRob2RSZXN1bHRbMF0sIHRoaXMuX21ldGhvZFJlc3VsdFsxXSk7XG5cbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGlzIG1ldGhvZC5cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RJbnZva2Vyc1t0aGlzLm1ldGhvZElkXTtcblxuICAgICAgLy8gTGV0IHRoZSBjb25uZWN0aW9uIGtub3cgdGhhdCB0aGlzIG1ldGhvZCBpcyBmaW5pc2hlZCwgc28gaXQgY2FuIHRyeSB0b1xuICAgICAgLy8gbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayBvZiBtZXRob2RzLlxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpO1xuICAgIH1cbiAgfVxuICAvLyBDYWxsIHdpdGggdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGZyb20gdGhlIHNlcnZlci4gT25seSBtYXkgYmUgY2FsbGVkXG4gIC8vIG9uY2U7IG9uY2UgaXQgaXMgY2FsbGVkLCB5b3Ugc2hvdWxkIG5vdCBjYWxsIHNlbmRNZXNzYWdlIGFnYWluLlxuICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhbiBvblJlc3VsdFJlY2VpdmVkIGNhbGxiYWNrLCBjYWxsIGl0IGltbWVkaWF0ZWx5LlxuICAvLyBUaGVuIGludm9rZSB0aGUgbWFpbiBjYWxsYmFjayBpZiBkYXRhIGlzIGFsc28gdmlzaWJsZS5cbiAgcmVjZWl2ZVJlc3VsdChlcnIsIHJlc3VsdCkge1xuICAgIGlmICh0aGlzLmdvdFJlc3VsdCgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2RzIHNob3VsZCBvbmx5IHJlY2VpdmUgcmVzdWx0cyBvbmNlJyk7XG4gICAgdGhpcy5fbWV0aG9kUmVzdWx0ID0gW2VyciwgcmVzdWx0XTtcbiAgICB0aGlzLl9vblJlc3VsdFJlY2VpdmVkKGVyciwgcmVzdWx0KTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gQ2FsbCB0aGlzIHdoZW4gYWxsIGRhdGEgd3JpdHRlbiBieSB0aGUgbWV0aG9kIGlzIHZpc2libGUuIFRoaXMgbWVhbnMgdGhhdFxuICAvLyB0aGUgbWV0aG9kIGhhcyByZXR1cm5zIGl0cyBcImRhdGEgaXMgZG9uZVwiIG1lc3NhZ2UgKkFORCogYWxsIHNlcnZlclxuICAvLyBkb2N1bWVudHMgdGhhdCBhcmUgYnVmZmVyZWQgYXQgdGhhdCB0aW1lIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbFxuICAvLyBjYWNoZS4gSW52b2tlcyB0aGUgbWFpbiBjYWxsYmFjayBpZiB0aGUgcmVzdWx0IGhhcyBiZWVuIHJlY2VpdmVkLlxuICBkYXRhVmlzaWJsZSgpIHtcbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5fbWF5YmVJbnZva2VDYWxsYmFjaygpO1xuICB9XG4gIC8vIFRydWUgaWYgcmVjZWl2ZVJlc3VsdCBoYXMgYmVlbiBjYWxsZWQuXG4gIGdvdFJlc3VsdCgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9tZXRob2RSZXN1bHQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gJ21ldGVvci90cmFja2VyJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgSG9vayB9IGZyb20gJ21ldGVvci9jYWxsYmFjay1ob29rJztcbmltcG9ydCB7IE1vbmdvSUQgfSBmcm9tICdtZXRlb3IvbW9uZ28taWQnO1xuaW1wb3J0IHsgRERQIH0gZnJvbSAnLi9uYW1lc3BhY2UuanMnO1xuaW1wb3J0IE1ldGhvZEludm9rZXIgZnJvbSAnLi9NZXRob2RJbnZva2VyLmpzJztcbmltcG9ydCB7XG4gIGhhc093bixcbiAgc2xpY2UsXG4gIGtleXMsXG4gIGlzRW1wdHksXG4gIGxhc3QsXG59IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5jbGFzcyBNb25nb0lETWFwIGV4dGVuZHMgSWRNYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihNb25nb0lELmlkU3RyaW5naWZ5LCBNb25nb0lELmlkUGFyc2UpO1xuICB9XG59XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ3xPYmplY3R9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICBvciBhbiBvYmplY3QgYXMgYSB0ZXN0IGhvb2sgKHNlZSBjb2RlKVxuLy8gT3B0aW9uczpcbi8vICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4vLyAgIGhlYWRlcnM6IGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Jcbi8vICAgICBzZXJ2ZXItdG8tc2VydmVyIEREUCBvbmx5XG4vLyAgIF9zb2NranNPcHRpb25zOiBTcGVjaWZpZXMgb3B0aW9ucyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHNvY2tqcyBjbGllbnRcbi8vICAgb25ERFBOZWdvdGlhdGlvblZlcnNpb25GYWlsdXJlOiBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4vL1xuLy8gWFhYIFRoZXJlIHNob3VsZCBiZSBhIHdheSB0byBkZXN0cm95IGEgRERQIGNvbm5lY3Rpb24sIGNhdXNpbmcgYWxsXG4vLyBvdXRzdGFuZGluZyBtZXRob2QgY2FsbHMgdG8gZmFpbC5cbi8vXG4vLyBYWFggT3VyIGN1cnJlbnQgd2F5IG9mIGhhbmRsaW5nIGZhaWx1cmUgYW5kIHJlY29ubmVjdGlvbiBpcyBncmVhdFxuLy8gZm9yIGFuIGFwcCAod2hlcmUgd2Ugd2FudCB0byB0b2xlcmF0ZSBiZWluZyBkaXNjb25uZWN0ZWQgYXMgYW5cbi8vIGV4cGVjdCBzdGF0ZSwgYW5kIGtlZXAgdHJ5aW5nIGZvcmV2ZXIgdG8gcmVjb25uZWN0KSBidXQgY3VtYmVyc29tZVxuLy8gZm9yIHNvbWV0aGluZyBsaWtlIGEgY29tbWFuZCBsaW5lIHRvb2wgdGhhdCB3YW50cyB0byBtYWtlIGFcbi8vIGNvbm5lY3Rpb24sIGNhbGwgYSBtZXRob2QsIGFuZCBwcmludCBhbiBlcnJvciBpZiBjb25uZWN0aW9uXG4vLyBmYWlscy4gV2Ugc2hvdWxkIGhhdmUgYmV0dGVyIHVzYWJpbGl0eSBpbiB0aGUgbGF0dGVyIGNhc2UgKHdoaWxlXG4vLyBzdGlsbCB0cmFuc3BhcmVudGx5IHJlY29ubmVjdGluZyBpZiBpdCdzIGp1c3QgYSB0cmFuc2llbnQgZmFpbHVyZVxuLy8gb3IgdGhlIHNlcnZlciBtaWdyYXRpbmcgdXMpLlxuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSB7XG4gICAgICBvbkNvbm5lY3RlZCgpIHt9LFxuICAgICAgb25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoZGVzY3JpcHRpb24pO1xuICAgICAgfSxcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNzUwMCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgICAgbnBtRmF5ZU9wdGlvbnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAvLyBUaGVzZSBvcHRpb25zIGFyZSBvbmx5IGZvciB0ZXN0aW5nLlxuICAgICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBmYWxzZSxcbiAgICAgIHN1cHBvcnRlZEREUFZlcnNpb25zOiBERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyxcbiAgICAgIHJldHJ5OiB0cnVlLFxuICAgICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgICAvLyBXaGVuIHVwZGF0ZXMgYXJlIGNvbWluZyB3aXRoaW4gdGhpcyBtcyBpbnRlcnZhbCwgYmF0Y2ggdGhlbSB0b2dldGhlci5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw6IDUsXG4gICAgICAvLyBGbHVzaCBidWZmZXJzIGltbWVkaWF0ZWx5IGlmIHdyaXRlcyBhcmUgaGFwcGVuaW5nIGNvbnRpbnVvdXNseSBmb3IgbW9yZSB0aGFuIHRoaXMgbWFueSBtcy5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzTWF4QWdlOiA1MDAsXG5cbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9O1xuXG4gICAgLy8gSWYgc2V0LCBjYWxsZWQgd2hlbiB3ZSByZWNvbm5lY3QsIHF1ZXVpbmcgbWV0aG9kIGNhbGxzIF9iZWZvcmVfIHRoZVxuICAgIC8vIGV4aXN0aW5nIG91dHN0YW5kaW5nIG9uZXMuXG4gICAgLy8gTk9URTogVGhpcyBmZWF0dXJlIGhhcyBiZWVuIHByZXNlcnZlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuIFRoZVxuICAgIC8vIHByZWZlcnJlZCBtZXRob2Qgb2Ygc2V0dGluZyBhIGNhbGxiYWNrIG9uIHJlY29ubmVjdCBpcyB0byB1c2VcbiAgICAvLyBERFAub25SZWNvbm5lY3QuXG4gICAgc2VsZi5vblJlY29ubmVjdCA9IG51bGw7XG5cbiAgICAvLyBhcyBhIHRlc3QgaG9vaywgYWxsb3cgcGFzc2luZyBhIHN0cmVhbSBpbnN0ZWFkIG9mIGEgdXJsLlxuICAgIGlmICh0eXBlb2YgdXJsID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VsZi5fc3RyZWFtID0gdXJsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IENsaWVudFN0cmVhbSB9ID0gcmVxdWlyZShcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiKTtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IG5ldyBDbGllbnRTdHJlYW0odXJsLCB7XG4gICAgICAgIHJldHJ5OiBvcHRpb25zLnJldHJ5LFxuICAgICAgICBDb25uZWN0aW9uRXJyb3I6IEREUC5Db25uZWN0aW9uRXJyb3IsXG4gICAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgICAgX3NvY2tqc09wdGlvbnM6IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMsXG4gICAgICAgIC8vIFVzZWQgdG8ga2VlcCBzb21lIHRlc3RzIHF1aWV0LCBvciBmb3Igb3RoZXIgY2FzZXMgaW4gd2hpY2hcbiAgICAgICAgLy8gdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdpdGggY29ubmVjdGlvbiBlcnJvcnMgaXMgdG8gc2lsZW50bHlcbiAgICAgICAgLy8gZmFpbCAoZS5nLiBzZW5kaW5nIHBhY2thZ2UgdXNhZ2Ugc3RhdHMpLiBBdCBzb21lIHBvaW50IHdlXG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGEgcmVhbCBBUEkgZm9yIGhhbmRsaW5nIGNsaWVudC1zdHJlYW0tbGV2ZWxcbiAgICAgICAgLy8gZXJyb3JzLlxuICAgICAgICBfZG9udFByaW50RXJyb3JzOiBvcHRpb25zLl9kb250UHJpbnRFcnJvcnMsXG4gICAgICAgIGNvbm5lY3RUaW1lb3V0TXM6IG9wdGlvbnMuY29ubmVjdFRpbWVvdXRNcyxcbiAgICAgICAgbnBtRmF5ZU9wdGlvbnM6IG9wdGlvbnMubnBtRmF5ZU9wdGlvbnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBudWxsO1xuICAgIHNlbGYuX3ZlcnNpb25TdWdnZXN0aW9uID0gbnVsbDsgLy8gVGhlIGxhc3QgcHJvcG9zZWQgRERQIHZlcnNpb24uXG4gICAgc2VsZi5fdmVyc2lvbiA9IG51bGw7IC8vIFRoZSBERFAgdmVyc2lvbiBhZ3JlZWQgb24gYnkgY2xpZW50IGFuZCBzZXJ2ZXIuXG4gICAgc2VsZi5fc3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBvYmplY3Qgd2l0aCBtZXRob2RzXG4gICAgc2VsZi5fbWV0aG9kSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBuYW1lIC0+IGZ1bmNcbiAgICBzZWxmLl9uZXh0TWV0aG9kSWQgPSAxO1xuICAgIHNlbGYuX3N1cHBvcnRlZEREUFZlcnNpb25zID0gb3B0aW9ucy5zdXBwb3J0ZWRERFBWZXJzaW9ucztcblxuICAgIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsID0gb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbDtcbiAgICBzZWxmLl9oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuXG4gICAgLy8gVHJhY2tzIG1ldGhvZHMgd2hpY2ggdGhlIHVzZXIgaGFzIHRyaWVkIHRvIGNhbGwgYnV0IHdoaWNoIGhhdmUgbm90IHlldFxuICAgIC8vIGNhbGxlZCB0aGVpciB1c2VyIGNhbGxiYWNrIChpZSwgdGhleSBhcmUgd2FpdGluZyBvbiB0aGVpciByZXN1bHQgb3IgZm9yIGFsbFxuICAgIC8vIG9mIHRoZWlyIHdyaXRlcyB0byBiZSB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZSkuIE1hcCBmcm9tIG1ldGhvZCBJRCB0b1xuICAgIC8vIE1ldGhvZEludm9rZXIgb2JqZWN0LlxuICAgIHNlbGYuX21ldGhvZEludm9rZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyBjYWxsZWQgYnV0IHdob3NlIHJlc3VsdCBtZXNzYWdlcyBoYXZlIG5vdFxuICAgIC8vIGFycml2ZWQgeWV0LlxuICAgIC8vXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIGlzIGFuIGFycmF5IG9mIGJsb2NrcyBvZiBtZXRob2RzLiBFYWNoIGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyBhIHNldCBvZiBtZXRob2RzIHRoYXQgY2FuIHJ1biBhdCB0aGUgc2FtZSB0aW1lLiBUaGUgZmlyc3QgYmxvY2tcbiAgICAvLyByZXByZXNlbnRzIHRoZSBtZXRob2RzIHdoaWNoIGFyZSBjdXJyZW50bHkgaW4gZmxpZ2h0OyBzdWJzZXF1ZW50IGJsb2Nrc1xuICAgIC8vIG11c3Qgd2FpdCBmb3IgcHJldmlvdXMgYmxvY2tzIHRvIGJlIGZ1bGx5IGZpbmlzaGVkIGJlZm9yZSB0aGV5IGNhbiBiZSBzZW50XG4gICAgLy8gdG8gdGhlIHNlcnZlci5cbiAgICAvL1xuICAgIC8vIEVhY2ggYmxvY2sgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gICAgLy8gLSBtZXRob2RzOiBhIGxpc3Qgb2YgTWV0aG9kSW52b2tlciBvYmplY3RzXG4gICAgLy8gLSB3YWl0OiBhIGJvb2xlYW47IGlmIHRydWUsIHRoaXMgYmxvY2sgaGFkIGEgc2luZ2xlIG1ldGhvZCBpbnZva2VkIHdpdGhcbiAgICAvLyAgICAgICAgIHRoZSBcIndhaXRcIiBvcHRpb25cbiAgICAvL1xuICAgIC8vIFRoZXJlIHdpbGwgbmV2ZXIgYmUgYWRqYWNlbnQgYmxvY2tzIHdpdGggd2FpdD1mYWxzZSwgYmVjYXVzZSB0aGUgb25seSB0aGluZ1xuICAgIC8vIHRoYXQgbWFrZXMgbWV0aG9kcyBuZWVkIHRvIGJlIHNlcmlhbGl6ZWQgaXMgYSB3YWl0IG1ldGhvZC5cbiAgICAvL1xuICAgIC8vIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZmlyc3QgYmxvY2sgd2hlbiB0aGVpciBcInJlc3VsdFwiIGlzXG4gICAgLy8gcmVjZWl2ZWQuIFRoZSBlbnRpcmUgZmlyc3QgYmxvY2sgaXMgb25seSByZW1vdmVkIHdoZW4gYWxsIG9mIHRoZSBpbi1mbGlnaHRcbiAgICAvLyBtZXRob2RzIGhhdmUgcmVjZWl2ZWQgdGhlaXIgcmVzdWx0cyAoc28gdGhlIFwibWV0aG9kc1wiIGxpc3QgaXMgZW1wdHkpICpBTkQqXG4gICAgLy8gYWxsIG9mIHRoZSBkYXRhIHdyaXR0ZW4gYnkgdGhvc2UgbWV0aG9kcyBhcmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIFNvXG4gICAgLy8gaXQgaXMgcG9zc2libGUgZm9yIHRoZSBmaXJzdCBibG9jaydzIG1ldGhvZHMgbGlzdCB0byBiZSBlbXB0eSwgaWYgd2UgYXJlXG4gICAgLy8gc3RpbGwgd2FpdGluZyBmb3Igc29tZSBvYmplY3RzIHRvIHF1aWVzY2UuXG4gICAgLy9cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vICBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbXX0sXG4gICAgLy8gICAge3dhaXQ6IHRydWUsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2xvZ2luJz5dfSxcbiAgICAvLyAgICB7d2FpdDogZmFsc2UsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2Zvbyc+LFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxNZXRob2RJbnZva2VyIGZvciAnYmFyJz5dfV1cbiAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgd2VyZSBzb21lIG1ldGhvZHMgd2hpY2ggd2VyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgYW5kXG4gICAgLy8gd2hpY2ggaGF2ZSByZXR1cm5lZCB0aGVpciByZXN1bHRzLCBidXQgc29tZSBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5XG4gICAgLy8gdGhlIG1ldGhvZHMgbWF5IG5vdCBiZSB2aXNpYmxlIGluIHRoZSBsb2NhbCBjYWNoZS4gT25jZSBhbGwgdGhhdCBkYXRhIGlzXG4gICAgLy8gdmlzaWJsZSwgd2Ugd2lsbCBzZW5kIGEgJ2xvZ2luJyBtZXRob2QuIE9uY2UgdGhlIGxvZ2luIG1ldGhvZCBoYXMgcmV0dXJuZWRcbiAgICAvLyBhbmQgYWxsIHRoZSBkYXRhIGlzIHZpc2libGUgKGluY2x1ZGluZyByZS1ydW5uaW5nIHN1YnMgaWYgdXNlcklkIGNoYW5nZXMpLFxuICAgIC8vIHdlIHdpbGwgc2VuZCB0aGUgJ2ZvbycgYW5kICdiYXInIG1ldGhvZHMgaW4gcGFyYWxsZWwuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIC8vIG1ldGhvZCBJRCAtPiBhcnJheSBvZiBvYmplY3RzIHdpdGgga2V5cyAnY29sbGVjdGlvbicgYW5kICdpZCcsIGxpc3RpbmdcbiAgICAvLyBkb2N1bWVudHMgd3JpdHRlbiBieSBhIGdpdmVuIG1ldGhvZCdzIHN0dWIuIGtleXMgYXJlIGFzc29jaWF0ZWQgd2l0aFxuICAgIC8vIG1ldGhvZHMgd2hvc2Ugc3R1YiB3cm90ZSBhdCBsZWFzdCBvbmUgZG9jdW1lbnQsIGFuZCB3aG9zZSBkYXRhLWRvbmUgbWVzc2FnZVxuICAgIC8vIGhhcyBub3QgeWV0IGJlZW4gcmVjZWl2ZWQuXG4gICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IHt9O1xuICAgIC8vIGNvbGxlY3Rpb24gLT4gSWRNYXAgb2YgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBvYmplY3QuIEEgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBoYXM6XG4gICAgLy8gLSBcImRvY3VtZW50XCI6IHRoZSB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBhY2NvcmRpbmcgdGhlXG4gICAgLy8gICBzZXJ2ZXIgKGllLCB0aGUgc25hcHNob3QgYmVmb3JlIGEgc3R1YiB3cm90ZSBpdCwgYW1lbmRlZCBieSBhbnkgY2hhbmdlc1xuICAgIC8vICAgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyKVxuICAgIC8vICAgSXQgaXMgdW5kZWZpbmVkIGlmIHdlIHRoaW5rIHRoZSBkb2N1bWVudCBkb2VzIG5vdCBleGlzdFxuICAgIC8vIC0gXCJ3cml0dGVuQnlTdHVic1wiOiBhIHNldCBvZiBtZXRob2QgSURzIHdob3NlIHN0dWJzIHdyb3RlIHRvIHRoZSBkb2N1bWVudFxuICAgIC8vICAgd2hvc2UgXCJkYXRhIGRvbmVcIiBtZXNzYWdlcyBoYXZlIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWRcbiAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSB7fTtcblxuICAgIC8vIEFycmF5IG9mIGNhbGxiYWNrcyB0byBiZSBjYWxsZWQgYWZ0ZXIgdGhlIG5leHQgdXBkYXRlIG9mIHRoZSBsb2NhbFxuICAgIC8vIGNhY2hlLiBVc2VkIGZvcjpcbiAgICAvLyAgLSBDYWxsaW5nIG1ldGhvZEludm9rZXIuZGF0YVZpc2libGUgYW5kIHN1YiByZWFkeSBjYWxsYmFja3MgYWZ0ZXJcbiAgICAvLyAgICB0aGUgcmVsZXZhbnQgZGF0YSBpcyBmbHVzaGVkLlxuICAgIC8vICAtIEludm9raW5nIHRoZSBjYWxsYmFja3Mgb2YgXCJoYWxmLWZpbmlzaGVkXCIgbWV0aG9kcyBhZnRlciByZWNvbm5lY3RcbiAgICAvLyAgICBxdWllc2NlbmNlLiBTcGVjaWZpY2FsbHksIG1ldGhvZHMgd2hvc2UgcmVzdWx0IHdhcyByZWNlaXZlZCBvdmVyIHRoZSBvbGRcbiAgICAvLyAgICBjb25uZWN0aW9uIChzbyB3ZSBkb24ndCByZS1zZW5kIGl0KSBidXQgd2hvc2UgZGF0YSBoYWQgbm90IGJlZW4gbWFkZVxuICAgIC8vICAgIHZpc2libGUuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIEluIHR3byBjb250ZXh0cywgd2UgYnVmZmVyIGFsbCBpbmNvbWluZyBkYXRhIG1lc3NhZ2VzIGFuZCB0aGVuIHByb2Nlc3MgdGhlbVxuICAgIC8vIGFsbCBhdCBvbmNlIGluIGEgc2luZ2xlIHVwZGF0ZTpcbiAgICAvLyAgIC0gRHVyaW5nIHJlY29ubmVjdCwgd2UgYnVmZmVyIGFsbCBkYXRhIG1lc3NhZ2VzIHVudGlsIGFsbCBzdWJzIHRoYXQgaGFkXG4gICAgLy8gICAgIGJlZW4gcmVhZHkgYmVmb3JlIHJlY29ubmVjdCBhcmUgcmVhZHkgYWdhaW4sIGFuZCBhbGwgbWV0aG9kcyB0aGF0IGFyZVxuICAgIC8vICAgICBhY3RpdmUgaGF2ZSByZXR1cm5lZCB0aGVpciBcImRhdGEgZG9uZSBtZXNzYWdlXCI7IHRoZW5cbiAgICAvLyAgIC0gRHVyaW5nIHRoZSBleGVjdXRpb24gb2YgYSBcIndhaXRcIiBtZXRob2QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlc1xuICAgIC8vICAgICB1bnRpbCB0aGUgd2FpdCBtZXRob2QgZ2V0cyBpdHMgXCJkYXRhIGRvbmVcIiBtZXNzYWdlLiAoSWYgdGhlIHdhaXQgbWV0aG9kXG4gICAgLy8gICAgIG9jY3VycyBkdXJpbmcgcmVjb25uZWN0LCBpdCBkb2Vzbid0IGdldCBhbnkgc3BlY2lhbCBoYW5kbGluZy4pXG4gICAgLy8gYWxsIGRhdGEgbWVzc2FnZXMgYXJlIHByb2Nlc3NlZCBpbiBvbmUgdXBkYXRlLlxuICAgIC8vXG4gICAgLy8gVGhlIGZvbGxvd2luZyBmaWVsZHMgYXJlIHVzZWQgZm9yIHRoaXMgXCJxdWllc2NlbmNlXCIgcHJvY2Vzcy5cblxuICAgIC8vIFRoaXMgYnVmZmVycyB0aGUgbWVzc2FnZXMgdGhhdCBhcmVuJ3QgYmVpbmcgcHJvY2Vzc2VkIHlldC5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG4gICAgLy8gTWFwIGZyb20gbWV0aG9kIElEIC0+IHRydWUuIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGlzIHdoZW4gdGhlaXJcbiAgICAvLyBcImRhdGEgZG9uZVwiIG1lc3NhZ2UgaXMgcmVjZWl2ZWQsIGFuZCB3ZSB3aWxsIG5vdCBxdWllc2NlIHVudGlsIGl0IGlzXG4gICAgLy8gZW1wdHkuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IHt9O1xuICAgIC8vIG1hcCBmcm9tIHN1YiBJRCAtPiB0cnVlIGZvciBzdWJzIHRoYXQgd2VyZSByZWFkeSAoaWUsIGNhbGxlZCB0aGUgc3ViXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGJlZm9yZSByZWNvbm5lY3QgYnV0IGhhdmVuJ3QgYmVjb21lIHJlYWR5IGFnYWluIHlldFxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSB7fTsgLy8gbWFwIGZyb20gc3ViLl9pZCAtPiB0cnVlXG4gICAgLy8gaWYgdHJ1ZSwgdGhlIG5leHQgZGF0YSB1cGRhdGUgc2hvdWxkIHJlc2V0IGFsbCBzdG9yZXMuIChzZXQgZHVyaW5nXG4gICAgLy8gcmVjb25uZWN0LilcbiAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgLy8gbmFtZSAtPiBhcnJheSBvZiB1cGRhdGVzIGZvciAoeWV0IHRvIGJlIGNyZWF0ZWQpIGNvbGxlY3Rpb25zXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSB7fTtcbiAgICAvLyBpZiB3ZSdyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgdGhlIHJldHJ5IGZ1bmNcbiAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuXG4gICAgc2VsZi5fX2ZsdXNoQnVmZmVyZWRXcml0ZXMgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgICdmbHVzaGluZyBERFAgYnVmZmVyZWQgd3JpdGVzJyxcbiAgICAgIHNlbGZcbiAgICApO1xuICAgIC8vIENvbGxlY3Rpb24gbmFtZSAtPiBhcnJheSBvZiBtZXNzYWdlcy5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlcyA9IHt9O1xuICAgIC8vIFdoZW4gY3VycmVudCBidWZmZXIgb2YgdXBkYXRlcyBtdXN0IGJlIGZsdXNoZWQgYXQsIGluIG1zIHRpbWVzdGFtcC5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFRpbWVvdXQgaGFuZGxlIGZvciB0aGUgbmV4dCBwcm9jZXNzaW5nIG9mIGFsbCBwZW5kaW5nIHdyaXRlc1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDtcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZSA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG5cbiAgICAvLyBtZXRhZGF0YSBmb3Igc3Vic2NyaXB0aW9ucy4gIE1hcCBmcm9tIHN1YiBJRCB0byBvYmplY3Qgd2l0aCBrZXlzOlxuICAgIC8vICAgLSBpZFxuICAgIC8vICAgLSBuYW1lXG4gICAgLy8gICAtIHBhcmFtc1xuICAgIC8vICAgLSBpbmFjdGl2ZSAoaWYgdHJ1ZSwgd2lsbCBiZSBjbGVhbmVkIHVwIGlmIG5vdCByZXVzZWQgaW4gcmUtcnVuKVxuICAgIC8vICAgLSByZWFkeSAoaGFzIHRoZSAncmVhZHknIG1lc3NhZ2UgYmVlbiByZWNlaXZlZD8pXG4gICAgLy8gICAtIHJlYWR5Q2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiByZWFkeSlcbiAgICAvLyAgIC0gZXJyb3JDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCBpZiB0aGUgc3ViIHRlcm1pbmF0ZXMgd2l0aFxuICAgIC8vICAgICAgICAgICAgICAgICAgICBhbiBlcnJvciwgWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEpXG4gICAgLy8gICAtIHN0b3BDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCB3aGVuIHRoZSBzdWIgdGVybWluYXRlc1xuICAgIC8vICAgICBmb3IgYW55IHJlYXNvbiwgd2l0aCBhbiBlcnJvciBhcmd1bWVudCBpZiBhbiBlcnJvciB0cmlnZ2VyZWQgdGhlIHN0b3ApXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9ucyA9IHt9O1xuXG4gICAgLy8gUmVhY3RpdmUgdXNlcklkLlxuICAgIHNlbGYuX3VzZXJJZCA9IG51bGw7XG4gICAgc2VsZi5fdXNlcklkRGVwcyA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcblxuICAgIC8vIEJsb2NrIGF1dG8tcmVsb2FkIHdoaWxlIHdlJ3JlIHdhaXRpbmcgZm9yIG1ldGhvZCByZXNwb25zZXMuXG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCAmJlxuICAgICAgUGFja2FnZS5yZWxvYWQgJiZcbiAgICAgICEgb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcpIHtcbiAgICAgIFBhY2thZ2UucmVsb2FkLlJlbG9hZC5fb25NaWdyYXRlKHJldHJ5ID0+IHtcbiAgICAgICAgaWYgKCEgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IHJldHJ5O1xuICAgICAgICAgIHJldHVybiBbZmFsc2VdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBbdHJ1ZV07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG9uRGlzY29ubmVjdCA9ICgpID0+IHtcbiAgICAgIGlmIChzZWxmLl9oZWFydGJlYXQpIHtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAnbWVzc2FnZScsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgICAgdGhpcy5vbk1lc3NhZ2UuYmluZCh0aGlzKSxcbiAgICAgICAgICAnaGFuZGxpbmcgRERQIG1lc3NhZ2UnXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdyZXNldCcsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQodGhpcy5vblJlc2V0LmJpbmQodGhpcyksICdoYW5kbGluZyBERFAgcmVzZXQnKVxuICAgICAgKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ2Rpc2Nvbm5lY3QnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KG9uRGlzY29ubmVjdCwgJ2hhbmRsaW5nIEREUCBkaXNjb25uZWN0JylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignbWVzc2FnZScsIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcykpO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKCdyZXNldCcsIHRoaXMub25SZXNldC5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignZGlzY29ubmVjdCcsIG9uRGlzY29ubmVjdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gJ25hbWUnIGlzIHRoZSBuYW1lIG9mIHRoZSBkYXRhIG9uIHRoZSB3aXJlIHRoYXQgc2hvdWxkIGdvIGluIHRoZVxuICAvLyBzdG9yZS4gJ3dyYXBwZWRTdG9yZScgc2hvdWxkIGJlIGFuIG9iamVjdCB3aXRoIG1ldGhvZHMgYmVnaW5VcGRhdGUsIHVwZGF0ZSxcbiAgLy8gZW5kVXBkYXRlLCBzYXZlT3JpZ2luYWxzLCByZXRyaWV2ZU9yaWdpbmFscy4gc2VlIENvbGxlY3Rpb24gZm9yIGFuIGV4YW1wbGUuXG4gIGNyZWF0ZVN0b3JlTWV0aG9kcyhuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChuYW1lIGluIHNlbGYuX3N0b3JlcykgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gV3JhcCB0aGUgaW5wdXQgb2JqZWN0IGluIGFuIG9iamVjdCB3aGljaCBtYWtlcyBhbnkgc3RvcmUgbWV0aG9kIG5vdFxuICAgIC8vIGltcGxlbWVudGVkIGJ5ICdzdG9yZScgaW50byBhIG5vLW9wLlxuICAgIGNvbnN0IHN0b3JlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBrZXlzT2ZTdG9yZSA9IFtcbiAgICAgICd1cGRhdGUnLFxuICAgICAgJ2JlZ2luVXBkYXRlJyxcbiAgICAgICdlbmRVcGRhdGUnLFxuICAgICAgJ3NhdmVPcmlnaW5hbHMnLFxuICAgICAgJ3JldHJpZXZlT3JpZ2luYWxzJyxcbiAgICAgICdnZXREb2MnLFxuICAgICAgJ19nZXRDb2xsZWN0aW9uJ1xuICAgIF07XG4gICAga2V5c09mU3RvcmUuZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICBzdG9yZVttZXRob2RdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgaWYgKHdyYXBwZWRTdG9yZVttZXRob2RdKSB7XG4gICAgICAgICAgcmV0dXJuIHdyYXBwZWRTdG9yZVttZXRob2RdKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICAgIHNlbGYuX3N0b3Jlc1tuYW1lXSA9IHN0b3JlO1xuICAgIHJldHVybiBzdG9yZTtcbiAgfVxuXG4gIHJlZ2lzdGVyU3RvcmVDbGllbnQobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBzdG9yZSA9IHNlbGYuY3JlYXRlU3RvcmVNZXRob2RzKG5hbWUsIHdyYXBwZWRTdG9yZSk7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBxdWV1ZWQuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgICBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH0pO1xuICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICBkZWxldGUgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgcmVnaXN0ZXJTdG9yZVNlcnZlcihuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IHN0b3JlID0gc2VsZi5jcmVhdGVTdG9yZU1ldGhvZHMobmFtZSwgd3JhcHBlZFN0b3JlKTtcblxuICAgIGNvbnN0IHF1ZXVlZCA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHF1ZXVlZCkpIHtcbiAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKHF1ZXVlZC5sZW5ndGgsIGZhbHNlKTtcbiAgICAgIGZvciAoY29uc3QgbXNnIG9mIHF1ZXVlZCkge1xuICAgICAgICBhd2FpdCBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgZGVsZXRlIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN1YnNjcmliZVxuICAgKiBAc3VtbWFyeSBTdWJzY3JpYmUgdG8gYSByZWNvcmQgc2V0LiAgUmV0dXJucyBhIGhhbmRsZSB0aGF0IHByb3ZpZGVzXG4gICAqIGBzdG9wKClgIGFuZCBgcmVhZHkoKWAgbWV0aG9kcy5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBzdWJzY3JpcHRpb24uICBNYXRjaGVzIHRoZSBuYW1lIG9mIHRoZVxuICAgKiBzZXJ2ZXIncyBgcHVibGlzaCgpYCBjYWxsLlxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXJcbiAgICogZnVuY3Rpb24gb24gc2VydmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdH0gW2NhbGxiYWNrc10gT3B0aW9uYWwuIE1heSBpbmNsdWRlIGBvblN0b3BgXG4gICAqIGFuZCBgb25SZWFkeWAgY2FsbGJhY2tzLiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgaXQgaXMgcGFzc2VkIGFzIGFuXG4gICAqIGFyZ3VtZW50IHRvIGBvblN0b3BgLiBJZiBhIGZ1bmN0aW9uIGlzIHBhc3NlZCBpbnN0ZWFkIG9mIGFuIG9iamVjdCwgaXRcbiAgICogaXMgaW50ZXJwcmV0ZWQgYXMgYW4gYG9uUmVhZHlgIGNhbGxiYWNrLlxuICAgKi9cbiAgc3Vic2NyaWJlKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKGNhbGxiYWNrfGNhbGxiYWNrcykgKi8pIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IHBhcmFtcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsZXQgY2FsbGJhY2tzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBpZiAocGFyYW1zLmxlbmd0aCkge1xuICAgICAgY29uc3QgbGFzdFBhcmFtID0gcGFyYW1zW3BhcmFtcy5sZW5ndGggLSAxXTtcbiAgICAgIGlmICh0eXBlb2YgbGFzdFBhcmFtID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrcy5vblJlYWR5ID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfSBlbHNlIGlmIChsYXN0UGFyYW0gJiYgW1xuICAgICAgICBsYXN0UGFyYW0ub25SZWFkeSxcbiAgICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgb25FcnJvciB1c2VkIHRvIGV4aXN0LCBidXQgbm93IHdlIHVzZVxuICAgICAgICAvLyBvblN0b3Agd2l0aCBhbiBlcnJvciBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgICBsYXN0UGFyYW0ub25FcnJvcixcbiAgICAgICAgbGFzdFBhcmFtLm9uU3RvcFxuICAgICAgXS5zb21lKGYgPT4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIikpIHtcbiAgICAgICAgY2FsbGJhY2tzID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElzIHRoZXJlIGFuIGV4aXN0aW5nIHN1YiB3aXRoIHRoZSBzYW1lIG5hbWUgYW5kIHBhcmFtLCBydW4gaW4gYW5cbiAgICAvLyBpbnZhbGlkYXRlZCBDb21wdXRhdGlvbj8gVGhpcyB3aWxsIGhhcHBlbiBpZiB3ZSBhcmUgcmVydW5uaW5nIGFuXG4gICAgLy8gZXhpc3RpbmcgY29tcHV0YXRpb24uXG4gICAgLy9cbiAgICAvLyBGb3IgZXhhbXBsZSwgY29uc2lkZXIgYSByZXJ1biBvZjpcbiAgICAvL1xuICAgIC8vICAgICBUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJmb29cIiwgU2Vzc2lvbi5nZXQoXCJmb29cIikpO1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJiYXJcIiwgU2Vzc2lvbi5nZXQoXCJiYXJcIikpO1xuICAgIC8vICAgICB9KTtcbiAgICAvL1xuICAgIC8vIElmIFwiZm9vXCIgaGFzIGNoYW5nZWQgYnV0IFwiYmFyXCIgaGFzIG5vdCwgd2Ugd2lsbCBtYXRjaCB0aGUgXCJiYXJcIlxuICAgIC8vIHN1YmNyaWJlIHRvIGFuIGV4aXN0aW5nIGluYWN0aXZlIHN1YnNjcmlwdGlvbiBpbiBvcmRlciB0byBub3RcbiAgICAvLyB1bnN1YiBhbmQgcmVzdWIgdGhlIHN1YnNjcmlwdGlvbiB1bm5lY2Vzc2FyaWx5LlxuICAgIC8vXG4gICAgLy8gV2Ugb25seSBsb29rIGZvciBvbmUgc3VjaCBzdWI7IGlmIHRoZXJlIGFyZSBOIGFwcGFyZW50bHktaWRlbnRpY2FsIHN1YnNcbiAgICAvLyBiZWluZyBpbnZhbGlkYXRlZCwgd2Ugd2lsbCByZXF1aXJlIE4gbWF0Y2hpbmcgc3Vic2NyaWJlIGNhbGxzIHRvIGtlZXBcbiAgICAvLyB0aGVtIGFsbCBhY3RpdmUuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBPYmplY3QudmFsdWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZpbmQoXG4gICAgICBzdWIgPT4gKHN1Yi5pbmFjdGl2ZSAmJiBzdWIubmFtZSA9PT0gbmFtZSAmJiBFSlNPTi5lcXVhbHMoc3ViLnBhcmFtcywgcGFyYW1zKSlcbiAgICApO1xuXG4gICAgbGV0IGlkO1xuICAgIGlmIChleGlzdGluZykge1xuICAgICAgaWQgPSBleGlzdGluZy5pZDtcbiAgICAgIGV4aXN0aW5nLmluYWN0aXZlID0gZmFsc2U7IC8vIHJlYWN0aXZhdGVcblxuICAgICAgaWYgKGNhbGxiYWNrcy5vblJlYWR5KSB7XG4gICAgICAgIC8vIElmIHRoZSBzdWIgaXMgbm90IGFscmVhZHkgcmVhZHksIHJlcGxhY2UgYW55IHJlYWR5IGNhbGxiYWNrIHdpdGggdGhlXG4gICAgICAgIC8vIG9uZSBwcm92aWRlZCBub3cuIChJdCdzIG5vdCByZWFsbHkgY2xlYXIgd2hhdCB1c2VycyB3b3VsZCBleHBlY3QgZm9yXG4gICAgICAgIC8vIGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuIGF1dG9ydW47IHRoZSBzZW1hbnRpY3Mgd2UgcHJvdmlkZSBpc1xuICAgICAgICAvLyB0aGF0IGF0IHRoZSB0aW1lIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSwgd2UgY2FsbCB0aGUgbGFzdFxuICAgICAgICAvLyBvblJlYWR5IGNhbGxiYWNrIHByb3ZpZGVkLCBpZiBhbnkuKVxuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIGFscmVhZHkgcmVhZHksIHJ1biB0aGUgcmVhZHkgY2FsbGJhY2sgcmlnaHQgYXdheS5cbiAgICAgICAgLy8gSXQgc2VlbXMgdGhhdCB1c2VycyB3b3VsZCBleHBlY3QgYW4gb25SZWFkeSBjYWxsYmFjayBpbnNpZGUgYW5cbiAgICAgICAgLy8gYXV0b3J1biB0byB0cmlnZ2VyIG9uY2UgdGhlIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSBhbmQgYWxzb1xuICAgICAgICAvLyB3aGVuIHJlLXN1YnMgaGFwcGVucy5cbiAgICAgICAgaWYgKGV4aXN0aW5nLnJlYWR5KSB7XG4gICAgICAgICAgY2FsbGJhY2tzLm9uUmVhZHkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleGlzdGluZy5yZWFkeUNhbGxiYWNrID0gY2FsbGJhY2tzLm9uUmVhZHk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgd2UgdXNlZCB0byBoYXZlIG9uRXJyb3IgYnV0IG5vdyB3ZSBjYWxsXG4gICAgICAvLyBvblN0b3Agd2l0aCBhbiBvcHRpb25hbCBlcnJvciBhcmd1bWVudFxuICAgICAgaWYgKGNhbGxiYWNrcy5vbkVycm9yKSB7XG4gICAgICAgIC8vIFJlcGxhY2UgZXhpc3RpbmcgY2FsbGJhY2sgaWYgYW55LCBzbyB0aGF0IGVycm9ycyBhcmVuJ3RcbiAgICAgICAgLy8gZG91YmxlLXJlcG9ydGVkLlxuICAgICAgICBleGlzdGluZy5lcnJvckNhbGxiYWNrID0gY2FsbGJhY2tzLm9uRXJyb3I7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25TdG9wKSB7XG4gICAgICAgIGV4aXN0aW5nLnN0b3BDYWxsYmFjayA9IGNhbGxiYWNrcy5vblN0b3A7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5ldyBzdWIhIEdlbmVyYXRlIGFuIGlkLCBzYXZlIGl0IGxvY2FsbHksIGFuZCBzZW5kIG1lc3NhZ2UuXG4gICAgICBpZCA9IFJhbmRvbS5pZCgpO1xuICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0gPSB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBFSlNPTi5jbG9uZShwYXJhbXMpLFxuICAgICAgICBpbmFjdGl2ZTogZmFsc2UsXG4gICAgICAgIHJlYWR5OiBmYWxzZSxcbiAgICAgICAgcmVhZHlEZXBzOiBuZXcgVHJhY2tlci5EZXBlbmRlbmN5KCksXG4gICAgICAgIHJlYWR5Q2FsbGJhY2s6IGNhbGxiYWNrcy5vblJlYWR5LFxuICAgICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSAjZXJyb3JDYWxsYmFja1xuICAgICAgICBlcnJvckNhbGxiYWNrOiBjYWxsYmFja3Mub25FcnJvcixcbiAgICAgICAgc3RvcENhbGxiYWNrOiBjYWxsYmFja3Mub25TdG9wLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgICByZW1vdmUoKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbi5fc3Vic2NyaXB0aW9uc1t0aGlzLmlkXTtcbiAgICAgICAgICB0aGlzLnJlYWR5ICYmIHRoaXMucmVhZHlEZXBzLmNoYW5nZWQoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RvcCgpIHtcbiAgICAgICAgICB0aGlzLmNvbm5lY3Rpb24uX3NlbmQoeyBtc2c6ICd1bnN1YicsIGlkOiBpZCB9KTtcbiAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vblN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzZWxmLl9zZW5kKHsgbXNnOiAnc3ViJywgaWQ6IGlkLCBuYW1lOiBuYW1lLCBwYXJhbXM6IHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYSBoYW5kbGUgdG8gdGhlIGFwcGxpY2F0aW9uLlxuICAgIGNvbnN0IGhhbmRsZSA9IHtcbiAgICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5zdG9wKCk7XG4gICAgICB9LFxuICAgICAgcmVhZHkoKSB7XG4gICAgICAgIC8vIHJldHVybiBmYWxzZSBpZiB3ZSd2ZSB1bnN1YnNjcmliZWQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlY29yZCA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdO1xuICAgICAgICByZWNvcmQucmVhZHlEZXBzLmRlcGVuZCgpO1xuICAgICAgICByZXR1cm4gcmVjb3JkLnJlYWR5O1xuICAgICAgfSxcbiAgICAgIHN1YnNjcmlwdGlvbklkOiBpZFxuICAgIH07XG5cbiAgICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIC8vIFdlJ3JlIGluIGEgcmVhY3RpdmUgY29tcHV0YXRpb24sIHNvIHdlJ2QgbGlrZSB0byB1bnN1YnNjcmliZSB3aGVuIHRoZVxuICAgICAgLy8gY29tcHV0YXRpb24gaXMgaW52YWxpZGF0ZWQuLi4gYnV0IG5vdCBpZiB0aGUgcmVydW4ganVzdCByZS1zdWJzY3JpYmVzXG4gICAgICAvLyB0byB0aGUgc2FtZSBzdWJzY3JpcHRpb24hICBXaGVuIGEgcmVydW4gaGFwcGVucywgd2UgdXNlIG9uSW52YWxpZGF0ZVxuICAgICAgLy8gYXMgYSBjaGFuZ2UgdG8gbWFyayB0aGUgc3Vic2NyaXB0aW9uIFwiaW5hY3RpdmVcIiBzbyB0aGF0IGl0IGNhblxuICAgICAgLy8gYmUgcmV1c2VkIGZyb20gdGhlIHJlcnVuLiAgSWYgaXQgaXNuJ3QgcmV1c2VkLCBpdCdzIGtpbGxlZCBmcm9tXG4gICAgICAvLyBhbiBhZnRlckZsdXNoLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoKGMpID0+IHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaCgoKSA9PiB7XG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSAmJlxuICAgICAgICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5pbmFjdGl2ZSkge1xuICAgICAgICAgICAgaGFuZGxlLnN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBUZWxscyBpZiB0aGUgbWV0aG9kIGNhbGwgY2FtZSBmcm9tIGEgY2FsbCBvciBhIGNhbGxBc3luYy5cbiAgICogQGFsaWFzIE1ldGVvci5pc0FzeW5jQ2FsbFxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEByZXR1cm5zIGJvb2xlYW5cbiAgICovXG4gIGlzQXN5bmNDYWxsKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH1cbiAgbWV0aG9kcyhtZXRob2RzKSB7XG4gICAgT2JqZWN0LmVudHJpZXMobWV0aG9kcykuZm9yRWFjaCgoW25hbWUsIGZ1bmNdKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdcIiArIG5hbWUgKyBcIicgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX21ldGhvZEhhbmRsZXJzW25hbWVdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9XG5cbiAgX2dldElzU2ltdWxhdGlvbih7aXNGcm9tQ2FsbEFzeW5jLCBhbHJlYWR5SW5TaW11bGF0aW9ufSkge1xuICAgIGlmICghaXNGcm9tQ2FsbEFzeW5jKSB7XG4gICAgICByZXR1cm4gYWxyZWFkeUluU2ltdWxhdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIGFscmVhZHlJblNpbXVsYXRpb24gJiYgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5faXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbFxuICAgKiBAc3VtbWFyeSBJbnZva2VzIGEgbWV0aG9kIHdpdGggYSBzeW5jIHN0dWIsIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrLCB3aGljaCBpcyBjYWxsZWQgYXN5bmNocm9ub3VzbHkgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IGFmdGVyIHRoZSBtZXRob2QgaXMgY29tcGxldGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIG1ldGhvZCBydW5zIHN5bmNocm9ub3VzbHkgaWYgcG9zc2libGUgKHNlZSBiZWxvdykuXG4gICAqL1xuICBjYWxsKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gY2FsbGJhY2sgKi8pIHtcbiAgICAvLyBpZiBpdCdzIGEgZnVuY3Rpb24sIHRoZSBsYXN0IGFyZ3VtZW50IGlzIHRoZSByZXN1bHQgY2FsbGJhY2ssXG4gICAgLy8gbm90IGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFwcGx5KG5hbWUsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgfVxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbEFzeW5jXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2Qgd2l0aCBhbiBhc3luYyBzdHViLCBwYXNzaW5nIGFueSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBtZXRob2QgYXJndW1lbnRzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgYXN5bmMgY2FsbEFzeW5jKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKi8pIHtcbiAgICBjb25zdCBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiTWV0ZW9yLmNhbGxBc3luYygpIGRvZXMgbm90IGFjY2VwdCBhIGNhbGxiYWNrLiBZb3Ugc2hvdWxkICdhd2FpdCcgdGhlIHJlc3VsdCwgb3IgdXNlIC50aGVuKCkuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgYXBwbHlPcHRpb25zID0gWydyZXR1cm5TdHViVmFsdWUnLCAncmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZScsICdyZXR1cm5TZXJ2ZXJQcm9taXNlJ107XG4gICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICByZXR1cm5TZXJ2ZXJSZXN1bHRQcm9taXNlOiB0cnVlLFxuICAgIH07XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIC4uLmRlZmF1bHRPcHRpb25zLFxuICAgICAgLi4uKGFwcGx5T3B0aW9ucy5zb21lKG8gPT4gYXJnc1swXT8uaGFzT3duUHJvcGVydHkobykpXG4gICAgICAgID8gYXJncy5zaGlmdCgpXG4gICAgICAgIDoge30pLFxuICAgIH07XG5cbiAgICBjb25zdCBpbnZvY2F0aW9uID0gRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5nZXQoKTtcblxuICAgIGlmIChpbnZvY2F0aW9uPy5oYXNDYWxsQXN5bmNQYXJlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLmFwcGx5QXN5bmMobmFtZSwgYXJncywgeyAuLi5vcHRpb25zLCBpc0Zyb21DYWxsQXN5bmM6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugd2hlbiB5b3UgY2FsbCBhIFByb21pc2UudGhlbiwgeW91J3JlIGFjdHVhbGx5IGNhbGxpbmcgYSBib3VuZCBmdW5jdGlvbiBieSBNZXRlb3IuXG4gICAgKlxuICAgICogVGhpcyBpcyBkb25lIGJ5IHRoaXMgY29kZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9ibG9iLzE3NjczYzY2ODc4ZDNmN2IxZDU2NGE0MjE1ZWIwNjMzZmE2NzkwMTcvbnBtLXBhY2thZ2VzL21ldGVvci1wcm9taXNlL3Byb21pc2VfY2xpZW50LmpzI0wxLUwxNi4gKEFsbCB0aGUgbG9naWMgYmVsb3cgY2FuIGJlIHJlbW92ZWQgaW4gdGhlIGZ1dHVyZSwgd2hlbiB3ZSBzdG9wIG92ZXJ3cml0aW5nIHRoZVxuICAgICogUHJvbWlzZS4pXG4gICAgKlxuICAgICogV2hlbiB5b3UgY2FsbCBhIFwiLnRoZW4oKVwiLCBsaWtlIFwiTWV0ZW9yLmNhbGxBc3luYygpLnRoZW4oKVwiLCB0aGUgZ2xvYmFsIGNvbnRleHQgKGluc2lkZSBjdXJyZW50VmFsdWVzKVxuICAgICogd2lsbCBiZSBmcm9tIHRoZSBjYWxsIG9mIE1ldGVvci5jYWxsQXN5bmMoKSwgYW5kIG5vdCB0aGUgY29udGV4dCBhZnRlciB0aGUgcHJvbWlzZSBpcyBkb25lLlxuICAgICpcbiAgICAqIFRoaXMgbWVhbnMgdGhhdCB3aXRob3V0IHRoaXMgY29kZSBpZiB5b3UgY2FsbCBhIHN0dWIgaW5zaWRlIHRoZSBcIi50aGVuKClcIiwgdGhpcyBzdHViIHdpbGwgYWN0IGFzIGEgc2ltdWxhdGlvblxuICAgICogYW5kIHdvbid0IHJlYWNoIHRoZSBzZXJ2ZXIuXG4gICAgKlxuICAgICogSW5zaWRlIHRoZSBmdW5jdGlvbiBfZ2V0SXNTaW11bGF0aW9uKCksIGlmIGlzRnJvbUNhbGxBc3luYyBpcyBmYWxzZSwgd2UgY29udGludWUgdG8gY29uc2lkZXIganVzdCB0aGVcbiAgICAqIGFscmVhZHlJblNpbXVsYXRpb24sIG90aGVyd2lzZSwgaXNGcm9tQ2FsbEFzeW5jIGlzIHRydWUsIHdlIGFsc28gY2hlY2sgdGhlIHZhbHVlIG9mIGNhbGxBc3luY01ldGhvZFJ1bm5pbmcgKGJ5XG4gICAgKiBjYWxsaW5nIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpKS5cbiAgICAqXG4gICAgKiBXaXRoIHRoaXMsIGlmIGEgc3R1YiBpcyBydW5uaW5nIGluc2lkZSBhIFwiLnRoZW4oKVwiLCBpdCdsbCBrbm93IGl0J3Mgbm90IGEgc2ltdWxhdGlvbiwgYmVjYXVzZSBjYWxsQXN5bmNNZXRob2RSdW5uaW5nXG4gICAgKiB3aWxsIGJlIGZhbHNlLlxuICAgICpcbiAgICAqIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpIGlzIGltcG9ydGFudCBiZWNhdXNlIHdpdGhvdXQgaXQsIGlmIHlvdSBoYXZlIGEgY29kZSBsaWtlOlxuICAgICpcbiAgICAqIE1ldGVvci5jYWxsQXN5bmMoXCJtMVwiKS50aGVuKCgpID0+IHtcbiAgICAqICAgTWV0ZW9yLmNhbGxBc3luYyhcIm0yXCIpXG4gICAgKiB9KVxuICAgICpcbiAgICAqIFRoZSBjYWxsIHRoZSBtZXRob2QgbTIgd2lsbCBhY3QgYXMgYSBzaW11bGF0aW9uIGFuZCB3b24ndCByZWFjaCB0aGUgc2VydmVyLiBUaGF0J3Mgd2h5IHdlIHJlc2V0IHRoZSBjb250ZXh0IGhlcmVcbiAgICAqIGJlZm9yZSBjYWxsaW5nIGV2ZXJ5dGhpbmcgZWxzZS5cbiAgICAqXG4gICAgKiAqL1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpO1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIEREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24uX3NldCh7IG5hbWUsIGhhc0NhbGxBc3luY1BhcmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAudGhlbihyZXNvbHZlKVxuICAgICAgICAuY2F0Y2gocmVqZWN0KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5fc2V0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT5cbiAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcoZmFsc2UpXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5hcHBseVxuICAgKiBAc3VtbWFyeSBJbnZva2UgYSBtZXRob2QgcGFzc2luZyBhbiBhcnJheSBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGVbXX0gYXJncyBNZXRob2QgYXJndW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLndhaXQgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIHVudGlsIGFsbCBwcmV2aW91cyBtZXRob2QgY2FsbHMgaGF2ZSBjb21wbGV0ZWQsIGFuZCBkb24ndCBzZW5kIGFueSBzdWJzZXF1ZW50IG1ldGhvZCBjYWxscyB1bnRpbCB0aGlzIG9uZSBpcyBjb21wbGV0ZWQuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCAoQ2xpZW50IG9ubHkpIFRoaXMgY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgb2YgdGhlIG1ldGhvZCAoanVzdCBsaWtlIGBhc3luY0NhbGxiYWNrYCkgYXMgc29vbiBhcyB0aGUgZXJyb3Igb3IgcmVzdWx0IGlzIGF2YWlsYWJsZS4gVGhlIGxvY2FsIGNhY2hlIG1heSBub3QgeWV0IHJlZmxlY3QgdGhlIHdyaXRlcyBwZXJmb3JtZWQgYnkgdGhlIG1ldGhvZC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm5vUmV0cnkgKENsaWVudCBvbmx5KSBpZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIGFnYWluIG9uIHJlbG9hZCwgc2ltcGx5IGNhbGwgdGhlIGNhbGxiYWNrIGFuIGVycm9yIHdpdGggdGhlIGVycm9yIGNvZGUgJ2ludm9jYXRpb24tZmFpbGVkJy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBleGNlcHRpb25zIHRocm93biBieSBtZXRob2Qgc3R1YnMgd2lsbCBiZSB0aHJvd24gaW5zdGVhZCBvZiBsb2dnZWQsIGFuZCB0aGUgbWV0aG9kIHdpbGwgbm90IGJlIGludm9rZWQgb24gdGhlIHNlcnZlci5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSAoQ2xpZW50IG9ubHkpIElmIHRydWUgdGhlbiBpbiBjYXNlcyB3aGVyZSB3ZSB3b3VsZCBoYXZlIG90aGVyd2lzZSBkaXNjYXJkZWQgdGhlIHN0dWIncyByZXR1cm4gdmFsdWUgYW5kIHJldHVybmVkIHVuZGVmaW5lZCwgaW5zdGVhZCB3ZSBnbyBhaGVhZCBhbmQgcmV0dXJuIGl0LiBTcGVjaWZpY2FsbHksIHRoaXMgaXMgYW55IHRpbWUgb3RoZXIgdGhhbiB3aGVuIChhKSB3ZSBhcmUgYWxyZWFkeSBpbnNpZGUgYSBzdHViIG9yIChiKSB3ZSBhcmUgaW4gTm9kZSBhbmQgbm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkLiBDdXJyZW50bHkgd2UgcmVxdWlyZSB0aGlzIGZsYWcgdG8gYmUgZXhwbGljaXRseSBwYXNzZWQgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIHRoYXQgc3R1YiByZXR1cm4gdmFsdWVzIHdpbGwgYmUgY29uZnVzZWQgd2l0aCBzZXJ2ZXIgcmV0dXJuIHZhbHVlczsgd2UgbWF5IGltcHJvdmUgdGhpcyBpbiBmdXR1cmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFthc3luY0NhbGxiYWNrXSBPcHRpb25hbCBjYWxsYmFjazsgc2FtZSBzZW1hbnRpY3MgYXMgaW4gW2BNZXRlb3IuY2FsbGBdKCNtZXRlb3JfY2FsbCkuXG4gICAqL1xuICBhcHBseShuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHsgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24sIC4uLnN0dWJPcHRpb25zIH0gPSB0aGlzLl9zdHViQ2FsbChuYW1lLCBFSlNPTi5jbG9uZShhcmdzKSk7XG5cbiAgICBpZiAoc3R1Yk9wdGlvbnMuaGFzU3R1Yikge1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5fZ2V0SXNTaW11bGF0aW9uKHtcbiAgICAgICAgICBhbHJlYWR5SW5TaW11bGF0aW9uOiBzdHViT3B0aW9ucy5hbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1Yk9wdGlvbnMuaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgICB9KVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbHMoKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHN0dWJPcHRpb25zLnN0dWJSZXR1cm5WYWx1ZSA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb25cbiAgICAgICAgICAud2l0aFZhbHVlKGludm9jYXRpb24sIHN0dWJJbnZvY2F0aW9uKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgc3R1Yk9wdGlvbnMuZXhjZXB0aW9uID0gZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2FwcGx5KG5hbWUsIHN0dWJPcHRpb25zLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuYXBwbHlBc3luY1xuICAgKiBAc3VtbWFyeSBJbnZva2UgYSBtZXRob2QgcGFzc2luZyBhbiBhcnJheSBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGVbXX0gYXJncyBNZXRob2QgYXJndW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLndhaXQgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIHVudGlsIGFsbCBwcmV2aW91cyBtZXRob2QgY2FsbHMgaGF2ZSBjb21wbGV0ZWQsIGFuZCBkb24ndCBzZW5kIGFueSBzdWJzZXF1ZW50IG1ldGhvZCBjYWxscyB1bnRpbCB0aGlzIG9uZSBpcyBjb21wbGV0ZWQuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCAoQ2xpZW50IG9ubHkpIFRoaXMgY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgb2YgdGhlIG1ldGhvZCAoanVzdCBsaWtlIGBhc3luY0NhbGxiYWNrYCkgYXMgc29vbiBhcyB0aGUgZXJyb3Igb3IgcmVzdWx0IGlzIGF2YWlsYWJsZS4gVGhlIGxvY2FsIGNhY2hlIG1heSBub3QgeWV0IHJlZmxlY3QgdGhlIHdyaXRlcyBwZXJmb3JtZWQgYnkgdGhlIG1ldGhvZC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm5vUmV0cnkgKENsaWVudCBvbmx5KSBpZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIGFnYWluIG9uIHJlbG9hZCwgc2ltcGx5IGNhbGwgdGhlIGNhbGxiYWNrIGFuIGVycm9yIHdpdGggdGhlIGVycm9yIGNvZGUgJ2ludm9jYXRpb24tZmFpbGVkJy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBleGNlcHRpb25zIHRocm93biBieSBtZXRob2Qgc3R1YnMgd2lsbCBiZSB0aHJvd24gaW5zdGVhZCBvZiBsb2dnZWQsIGFuZCB0aGUgbWV0aG9kIHdpbGwgbm90IGJlIGludm9rZWQgb24gdGhlIHNlcnZlci5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSAoQ2xpZW50IG9ubHkpIElmIHRydWUgdGhlbiBpbiBjYXNlcyB3aGVyZSB3ZSB3b3VsZCBoYXZlIG90aGVyd2lzZSBkaXNjYXJkZWQgdGhlIHN0dWIncyByZXR1cm4gdmFsdWUgYW5kIHJldHVybmVkIHVuZGVmaW5lZCwgaW5zdGVhZCB3ZSBnbyBhaGVhZCBhbmQgcmV0dXJuIGl0LiBTcGVjaWZpY2FsbHksIHRoaXMgaXMgYW55IHRpbWUgb3RoZXIgdGhhbiB3aGVuIChhKSB3ZSBhcmUgYWxyZWFkeSBpbnNpZGUgYSBzdHViIG9yIChiKSB3ZSBhcmUgaW4gTm9kZSBhbmQgbm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkLiBDdXJyZW50bHkgd2UgcmVxdWlyZSB0aGlzIGZsYWcgdG8gYmUgZXhwbGljaXRseSBwYXNzZWQgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIHRoYXQgc3R1YiByZXR1cm4gdmFsdWVzIHdpbGwgYmUgY29uZnVzZWQgd2l0aCBzZXJ2ZXIgcmV0dXJuIHZhbHVlczsgd2UgbWF5IGltcHJvdmUgdGhpcyBpbiBmdXR1cmUuXG4gICAqL1xuICBhc3luYyBhcHBseUFzeW5jKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrID0gbnVsbCkge1xuICAgIGNvbnN0IHsgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24sIC4uLnN0dWJPcHRpb25zIH0gPSB0aGlzLl9zdHViQ2FsbChuYW1lLCBFSlNPTi5jbG9uZShhcmdzKSwgb3B0aW9ucyk7XG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvKlxuICAgICAgICAgKiBUaGUgY29kZSBiZWxvdyBmb2xsb3dzIHRoZSBzYW1lIGxvZ2ljIGFzIHRoZSBmdW5jdGlvbiB3aXRoVmFsdWVzKCkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEJ1dCBhcyB0aGUgTWV0ZW9yIHBhY2thZ2UgaXMgbm90IGNvbXBpbGVkIGJ5IGVjbWFzY3JpcHQsIGl0IGlzIHVuYWJsZSB0byB1c2UgbmV3ZXIgc3ludGF4IGluIHRoZSBicm93c2VyLFxuICAgICAgICAgKiBzdWNoIGFzLCB0aGUgYXN5bmMvYXdhaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIFNvLCB0byBrZWVwIHN1cHBvcnRpbmcgb2xkIGJyb3dzZXJzLCBsaWtlIElFIDExLCB3ZSdyZSBjcmVhdGluZyB0aGUgbG9naWMgb25lIGxldmVsIGFib3ZlLlxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY3VycmVudENvbnRleHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9zZXROZXdDb250ZXh0QW5kR2V0Q3VycmVudChcbiAgICAgICAgICBpbnZvY2F0aW9uXG4gICAgICAgICk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc3R1Yk9wdGlvbnMuc3R1YlJldHVyblZhbHVlID0gYXdhaXQgc3R1Ykludm9jYXRpb24oKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0KGN1cnJlbnRDb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzdHViT3B0aW9ucy5leGNlcHRpb24gPSBlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYXBwbHkobmFtZSwgc3R1Yk9wdGlvbnMsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIF9hcHBseShuYW1lLCBzdHViQ2FsbFZhbHVlLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIFdlIHdlcmUgcGFzc2VkIDMgYXJndW1lbnRzLiBUaGV5IG1heSBiZSBlaXRoZXIgKG5hbWUsIGFyZ3MsIG9wdGlvbnMpXG4gICAgLy8gb3IgKG5hbWUsIGFyZ3MsIGNhbGxiYWNrKVxuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAvLyBYWFggd291bGQgaXQgYmUgYmV0dGVyIGZvcm0gdG8gZG8gdGhlIGJpbmRpbmcgaW4gc3RyZWFtLm9uLFxuICAgICAgLy8gb3IgY2FsbGVyLCBpbnN0ZWFkIG9mIGhlcmU/XG4gICAgICAvLyBYWFggaW1wcm92ZSBlcnJvciBtZXNzYWdlIChhbmQgaG93IHdlIHJlcG9ydCBpdClcbiAgICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgIFwiZGVsaXZlcmluZyByZXN1bHQgb2YgaW52b2tpbmcgJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB7XG4gICAgICBoYXNTdHViLFxuICAgICAgZXhjZXB0aW9uLFxuICAgICAgc3R1YlJldHVyblZhbHVlLFxuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgfSA9IHN0dWJDYWxsVmFsdWU7XG5cbiAgICAvLyBLZWVwIG91ciBhcmdzIHNhZmUgZnJvbSBtdXRhdGlvbiAoZWcgaWYgd2UgZG9uJ3Qgc2VuZCB0aGUgbWVzc2FnZSBmb3IgYVxuICAgIC8vIHdoaWxlIGJlY2F1c2Ugb2YgYSB3YWl0IG1ldGhvZCkuXG4gICAgYXJncyA9IEVKU09OLmNsb25lKGFyZ3MpO1xuICAgIC8vIElmIHdlJ3JlIGluIGEgc2ltdWxhdGlvbiwgc3RvcCBhbmQgcmV0dXJuIHRoZSByZXN1bHQgd2UgaGF2ZSxcbiAgICAvLyByYXRoZXIgdGhhbiBnb2luZyBvbiB0byBkbyBhbiBSUEMuIElmIHRoZXJlIHdhcyBubyBzdHViLFxuICAgIC8vIHdlJ2xsIGVuZCB1cCByZXR1cm5pbmcgdW5kZWZpbmVkLlxuICAgIGlmIChcbiAgICAgIHRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sXG4gICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1YkNhbGxWYWx1ZS5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV4Y2VwdGlvbiwgc3R1YlJldHVyblZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChleGNlcHRpb24pIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIHJldHVybiBzdHViUmV0dXJuVmFsdWU7XG4gICAgfVxuXG4gICAgLy8gV2Ugb25seSBjcmVhdGUgdGhlIG1ldGhvZElkIGhlcmUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSBuZWVkIG9uZSBpZlxuICAgIC8vIHdlJ3JlIGFscmVhZHkgaW4gYSBzaW11bGF0aW9uXG4gICAgY29uc3QgbWV0aG9kSWQgPSAnJyArIHNlbGYuX25leHRNZXRob2RJZCsrO1xuICAgIGlmIChoYXNTdHViKSB7XG4gICAgICBzZWxmLl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgRERQIG1lc3NhZ2UgZm9yIHRoZSBtZXRob2QgY2FsbC4gTm90ZSB0aGF0IG9uIHRoZSBjbGllbnQsXG4gICAgLy8gaXQgaXMgaW1wb3J0YW50IHRoYXQgdGhlIHN0dWIgaGF2ZSBmaW5pc2hlZCBiZWZvcmUgd2Ugc2VuZCB0aGUgUlBDLCBzb1xuICAgIC8vIHRoYXQgd2Uga25vdyB3ZSBoYXZlIGEgY29tcGxldGUgbGlzdCBvZiB3aGljaCBsb2NhbCBkb2N1bWVudHMgdGhlIHN0dWJcbiAgICAvLyB3cm90ZS5cbiAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgbXNnOiAnbWV0aG9kJyxcbiAgICAgIGlkOiBtZXRob2RJZCxcbiAgICAgIG1ldGhvZDogbmFtZSxcbiAgICAgIHBhcmFtczogYXJnc1xuICAgIH07XG5cbiAgICAvLyBJZiBhbiBleGNlcHRpb24gb2NjdXJyZWQgaW4gYSBzdHViLCBhbmQgd2UncmUgaWdub3JpbmcgaXRcbiAgICAvLyBiZWNhdXNlIHdlJ3JlIGRvaW5nIGFuIFJQQyBhbmQgd2FudCB0byB1c2Ugd2hhdCB0aGUgc2VydmVyXG4gICAgLy8gcmV0dXJucyBpbnN0ZWFkLCBsb2cgaXQgc28gdGhlIGRldmVsb3BlciBrbm93c1xuICAgIC8vICh1bmxlc3MgdGhleSBleHBsaWNpdGx5IGFzayB0byBzZWUgdGhlIGVycm9yKS5cbiAgICAvL1xuICAgIC8vIFRlc3RzIGNhbiBzZXQgdGhlICdfZXhwZWN0ZWRCeVRlc3QnIGZsYWcgb24gYW4gZXhjZXB0aW9uIHNvIGl0IHdvbid0XG4gICAgLy8gZ28gdG8gbG9nLlxuICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfSBlbHNlIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHNpbXVsYXRpbmcgdGhlIGVmZmVjdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCIsXG4gICAgICAgICAgZXhjZXB0aW9uXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSdyZSBkZWZpbml0ZWx5IGRvaW5nIGFuIFJQQywgYW5kIHdlJ3JlIGdvaW5nIHRvXG4gICAgLy8gcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgUlBDIHRvIHRoZSBjYWxsZXIuXG5cbiAgICAvLyBJZiB0aGUgY2FsbGVyIGRpZG4ndCBnaXZlIGEgY2FsbGJhY2ssIGRlY2lkZSB3aGF0IHRvIGRvLlxuICAgIGxldCBmdXR1cmU7XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgaWYgKFxuICAgICAgICBNZXRlb3IuaXNDbGllbnQgJiZcbiAgICAgICAgIW9wdGlvbnMucmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZSAmJlxuICAgICAgICAoIW9wdGlvbnMuaXNGcm9tQ2FsbEFzeW5jIHx8IG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlKVxuICAgICAgKSB7XG4gICAgICAgIC8vIE9uIHRoZSBjbGllbnQsIHdlIGRvbid0IGhhdmUgZmliZXJzLCBzbyB3ZSBjYW4ndCBibG9jay4gVGhlXG4gICAgICAgIC8vIG9ubHkgdGhpbmcgd2UgY2FuIGRvIGlzIHRvIHJldHVybiB1bmRlZmluZWQgYW5kIGRpc2NhcmQgdGhlXG4gICAgICAgIC8vIHJlc3VsdCBvZiB0aGUgUlBDLiBJZiBhbiBlcnJvciBvY2N1cnJlZCB0aGVuIHByaW50IHRoZSBlcnJvclxuICAgICAgICAvLyB0byB0aGUgY29uc29sZS5cbiAgICAgICAgY2FsbGJhY2sgPSAoZXJyKSA9PiB7XG4gICAgICAgICAgZXJyICYmIE1ldGVvci5fZGVidWcoXCJFcnJvciBpbnZva2luZyBNZXRob2QgJ1wiICsgbmFtZSArIFwiJ1wiLCBlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gT24gdGhlIHNlcnZlciwgbWFrZSB0aGUgZnVuY3Rpb24gc3luY2hyb25vdXMuIFRocm93IG9uXG4gICAgICAgIC8vIGVycm9ycywgcmV0dXJuIG9uIHN1Y2Nlc3MuXG4gICAgICAgIGZ1dHVyZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjYWxsYmFjayA9ICguLi5hbGxBcmdzKSA9PiB7XG4gICAgICAgICAgICBsZXQgYXJncyA9IEFycmF5LmZyb20oYWxsQXJncyk7XG4gICAgICAgICAgICBsZXQgZXJyID0gYXJncy5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZSguLi5hcmdzKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZW5kIHRoZSByYW5kb21TZWVkIG9ubHkgaWYgd2UgdXNlZCBpdFxuICAgIGlmIChyYW5kb21TZWVkLnZhbHVlICE9PSBudWxsKSB7XG4gICAgICBtZXNzYWdlLnJhbmRvbVNlZWQgPSByYW5kb21TZWVkLnZhbHVlO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZEludm9rZXIgPSBuZXcgTWV0aG9kSW52b2tlcih7XG4gICAgICBtZXRob2RJZCxcbiAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgIGNvbm5lY3Rpb246IHNlbGYsXG4gICAgICBvblJlc3VsdFJlY2VpdmVkOiBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQsXG4gICAgICB3YWl0OiAhIW9wdGlvbnMud2FpdCxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICBub1JldHJ5OiAhIW9wdGlvbnMubm9SZXRyeVxuICAgIH0pO1xuXG4gICAgaWYgKG9wdGlvbnMud2FpdCkge1xuICAgICAgLy8gSXQncyBhIHdhaXQgbWV0aG9kISBXYWl0IG1ldGhvZHMgZ28gaW4gdGhlaXIgb3duIGJsb2NrLlxuICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgIHdhaXQ6IHRydWUsXG4gICAgICAgIG1ldGhvZHM6IFttZXRob2RJbnZva2VyXVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBhIHdhaXQgbWV0aG9kLiBTdGFydCBhIG5ldyBibG9jayBpZiB0aGUgcHJldmlvdXMgYmxvY2sgd2FzIGEgd2FpdFxuICAgICAgLy8gYmxvY2ssIGFuZCBhZGQgaXQgdG8gdGhlIGxhc3QgYmxvY2sgb2YgbWV0aG9kcy5cbiAgICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSB8fFxuICAgICAgICAgIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQpIHtcbiAgICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgICAgd2FpdDogZmFsc2UsXG4gICAgICAgICAgbWV0aG9kczogW10sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobWV0aG9kSW52b2tlcik7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgYWRkZWQgaXQgdG8gdGhlIGZpcnN0IGJsb2NrLCBzZW5kIGl0IG91dCBub3cuXG4gICAgaWYgKHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkgbWV0aG9kSW52b2tlci5zZW5kTWVzc2FnZSgpO1xuXG4gICAgLy8gSWYgd2UncmUgdXNpbmcgdGhlIGRlZmF1bHQgY2FsbGJhY2sgb24gdGhlIHNlcnZlcixcbiAgICAvLyBibG9jayB3YWl0aW5nIGZvciB0aGUgcmVzdWx0LlxuICAgIGlmIChmdXR1cmUpIHtcbiAgICAgIGlmIChvcHRpb25zLnJldHVyblNlcnZlclByb21pc2UpIHtcbiAgICAgICAgcmV0dXJuIGZ1dHVyZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvcHRpb25zLnJldHVyblN0dWJWYWx1ZVxuICAgICAgICA/IGZ1dHVyZS50aGVuKCgpID0+IHN0dWJSZXR1cm5WYWx1ZSlcbiAgICAgICAgOiB7XG4gICAgICAgICAgICBzdHViVmFsdWVQcm9taXNlOiBmdXR1cmUsXG4gICAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlID8gc3R1YlJldHVyblZhbHVlIDogdW5kZWZpbmVkO1xuICB9XG5cblxuICBfc3R1YkNhbGwobmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIFJ1biB0aGUgc3R1YiwgaWYgd2UgaGF2ZSBvbmUuIFRoZSBzdHViIGlzIHN1cHBvc2VkIHRvIG1ha2Ugc29tZVxuICAgIC8vIHRlbXBvcmFyeSB3cml0ZXMgdG8gdGhlIGRhdGFiYXNlIHRvIGdpdmUgdGhlIHVzZXIgYSBzbW9vdGggZXhwZXJpZW5jZVxuICAgIC8vIHVudGlsIHRoZSBhY3R1YWwgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGUgbWV0aG9kIGNvbWVzIGJhY2sgZnJvbSB0aGVcbiAgICAvLyBzZXJ2ZXIgKHdoZXJldXBvbiB0aGUgdGVtcG9yYXJ5IHdyaXRlcyB0byB0aGUgZGF0YWJhc2Ugd2lsbCBiZSByZXZlcnNlZFxuICAgIC8vIGR1cmluZyB0aGUgYmVnaW5VcGRhdGUvZW5kVXBkYXRlIHByb2Nlc3MuKVxuICAgIC8vXG4gICAgLy8gTm9ybWFsbHksIHdlIGlnbm9yZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBzdHViIChldmVuIGlmIGl0IGlzIGFuXG4gICAgLy8gZXhjZXB0aW9uKSwgaW4gZmF2b3Igb2YgdGhlIHJlYWwgcmV0dXJuIHZhbHVlIGZyb20gdGhlIHNlcnZlci4gVGhlXG4gICAgLy8gZXhjZXB0aW9uIGlzIGlmIHRoZSAqY2FsbGVyKiBpcyBhIHN0dWIuIEluIHRoYXQgY2FzZSwgd2UncmUgbm90IGdvaW5nXG4gICAgLy8gdG8gZG8gYSBSUEMsIHNvIHdlIHVzZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBzdHViIGFzIG91ciByZXR1cm5cbiAgICAvLyB2YWx1ZS5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgIGNvbnN0IHN0dWIgPSBzZWxmLl9tZXRob2RIYW5kbGVyc1tuYW1lXTtcbiAgICBjb25zdCBhbHJlYWR5SW5TaW11bGF0aW9uID0gZW5jbG9zaW5nPy5pc1NpbXVsYXRpb247XG4gICAgY29uc3QgaXNGcm9tQ2FsbEFzeW5jID0gZW5jbG9zaW5nPy5faXNGcm9tQ2FsbEFzeW5jO1xuICAgIGNvbnN0IHJhbmRvbVNlZWQgPSB7IHZhbHVlOiBudWxsfTtcblxuICAgIGNvbnN0IGRlZmF1bHRSZXR1cm4gPSB7XG4gICAgICBhbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgcmFuZG9tU2VlZCxcbiAgICAgIGlzRnJvbUNhbGxBc3luYyxcbiAgICB9O1xuICAgIGlmICghc3R1Yikge1xuICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdFJldHVybiwgaGFzU3R1YjogZmFsc2UgfTtcbiAgICB9XG5cbiAgICAvLyBMYXppbHkgZ2VuZXJhdGUgYSByYW5kb21TZWVkLCBvbmx5IGlmIGl0IGlzIHJlcXVlc3RlZCBieSB0aGUgc3R1Yi5cbiAgICAvLyBUaGUgcmFuZG9tIHN0cmVhbXMgb25seSBoYXZlIHV0aWxpdHkgaWYgdGhleSdyZSB1c2VkIG9uIGJvdGggdGhlIGNsaWVudFxuICAgIC8vIGFuZCB0aGUgc2VydmVyOyBpZiB0aGUgY2xpZW50IGRvZXNuJ3QgZ2VuZXJhdGUgYW55ICdyYW5kb20nIHZhbHVlc1xuICAgIC8vIHRoZW4gd2UgZG9uJ3QgZXhwZWN0IHRoZSBzZXJ2ZXIgdG8gZ2VuZXJhdGUgYW55IGVpdGhlci5cbiAgICAvLyBMZXNzIGNvbW1vbmx5LCB0aGUgc2VydmVyIG1heSBwZXJmb3JtIGRpZmZlcmVudCBhY3Rpb25zIGZyb20gdGhlIGNsaWVudCxcbiAgICAvLyBhbmQgbWF5IGluIGZhY3QgZ2VuZXJhdGUgdmFsdWVzIHdoZXJlIHRoZSBjbGllbnQgZGlkIG5vdCwgYnV0IHdlIGRvbid0XG4gICAgLy8gaGF2ZSBhbnkgY2xpZW50LXNpZGUgdmFsdWVzIHRvIG1hdGNoLCBzbyBldmVuIGhlcmUgd2UgbWF5IGFzIHdlbGwganVzdFxuICAgIC8vIHVzZSBhIHJhbmRvbSBzZWVkIG9uIHRoZSBzZXJ2ZXIuICBJbiB0aGF0IGNhc2UsIHdlIGRvbid0IHBhc3MgdGhlXG4gICAgLy8gcmFuZG9tU2VlZCB0byBzYXZlIGJhbmR3aWR0aCwgYW5kIHdlIGRvbid0IGV2ZW4gZ2VuZXJhdGUgaXQgdG8gc2F2ZSBhXG4gICAgLy8gYml0IG9mIENQVSBhbmQgdG8gYXZvaWQgY29uc3VtaW5nIGVudHJvcHkuXG5cbiAgICBjb25zdCByYW5kb21TZWVkR2VuZXJhdG9yID0gKCkgPT4ge1xuICAgICAgaWYgKHJhbmRvbVNlZWQudmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgcmFuZG9tU2VlZC52YWx1ZSA9IEREUENvbW1vbi5tYWtlUnBjU2VlZChlbmNsb3NpbmcsIG5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJhbmRvbVNlZWQudmFsdWU7XG4gICAgfTtcblxuICAgIGNvbnN0IHNldFVzZXJJZCA9IHVzZXJJZCA9PiB7XG4gICAgICBzZWxmLnNldFVzZXJJZCh1c2VySWQpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnZvY2F0aW9uID0gbmV3IEREUENvbW1vbi5NZXRob2RJbnZvY2F0aW9uKHtcbiAgICAgIGlzU2ltdWxhdGlvbjogdHJ1ZSxcbiAgICAgIHVzZXJJZDogc2VsZi51c2VySWQoKSxcbiAgICAgIGlzRnJvbUNhbGxBc3luYzogb3B0aW9ucz8uaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgc2V0VXNlcklkOiBzZXRVc2VySWQsXG4gICAgICByYW5kb21TZWVkKCkge1xuICAgICAgICByZXR1cm4gcmFuZG9tU2VlZEdlbmVyYXRvcigpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTm90ZSB0aGF0IHVubGlrZSBpbiB0aGUgY29ycmVzcG9uZGluZyBzZXJ2ZXIgY29kZSwgd2UgbmV2ZXIgYXVkaXRcbiAgICAvLyB0aGF0IHN0dWJzIGNoZWNrKCkgdGhlaXIgYXJndW1lbnRzLlxuICAgIGNvbnN0IHN0dWJJbnZvY2F0aW9uID0gKCkgPT4ge1xuICAgICAgICBpZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gICAgICAgICAgLy8gQmVjYXVzZSBzYXZlT3JpZ2luYWxzIGFuZCByZXRyaWV2ZU9yaWdpbmFscyBhcmVuJ3QgcmVlbnRyYW50LFxuICAgICAgICAgIC8vIGRvbid0IGFsbG93IHN0dWJzIHRvIHlpZWxkLlxuICAgICAgICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZCgoKSA9PiB7XG4gICAgICAgICAgICAvLyByZS1jbG9uZSwgc28gdGhhdCB0aGUgc3R1YiBjYW4ndCBhZmZlY3Qgb3VyIGNhbGxlcidzIHZhbHVlc1xuICAgICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBzdHViLmFwcGx5KGludm9jYXRpb24sIEVKU09OLmNsb25lKGFyZ3MpKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIHsgLi4uZGVmYXVsdFJldHVybiwgaGFzU3R1YjogdHJ1ZSwgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24gfTtcbiAgfVxuXG4gIC8vIEJlZm9yZSBjYWxsaW5nIGEgbWV0aG9kIHN0dWIsIHByZXBhcmUgYWxsIHN0b3JlcyB0byB0cmFjayBjaGFuZ2VzIGFuZCBhbGxvd1xuICAvLyBfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyB0byBnZXQgdGhlIG9yaWdpbmFsIHZlcnNpb25zIG9mIGNoYW5nZWRcbiAgLy8gZG9jdW1lbnRzLlxuICBfc2F2ZU9yaWdpbmFscygpIHtcbiAgICBpZiAoISB0aGlzLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICB0aGlzLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzQ2xpZW50KCk7XG4gICAgfVxuXG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdG9yZXMpLmZvckVhY2goKHN0b3JlKSA9PiB7XG4gICAgICBzdG9yZS5zYXZlT3JpZ2luYWxzKCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXRyaWV2ZXMgdGhlIG9yaWdpbmFsIHZlcnNpb25zIG9mIGFsbCBkb2N1bWVudHMgbW9kaWZpZWQgYnkgdGhlIHN0dWIgZm9yXG4gIC8vIG1ldGhvZCAnbWV0aG9kSWQnIGZyb20gYWxsIHN0b3JlcyBhbmQgc2F2ZXMgdGhlbSB0byBfc2VydmVyRG9jdW1lbnRzIChrZXllZFxuICAvLyBieSBkb2N1bWVudCkgYW5kIF9kb2N1bWVudHNXcml0dGVuQnlTdHViIChrZXllZCBieSBtZXRob2QgSUQpLlxuICBfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyhtZXRob2RJZCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignRHVwbGljYXRlIG1ldGhvZElkIGluIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzJyk7XG5cbiAgICBjb25zdCBkb2NzV3JpdHRlbiA9IFtdO1xuXG4gICAgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKChbY29sbGVjdGlvbiwgc3RvcmVdKSA9PiB7XG4gICAgICBjb25zdCBvcmlnaW5hbHMgPSBzdG9yZS5yZXRyaWV2ZU9yaWdpbmFscygpO1xuICAgICAgLy8gbm90IGFsbCBzdG9yZXMgZGVmaW5lIHJldHJpZXZlT3JpZ2luYWxzXG4gICAgICBpZiAoISBvcmlnaW5hbHMpIHJldHVybjtcbiAgICAgIG9yaWdpbmFscy5mb3JFYWNoKChkb2MsIGlkKSA9PiB7XG4gICAgICAgIGRvY3NXcml0dGVuLnB1c2goeyBjb2xsZWN0aW9uLCBpZCB9KTtcbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgICAgIHNlbGYuX3NlcnZlckRvY3VtZW50c1tjb2xsZWN0aW9uXSA9IG5ldyBNb25nb0lETWFwKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dLnNldERlZmF1bHQoXG4gICAgICAgICAgaWQsXG4gICAgICAgICAgT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgICAgICApO1xuICAgICAgICBpZiAoc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzKSB7XG4gICAgICAgICAgLy8gV2UncmUgbm90IHRoZSBmaXJzdCBzdHViIHRvIHdyaXRlIHRoaXMgZG9jLiBKdXN0IGFkZCBvdXIgbWV0aG9kIElEXG4gICAgICAgICAgLy8gdG8gdGhlIHJlY29yZC5cbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaXJzdCBzdHViISBTYXZlIHRoZSBvcmlnaW5hbCB2YWx1ZSBhbmQgb3VyIG1ldGhvZCBJRC5cbiAgICAgICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBkb2M7XG4gICAgICAgICAgc2VydmVyRG9jLmZsdXNoQ2FsbGJhY2tzID0gW107XG4gICAgICAgICAgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKCEgaXNFbXB0eShkb2NzV3JpdHRlbikpIHtcbiAgICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdID0gZG9jc1dyaXR0ZW47XG4gICAgfVxuICB9XG5cbiAgLy8gVGhpcyBpcyB2ZXJ5IG11Y2ggYSBwcml2YXRlIGZ1bmN0aW9uIHdlIHVzZSB0byBtYWtlIHRoZSB0ZXN0c1xuICAvLyB0YWtlIHVwIGZld2VyIHNlcnZlciByZXNvdXJjZXMgYWZ0ZXIgdGhleSBjb21wbGV0ZS5cbiAgX3Vuc3Vic2NyaWJlQWxsKCkge1xuICAgIE9iamVjdC52YWx1ZXModGhpcy5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgoc3ViKSA9PiB7XG4gICAgICAvLyBBdm9pZCBraWxsaW5nIHRoZSBhdXRvdXBkYXRlIHN1YnNjcmlwdGlvbiBzbyB0aGF0IGRldmVsb3BlcnNcbiAgICAgIC8vIHN0aWxsIGdldCBob3QgY29kZSBwdXNoZXMgd2hlbiB3cml0aW5nIHRlc3RzLlxuICAgICAgLy9cbiAgICAgIC8vIFhYWCBpdCdzIGEgaGFjayB0byBlbmNvZGUga25vd2xlZGdlIGFib3V0IGF1dG91cGRhdGUgaGVyZSxcbiAgICAgIC8vIGJ1dCBpdCBkb2Vzbid0IHNlZW0gd29ydGggaXQgeWV0IHRvIGhhdmUgYSBzcGVjaWFsIEFQSSBmb3JcbiAgICAgIC8vIHN1YnNjcmlwdGlvbnMgdG8gcHJlc2VydmUgYWZ0ZXIgdW5pdCB0ZXN0cy5cbiAgICAgIGlmIChzdWIubmFtZSAhPT0gJ21ldGVvcl9hdXRvdXBkYXRlX2NsaWVudFZlcnNpb25zJykge1xuICAgICAgICBzdWIuc3RvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gU2VuZHMgdGhlIEREUCBzdHJpbmdpZmljYXRpb24gb2YgdGhlIGdpdmVuIG1lc3NhZ2Ugb2JqZWN0XG4gIF9zZW5kKG9iaikge1xuICAgIHRoaXMuX3N0cmVhbS5zZW5kKEREUENvbW1vbi5zdHJpbmdpZnlERFAob2JqKSk7XG4gIH1cblxuICAvLyBXZSBkZXRlY3RlZCB2aWEgRERQLWxldmVsIGhlYXJ0YmVhdHMgdGhhdCB3ZSd2ZSBsb3N0IHRoZVxuICAvLyBjb25uZWN0aW9uLiAgVW5saWtlIGBkaXNjb25uZWN0YCBvciBgY2xvc2VgLCBhIGxvc3QgY29ubmVjdGlvblxuICAvLyB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmV0cmllZC5cbiAgX2xvc3RDb25uZWN0aW9uKGVycm9yKSB7XG4gICAgdGhpcy5fc3RyZWFtLl9sb3N0Q29ubmVjdGlvbihlcnJvcik7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3Iuc3RhdHVzXG4gICAqIEBzdW1tYXJ5IEdldCB0aGUgY3VycmVudCBjb25uZWN0aW9uIHN0YXR1cy4gQSByZWFjdGl2ZSBkYXRhIHNvdXJjZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgc3RhdHVzKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLnN0YXR1cyguLi5hcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGb3JjZSBhbiBpbW1lZGlhdGUgcmVjb25uZWN0aW9uIGF0dGVtcHQgaWYgdGhlIGNsaWVudCBpcyBub3QgY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXIuXG5cbiAgVGhpcyBtZXRob2QgZG9lcyBub3RoaW5nIGlmIHRoZSBjbGllbnQgaXMgYWxyZWFkeSBjb25uZWN0ZWQuXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnJlY29ubmVjdFxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICByZWNvbm5lY3QoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0ucmVjb25uZWN0KC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmRpc2Nvbm5lY3RcbiAgICogQHN1bW1hcnkgRGlzY29ubmVjdCB0aGUgY2xpZW50IGZyb20gdGhlIHNlcnZlci5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgZGlzY29ubmVjdCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5kaXNjb25uZWN0KC4uLmFyZ3MpO1xuICB9XG5cbiAgY2xvc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5kaXNjb25uZWN0KHsgX3Blcm1hbmVudDogdHJ1ZSB9KTtcbiAgfVxuXG4gIC8vL1xuICAvLy8gUmVhY3RpdmUgdXNlciBzeXN0ZW1cbiAgLy8vXG4gIHVzZXJJZCgpIHtcbiAgICBpZiAodGhpcy5fdXNlcklkRGVwcykgdGhpcy5fdXNlcklkRGVwcy5kZXBlbmQoKTtcbiAgICByZXR1cm4gdGhpcy5fdXNlcklkO1xuICB9XG5cbiAgc2V0VXNlcklkKHVzZXJJZCkge1xuICAgIC8vIEF2b2lkIGludmFsaWRhdGluZyBkZXBlbmRlbnRzIGlmIHNldFVzZXJJZCBpcyBjYWxsZWQgd2l0aCBjdXJyZW50IHZhbHVlLlxuICAgIGlmICh0aGlzLl91c2VySWQgPT09IHVzZXJJZCkgcmV0dXJuO1xuICAgIHRoaXMuX3VzZXJJZCA9IHVzZXJJZDtcbiAgICBpZiAodGhpcy5fdXNlcklkRGVwcykgdGhpcy5fdXNlcklkRGVwcy5jaGFuZ2VkKCk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgaWYgd2UgYXJlIGluIGEgc3RhdGUgYWZ0ZXIgcmVjb25uZWN0IG9mIHdhaXRpbmcgZm9yIHN1YnMgdG8gYmVcbiAgLy8gcmV2aXZlZCBvciBlYXJseSBtZXRob2RzIHRvIGZpbmlzaCB0aGVpciBkYXRhLCBvciB3ZSBhcmUgd2FpdGluZyBmb3IgYVxuICAvLyBcIndhaXRcIiBtZXRob2QgdG8gZmluaXNoLlxuICBfd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICEgaXNFbXB0eSh0aGlzLl9zdWJzQmVpbmdSZXZpdmVkKSB8fFxuICAgICAgISBpc0VtcHR5KHRoaXMuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UpXG4gICAgKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiBhbnkgbWV0aG9kIHdob3NlIG1lc3NhZ2UgaGFzIGJlZW4gc2VudCB0byB0aGUgc2VydmVyIGhhc1xuICAvLyBub3QgeWV0IGludm9rZWQgaXRzIHVzZXIgY2FsbGJhY2suXG4gIF9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmcoKSB7XG4gICAgY29uc3QgaW52b2tlcnMgPSB0aGlzLl9tZXRob2RJbnZva2VycztcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhpbnZva2Vycykuc29tZSgoaW52b2tlcikgPT4gISFpbnZva2VyLnNlbnRNZXNzYWdlKTtcbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9jb25uZWN0ZWQobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fdmVyc2lvbiAhPT0gJ3ByZTEnICYmIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsICE9PSAwKSB7XG4gICAgICBzZWxmLl9oZWFydGJlYXQgPSBuZXcgRERQQ29tbW9uLkhlYXJ0YmVhdCh7XG4gICAgICAgIGhlYXJ0YmVhdEludGVydmFsOiBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCxcbiAgICAgICAgaGVhcnRiZWF0VGltZW91dDogc2VsZi5faGVhcnRiZWF0VGltZW91dCxcbiAgICAgICAgb25UaW1lb3V0KCkge1xuICAgICAgICAgIHNlbGYuX2xvc3RDb25uZWN0aW9uKFxuICAgICAgICAgICAgbmV3IEREUC5Db25uZWN0aW9uRXJyb3IoJ0REUCBoZWFydGJlYXQgdGltZWQgb3V0JylcbiAgICAgICAgICApO1xuICAgICAgICB9LFxuICAgICAgICBzZW5kUGluZygpIHtcbiAgICAgICAgICBzZWxmLl9zZW5kKHsgbXNnOiAncGluZycgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgc2VsZi5faGVhcnRiZWF0LnN0YXJ0KCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhpcyBpcyBhIHJlY29ubmVjdCwgd2UnbGwgaGF2ZSB0byByZXNldCBhbGwgc3RvcmVzLlxuICAgIGlmIChzZWxmLl9sYXN0U2Vzc2lvbklkKSBzZWxmLl9yZXNldFN0b3JlcyA9IHRydWU7XG5cbiAgICBsZXQgcmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbjtcbiAgICBpZiAodHlwZW9mIG1zZy5zZXNzaW9uID09PSAnc3RyaW5nJykge1xuICAgICAgcmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbiA9IHNlbGYuX2xhc3RTZXNzaW9uSWQgPT09IG1zZy5zZXNzaW9uO1xuICAgICAgc2VsZi5fbGFzdFNlc3Npb25JZCA9IG1zZy5zZXNzaW9uO1xuICAgIH1cblxuICAgIGlmIChyZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uKSB7XG4gICAgICAvLyBTdWNjZXNzZnVsIHJlY29ubmVjdGlvbiAtLSBwaWNrIHVwIHdoZXJlIHdlIGxlZnQgb2ZmLiAgTm90ZSB0aGF0IHJpZ2h0XG4gICAgICAvLyBub3csIHRoaXMgbmV2ZXIgaGFwcGVuczogdGhlIHNlcnZlciBuZXZlciBjb25uZWN0cyB1cyB0byBhIHByZXZpb3VzXG4gICAgICAvLyBzZXNzaW9uLCBiZWNhdXNlIEREUCBkb2Vzbid0IHByb3ZpZGUgZW5vdWdoIGRhdGEgZm9yIHRoZSBzZXJ2ZXIgdG8ga25vd1xuICAgICAgLy8gd2hhdCBtZXNzYWdlcyB0aGUgY2xpZW50IGhhcyBwcm9jZXNzZWQuIFdlIG5lZWQgdG8gaW1wcm92ZSBERFAgdG8gbWFrZVxuICAgICAgLy8gdGhpcyBwb3NzaWJsZSwgYXQgd2hpY2ggcG9pbnQgd2UnbGwgcHJvYmFibHkgbmVlZCBtb3JlIGNvZGUgaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXJ2ZXIgZG9lc24ndCBoYXZlIG91ciBkYXRhIGFueSBtb3JlLiBSZS1zeW5jIGEgbmV3IHNlc3Npb24uXG5cbiAgICAvLyBGb3JnZXQgYWJvdXQgbWVzc2FnZXMgd2Ugd2VyZSBidWZmZXJpbmcgZm9yIHVua25vd24gY29sbGVjdGlvbnMuIFRoZXknbGxcbiAgICAvLyBiZSByZXNlbnQgaWYgc3RpbGwgcmVsZXZhbnQuXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAvLyBGb3JnZXQgYWJvdXQgdGhlIGVmZmVjdHMgb2Ygc3R1YnMuIFdlJ2xsIGJlIHJlc2V0dGluZyBhbGwgY29sbGVjdGlvbnNcbiAgICAgIC8vIGFueXdheS5cbiAgICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBfYWZ0ZXJVcGRhdGVDYWxsYmFja3MuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIE1hcmsgYWxsIG5hbWVkIHN1YnNjcmlwdGlvbnMgd2hpY2ggYXJlIHJlYWR5IChpZSwgd2UgYWxyZWFkeSBjYWxsZWQgdGhlXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGFzIG5lZWRpbmcgdG8gYmUgcmV2aXZlZC5cbiAgICAvLyBYWFggV2Ugc2hvdWxkIGFsc28gYmxvY2sgcmVjb25uZWN0IHF1aWVzY2VuY2UgdW50aWwgdW5uYW1lZCBzdWJzY3JpcHRpb25zXG4gICAgLy8gICAgIChlZywgYXV0b3B1Ymxpc2gpIGFyZSBkb25lIHJlLXB1Ymxpc2hpbmcgdG8gYXZvaWQgZmxpY2tlciFcbiAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChbaWQsIHN1Yl0pID0+IHtcbiAgICAgIGlmIChzdWIucmVhZHkpIHtcbiAgICAgICAgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFtpZF0gPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXJyYW5nZSBmb3IgXCJoYWxmLWZpbmlzaGVkXCIgbWV0aG9kcyB0byBoYXZlIHRoZWlyIGNhbGxiYWNrcyBydW4sIGFuZFxuICAgIC8vIHRyYWNrIG1ldGhvZHMgdGhhdCB3ZXJlIHNlbnQgb24gdGhpcyBjb25uZWN0aW9uIHNvIHRoYXQgd2UgZG9uJ3RcbiAgICAvLyBxdWllc2NlIHVudGlsIHRoZXkgYXJlIGFsbCBkb25lLlxuICAgIC8vXG4gICAgLy8gU3RhcnQgYnkgY2xlYXJpbmcgX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2U6IG1ldGhvZHMgc2VudCBiZWZvcmVcbiAgICAvLyByZWNvbm5lY3QgZG9uJ3QgbWF0dGVyLCBhbmQgYW55IFwid2FpdFwiIG1ldGhvZHMgc2VudCBvbiB0aGUgbmV3IGNvbm5lY3Rpb25cbiAgICAvLyB0aGF0IHdlIGRyb3AgaGVyZSB3aWxsIGJlIHJlc3RvcmVkIGJ5IHRoZSBsb29wIGJlbG93LlxuICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgY29uc3QgaW52b2tlcnMgPSBzZWxmLl9tZXRob2RJbnZva2VycztcbiAgICAgIGtleXMoaW52b2tlcnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgICBjb25zdCBpbnZva2VyID0gaW52b2tlcnNbaWRdO1xuICAgICAgICBpZiAoaW52b2tlci5nb3RSZXN1bHQoKSkge1xuICAgICAgICAgIC8vIFRoaXMgbWV0aG9kIGFscmVhZHkgZ290IGl0cyByZXN1bHQsIGJ1dCBpdCBkaWRuJ3QgY2FsbCBpdHMgY2FsbGJhY2tcbiAgICAgICAgICAvLyBiZWNhdXNlIGl0cyBkYXRhIGRpZG4ndCBiZWNvbWUgdmlzaWJsZS4gV2UgZGlkIG5vdCByZXNlbmQgdGhlXG4gICAgICAgICAgLy8gbWV0aG9kIFJQQy4gV2UnbGwgY2FsbCBpdHMgY2FsbGJhY2sgd2hlbiB3ZSBnZXQgYSBmdWxsIHF1aWVzY2UsXG4gICAgICAgICAgLy8gc2luY2UgdGhhdCdzIGFzIGNsb3NlIGFzIHdlJ2xsIGdldCB0byBcImRhdGEgbXVzdCBiZSB2aXNpYmxlXCIuXG4gICAgICAgICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MucHVzaChcbiAgICAgICAgICAgICguLi5hcmdzKSA9PiBpbnZva2VyLmRhdGFWaXNpYmxlKC4uLmFyZ3MpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbnZva2VyLnNlbnRNZXNzYWdlKSB7XG4gICAgICAgICAgLy8gVGhpcyBtZXRob2QgaGFzIGJlZW4gc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gKG1heWJlIGFzIGEgcmVzZW5kXG4gICAgICAgICAgLy8gZnJvbSB0aGUgbGFzdCBjb25uZWN0aW9uLCBtYXliZSBmcm9tIG9uUmVjb25uZWN0LCBtYXliZSBqdXN0IHZlcnlcbiAgICAgICAgICAvLyBxdWlja2x5IGJlZm9yZSBwcm9jZXNzaW5nIHRoZSBjb25uZWN0ZWQgbWVzc2FnZSkuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nIHNwZWNpYWwgdG8gZW5zdXJlIGl0cyBjYWxsYmFja3MgZ2V0XG4gICAgICAgICAgLy8gY2FsbGVkLCBidXQgd2UnbGwgY291bnQgaXQgYXMgYSBtZXRob2Qgd2hpY2ggaXMgcHJldmVudGluZ1xuICAgICAgICAgIC8vIHJlY29ubmVjdCBxdWllc2NlbmNlLiAoZWcsIGl0IG1pZ2h0IGJlIGEgbG9naW4gbWV0aG9kIHRoYXQgd2FzIHJ1blxuICAgICAgICAgIC8vIGZyb20gb25SZWNvbm5lY3QsIGFuZCB3ZSBkb24ndCB3YW50IHRvIHNlZSBmbGlja2VyIGJ5IHNlZWluZyBhXG4gICAgICAgICAgLy8gbG9nZ2VkLW91dCBzdGF0ZS4pXG4gICAgICAgICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVtpbnZva2VyLm1ldGhvZElkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UgPSBbXTtcblxuICAgIC8vIElmIHdlJ3JlIG5vdCB3YWl0aW5nIG9uIGFueSBtZXRob2RzIG9yIHN1YnMsIHdlIGNhbiByZXNldCB0aGUgc3RvcmVzIGFuZFxuICAgIC8vIGNhbGwgdGhlIGNhbGxiYWNrcyBpbW1lZGlhdGVseS5cbiAgICBpZiAoISBzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBzdG9yZSBvZiBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgICBhd2FpdCBzdG9yZS5iZWdpblVwZGF0ZSgwLCB0cnVlKTtcbiAgICAgICAgICBhd2FpdCBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgc2VsZi5fcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBfcHJvY2Vzc09uZURhdGFNZXNzYWdlKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IG1lc3NhZ2VUeXBlID0gbXNnLm1zZztcblxuICAgIC8vIG1zZyBpcyBvbmUgb2YgWydhZGRlZCcsICdjaGFuZ2VkJywgJ3JlbW92ZWQnLCAncmVhZHknLCAndXBkYXRlZCddXG4gICAgaWYgKG1lc3NhZ2VUeXBlID09PSAnYWRkZWQnKSB7XG4gICAgICBhd2FpdCB0aGlzLl9wcm9jZXNzX2FkZGVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ2NoYW5nZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX2NoYW5nZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAncmVtb3ZlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdyZWFkeScpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfcmVhZHkobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAndXBkYXRlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfdXBkYXRlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdub3N1YicpIHtcbiAgICAgIC8vIGlnbm9yZSB0aGlzXG4gICAgfSBlbHNlIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgdW5rbm93biBsaXZlZGF0YSBkYXRhIG1lc3NhZ2UgdHlwZScsIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX2xpdmVkYXRhX2RhdGEobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZS5wdXNoKG1zZyk7XG5cbiAgICAgIGlmIChtc2cubXNnID09PSAnbm9zdWInKSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW21zZy5pZF07XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cuc3Vicykge1xuICAgICAgICBtc2cuc3Vicy5mb3JFYWNoKHN1YklkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFtzdWJJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAobXNnLm1ldGhvZHMpIHtcbiAgICAgICAgbXNnLm1ldGhvZHMuZm9yRWFjaChtZXRob2RJZCA9PiB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbbWV0aG9kSWRdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBObyBtZXRob2RzIG9yIHN1YnMgYXJlIGJsb2NraW5nIHF1aWVzY2VuY2UhXG4gICAgICAvLyBXZSdsbCBub3cgcHJvY2VzcyBhbmQgYWxsIG9mIG91ciBidWZmZXJlZCBtZXNzYWdlcywgcmVzZXQgYWxsIHN0b3JlcyxcbiAgICAgIC8vIGFuZCBhcHBseSB0aGVtIGFsbCBhdCBvbmNlLlxuXG4gICAgICBjb25zdCBidWZmZXJlZE1lc3NhZ2VzID0gc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZTtcbiAgICAgIGZvciAoY29uc3QgYnVmZmVyZWRNZXNzYWdlIG9mIE9iamVjdC52YWx1ZXMoYnVmZmVyZWRNZXNzYWdlcykpIHtcbiAgICAgICAgYXdhaXQgc2VsZi5fcHJvY2Vzc09uZURhdGFNZXNzYWdlKFxuICAgICAgICAgIGJ1ZmZlcmVkTWVzc2FnZSxcbiAgICAgICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG5cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgc2VsZi5fcHJvY2Vzc09uZURhdGFNZXNzYWdlKG1zZywgc2VsZi5fYnVmZmVyZWRXcml0ZXMpO1xuICAgIH1cblxuICAgIC8vIEltbWVkaWF0ZWx5IGZsdXNoIHdyaXRlcyB3aGVuOlxuICAgIC8vICAxLiBCdWZmZXJpbmcgaXMgZGlzYWJsZWQuIE9yO1xuICAgIC8vICAyLiBhbnkgbm9uLShhZGRlZC9jaGFuZ2VkL3JlbW92ZWQpIG1lc3NhZ2UgYXJyaXZlcy5cbiAgICBjb25zdCBzdGFuZGFyZFdyaXRlID1cbiAgICAgIG1zZy5tc2cgPT09IFwiYWRkZWRcIiB8fFxuICAgICAgbXNnLm1zZyA9PT0gXCJjaGFuZ2VkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwicmVtb3ZlZFwiO1xuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPT09IDAgfHwgISBzdGFuZGFyZFdyaXRlKSB7XG4gICAgICBhd2FpdCBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9PT0gbnVsbCkge1xuICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID1cbiAgICAgICAgbmV3IERhdGUoKS52YWx1ZU9mKCkgKyBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZTtcbiAgICB9IGVsc2UgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA8IG5ldyBEYXRlKCkudmFsdWVPZigpKSB7XG4gICAgICBhd2FpdCBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICB9XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgLy8gX19mbHVzaEJ1ZmZlcmVkV3JpdGVzIGlzIGEgcHJvbWlzZSwgc28gd2l0aCB0aGlzIHdlIGNhbiB3YWl0IHRoZSBwcm9taXNlIHRvIGZpbmlzaFxuICAgICAgLy8gYmVmb3JlIGRvaW5nIHNvbWV0aGluZ1xuICAgICAgc2VsZi5fbGl2ZURhdGFXcml0ZXNQcm9taXNlID0gc2VsZi5fX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcblxuICAgICAgaWYgKE1ldGVvci5faXNQcm9taXNlKHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZSkpIHtcbiAgICAgICAgc2VsZi5fbGl2ZURhdGFXcml0ZXNQcm9taXNlLmZpbmFsbHkoXG4gICAgICAgICAgKCkgPT4gKHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZSA9IHVuZGVmaW5lZClcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9LCBzZWxmLl9idWZmZXJlZFdyaXRlc0ludGVydmFsKTtcbiAgfVxuXG4gIF9wcmVwYXJlQnVmZmVyc1RvRmx1c2goKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuICAgIH1cblxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9IG51bGw7XG4gICAgLy8gV2UgbmVlZCB0byBjbGVhciB0aGUgYnVmZmVyIGJlZm9yZSBwYXNzaW5nIGl0IHRvXG4gICAgLy8gIHBlcmZvcm1Xcml0ZXMuIEFzIHRoZXJlJ3Mgbm8gZ3VhcmFudGVlIHRoYXQgaXRcbiAgICAvLyAgd2lsbCBleGl0IGNsZWFubHkuXG4gICAgY29uc3Qgd3JpdGVzID0gc2VsZi5fYnVmZmVyZWRXcml0ZXM7XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHJldHVybiB3cml0ZXM7XG4gIH1cblxuICBhc3luYyBfZmx1c2hCdWZmZXJlZFdyaXRlc1NlcnZlcigpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCB3cml0ZXMgPSBzZWxmLl9wcmVwYXJlQnVmZmVyc1RvRmx1c2goKTtcbiAgICBhd2FpdCBzZWxmLl9wZXJmb3JtV3JpdGVzU2VydmVyKHdyaXRlcyk7XG4gIH1cbiAgX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd3JpdGVzID0gc2VsZi5fcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoKCk7XG4gICAgc2VsZi5fcGVyZm9ybVdyaXRlc0NsaWVudCh3cml0ZXMpO1xuICB9XG4gIF9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBNZXRlb3IuaXNDbGllbnRcbiAgICAgID8gc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlc0NsaWVudCgpXG4gICAgICA6IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXNTZXJ2ZXIoKTtcbiAgfVxuICBhc3luYyBfcGVyZm9ybVdyaXRlc1NlcnZlcih1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMgfHwgISBpc0VtcHR5KHVwZGF0ZXMpKSB7XG4gICAgICAvLyBCZWdpbiBhIHRyYW5zYWN0aW9uYWwgdXBkYXRlIG9mIGVhY2ggc3RvcmUuXG5cbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgc3RvcmVdIG9mIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgYXdhaXQgc3RvcmUuYmVnaW5VcGRhdGUoXG4gICAgICAgICAgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKVxuICAgICAgICAgICAgPyB1cGRhdGVzW3N0b3JlTmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICA6IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcblxuICAgICAgZm9yIChjb25zdCBbc3RvcmVOYW1lLCB1cGRhdGVNZXNzYWdlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSBzZWxmLl9zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgaWYgKHN0b3JlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB1cGRhdGVNZXNzYWdlIG9mIHVwZGF0ZU1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBhd2FpdCBzdG9yZS51cGRhdGUodXBkYXRlTWVzc2FnZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vYm9keSdzIGxpc3RlbmluZyBmb3IgdGhpcyBkYXRhLiBRdWV1ZSBpdCB1cCB1bnRpbFxuICAgICAgICAgIC8vIHNvbWVvbmUgd2FudHMgaXQuXG4gICAgICAgICAgLy8gWFhYIG1lbW9yeSB1c2Ugd2lsbCBncm93IHdpdGhvdXQgYm91bmQgaWYgeW91IGZvcmdldCB0b1xuICAgICAgICAgIC8vIGNyZWF0ZSBhIGNvbGxlY3Rpb24gb3IganVzdCBkb24ndCBjYXJlIGFib3V0IGl0Li4uIGdvaW5nXG4gICAgICAgICAgLy8gdG8gaGF2ZSB0byBkbyBzb21ldGhpbmcgYWJvdXQgdGhhdC5cbiAgICAgICAgICBjb25zdCB1cGRhdGVzID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXM7XG5cbiAgICAgICAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBzdG9yZU5hbWUpKSB7XG4gICAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0gPSBbXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0ucHVzaCguLi51cGRhdGVNZXNzYWdlcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEVuZCB1cGRhdGUgdHJhbnNhY3Rpb24uXG4gICAgICBmb3IgKGNvbnN0IHN0b3JlIG9mIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICBhd2FpdCBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICB9XG4gIF9wZXJmb3JtV3JpdGVzQ2xpZW50KHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3JlcyB8fCAhIGlzRW1wdHkodXBkYXRlcykpIHtcbiAgICAgIC8vIEJlZ2luIGEgdHJhbnNhY3Rpb25hbCB1cGRhdGUgb2YgZWFjaCBzdG9yZS5cblxuICAgICAgZm9yIChjb25zdCBbc3RvcmVOYW1lLCBzdG9yZV0gb2YgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICBzdG9yZS5iZWdpblVwZGF0ZShcbiAgICAgICAgICBoYXNPd24uY2FsbCh1cGRhdGVzLCBzdG9yZU5hbWUpXG4gICAgICAgICAgICA/IHVwZGF0ZXNbc3RvcmVOYW1lXS5sZW5ndGhcbiAgICAgICAgICAgIDogMCxcbiAgICAgICAgICBzZWxmLl9yZXNldFN0b3Jlc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICBmb3IgKGNvbnN0IFtzdG9yZU5hbWUsIHVwZGF0ZU1lc3NhZ2VzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBjb25zdCBzdG9yZSA9IHNlbGYuX3N0b3Jlc1tzdG9yZU5hbWVdO1xuICAgICAgICBpZiAoc3RvcmUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHVwZGF0ZU1lc3NhZ2Ugb2YgdXBkYXRlTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHN0b3JlLnVwZGF0ZSh1cGRhdGVNZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTm9ib2R5J3MgbGlzdGVuaW5nIGZvciB0aGlzIGRhdGEuIFF1ZXVlIGl0IHVwIHVudGlsXG4gICAgICAgICAgLy8gc29tZW9uZSB3YW50cyBpdC5cbiAgICAgICAgICAvLyBYWFggbWVtb3J5IHVzZSB3aWxsIGdyb3cgd2l0aG91dCBib3VuZCBpZiB5b3UgZm9yZ2V0IHRvXG4gICAgICAgICAgLy8gY3JlYXRlIGEgY29sbGVjdGlvbiBvciBqdXN0IGRvbid0IGNhcmUgYWJvdXQgaXQuLi4gZ29pbmdcbiAgICAgICAgICAvLyB0byBoYXZlIHRvIGRvIHNvbWV0aGluZyBhYm91dCB0aGF0LlxuICAgICAgICAgIGNvbnN0IHVwZGF0ZXMgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcztcblxuICAgICAgICAgIGlmICghIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSkpIHtcbiAgICAgICAgICAgIHVwZGF0ZXNbc3RvcmVOYW1lXSA9IFtdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHVwZGF0ZXNbc3RvcmVOYW1lXS5wdXNoKC4uLnVwZGF0ZU1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gRW5kIHVwZGF0ZSB0cmFuc2FjdGlvbi5cbiAgICAgIGZvciAoY29uc3Qgc3RvcmUgb2YgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgIHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gIH1cblxuICAvLyBDYWxsIGFueSBjYWxsYmFja3MgZGVmZXJyZWQgd2l0aCBfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIHdob3NlXG4gIC8vIHJlbGV2YW50IGRvY3MgaGF2ZSBiZWVuIGZsdXNoZWQsIGFzIHdlbGwgYXMgZGF0YVZpc2libGUgY2FsbGJhY2tzIGF0XG4gIC8vIHJlY29ubmVjdC1xdWllc2NlbmNlIHRpbWUuXG4gIF9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBjYWxsYmFja3MgPSBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcztcbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICBjKCk7XG4gICAgfSk7XG4gIH1cblxuICBfcHVzaFVwZGF0ZSh1cGRhdGVzLCBjb2xsZWN0aW9uLCBtc2cpIHtcbiAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgdXBkYXRlc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICB1cGRhdGVzW2NvbGxlY3Rpb25dLnB1c2gobXNnKTtcbiAgfVxuXG4gIF9nZXRTZXJ2ZXJEb2MoY29sbGVjdGlvbiwgaWQpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc2VydmVyRG9jc0ZvckNvbGxlY3Rpb24gPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl07XG4gICAgcmV0dXJuIHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uLmdldChpZCkgfHwgbnVsbDtcbiAgfVxuXG4gIGFzeW5jIF9wcm9jZXNzX2FkZGVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGlkID0gTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCk7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBpZCk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgLy8gU29tZSBvdXRzdGFuZGluZyBzdHViIHdyb3RlIGhlcmUuXG4gICAgICBjb25zdCBpc0V4aXN0aW5nID0gc2VydmVyRG9jLmRvY3VtZW50ICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IG1zZy5maWVsZHMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudC5faWQgPSBpZDtcblxuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIC8vIER1cmluZyByZWNvbm5lY3QgdGhlIHNlcnZlciBpcyBzZW5kaW5nIGFkZHMgZm9yIGV4aXN0aW5nIGlkcy5cbiAgICAgICAgLy8gQWx3YXlzIHB1c2ggYW4gdXBkYXRlIHNvIHRoYXQgZG9jdW1lbnQgc3RheXMgaW4gdGhlIHN0b3JlIGFmdGVyXG4gICAgICAgIC8vIHJlc2V0LiBVc2UgY3VycmVudCB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBmb3IgdGhpcyB1cGRhdGUsIHNvXG4gICAgICAgIC8vIHRoYXQgc3R1Yi13cml0dGVuIHZhbHVlcyBhcmUgcHJlc2VydmVkLlxuICAgICAgICBjb25zdCBjdXJyZW50RG9jID0gYXdhaXQgc2VsZi5fc3RvcmVzW21zZy5jb2xsZWN0aW9uXS5nZXREb2MobXNnLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnREb2MgIT09IHVuZGVmaW5lZCkgbXNnLmZpZWxkcyA9IGN1cnJlbnREb2M7XG5cbiAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFeGlzdGluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGFkZCBmb3IgZXhpc3RpbmcgaWQ6ICcgKyBtc2cuaWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX2NoYW5nZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBNb25nb0lELmlkUGFyc2UobXNnLmlkKSk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGNoYW5nZWQgZm9yIG5vbmV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoc2VydmVyRG9jLmRvY3VtZW50LCBtc2cuZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IHJlbW92ZWQgZm9yIG5vbmV4aXN0aW5nIGlkOicgKyBtc2cuaWQpO1xuICAgICAgc2VydmVyRG9jLmRvY3VtZW50ID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCB7XG4gICAgICAgIG1zZzogJ3JlbW92ZWQnLFxuICAgICAgICBjb2xsZWN0aW9uOiBtc2cuY29sbGVjdGlvbixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfdXBkYXRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBQcm9jZXNzIFwibWV0aG9kIGRvbmVcIiBtZXNzYWdlcy5cblxuICAgIG1zZy5tZXRob2RzLmZvckVhY2goKG1ldGhvZElkKSA9PiB7XG4gICAgICBjb25zdCBkb2NzID0gc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gfHwge307XG4gICAgICBPYmplY3QudmFsdWVzKGRvY3MpLmZvckVhY2goKHdyaXR0ZW4pID0+IHtcbiAgICAgICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKHdyaXR0ZW4uY29sbGVjdGlvbiwgd3JpdHRlbi5pZCk7XG4gICAgICAgIGlmICghIHNlcnZlckRvYykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTG9zdCBzZXJ2ZXJEb2MgZm9yICcgKyBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdEb2MgJyArXG4gICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHdyaXR0ZW4pICtcbiAgICAgICAgICAgICAgJyBub3Qgd3JpdHRlbiBieSAgbWV0aG9kICcgK1xuICAgICAgICAgICAgICBtZXRob2RJZFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF07XG4gICAgICAgIGlmIChpc0VtcHR5KHNlcnZlckRvYy53cml0dGVuQnlTdHVicykpIHtcbiAgICAgICAgICAvLyBBbGwgbWV0aG9kcyB3aG9zZSBzdHVicyB3cm90ZSB0aGlzIG1ldGhvZCBoYXZlIGNvbXBsZXRlZCEgV2UgY2FuXG4gICAgICAgICAgLy8gbm93IGNvcHkgdGhlIHNhdmVkIGRvY3VtZW50IHRvIHRoZSBkYXRhYmFzZSAocmV2ZXJ0aW5nIHRoZSBzdHViJ3NcbiAgICAgICAgICAvLyBjaGFuZ2UgaWYgdGhlIHNlcnZlciBkaWQgbm90IHdyaXRlIHRvIHRoaXMgb2JqZWN0LCBvciBhcHBseWluZyB0aGVcbiAgICAgICAgICAvLyBzZXJ2ZXIncyB3cml0ZXMgaWYgaXQgZGlkKS5cblxuICAgICAgICAgIC8vIFRoaXMgaXMgYSBmYWtlIGRkcCAncmVwbGFjZScgbWVzc2FnZS4gIEl0J3MganVzdCBmb3IgdGFsa2luZ1xuICAgICAgICAgIC8vIGJldHdlZW4gbGl2ZWRhdGEgY29ubmVjdGlvbnMgYW5kIG1pbmltb25nby4gIChXZSBoYXZlIHRvIHN0cmluZ2lmeVxuICAgICAgICAgIC8vIHRoZSBJRCBiZWNhdXNlIGl0J3Mgc3VwcG9zZWQgdG8gbG9vayBsaWtlIGEgd2lyZSBtZXNzYWdlLilcbiAgICAgICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIHdyaXR0ZW4uY29sbGVjdGlvbiwge1xuICAgICAgICAgICAgbXNnOiAncmVwbGFjZScsXG4gICAgICAgICAgICBpZDogTW9uZ29JRC5pZFN0cmluZ2lmeSh3cml0dGVuLmlkKSxcbiAgICAgICAgICAgIHJlcGxhY2U6IHNlcnZlckRvYy5kb2N1bWVudFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIENhbGwgYWxsIGZsdXNoIGNhbGxiYWNrcy5cblxuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICAgICAgICBjKCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBEZWxldGUgdGhpcyBjb21wbGV0ZWQgc2VydmVyRG9jdW1lbnQuIERvbid0IGJvdGhlciB0byBHQyBlbXB0eVxuICAgICAgICAgIC8vIElkTWFwcyBpbnNpZGUgc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBzaW5jZSB0aGVyZSBwcm9iYWJseSBhcmVuJ3RcbiAgICAgICAgICAvLyBtYW55IGNvbGxlY3Rpb25zIGFuZCB0aGV5J2xsIGJlIHdyaXR0ZW4gcmVwZWF0ZWRseS5cbiAgICAgICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbd3JpdHRlbi5jb2xsZWN0aW9uXS5yZW1vdmUod3JpdHRlbi5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdO1xuXG4gICAgICAvLyBXZSB3YW50IHRvIGNhbGwgdGhlIGRhdGEtd3JpdHRlbiBjYWxsYmFjaywgYnV0IHdlIGNhbid0IGRvIHNvIHVudGlsIGFsbFxuICAgICAgLy8gY3VycmVudGx5IGJ1ZmZlcmVkIG1lc3NhZ2VzIGFyZSBmbHVzaGVkLlxuICAgICAgY29uc3QgY2FsbGJhY2tJbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgaWYgKCEgY2FsbGJhY2tJbnZva2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY2FsbGJhY2sgaW52b2tlciBmb3IgbWV0aG9kICcgKyBtZXRob2RJZCk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChcbiAgICAgICAgKC4uLmFyZ3MpID0+IGNhbGxiYWNrSW52b2tlci5kYXRhVmlzaWJsZSguLi5hcmdzKVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIFByb2Nlc3MgXCJzdWIgcmVhZHlcIiBtZXNzYWdlcy4gXCJzdWIgcmVhZHlcIiBtZXNzYWdlcyBkb24ndCB0YWtlIGVmZmVjdFxuICAgIC8vIHVudGlsIGFsbCBjdXJyZW50IHNlcnZlciBkb2N1bWVudHMgaGF2ZSBiZWVuIGZsdXNoZWQgdG8gdGhlIGxvY2FsXG4gICAgLy8gZGF0YWJhc2UuIFdlIGNhbiB1c2UgYSB3cml0ZSBmZW5jZSB0byBpbXBsZW1lbnQgdGhpcy5cblxuICAgIG1zZy5zdWJzLmZvckVhY2goKHN1YklkKSA9PiB7XG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdWJSZWNvcmQgPSBzZWxmLl9zdWJzY3JpcHRpb25zW3N1YklkXTtcbiAgICAgICAgLy8gRGlkIHdlIGFscmVhZHkgdW5zdWJzY3JpYmU/XG4gICAgICAgIGlmICghc3ViUmVjb3JkKSByZXR1cm47XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHJlY2VpdmUgYSByZWFkeSBtZXNzYWdlPyAoT29wcyEpXG4gICAgICAgIGlmIChzdWJSZWNvcmQucmVhZHkpIHJldHVybjtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2sgJiYgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2soKTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5RGVwcy5jaGFuZ2VkKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEVuc3VyZXMgdGhhdCBcImZcIiB3aWxsIGJlIGNhbGxlZCBhZnRlciBhbGwgZG9jdW1lbnRzIGN1cnJlbnRseSBpblxuICAvLyBfc2VydmVyRG9jdW1lbnRzIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS4gZiB3aWxsIG5vdCBiZSBjYWxsZWRcbiAgLy8gaWYgdGhlIGNvbm5lY3Rpb24gaXMgbG9zdCBiZWZvcmUgdGhlbiFcbiAgX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChmKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgcnVuRkFmdGVyVXBkYXRlcyA9ICgpID0+IHtcbiAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgfTtcbiAgICBsZXQgdW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPSAwO1xuICAgIGNvbnN0IG9uU2VydmVyRG9jRmx1c2ggPSAoKSA9PiB7XG4gICAgICAtLXVuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAgIC8vIFRoaXMgd2FzIHRoZSBsYXN0IGRvYyB0byBmbHVzaCEgQXJyYW5nZSB0byBydW4gZiBhZnRlciB0aGUgdXBkYXRlc1xuICAgICAgICAvLyBoYXZlIGJlZW4gYXBwbGllZC5cbiAgICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBPYmplY3QudmFsdWVzKHNlbGYuX3NlcnZlckRvY3VtZW50cykuZm9yRWFjaCgoc2VydmVyRG9jdW1lbnRzKSA9PiB7XG4gICAgICBzZXJ2ZXJEb2N1bWVudHMuZm9yRWFjaCgoc2VydmVyRG9jKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlID1cbiAgICAgICAgICBrZXlzKHNlcnZlckRvYy53cml0dGVuQnlTdHVicykuc29tZShtZXRob2RJZCA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgICAgICAgcmV0dXJuIGludm9rZXIgJiYgaW52b2tlci5zZW50TWVzc2FnZTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICBpZiAod3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICArK3VuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5wdXNoKG9uU2VydmVyRG9jRmx1c2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAodW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPT09IDApIHtcbiAgICAgIC8vIFRoZXJlIGFyZW4ndCBhbnkgYnVmZmVyZWQgZG9jcyAtLS0gd2UgY2FuIGNhbGwgZiBhcyBzb29uIGFzIHRoZSBjdXJyZW50XG4gICAgICAvLyByb3VuZCBvZiB1cGRhdGVzIGlzIGFwcGxpZWQhXG4gICAgICBydW5GQWZ0ZXJVcGRhdGVzKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX2xpdmVkYXRhX25vc3ViKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRmlyc3QgcGFzcyBpdCB0aHJvdWdoIF9saXZlZGF0YV9kYXRhLCB3aGljaCBvbmx5IHVzZXMgaXQgdG8gaGVscCBnZXRcbiAgICAvLyB0b3dhcmRzIHF1aWVzY2VuY2UuXG4gICAgYXdhaXQgc2VsZi5fbGl2ZWRhdGFfZGF0YShtc2cpO1xuXG4gICAgLy8gRG8gdGhlIHJlc3Qgb2Ygb3VyIHByb2Nlc3NpbmcgaW1tZWRpYXRlbHksIHdpdGggbm9cbiAgICAvLyBidWZmZXJpbmctdW50aWwtcXVpZXNjZW5jZS5cblxuICAgIC8vIHdlIHdlcmVuJ3Qgc3ViYmVkIGFueXdheSwgb3Igd2UgaW5pdGlhdGVkIHRoZSB1bnN1Yi5cbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBtc2cuaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBjb25zdCBlcnJvckNhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLmVycm9yQ2FsbGJhY2s7XG4gICAgY29uc3Qgc3RvcENhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLnN0b3BDYWxsYmFjaztcblxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5yZW1vdmUoKTtcblxuICAgIGNvbnN0IG1ldGVvckVycm9yRnJvbU1zZyA9IG1zZ0FyZyA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBtc2dBcmcgJiZcbiAgICAgICAgbXNnQXJnLmVycm9yICYmXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmVycm9yLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5yZWFzb24sXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmRldGFpbHNcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBpZiAoZXJyb3JDYWxsYmFjayAmJiBtc2cuZXJyb3IpIHtcbiAgICAgIGVycm9yQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cblxuICAgIGlmIChzdG9wQ2FsbGJhY2spIHtcbiAgICAgIHN0b3BDYWxsYmFjayhtZXRlb3JFcnJvckZyb21Nc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX2xpdmVkYXRhX3Jlc3VsdChtc2cpIHtcbiAgICAvLyBpZCwgcmVzdWx0IG9yIGVycm9yLiBlcnJvciBoYXMgZXJyb3IgKGNvZGUpLCByZWFzb24sIGRldGFpbHNcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gTGV0cyBtYWtlIHN1cmUgdGhlcmUgYXJlIG5vIGJ1ZmZlcmVkIHdyaXRlcyBiZWZvcmUgcmV0dXJuaW5nIHJlc3VsdC5cbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX2J1ZmZlcmVkV3JpdGVzKSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgIH1cblxuICAgIC8vIGZpbmQgdGhlIG91dHN0YW5kaW5nIHJlcXVlc3RcbiAgICAvLyBzaG91bGQgYmUgTygxKSBpbiBuZWFybHkgYWxsIHJlYWxpc3RpYyB1c2UgY2FzZXNcbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ1JlY2VpdmVkIG1ldGhvZCByZXN1bHQgYnV0IG5vIG1ldGhvZHMgb3V0c3RhbmRpbmcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudE1ldGhvZEJsb2NrID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcztcbiAgICBsZXQgaTtcbiAgICBjb25zdCBtID0gY3VycmVudE1ldGhvZEJsb2NrLmZpbmQoKG1ldGhvZCwgaWR4KSA9PiB7XG4gICAgICBjb25zdCBmb3VuZCA9IG1ldGhvZC5tZXRob2RJZCA9PT0gbXNnLmlkO1xuICAgICAgaWYgKGZvdW5kKSBpID0gaWR4O1xuICAgICAgcmV0dXJuIGZvdW5kO1xuICAgIH0pO1xuICAgIGlmICghbSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkNhbid0IG1hdGNoIG1ldGhvZCByZXNwb25zZSB0byBvcmlnaW5hbCBtZXRob2QgY2FsbFwiLCBtc2cpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBmcm9tIGN1cnJlbnQgbWV0aG9kIGJsb2NrLiBUaGlzIG1heSBsZWF2ZSB0aGUgYmxvY2sgZW1wdHksIGJ1dCB3ZVxuICAgIC8vIGRvbid0IG1vdmUgb24gdG8gdGhlIG5leHQgYmxvY2sgdW50aWwgdGhlIGNhbGxiYWNrIGhhcyBiZWVuIGRlbGl2ZXJlZCwgaW5cbiAgICAvLyBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZC5cbiAgICBjdXJyZW50TWV0aG9kQmxvY2suc3BsaWNlKGksIDEpO1xuXG4gICAgaWYgKGhhc093bi5jYWxsKG1zZywgJ2Vycm9yJykpIHtcbiAgICAgIG0ucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgbmV3IE1ldGVvci5FcnJvcihtc2cuZXJyb3IuZXJyb3IsIG1zZy5lcnJvci5yZWFzb24sIG1zZy5lcnJvci5kZXRhaWxzKVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbXNnLnJlc3VsdCBtYXkgYmUgdW5kZWZpbmVkIGlmIHRoZSBtZXRob2QgZGlkbid0IHJldHVybiBhXG4gICAgICAvLyB2YWx1ZVxuICAgICAgbS5yZWNlaXZlUmVzdWx0KHVuZGVmaW5lZCwgbXNnLnJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gQ2FsbGVkIGJ5IE1ldGhvZEludm9rZXIgYWZ0ZXIgYSBtZXRob2QncyBjYWxsYmFjayBpcyBpbnZva2VkLiAgSWYgdGhpcyB3YXNcbiAgLy8gdGhlIGxhc3Qgb3V0c3RhbmRpbmcgbWV0aG9kIGluIHRoZSBjdXJyZW50IGJsb2NrLCBydW5zIHRoZSBuZXh0IGJsb2NrLiBJZlxuICAvLyB0aGVyZSBhcmUgbm8gbW9yZSBtZXRob2RzLCBjb25zaWRlciBhY2NlcHRpbmcgYSBob3QgY29kZSBwdXNoLlxuICBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkpIHJldHVybjtcblxuICAgIC8vIE5vIG1ldGhvZHMgYXJlIG91dHN0YW5kaW5nLiBUaGlzIHNob3VsZCBtZWFuIHRoYXQgdGhlIGZpcnN0IGJsb2NrIG9mXG4gICAgLy8gbWV0aG9kcyBpcyBlbXB0eS4gKE9yIGl0IG1pZ2h0IG5vdCBleGlzdCwgaWYgdGhpcyB3YXMgYSBtZXRob2QgdGhhdFxuICAgIC8vIGhhbGYtZmluaXNoZWQgYmVmb3JlIGRpc2Nvbm5lY3QvcmVjb25uZWN0LilcbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgY29uc3QgZmlyc3RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgICBpZiAoISBpc0VtcHR5KGZpcnN0QmxvY2subWV0aG9kcykpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnTm8gbWV0aG9kcyBvdXRzdGFuZGluZyBidXQgbm9uZW1wdHkgYmxvY2s6ICcgK1xuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZmlyc3RCbG9jaylcbiAgICAgICAgKTtcblxuICAgICAgLy8gU2VuZCB0aGUgb3V0c3RhbmRpbmcgbWV0aG9kcyBub3cgaW4gdGhlIGZpcnN0IGJsb2NrLlxuICAgICAgaWYgKCEgaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpXG4gICAgICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKTtcbiAgICB9XG5cbiAgICAvLyBNYXliZSBhY2NlcHQgYSBob3QgY29kZSBwdXNoLlxuICAgIHNlbGYuX21heWJlTWlncmF0ZSgpO1xuICB9XG5cbiAgLy8gU2VuZHMgbWVzc2FnZXMgZm9yIGFsbCB0aGUgbWV0aG9kcyBpbiB0aGUgZmlyc3QgYmxvY2sgaW5cbiAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLlxuICBfc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMuZm9yRWFjaChtID0+IHtcbiAgICAgIG0uc2VuZE1lc3NhZ2UoKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9saXZlZGF0YV9lcnJvcihtc2cpIHtcbiAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBlcnJvciBmcm9tIHNlcnZlcjogJywgbXNnLnJlYXNvbik7XG4gICAgaWYgKG1zZy5vZmZlbmRpbmdNZXNzYWdlKSBNZXRlb3IuX2RlYnVnKCdGb3I6ICcsIG1zZy5vZmZlbmRpbmdNZXNzYWdlKTtcbiAgfVxuXG4gIF9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcztcbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IFtdO1xuXG4gICAgc2VsZi5vblJlY29ubmVjdCAmJiBzZWxmLm9uUmVjb25uZWN0KCk7XG4gICAgRERQLl9yZWNvbm5lY3RIb29rLmVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgY2FsbGJhY2soc2VsZik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGlmIChpc0VtcHR5KG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkgcmV0dXJuO1xuXG4gICAgLy8gV2UgaGF2ZSBhdCBsZWFzdCBvbmUgYmxvY2sgd29ydGggb2Ygb2xkIG91dHN0YW5kaW5nIG1ldGhvZHMgdG8gdHJ5XG4gICAgLy8gYWdhaW4uIEZpcnN0OiBkaWQgb25SZWNvbm5lY3QgYWN0dWFsbHkgc2VuZCBhbnl0aGluZz8gSWYgbm90LCB3ZSBqdXN0XG4gICAgLy8gcmVzdG9yZSBhbGwgb3V0c3RhbmRpbmcgbWV0aG9kcyBhbmQgcnVuIHRoZSBmaXJzdCBibG9jay5cbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT0ssIHRoZXJlIGFyZSBibG9ja3Mgb24gYm90aCBzaWRlcy4gU3BlY2lhbCBjYXNlOiBtZXJnZSB0aGUgbGFzdCBibG9jayBvZlxuICAgIC8vIHRoZSByZWNvbm5lY3QgbWV0aG9kcyB3aXRoIHRoZSBmaXJzdCBibG9jayBvZiB0aGUgb3JpZ2luYWwgbWV0aG9kcywgaWZcbiAgICAvLyBuZWl0aGVyIG9mIHRoZW0gYXJlIFwid2FpdFwiIGJsb2Nrcy5cbiAgICBpZiAoISBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0ICYmXG4gICAgICAgICEgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ud2FpdCkge1xuICAgICAgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKG0gPT4ge1xuICAgICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobSk7XG5cbiAgICAgICAgLy8gSWYgdGhpcyBcImxhc3QgYmxvY2tcIiBpcyBhbHNvIHRoZSBmaXJzdCBibG9jaywgc2VuZCB0aGUgbWVzc2FnZS5cbiAgICAgICAgaWYgKHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIG0uc2VuZE1lc3NhZ2UoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgLy8gTm93IGFkZCB0aGUgcmVzdCBvZiB0aGUgb3JpZ2luYWwgYmxvY2tzIG9uLlxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goLi4ub2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpO1xuICB9XG5cbiAgLy8gV2UgY2FuIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2ggaWYgdGhlcmUgYXJlIG5vIG1ldGhvZHMgaW4gZmxpZ2h0LlxuICBfcmVhZHlUb01pZ3JhdGUoKSB7XG4gICAgcmV0dXJuIGlzRW1wdHkodGhpcy5fbWV0aG9kSW52b2tlcnMpO1xuICB9XG5cbiAgLy8gSWYgd2Ugd2VyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgc2VlIGlmIGl0J3Mgbm93IHBvc3NpYmxlIHRvIGNvbnRpbnVlLlxuICAvLyBDYWxsIHdoZW5ldmVyIHRoZSBzZXQgb2Ygb3V0c3RhbmRpbmcvYmxvY2tlZCBtZXRob2RzIHNocmlua3MuXG4gIF9tYXliZU1pZ3JhdGUoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3JldHJ5TWlncmF0ZSAmJiBzZWxmLl9yZWFkeVRvTWlncmF0ZSgpKSB7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUoKTtcbiAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgb25NZXNzYWdlKHJhd19tc2cpIHtcbiAgICBsZXQgbXNnO1xuICAgIHRyeSB7XG4gICAgICBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnRXhjZXB0aW9uIHdoaWxlIHBhcnNpbmcgRERQJywgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIHNlcnZlciBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAodGhpcy5faGVhcnRiZWF0KSB7XG4gICAgICB0aGlzLl9oZWFydGJlYXQubWVzc2FnZVJlY2VpdmVkKCk7XG4gICAgfVxuXG4gICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgaWYoIW1zZyB8fCAhbXNnLnRlc3RNZXNzYWdlT25Db25uZWN0KSB7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhtc2cpLmxlbmd0aCA9PT0gMSAmJiBtc2cuc2VydmVyX2lkKSByZXR1cm47XG4gICAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgaW52YWxpZCBsaXZlZGF0YSBtZXNzYWdlJywgbXNnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobXNnLm1zZyA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIHRoaXMuX3ZlcnNpb24gPSB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbjtcbiAgICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX2Nvbm5lY3RlZChtc2cpO1xuICAgICAgdGhpcy5vcHRpb25zLm9uQ29ubmVjdGVkKCk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnZmFpbGVkJykge1xuICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zLmluZGV4T2YobXNnLnZlcnNpb24pID49IDApIHtcbiAgICAgICAgdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb24gPSBtc2cudmVyc2lvbjtcbiAgICAgICAgdGhpcy5fc3RyZWFtLnJlY29ubmVjdCh7IF9mb3JjZTogdHJ1ZSB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID1cbiAgICAgICAgICAnRERQIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbGVkOyBzZXJ2ZXIgcmVxdWVzdGVkIHZlcnNpb24gJyArXG4gICAgICAgICAgbXNnLnZlcnNpb247XG4gICAgICAgIHRoaXMuX3N0cmVhbS5kaXNjb25uZWN0KHsgX3Blcm1hbmVudDogdHJ1ZSwgX2Vycm9yOiBkZXNjcmlwdGlvbiB9KTtcbiAgICAgICAgdGhpcy5vcHRpb25zLm9uRERQVmVyc2lvbk5lZ290aWF0aW9uRmFpbHVyZShkZXNjcmlwdGlvbik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncGluZycgJiYgdGhpcy5vcHRpb25zLnJlc3BvbmRUb1BpbmdzKSB7XG4gICAgICB0aGlzLl9zZW5kKHsgbXNnOiAncG9uZycsIGlkOiBtc2cuaWQgfSk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncG9uZycpIHtcbiAgICAgIC8vIG5vb3AsIGFzIHdlIGFzc3VtZSBldmVyeXRoaW5nJ3MgYSBwb25nXG4gICAgfSBlbHNlIGlmIChcbiAgICAgIFsnYWRkZWQnLCAnY2hhbmdlZCcsICdyZW1vdmVkJywgJ3JlYWR5JywgJ3VwZGF0ZWQnXS5pbmNsdWRlcyhtc2cubXNnKVxuICAgICkge1xuICAgICAgYXdhaXQgdGhpcy5fbGl2ZWRhdGFfZGF0YShtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ25vc3ViJykge1xuICAgICAgYXdhaXQgdGhpcy5fbGl2ZWRhdGFfbm9zdWIobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdyZXN1bHQnKSB7XG4gICAgICBhd2FpdCB0aGlzLl9saXZlZGF0YV9yZXN1bHQobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdlcnJvcicpIHtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX2Vycm9yKG1zZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgdW5rbm93biBsaXZlZGF0YSBtZXNzYWdlIHR5cGUnLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIG9uUmVzZXQoKSB7XG4gICAgLy8gU2VuZCBhIGNvbm5lY3QgbWVzc2FnZSBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBzdHJlYW0uXG4gICAgLy8gTk9URTogcmVzZXQgaXMgY2FsbGVkIGV2ZW4gb24gdGhlIGZpcnN0IGNvbm5lY3Rpb24sIHNvIHRoaXMgaXNcbiAgICAvLyB0aGUgb25seSBwbGFjZSB3ZSBzZW5kIHRoaXMgbWVzc2FnZS5cbiAgICBjb25zdCBtc2cgPSB7IG1zZzogJ2Nvbm5lY3QnIH07XG4gICAgaWYgKHRoaXMuX2xhc3RTZXNzaW9uSWQpIG1zZy5zZXNzaW9uID0gdGhpcy5fbGFzdFNlc3Npb25JZDtcbiAgICBtc2cudmVyc2lvbiA9IHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uIHx8IHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zWzBdO1xuICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgbXNnLnN1cHBvcnQgPSB0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucztcbiAgICB0aGlzLl9zZW5kKG1zZyk7XG5cbiAgICAvLyBNYXJrIG5vbi1yZXRyeSBjYWxscyBhcyBmYWlsZWQuIFRoaXMgaGFzIHRvIGJlIGRvbmUgZWFybHkgYXMgZ2V0dGluZyB0aGVzZSBtZXRob2RzIG91dCBvZiB0aGVcbiAgICAvLyBjdXJyZW50IGJsb2NrIGlzIHByZXR0eSBpbXBvcnRhbnQgdG8gbWFraW5nIHN1cmUgdGhhdCBxdWllc2NlbmNlIGlzIHByb3Blcmx5IGNhbGN1bGF0ZWQsIGFzXG4gICAgLy8gd2VsbCBhcyBwb3NzaWJseSBtb3Zpbmcgb24gdG8gYW5vdGhlciB1c2VmdWwgYmxvY2suXG5cbiAgICAvLyBPbmx5IGJvdGhlciB0ZXN0aW5nIGlmIHRoZXJlIGlzIGFuIG91dHN0YW5kaW5nTWV0aG9kQmxvY2sgKHRoZXJlIG1pZ2h0IG5vdCBiZSwgZXNwZWNpYWxseSBpZlxuICAgIC8vIHdlIGFyZSBjb25uZWN0aW5nIGZvciB0aGUgZmlyc3QgdGltZS5cbiAgICBpZiAodGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID4gMCkge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gb3V0c3RhbmRpbmcgbWV0aG9kIGJsb2NrLCB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIGZpcnN0IG9uZSBhcyB0aGF0IGlzIHRoZVxuICAgICAgLy8gb25lIHRoYXQgY291bGQgaGF2ZSBhbHJlYWR5IHNlbnQgbWVzc2FnZXMgd2l0aCBubyByZXNwb25zZSwgdGhhdCBhcmUgbm90IGFsbG93ZWQgdG8gcmV0cnkuXG4gICAgICBjb25zdCBjdXJyZW50TWV0aG9kQmxvY2sgPSB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzO1xuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcyA9IGN1cnJlbnRNZXRob2RCbG9jay5maWx0ZXIoXG4gICAgICAgIG1ldGhvZEludm9rZXIgPT4ge1xuICAgICAgICAgIC8vIE1ldGhvZHMgd2l0aCAnbm9SZXRyeScgb3B0aW9uIHNldCBhcmUgbm90IGFsbG93ZWQgdG8gcmUtc2VuZCBhZnRlclxuICAgICAgICAgIC8vIHJlY292ZXJpbmcgZHJvcHBlZCBjb25uZWN0aW9uLlxuICAgICAgICAgIGlmIChtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSkge1xuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIG1ldGhvZCBpcyB0b2xkIHRoYXQgaXQgZmFpbGVkLlxuICAgICAgICAgICAgbWV0aG9kSW52b2tlci5yZWNlaXZlUmVzdWx0KFxuICAgICAgICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICAgICdpbnZvY2F0aW9uLWZhaWxlZCcsXG4gICAgICAgICAgICAgICAgJ01ldGhvZCBpbnZvY2F0aW9uIG1pZ2h0IGhhdmUgZmFpbGVkIGR1ZSB0byBkcm9wcGVkIGNvbm5lY3Rpb24uICcgK1xuICAgICAgICAgICAgICAgICAgJ0ZhaWxpbmcgYmVjYXVzZSBgbm9SZXRyeWAgb3B0aW9uIHdhcyBwYXNzZWQgdG8gTWV0ZW9yLmFwcGx5LidcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPbmx5IGtlZXAgYSBtZXRob2QgaWYgaXQgd2Fzbid0IHNlbnQgb3IgaXQncyBhbGxvd2VkIHRvIHJldHJ5LlxuICAgICAgICAgIC8vIFRoaXMgbWF5IGxlYXZlIHRoZSBibG9jayBlbXB0eSwgYnV0IHdlIGRvbid0IG1vdmUgb24gdG8gdGhlIG5leHRcbiAgICAgICAgICAvLyBibG9jayB1bnRpbCB0aGUgY2FsbGJhY2sgaGFzIGJlZW4gZGVsaXZlcmVkLCBpbiBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZC5cbiAgICAgICAgICByZXR1cm4gIShtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gTm93LCB0byBtaW5pbWl6ZSBzZXR1cCBsYXRlbmN5LCBnbyBhaGVhZCBhbmQgYmxhc3Qgb3V0IGFsbCBvZlxuICAgIC8vIG91ciBwZW5kaW5nIG1ldGhvZHMgYW5kcyBzdWJzY3JpcHRpb25zIGJlZm9yZSB3ZSd2ZSBldmVuIHRha2VuXG4gICAgLy8gdGhlIG5lY2Vzc2FyeSBSVFQgdG8ga25vdyBpZiB3ZSBzdWNjZXNzZnVsbHkgcmVjb25uZWN0ZWQuICgxKVxuICAgIC8vIFRoZXkncmUgc3VwcG9zZWQgdG8gYmUgaWRlbXBvdGVudCwgYW5kIHdoZXJlIHRoZXkgYXJlIG5vdCxcbiAgICAvLyB0aGV5IGNhbiBibG9jayByZXRyeSBpbiBhcHBseTsgKDIpIGV2ZW4gaWYgd2UgZGlkIHJlY29ubmVjdCxcbiAgICAvLyB3ZSdyZSBub3Qgc3VyZSB3aGF0IG1lc3NhZ2VzIG1pZ2h0IGhhdmUgZ290dGVuIGxvc3RcbiAgICAvLyAoaW4gZWl0aGVyIGRpcmVjdGlvbikgc2luY2Ugd2Ugd2VyZSBkaXNjb25uZWN0ZWQgKFRDUCBiZWluZ1xuICAgIC8vIHNsb3BweSBhYm91dCB0aGF0LilcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IGJsb2NrIG9mIG1ldGhvZHMgYWxsIGdvdCB0aGVpciByZXN1bHRzIChidXQgZGlkbid0IGFsbCBnZXRcbiAgICAvLyB0aGVpciBkYXRhIHZpc2libGUpLCBkaXNjYXJkIHRoZSBlbXB0eSBibG9jayBub3cuXG4gICAgaWYgKFxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID4gMCAmJlxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5sZW5ndGggPT09IDBcbiAgICApIHtcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgLy8gTWFyayBhbGwgbWVzc2FnZXMgYXMgdW5zZW50LCB0aGV5IGhhdmUgbm90IHlldCBiZWVuIHNlbnQgb24gdGhpc1xuICAgIC8vIGNvbm5lY3Rpb24uXG4gICAga2V5cyh0aGlzLl9tZXRob2RJbnZva2VycykuZm9yRWFjaChpZCA9PiB7XG4gICAgICB0aGlzLl9tZXRob2RJbnZva2Vyc1tpZF0uc2VudE1lc3NhZ2UgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8vIElmIGFuIGBvblJlY29ubmVjdGAgaGFuZGxlciBpcyBzZXQsIGNhbGwgaXQgZmlyc3QuIEdvIHRocm91Z2hcbiAgICAvLyBzb21lIGhvb3BzIHRvIGVuc3VyZSB0aGF0IG1ldGhvZHMgdGhhdCBhcmUgY2FsbGVkIGZyb20gd2l0aGluXG4gICAgLy8gYG9uUmVjb25uZWN0YCBnZXQgZXhlY3V0ZWQgX2JlZm9yZV8gb25lcyB0aGF0IHdlcmUgb3JpZ2luYWxseVxuICAgIC8vIG91dHN0YW5kaW5nIChzaW5jZSBgb25SZWNvbm5lY3RgIGlzIHVzZWQgdG8gcmUtZXN0YWJsaXNoIGF1dGhcbiAgICAvLyBjZXJ0aWZpY2F0ZXMpXG4gICAgdGhpcy5fY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCk7XG5cbiAgICAvLyBhZGQgbmV3IHN1YnNjcmlwdGlvbnMgYXQgdGhlIGVuZC4gdGhpcyB3YXkgdGhleSB0YWtlIGVmZmVjdCBhZnRlclxuICAgIC8vIHRoZSBoYW5kbGVycyBhbmQgd2UgZG9uJ3Qgc2VlIGZsaWNrZXIuXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgoW2lkLCBzdWJdKSA9PiB7XG4gICAgICB0aGlzLl9zZW5kKHtcbiAgICAgICAgbXNnOiAnc3ViJyxcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICBuYW1lOiBzdWIubmFtZSxcbiAgICAgICAgcGFyYW1zOiBzdWIucGFyYW1zXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbmltcG9ydCB7IENvbm5lY3Rpb24gfSBmcm9tICcuL2xpdmVkYXRhX2Nvbm5lY3Rpb24uanMnO1xuXG4vLyBUaGlzIGFycmF5IGFsbG93cyB0aGUgYF9hbGxTdWJzY3JpcHRpb25zUmVhZHlgIG1ldGhvZCBiZWxvdywgd2hpY2hcbi8vIGlzIHVzZWQgYnkgdGhlIGBzcGlkZXJhYmxlYCBwYWNrYWdlLCB0byBrZWVwIHRyYWNrIG9mIHdoZXRoZXIgYWxsXG4vLyBkYXRhIGlzIHJlYWR5LlxuY29uc3QgYWxsQ29ubmVjdGlvbnMgPSBbXTtcblxuLyoqXG4gKiBAbmFtZXNwYWNlIEREUFxuICogQHN1bW1hcnkgTmFtZXNwYWNlIGZvciBERFAtcmVsYXRlZCBtZXRob2RzL2NsYXNzZXMuXG4gKi9cbmV4cG9ydCBjb25zdCBERFAgPSB7fTtcblxuLy8gVGhpcyBpcyBwcml2YXRlIGJ1dCBpdCdzIHVzZWQgaW4gYSBmZXcgcGxhY2VzLiBhY2NvdW50cy1iYXNlIHVzZXNcbi8vIGl0IHRvIGdldCB0aGUgY3VycmVudCB1c2VyLiBNZXRlb3Iuc2V0VGltZW91dCBhbmQgZnJpZW5kcyBjbGVhclxuLy8gaXQuIFdlIGNhbiBwcm9iYWJseSBmaW5kIGEgYmV0dGVyIHdheSB0byBmYWN0b3IgdGhpcy5cbkREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcbkREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZSgpO1xuXG4vLyBYWFg6IEtlZXAgRERQLl9DdXJyZW50SW52b2NhdGlvbiBmb3IgYmFja3dhcmRzLWNvbXBhdGliaWxpdHkuXG5ERFAuX0N1cnJlbnRJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbjtcblxuRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbiA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZSgpO1xuXG4vLyBUaGlzIGlzIHBhc3NlZCBpbnRvIGEgd2VpcmQgYG1ha2VFcnJvclR5cGVgIGZ1bmN0aW9uIHRoYXQgZXhwZWN0cyBpdHMgdGhpbmdcbi8vIHRvIGJlIGEgY29uc3RydWN0b3JcbmZ1bmN0aW9uIGNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbn1cblxuRERQLkNvbm5lY3Rpb25FcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKFxuICAnRERQLkNvbm5lY3Rpb25FcnJvcicsXG4gIGNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yXG4pO1xuXG5ERFAuRm9yY2VkUmVjb25uZWN0RXJyb3IgPSBNZXRlb3IubWFrZUVycm9yVHlwZShcbiAgJ0REUC5Gb3JjZWRSZWNvbm5lY3RFcnJvcicsXG4gICgpID0+IHt9XG4pO1xuXG4vLyBSZXR1cm5zIHRoZSBuYW1lZCBzZXF1ZW5jZSBvZiBwc2V1ZG8tcmFuZG9tIHZhbHVlcy5cbi8vIFRoZSBzY29wZSB3aWxsIGJlIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCksIHNvIHRoZSBzdHJlYW0gd2lsbCBwcm9kdWNlXG4vLyBjb25zaXN0ZW50IHZhbHVlcyBmb3IgbWV0aG9kIGNhbGxzIG9uIHRoZSBjbGllbnQgYW5kIHNlcnZlci5cbkREUC5yYW5kb21TdHJlYW0gPSBuYW1lID0+IHtcbiAgY29uc3Qgc2NvcGUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICByZXR1cm4gRERQQ29tbW9uLlJhbmRvbVN0cmVhbS5nZXQoc2NvcGUsIG5hbWUpO1xufTtcblxuLy8gQHBhcmFtIHVybCB7U3RyaW5nfSBVUkwgdG8gTWV0ZW9yIGFwcCxcbi8vICAgICBlLmcuOlxuLy8gICAgIFwic3ViZG9tYWluLm1ldGVvci5jb21cIixcbi8vICAgICBcImh0dHA6Ly9zdWJkb21haW4ubWV0ZW9yLmNvbVwiLFxuLy8gICAgIFwiL1wiLFxuLy8gICAgIFwiZGRwK3NvY2tqczovL2RkcC0tKioqKi1mb28ubWV0ZW9yLmNvbS9zb2NranNcIlxuXG4vKipcbiAqIEBzdW1tYXJ5IENvbm5lY3QgdG8gdGhlIHNlcnZlciBvZiBhIGRpZmZlcmVudCBNZXRlb3IgYXBwbGljYXRpb24gdG8gc3Vic2NyaWJlIHRvIGl0cyBkb2N1bWVudCBzZXRzIGFuZCBpbnZva2UgaXRzIHJlbW90ZSBtZXRob2RzLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgb2YgYW5vdGhlciBNZXRlb3IgYXBwbGljYXRpb24uXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVsb2FkV2l0aE91dHN0YW5kaW5nIGlzIGl0IE9LIHRvIHJlbG9hZCBpZiB0aGVyZSBhcmUgb3V0c3RhbmRpbmcgbWV0aG9kcz9cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLmhlYWRlcnMgZXh0cmEgaGVhZGVycyB0byBzZW5kIG9uIHRoZSB3ZWJzb2NrZXRzIGNvbm5lY3Rpb24sIGZvciBzZXJ2ZXItdG8tc2VydmVyIEREUCBvbmx5XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5fc29ja2pzT3B0aW9ucyBTcGVjaWZpZXMgb3B0aW9ucyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHNvY2tqcyBjbGllbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25ERFBOZWdvdGlhdGlvblZlcnNpb25GYWlsdXJlIGNhbGxiYWNrIHdoZW4gdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlscy5cbiAqL1xuRERQLmNvbm5lY3QgPSAodXJsLCBvcHRpb25zKSA9PiB7XG4gIGNvbnN0IHJldCA9IG5ldyBDb25uZWN0aW9uKHVybCwgb3B0aW9ucyk7XG4gIGFsbENvbm5lY3Rpb25zLnB1c2gocmV0KTsgLy8gaGFjay4gc2VlIGJlbG93LlxuICByZXR1cm4gcmV0O1xufTtcblxuRERQLl9yZWNvbm5lY3RIb29rID0gbmV3IEhvb2soeyBiaW5kRW52aXJvbm1lbnQ6IGZhbHNlIH0pO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gY2FsbCBhcyB0aGUgZmlyc3Qgc3RlcCBvZlxuICogcmVjb25uZWN0aW5nLiBUaGlzIGZ1bmN0aW9uIGNhbiBjYWxsIG1ldGhvZHMgd2hpY2ggd2lsbCBiZSBleGVjdXRlZCBiZWZvcmVcbiAqIGFueSBvdGhlciBvdXRzdGFuZGluZyBtZXRob2RzLiBGb3IgZXhhbXBsZSwgdGhpcyBjYW4gYmUgdXNlZCB0byByZS1lc3RhYmxpc2hcbiAqIHRoZSBhcHByb3ByaWF0ZSBhdXRoZW50aWNhdGlvbiBjb250ZXh0IG9uIHRoZSBjb25uZWN0aW9uLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2FsbC4gSXQgd2lsbCBiZSBjYWxsZWQgd2l0aCBhXG4gKiBzaW5nbGUgYXJndW1lbnQsIHRoZSBbY29ubmVjdGlvbiBvYmplY3RdKCNkZHBfY29ubmVjdCkgdGhhdCBpcyByZWNvbm5lY3RpbmcuXG4gKi9cbkREUC5vblJlY29ubmVjdCA9IGNhbGxiYWNrID0+IEREUC5fcmVjb25uZWN0SG9vay5yZWdpc3RlcihjYWxsYmFjayk7XG5cbi8vIEhhY2sgZm9yIGBzcGlkZXJhYmxlYCBwYWNrYWdlOiBhIHdheSB0byBzZWUgaWYgdGhlIHBhZ2UgaXMgZG9uZVxuLy8gbG9hZGluZyBhbGwgdGhlIGRhdGEgaXQgbmVlZHMuXG4vL1xuRERQLl9hbGxTdWJzY3JpcHRpb25zUmVhZHkgPSAoKSA9PiBhbGxDb25uZWN0aW9ucy5ldmVyeShcbiAgY29ubiA9PiBPYmplY3QudmFsdWVzKGNvbm4uX3N1YnNjcmlwdGlvbnMpLmV2ZXJ5KHN1YiA9PiBzdWIucmVhZHkpXG4pO1xuIl19

Package["core-runtime"].queue("null", ["meteor-base", "mobile-experience", "mongo", "static-html", "reactive-var", "tracker", "standard-minifier-css", "standard-minifier-js", "es5-shim", "ecmascript", "typescript", "shell-server", "meteor", "webapp", "ddp", "hot-code-push", "launch-screen", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ddp-client", "ddp-server", "autoupdate", "reload", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports for global scope */

MongoInternals = Package.mongo.MongoInternals;
Mongo = Package.mongo.Mongo;
ReactiveVar = Package['reactive-var'].ReactiveVar;
Tracker = Package.tracker.Tracker;
Deps = Package.tracker.Deps;
ECMAScript = Package.ecmascript.ECMAScript;
Meteor = Package.meteor.Meteor;
global = Package.meteor.global;
meteorEnv = Package.meteor.meteorEnv;
EmitterPromise = Package.meteor.EmitterPromise;
WebApp = Package.webapp.WebApp;
WebAppInternals = Package.webapp.WebAppInternals;
main = Package.webapp.main;
DDP = Package['ddp-client'].DDP;
DDPServer = Package['ddp-server'].DDPServer;
LaunchScreen = Package['launch-screen'].LaunchScreen;
meteorInstall = Package.modules.meteorInstall;
Promise = Package.promise.Promise;
Autoupdate = Package.autoupdate.Autoupdate;

var require = meteorInstall({"server":{"main.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// server/main.js                                                                         //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Meteor.startup(async () => {
      console.log("hello Meteor");
      console.log(Bun.version);
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/server/main.js"
  ]
}});

//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvc2VydmVyL21haW4uanMiXSwibmFtZXMiOlsiTWV0ZW9yIiwibW9kdWxlIiwibGluayIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsInN0YXJ0dXAiLCJjb25zb2xlIiwibG9nIiwiQnVuIiwidmVyc2lvbiIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsTUFBTTtJQUFDQyxNQUFNLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQ0YsTUFBTUEsQ0FBQ0csQ0FBQyxFQUFDO1FBQUNILE1BQU0sR0FBQ0csQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBRTVISixNQUFNLENBQUNLLE9BQU8sQ0FBQyxZQUFZO01BQ3pCQyxPQUFPLENBQUNDLEdBQUcsQ0FBQyxjQUFjLENBQUM7TUFDM0JELE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyxHQUFHLENBQUNDLE9BQU8sQ0FBQztJQUMxQixDQUFDLENBQUM7SUFBQ0Msc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRyIsImZpbGUiOiIvYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSBcIm1ldGVvci9tZXRlb3JcIjtcblxuTWV0ZW9yLnN0YXJ0dXAoYXN5bmMgKCkgPT4ge1xuICBjb25zb2xlLmxvZyhcImhlbGxvIE1ldGVvclwiKTtcbiAgY29uc29sZS5sb2coQnVuLnZlcnNpb24pO1xufSk7XG4iXX0=

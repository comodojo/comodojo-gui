(function(factory){

    var root = (typeof self == 'object' && self.self == self && self);

    if (typeof define === 'function' && define.amd) {

        define(['underscore', 'jquery', 'backbone', 'exports'], function(_, $, Backbone, exports) {

            root.Comodojo = factory(root, exports, _, $, Backbone);

        });
    } else {

        root.Comodojo = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$), root.Backbone);

    }
}(
    function(root, Comodojo, _, $, Backbone){

        // extend current config (if any)

        var config = Comodojo.config = {
            baseUrl: window.location.href,
            lang: 'en'
        };

        _.extend(config, (_.isUndefined(root.comodojoConfig) || !_.isObject(root.comodojoConfig)) ? {} : root.comodojoConfig);

        // pids provider

        var getUniqueId = function(context) {

            _.defaults(this, {context: 'global'});

            return _.uniqueId(context);

        }

        // define the REGISTRY

        var REGISTRY = {};

        REGISTRY.LIBS = {};

        REGISTRY.CSS = {};

        REGISTRY.JST = {};

        REGISTRY.router = null;

        // create the registered apps model/collections

        var RegisteredApp = Backbone.Model.extend({
            defaults: {
                name: null,
                data: null,
                type: 'user',
                routes: [],
                libraries: [],
                css: [],
                templates: []
            },
            idAttribute: 'name'
        });

        var RegisteredApps = Backbone.Collection.extend({

            model: RegisteredApp,

            has: function(name) {
                var model = this.get(name);
	            if ( _.isUndefined(model) ) {
                    return false;
                } else {
  	                return true;
                }
            }

        });

        var REGISTRY.registeredApps = new RegisteredApps();

        // create the running apps model/collections

        var RunningApp = Backbone.Model.extend({
            defaults: {
                name: null,
                pid: null,
                node: null,
                active: true,
                data: null,
            },
            idAttribute: 'pid'
        });

        var RunningApps = Backbone.Collection.extend({

            model: RunningApp,

            has: function(pid) {
                var model = this.get(pid);
	            if ( _.isUndefined(model) ) {
                    return false;
                } else {
  	                return true;
                }
            }

        });

        var REGISTRY.runningApps = new RunningApps();

        // the session, just for login and logout

        var session = Comodojo.session = {};

        session.login = function(user, pass, callback) {

            $.ajax({
                async : false,
                dataType: 'json',
                type: "POST",
                data: {
                    "action": "LOGIN",
                    "user": user,
                    "pass": pass
               },
               url : Comodojo.config.baseUrl+'login'
            }).done(function(data) {
                if ( _.isFunction(callback) ) {
                    _.delay(session.reload, 2);
                    callback(data);
                } else {
                    session.reload();
                }
            }).fail(function(jqXHR, textStatus, errorThrown){
                console.log(errorThrown);
            });

        };

        session.logout = function(callback) {

            $.ajax({
                async : false,
                dataType: 'json',
                cache: false,
                type: "POST",
                data: {
                    "action": "LOGOUT"
                },
                url : Comodojo.config.baseUrl+'auth'
            }).done(function(data) {
                if ( _.isFunction(callback) ) {
                    _.delay(session.reset, 2);
                    callback(data);
                } else {
                    session.reset();
                }
            }).fail(function(jqXHR, textStatus, errorThrown){
                console.log(errorThrown);
            });

        };

        session.reload = function() {

            location.reload(true);

        };

        session.reset = function() {

            location.href = Comodojo.config.baseUrl;

        }

        var loader = Comodojo.loader = {};

        loader.load = function(parameters) {

            var params = {
                url: '',
                type: "get",
                dataType: "text",
                cache: false,
                global: true
            };

            _.extend(params, parameters);

            return $.ajax(params);

        };

        loader.library = function(url, cache, global) {

            _.defaults(this, {cache: true, global: true});

            var def = new $.Deferred();

            if (REGISTRY.LIBS[url]) {
                return def.resolve(REGISTRY.LIBS[url]);
            }

            var ajax = loader.load({
                url: config.baseUrl+url,
                dataType: 'script',
                cache: cache,
                global: global
            });

            ajax.done(function(data, textStatus, jqXHR ) {

                REGISTRY.LIBS[url] = true;

                def.resolve(REGISTRY.LIBS[url]);

            }).fail(function( jqXHR, textStatus, errorThrown ){

                console.log(errorThrown);

                def.reject(errorThrown);

            });

            return def.promise();

        }

        loader.template = function(namespace, cache, global) {

            _.defaults(this, {cache: true, global: true});

            var def = new $.Deferred();

            if (REGISTRY.JST[namespace]) {
                return def.resolve(REGISTRY.JST[namespace]);
            }

            var ajax = loader.load({
                url: config.baseUrl+'public/html/templates/'+namespace+'.jst',
                dataType: 'text',
                cache: cache,
                global: global
            });

            ajax.done(function(data, textStatus, jqXHR ) {

                REGISTRY.JST[namespace] = _.template(data);

                def.resolve(REGISTRY.JST[namespace]);

            }).fail(function( jqXHR, textStatus, errorThrown ){

                console.log(errorThrown);

                def.reject(errorThrown);

            });

            return def.promise();

        };

        loader.css = function(url) {

            var def = new $.Deferred();

            if ( _.has(REGISTRY.CSS, url) ) {
                return def.resolve();
            }

            var link = $("<link rel='stylesheet' type='text/css' href='"+url+"'>");

            $("head").append(link);

            return def.resolve();

        };

        loader.app = function(name, cache, global) {

            var def = new $.Deferred();

            var ajax = loader.load({
                url: config.baseUrl+'public/apps/'+name+'/main.js',
                dataType: 'script',
                cache: cache,
                global: global
            });

            ajax.done(function(data, textStatus, jqXHR ) {

                REGISTRY.LIBS[url] = true;

                def.resolve(REGISTRY.LIBS[url]);

            }).fail(function( jqXHR, textStatus, errorThrown ){

                console.log(errorThrown);

                def.reject(errorThrown);

            });

            return def.promise();

        }

        var app = Comodojo.app = {};

        app.register = function(name, properties, app) {

            _.extend(properties, {
                name: name,
                data: app
            })

            return REGISTRY.registeredApps.add(properties);

        };

        app.unregister = function(name) {

            if (REGISTRY.registeredApps.has(name)) {
                return REGISTRY.registeredApps.remove(name);
            } else {
                return false;
            }

        };

        // TODO: MANAGE app destroy and workspace!

        app.isRegistered = function(name) {
            return REGISTRY.registeredApps.has(name);
        };

        app.byName = function(name) {
            return REGISTRY.runningApps.where({
                name: name
            });
        };

        app.byPid = function(pid) {
            if (REGISTRY.runningApps.has(pid)) {
                return REGISTRY.runningApps.get(pid);
            } else {
                return false;
            }
        };

        app.byNode = function(node) {
            return REGISTRY.runningApps.where({
                node: node
            });
        };

        app.start = function(name, params) {

            if (!REGISTRY.registeredApps.has(name)) {
                console.log('App is not registered');
                return false;
            }

            var application = REGISTRY.registeredApps.get(name),
                pid = getUniqueId(name),
                node = $('#main-container'),
                preload = [],
                libraries = application.get('libraries'),
                templates = application.get('templates'),
                css = application.get('css'),
                data = application.get('data');

            for (i=0; i < libraries.length; i++) {
                preload.push(loader.library(libraries[i]));
            }

            for (i=0; i < templates.length; i++) {
                preload.push(loader.template(templates[i]));
            }

            for (i=0; i < css.length; i++) {
                preload.push(loader.css(css[i]));
            }

            $.when.apply($, preload).done(function() {
                var startapp = new data;
                startapp.exec(pid, node, params);
                REGISTRY.runningApps.add({
                    name: name,
                    pid: pid,
                    node: node,
                    active: true,
                    data: startapp
                });
            });
        };

        app.pause = function(pid) {

            var application = app.byPid(pid);

            // place the app somewhere hidden

            // remove events => undelegateEvents();
            var appExec = application.get('data');

            if ( _.has(appExec, 'pause') && _.isFunction(appExec.pause) ) {
                appExec.pause();
            } else {
                appExec.stop();
            }

        };

        app.resume = function(pid) {

            var application = app.byPid(pid);

            var appExec = application.get('data');

            if ( _.has(appExec, 'resume') && _.isFunction(appExec.resume) ) {
                appExec.resume();
            }

        };

        app.stop = function(pid) {

            var application = app.byPid(pid);

            var appExec = application.get('data');

            appExec.stop();

        };

        app.kill = function(pid) {};

        var router = Comodojo.router = {};

        router.setup = function() {

            var appName, routes;

            var Router = Backbone.Router.extend({

                initialize: function() {

                    REGISTRY.registeredApps.forEach(function(application) {

                        appName = application.get('name');

                        routes = application.get('routes');

                        if ( routes.length === 0 ) {

                            this.route(appName+'(/)', appName, function() {
                                app.start(appName);
                            });

                        } else {

                            _.each(routes, function(route) {
                                this.route(appName+(route.match(/^\//) ? '' : '/')+route, appName, function() {
                                    app.start(appName, arguments);
                                });
                            });

                        }

                    });

                    REGISTRY.router = new Router();

                    Backbone.history.start();

                    return REGISTRY.router;

                }

            });



        };

        router.get = function() {
            return REGISTRY.router;
        };

        return Comodojo;

    }
));
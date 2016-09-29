define(['backbone', 'jquery'], function(Backbone, $)
{
    'use strict';

    var Router = Backbone.Router.extend(
    {
        currentRoute: null,

        execute: function(route, args, name)
        {
            var _this = this;
            var cleanupResult;
            if (_this.currentRoute !== null)
            {
                cleanupResult = _this.currentRoute.cleanup(
                {
                    nextRoute: route
                });
            }
            $.when(cleanupResult).done(function()
            {
                var previousRoute = _this.currentRoute;
                _this.currentRoute = route;
                route.exec(
                {
                    previousRoute: previousRoute,
                    args: args
                });
            });
        }
    });

    return Router;
});

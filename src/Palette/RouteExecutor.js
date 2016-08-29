define(['backbone', 'jquery', 'Palette/Entity'], function(Backbone, $, Entity)
{
    'use strict';

    var RouteExecutor = Entity.extend(
    {
        currentRoute: null,

        makeCallable: function(route)
        {
            var _this = this;
            var f = function()
            {
                var cleanupResult;
                var args = $.makeArray(arguments);
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
            };
                                    
            return f;
        }
    });

    return RouteExecutor;
});

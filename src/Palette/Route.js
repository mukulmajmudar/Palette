define(
[
    'underscore',
    'jquery',
    'Palette/Entity'
], function(_, $, Entity)
{
    'use strict';

    var Route = Entity.extend(
    {
        id: null,

        constructor: function Route(args)
        {
            // Assemble a list of classes in "this" object's route inheritance
            // hierarchy.
            this.classes = [];
            if (args.prototype !== true)
            {
                var cls = this.constructor;
                while (cls !== Route)
                {
                    this.classes.unshift(cls);
                    cls = cls.__super__.constructor;
                }
                this.classes.unshift(cls);
            }

            // If route does not have its own clean() method, add an empty 
            // method to prevent unintended inherited cleanup
            if (!this.constructor.prototype.clean || 
               this.constructor.prototype.clean === 
                   this.constructor.__super__.constructor.prototype.clean)
            {
                this.constructor.prototype.clean = function() 
                {};
            }
        },


        /** 
         * Execute this route.
         *
         * This function will conditionally call the parent's version based on 
         * the previous route. It will not always call the parent's version 
         * because in some cases that would be incorrect (e.g. see comment #1 
         * in function code below).
         */
        exec: function(args)
        {
            var _this = this;
            args._length = args._length === undefined ? 
                _this.classes.length : args._length;
            if (args._length <= 1)
            {
                return;
            }
            var previousRoute = args.previousRoute;
            var mostDerivedClass = _this.classes[args._length - 1];
            var isSameRoute = previousRoute ?
                previousRoute.constructor === mostDerivedClass : false;

            // (1) Previous route is descendant of this class no need of exec
            // both chaining and self.
            if (previousRoute instanceof mostDerivedClass && !isSameRoute)
            {
                return;
            }

            var parentOfMostDerived = _this.classes[args._length - 2];

            // Previous route is not a sibling or not a parent
            // then we need to chain the exec call.
            if (!(previousRoute instanceof parentOfMostDerived))
            {
                args._length -= 1;
                return $.when(parentOfMostDerived.prototype.exec.call(
                    _this, args)).then(function()
                    {
                        return $.when(mostDerivedClass.prototype.execute.call(
                            _this,
                            {
                                previousRoute: previousRoute,
                                urlArgs: args.args
                            }));
                    });
            }
            else
            {
                return $.when(mostDerivedClass.prototype.execute.call(_this,
                {
                    previousRoute: previousRoute,
                    urlArgs: args.args
                }));
            }
        },


        /**
         * Clean up this route.
         *
         * This function will conditionally call the parent's version based on 
         * the next route. It will not always call the parent's version because
         * in some cases that would be incorrect (e.g. see comment #1 in 
         * function code below).
         */
        cleanup: function(args)
        {
            var _this = this;
            args._length = args._length === undefined ? 
                _this.classes.length : args._length;
            if (args._length <= 1)
            {
                return;
            }
            var force = args.force === true;

            var nextRoute = args.nextRoute;
            var mostDerivedClass = _this.classes[args._length - 1];

            // (1) Next route is descendant of this class no need of 
            // cleanup both chaining and self
            if (nextRoute instanceof mostDerivedClass && !force)
            {
                return;
            }

            var parentOfMostDerived = _this.classes[args._length - 2];
            
            // Next route is not a sibling or not parent route 
            // then we need to chain the cleanup up
            if (!(nextRoute instanceof parentOfMostDerived) || force)
            {
                args._length -= 1;
                return $.when(mostDerivedClass.prototype.clean.call(
                    _this)).then(function()
                    {
                        return parentOfMostDerived.prototype
                            .cleanup.call(_this, args);
                    });
            }
            else
            {
                return mostDerivedClass.prototype.clean.call(_this, args);
            }
        },


        /**
         * Route execution method, to be implemented by subclasses. 
         *
         * No need to consider chaining here because it will be taken care of
         * by exec().
         */
        execute: function()
        {
            // Default implementation is empty
        },


        /**
         * Route cleanup method, to be implemented by subclasses. 
         *
         * No need to consider chaining here because it will be taken care of
         * by cleanup().
         */
        clean: function()
        {
            // Default implementation is empty
        }
    });


    return Route;
});

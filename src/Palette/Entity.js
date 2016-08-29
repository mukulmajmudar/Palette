define(['underscore'], function(_)
{
    'use strict';

    /**
     * Base class to help define classes and correctly set up the prototype 
     * chain for subclasses. Similar to `goog.inherits`, but uses a hash of 
     * prototype properties and class properties to be extended.
     *
     * extend class method copied from Backbone.js v1.1.2
     */
    function Entity() 
    {}

    Entity.extend = function(protoProps, staticProps)
    {
        // jscs:disable
        var parent = this;
        // jscs:enable
        var child;

        // The constructor function for the new subclass is either defined by 
        // you (the "constructor" property in your `extend` definition), or 
        // defaulted by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) 
        {
            child = protoProps.constructor;
        } 
        else
        {
            child = function() 
            { 
                return parent.apply(this, arguments); 
            };
        }

        // Add static properties to the constructor function, if supplied.
        _.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function()
        { 
            this.constructor = child; 
        };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate();

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) 
        {
            _.extend(child.prototype, protoProps);
        }

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };

    return Entity;
});

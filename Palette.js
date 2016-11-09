define('Palette/Entity',['underscore'], function(_)
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

define(
'Palette/Route',[
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

define('Palette/Router',['backbone', 'jquery'], function(Backbone, $)
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

define(
'Palette/Palette',[
    'underscore',
    'jquery',
    'require',
    'Palette/Entity'
], function(_, $, require, Entity)
{
    'use strict';

    var Palette = Entity.extend(
    {
        observer: null,

        constructor: function()
        {
            // Create mutation observer on body element
            var _this = this;

            _this.observer = new MutationObserver(function(mutations)
            {
                mutations.forEach(function(mutation)
                {
                    // For each added node
                    _.each(mutation.addedNodes, function(node)
                    {
                        _.defer(function()
                        {
                            var $node = $(node);

                            // Trigger "attached" event
                            $node.trigger('attached');

                            // Trigger on each descendant
                            $node.find('*').each(function()
                            {
                                $(this).trigger('attached');
                            });
                        });
                    });

                    // For each removed node
                    _.each(mutation.removedNodes, function(node)
                    {
                        _.defer(function()
                        {
                            // Call view destroy method if exists
                            if (node.view)
                            {
                                if (node.view.destroy)
                                {
                                    node.view.destroy();
                                }
                                delete node.view;
                            }

                            // Trigger on each descendant
                            $(node).find('*').each(function()
                            {
                                if (this.view)
                                {
                                    if (this.view.destroy)
                                    {
                                        this.view.destroy();
                                    }
                                    delete this.view;
                                }
                            });
                        });
                    });
                });
            });

            _this.observer.observe(document.body,
            {
                childList: true,
                subtree: true
            });
        },


        isAttached: function(view)
        {
            // Add element attached flag if not there (e.g. if a view is created
            // from an element on the page before mutation observer was started)
            if (view.attached === undefined)
            {
                view.attached = $.contains(document, view.el);

                // Manage attachment flag
                view.$el
                    .off('attached.Palette')
                    .on('attached.Palette', function(event)
                    {
                        view.attached = true;
                    });
            }
            return view.attached;
        },


        isRendered: function(view)
        {
            return view.rendered;
        },


        whenRendered: function(view, fn)
        {
            if (this.isRendered(view))
            {
                fn();
            }
            else
            {
                view.$el.one('rendered', fn);
            }
        },


        whenAttached: function(view, fn)
        {
            if (this.isAttached(view))
            {
                fn();
            }
            else
            {
                view.$el.one('attached', fn);
            }
        },


        whenShown: function(view, fn)
        {
            var _this = this;
            _this.whenRendered(view, function()
            {
                _this.whenAttached(view, fn);
            });
        },


        setDefaults: function(view)
        {
            var loadErrorHtml =
                '<div class="alert alert-danger" role="alert">' +
                    'There was an error loading this content.' +
                '</div>';
            var viewDefaults =
            {
                // Whether to show a loading spinner while rendering
                showRenderSpinner: false,

                templates: {},
                styleSheets: [],
                staticData: {},
                loadErrorText: null,
                loadErrorHtml: loadErrorHtml,
                templatesLoaded: false,
                styleSheetsLoaded: false,
                staticDataLoaded: false,
                $loadingSpinner: null,
                loadingSpinnerCount: 0
            };

            for (var key in viewDefaults)
            {
                if (!view[key])
                {
                    view[key] = viewDefaults[key];
                }
            }
        },


        render: function(view)
        {
            var _this = this;

            // Set default render-related arguments on the view
            _this.setDefaults(view);
            
            view.rendered = false;
            view.attached = this.isAttached(view);
            view.loadError = false;
            view.el.view = view;

            var customDestroy;
            if (view.destroy)
            {
                customDestroy = view.destroy.bind(view);
            }
            view.destroy = function()
            {
                view.stopListening();
                view.attached = false;
                if (customDestroy)
                {
                    customDestroy();
                }
            }

            var promises = [];

            // Load templates
            if (!view.templatesLoaded)
            {
                var templatePaths = view.templates;

                // Create view's own property
                view.templates = {};

                promises = promises.concat(
                    _.map(templatePaths, function(path, key)
                    {
                        if (!path)
                        {
                            return Promise.resolve();
                        }

                        // Prepend baseUrl, if any
                        if (view.baseUrl)
                        {
                            path = view.baseUrl + path;
                        }
                        return $.get(path).done(function(html)
                        {
                            view.templates[key] = html;
                        });
                    }));
            }

            // Load style sheets
            if (!view.styleSheetsLoaded)
            {
                promises = promises.concat(
                    _.map(view.styleSheets, function(styleSheet)
                    {
                        return _this.loadStyleSheet(
                            styleSheet, {baseUrl: view.baseUrl});
                    }));
            }

            // Load static data
            if (!view.staticDataLoaded)
            {
                var staticDataPaths = view.staticData;

                // Create view's own property
                view.staticData = {};

                promises = promises.concat(
                    _.map(staticDataPaths, function(url, key)
                    {
                        // Prepend baseUrl, if any
                        if (view.baseUrl)
                        {
                            url = view.baseUrl + '/' + url;
                        }
                        return $.ajax(
                        {
                            url: url,
                            dataType: 'json'
                        }).done(function(data)
                        {
                            view.staticData[key] = data;
                        });
                    }));
            }

            if (view.showRenderSpinner)
            {
                if (_this.isAttached(view))
                {
                    _this.showLoading(view);
                }
                else
                {
                    // Try again once attached
                    view.$el.one('attached', function()
                    {
                        // Show loading if not rendered
                        if (!_this.isRendered(view))
                        {
                            _this.showLoading(view);
                        }
                    });
                }
            }

            // If onShown method declared, bind to whenShown
            if (_.isFunction(view.onShown))
            {
                _this.whenShown(view, view.onShown.bind(view));
            }

            // Wait till all templates, style sheets, and static data is loaded
            return $.when.apply(null, promises)
                .then(function()
                {
                    view.templatesLoaded = view.styleSheetsLoaded =
                        view.staticDataLoaded = true;

                    // Render view
                    return $.when(view.render()).then(function()
                    {
                        view.rendered = true;
                        if (view.showRenderSpinner)
                        {
                            _this.hideLoading(view);
                        }
                        view.$el.trigger('rendered');
                    }, function()
                    {
                        if (view.showRenderSpinner)
                        {
                            _this.hideLoading(view);
                        }
                        _this.showLoadError(view);
                    });
                });
        },


        showLoading: function(view, options)
        {
            var _this = this;

            // Don't show loading spinner on erroneous views
            if (view.loadError)
            {
                return;
            }

            if (!options)
            {
                options = {};
            }

            view.hidLoading = false;

            ++view.loadingSpinnerCount;

            function doShowLoading()
            {
                // If already showing a spinner, don't do anything
                if (view.$loadingSpinner)
                {
                    // If promise given return it
                    if (options.promise)
                    {
                        return $.when(options.promise);
                    }
                    return;
                }

                // If hideLoading() was called before we got here, don't show
                // the spinner at all
                if (view.hidLoading)
                {
                    if (options.promise)
                    {
                        return $.when(options.promise);
                    }
                    return;
                }

                view.$loadingSpinner = $('<div class="plt-loadingSpinner"></div>');

                if (options.id)
                {
                    view.$loadingSpinner.attr('id', options.id);
                }
                else if (view.id)
                {
                    view.$loadingSpinner.attr(
                        'id', view.id + '-loadingSpinner');
                }

                // Position on top of the view
                var offset = view.$el.offset();
                offset.left -= parseInt(view.$el.css('margin-left'));
                offset.top -= parseInt(view.$el.css('margin-top'));
                var width = _this.getActualWidth(view.$el);
                var height = _this.getActualHeight(view.$el);
                var top = offset.top + (height / 2 - 35);
                var left = offset.left + (width / 2 - 35);
                view.$loadingSpinner.css(
                {
                    top: top,
                    left: left
                });
                $(document.body).append(view.$loadingSpinner);
                return $.when(options.promise);
            }

            // If promise given, hide after promise is done
            if (options.promise)
            {
                $.when(options.promise)
                    .always(_this.hideLoading.bind(_this, view));
            }

            if (_this.isAttached(view))
            {
                return doShowLoading();
            }
            else
            {
                var d = new $.Deferred();
                view.$el.one('attached.PaletteShowLoading', function()
                {
                    $.when(doShowLoading()).then(function()
                    {
                        d.resolve.apply(d, arguments);
                    });
                });
                return d.promise();
            }
        },


        hideLoading: function(view)
        {
            view.hidLoading = true;

            // Decrement count
            --view.loadingSpinnerCount;

            // If more requests to show loading spinner still ongoing
            // don't hide
            if (view.loadingSpinnerCount > 0)
            {
                return;
            }

            if (!view.$loadingSpinner)
            {
                return;
            }
            view.$loadingSpinner.remove();
            view.$loadingSpinner = null;
        },


        showLoadError: function(view)
        {
            this.hideLoading(view);
            if (view.showLoadError)
            {
                view.showLoadError();
            }
            else if (view.loadErrorText)
            {
                view.$el.empty().html(
                '<div class="alert alert-danger" role="alert">' +
                    view.loadErrorText +
                '</div>');
            }
            else
            {
                view.$el.empty().html(view.loadErrorHtml);
            }
            view.loadError = true;
        },


        getActualHeight: function(arg)
        {
            var $el = arg instanceof $ ? arg : $(arg);
            var height = $el.height();
            var paddingTop = parseInt($el.css('padding-top'));
            var paddingBottom = parseInt($el.css('padding-bottom'));
            var marginTop = parseInt($el.css('margin-top'));
            var marginBottom = parseInt($el.css('margin-bottom'));
            var borderTop = parseInt($el.css('border-top-width'));
            var borderBottom = parseInt($el.css('border-bottom-width'));
            return height + paddingTop + paddingBottom + marginTop + marginBottom +
                borderTop + borderBottom;
        },


        getActualWidth: function(arg)
        {
            var $el = arg instanceof $ ? arg : $(arg);
            return ($el.width() + 
                    parseInt($el.css('padding-left')) + 
                    parseInt($el.css('padding-right')) + 
                    parseInt($el.css('margin-left')) + 
                    parseInt($el.css('margin-right')) +
                    parseInt($el.css('border-left-width')) +
                    parseInt($el.css('border-right-width')));
        },


        /**
         * Append a CSS transition to an element instead of overwriting the
         * current value. This is useful if multiple CSS transitions are needed
         * simultaneously but you can't manage them from the same place 
         * (for example, if you are implementing a custom slide animation and 
         * also need to use fadeIn()).
         */
        appendCssTransition: function($el, transition, prefixedValues)
        {
            if ($el.length === 0)
            {
                return;
            }

            var camelCase = 
            {
                transition: 'transition',
                '-webkit-transition': 'WebkitTransition',
                '-moz-transition': 'MozTransition',
                '-o-transition': 'OTransition',
                '-ms-transition': 'MsTransition'
            };
            _.each(['', '-webkit-', '-moz-', '-o-', '-ms-'], function(prefix)
            {
                var value;
                var existingValue = $el[0].style[camelCase[prefix + 'transition']];
                if (existingValue === '' || existingValue === 'all 0s ease 0s' || 
                    existingValue === undefined)
                {
                    value = prefixedValues ? prefix + transition : transition;
                    $el.css(prefix + 'transition', value);
                }
                else
                {
                    value = (prefixedValues ? prefix + transition : transition);
                    if (existingValue.indexOf(value) === -1)
                    {
                        value = existingValue + ', ' + value;
                        $el.css(prefix + 'transition', value);
                    }
                }
            });
        },


        fadeIn: function($el, durationInMs)
        {
            if (durationInMs === undefined)
            {
                durationInMs = 300;
            }
            var d = new $.Deferred();
            var resolved = false;

            // Check if any of the elements doesn't have the plt-transparent class
            if ($el.not('.plt-transparent').length > 0)
            {
                $el.addClass('plt-transparent');
            }
            $el.removeClass('plt-fadedIn');

            var _this = this;
            setTimeout(function()
            {
                var cssDuration = (durationInMs / 1000).toFixed(2) + 's';
                _this.appendCssTransition(
                    $el, 'opacity ' + cssDuration + ' ease');
                $el.addClass('plt-fadedIn');
            }, 0);

            // Resolve after durationInMs (sometimes transitionend events don't 
            // fire so we just use a timeout)
            setTimeout(function()
            {
                d.resolve();
            }, durationInMs);

            var promise = d.promise();
            $el.each(function(i, el)
            {
                el._pltAnimation = promise;
            });
            promise.always(function()
            {
                resolved = true;
            });
            return promise;
        },


        fadeOut: function($el, durationInMs)
        {
            var _this = this;
            if (durationInMs === undefined)
            {
                durationInMs = 300;
            }
            var d = new $.Deferred();
            var resolved = false;

            // Check if any of the elements doesn't have the plt-fadedIn class
            if ($el.not('.plt-fadedIn').length > 0)
            {
                $el.addClass('plt-fadedIn').addClass('plt-transparent');
                var cssDuration = (durationInMs / 1000).toFixed(2) + 's';
                _this.appendCssTransition($el, 'opacity ' + cssDuration + ' ease');
            }

            setTimeout(function()
            {
                $el.removeClass('plt-fadedIn');
            }, 0);

            // Resolve after durationInMs (sometimes transitionend events don't 
            // fire so we just use a timeout)
            setTimeout(function()
            {
                d.resolve();
            }, durationInMs);

            var promise = d.promise();
            $el.each(function(i, el)
            {
                el._pltAnimation = promise;
            });
            promise.always(function()
            {
                resolved = true;
            });

            return promise;
        },


        center: function(args)
        {
            var $el, $parent, parentPosition;
            var topOffset = 0;
            var leftOffset = 0;
            var horizontal, vertical;
            if (!(args instanceof $))
            {
                var defaults = 
                {
                    $parent: args.$el.parent(),
                    parentPosition: 'relative',
                    topOffset: topOffset,
                    leftOffset: leftOffset,
                    floorTopAtZero: false,
                    horizontal: true,
                    vertical: true
                };
                args = $.extend({}, defaults, args);
                $el = args.$el;
                $parent = args.$parent;
                parentPosition = args.parentPosition;
                topOffset = args.topOffset;
                leftOffset = args.leftOffset;
                horizontal = args.horizontal;
                vertical = args.vertical;
            }
            else
            {
                $el = args;

                if ($el.length > 1)
                {
                    let _this = this;
                    $el.each(function(i, e)
                    {
                        _this.center($(e));
                    });
                    return;
                }

                $parent = $el.parent();
                parentPosition = 'relative';
                horizontal = true;
                vertical = true;
            }

            $el.css('position', 'absolute');

            // Get dimensions of element and its parent
            var elHeight = this.getActualHeight($el);
            var elWidth = this.getActualWidth($el);
            var parentHeight = this.getActualHeight($parent) - 
                parseInt($parent.css('margin-top')) -
                parseInt($parent.css('margin-bottom'));
            var parentWidth = this.getActualWidth($parent) -
                parseInt($parent.css('margin-left')) -
                parseInt($parent.css('margin-right'));

            // If parent is positioned statically, make it relative
            var parentOrigPos = $parent.css('position');
            if (parentOrigPos === '' || parentOrigPos === 'static')
            {
                $parent.css('position', parentPosition);
            }

            // Make sure $parent is actually $el's parent
            var append = true;
            $parent.children().each(function()
            {
                if (this === $el[0])
                {
                    append = false;
                }
            });
            if (append)
            {
                $parent.append($el);
            }

            // Calculate top and left positions of the element
            var top = parentHeight / 2 - (elHeight / 2) + topOffset;
            var left = parentWidth / 2 - (elWidth / 2) + leftOffset;

            if (args.floorTopAtZero && top < 0)
            {
                top = 0;
            }

            // Place element
            if (horizontal)
            {
                $el.css('left', left + 'px');
            }
            if (vertical)
            {
                $el.css('top', top + 'px');
            }
        },


        setTimeout: function(fn, ms)
        {
            var d = new $.Deferred();

            setTimeout(function()
            {
                $.when(fn()).done(function()
                {
                    d.resolve.apply(d, arguments);
                }).fail(function()
                {
                    d.reject.apply(d, arguments);
                });
            }, ms);

            return d.promise();
        },


        waitForCondition: function(cond, interval, timeout)
        {
            // Undisclosed 4th argument is the count - for internal use only
            var count = arguments[3];
            if (count === undefined)
            {
                count = 0;
            }
            if (count * interval >= timeout)
            {
                return Promise.reject();
            }

            if (cond())
            {
                return;
            }
            return this.setTimeout(this.waitForCondition.bind(
                this, cond, interval, timeout, ++count), interval);
        },


        /**
         * Adapted from http://stackoverflow.com/a/5537911/1196816
         */
        loadStyleSheet: function(styleSheet, options)
        {
            var head = document.getElementsByTagName('head')[0];

            var href = styleSheet.href;
            if (options && options.baseUrl)
            {
                href = options.baseUrl + href;
            }

            // Create the link node
            var link = document.createElement('link');
            link.setAttribute('href', href);
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('type', 'text/css');
            if (styleSheet.media)
            {
                link.setAttribute('media', styleSheet.media);
            }

            // Get the correct properties to check for depending on the browser
            var sheet, cssRules;
            if ('sheet' in link)
            {
                sheet = 'sheet';
                cssRules = 'cssRules';
            }
            else
            {
                sheet = 'styleSheet';
                cssRules = 'rules';
            }

            // Insert the link node into the DOM and start loading the style 
            // sheet
            head.appendChild(link);  

            return $.when(this.waitForCondition(
                function()
                {
                    try
                    {
                        // Check whether the style sheet has successfully loaded
                        if (link[sheet] && link[sheet][cssRules].length) 
                        { 
                            return true;
                        }
                    }
                    catch (e)
                    {
                        return false;
                    }
                }, 10, 20000))
                .fail(function()
                {
                    // Timed out, so remove link element from head
                    head.removeChild(link);
                });
        },


        require: function(targets, options)
        {
            var d = new $.Deferred();
            var required = false;
            options = $.extend(
            {
                timeout: 60000
            }, options);

            require.call(null, targets, function()
            {
                required = true;
                d.resolve.apply(d, arguments);
            });

            // Timeout
            setTimeout(function()
            {
                if (!required)
                {
                    d.reject();
                }
            }, options.timeout);

            return d.promise();
        }
    });

    return new Palette();
});

define(
'Palette/Grid/Grid',[
    'backbone',
    'Palette/Palette',
    'jquery',
    'mustache',
    'underscore'
], function(Backbone, Palette, $, Mustache, _)
{
    'use strict';

    var defaultItemTemplate = 
            '<div class="plt-gridItem">{{text}}</div>';

    var defaultLayout = 
        '<h4 class="plt-gridTitle">{{title}}</h4>' +
        '<div class="plt-grid">' +
            '{{#items}}' +
                '{{> item }}' +
            '{{/items}}' +
            '{{^items}}' +
                '<div class="plt-gridNoItems">' +
                    '{{{emptyMessage}}}' +
                '</div>' +
            '{{/items}}' +
            '<div class="plt-gridStretch"></div>' +
        '</div>';

    var Grid = Backbone.View.extend(
    {
        itemDimensions: null,
        uri: null,
        templateLambdas: null,
        title: '',
        emptyMessage: 'No items',
        showEmptyMessage: true,
        maxSpacing: 30,
        minSpacing: 5,
        singleColBottomMargin: 10,

        initialize: function(args)
        {
            // Override properties
            _.extend(this, args);
        },


        render: function()
        {
            var _this = this;

            if (_this.uri)
            {
                // TODO: Implement rendering from URI using paging
                return;
            }

            // Otherwise assume setItems() will be called with
            // all the data that will be shown in the grid; do nothing here
        },


        setItems: function(items)
        {
            var _this = this;
            var $html = $(Mustache.render(defaultLayout,
            _.extend(
            {
                title: _this.title,
                items: items,
                emptyMessage: _this.emptyMessage
            }, _this.templateLambdas),
            {
                item: _this.templates.item ? _this.templates.item :
                    defaultItemTemplate
            }));

            var $grid = $html.filter('.plt-grid');
            if (_this.templates.firstItem)
            {
                $grid.prepend(_this.templates.firstItem);
            }

            if (!_this.showEmptyMessage)
            {
                $grid.find('.plt-gridNoItems').addClass('hidden');
            }

            var $children = $grid.children()
                .not('.plt-gridStretch')
                .not('.plt-gridNoItems');
            $children.addClass('plt-gridItem');
            if (_this.itemDimensions)
            {
                $children.css(_this.itemDimensions);
            }

            _this.$el.empty().append($html);

            // Remove title element if empty
            if (!_this.title)
            {
                _this.$('.plt-gridTitle').remove();
            }
            _this.$el.trigger('itemsSet');

            // Adjust items
            Palette.whenShown(_this, _this.adjustItems.bind(_this));
        },


        adjustItems: function()
        {
            var _this = this;
            var $grid = _this.$('.plt-grid');
            $grid.find('.plt-gridSpace').remove();

            if (_this.$('.plt-gridNoItems').length > 0)
            {
                return;
            }

            // Clear margins if any
            $grid.css('margin', '');

            // Reset title margin
            _this.$('.plt-gridTitle').css('margin-bottom', '10px');

            (function doAdjustGrid()
            {
                // Remove invisible items
                _this.$('.plt-gridItem.invisible').remove();
                _this.$('.plt-gridSpace').remove();

                var elements = $grid.find('.plt-gridItem');
                if (elements.length === 0)
                {
                    return;
                }

                // Clear grid width, if any
                $grid.css('width', '');

                // Reset element bottom margins
                _.each(elements, function(el)
                {
                    $(el).css('margin-bottom', 0);
                });

                // Figure out row and column counts
                var rowTop = $(elements[0]).position().top;
                var row = 0;
                var numColumns = 0;
                _.each(elements, function(el)
                {
                    var elTop = $(el).position().top;
                    if (elTop > rowTop)
                    {
                        ++row;
                        rowTop = elTop;
                    }
                    else
                    {
                        // Count the number of columns in the grid
                        if (row === 0)
                        {
                            ++numColumns;
                        }
                    }

                    // Store row number of each element
                    el.row = row;
                });

                var $el0, spacing, margin;

                // If only one column, just add bottom margin
                if (numColumns === 1)
                {
                    elements.css('margin-bottom', _this.singleColBottomMargin);
                    return;
                }

                // If there is just one row, don't spread out the elements, just
                // float them normally
                if (row === 0)
                {
                    var gridWidth = $grid.width();
                    var newWidth = elements.length *
                        Palette.getActualWidth(elements[0]) + 10 *
                        elements.length;
                    if (newWidth < gridWidth)
                    {
                        $grid.css('width', newWidth);
                    }

                    if (elements.length < 2)
                    {
                        return;
                    }

                    // Figure out spacing between columns
                    $el0 = $(elements[0]);
                    spacing = $(elements[1]).position().left -
                        ($el0.position().left + Palette.getActualWidth($el0));

                    // If spacing is too large or too small, add margin to the
                    // grid and adjust again
                    if (spacing > _this.maxSpacing ||
                        spacing < _this.minSpacing)
                    {
                        // Add margin to the grid
                        margin = parseInt($grid.css('margin-left')) + 10;
                        $grid.css('margin-left', margin);
                        $grid.css('margin-right', margin);

                        // Remove margin from section title
                        _this.$('.plt-gridTitle').css('margin-bottom', 0);

                        // Adjust grid again
                        doAdjustGrid();

                        return;
                    }

                    return;
                }

                // Add invisible boxes at the end of last row to maintain proper
                // spacing
                var numInvisible = (row + 1) * numColumns - elements.length;
                if (numInvisible > 0)
                {
                    var $stretch = $grid.find('.plt-gridStretch');
                    _.each(_.range(numInvisible), function()
                    {
                        // The "span" element is needed because we are
                        // unfortunately dependent on white space for rendering
                        // with CSS display: inline-block
                        $('<div class="invisible plt-gridItem"></div><span ' +
                            'class="plt-gridSpace">&nbsp;</span>')
                            .insertBefore($stretch);

                        if (_this.itemDimensions)
                        {
                            $grid.find('.invisible').css(_this.itemDimensions);
                        }
                    });
                }

                //
                // There is more than 1 row, so adjust bottom margin to match
                // spacing between columns
                //

                // Figure out spacing between columns
                $el0 = $(elements[0]);
                spacing = $(elements[1]).position().left -
                    ($el0.position().left + Palette.getActualWidth($el0));

                // If spacing is too large or too small, add margin to the grid
                // and
                // adjust again
                if (spacing > 0 && (spacing > _this.maxSpacing || spacing <
                                    _this.minSpacing))
                {
                    // Add margin to the grid
                    margin = parseInt($grid.css('margin-left')) + 10;
                    $grid.css('margin-left', margin);
                    $grid.css('margin-right', margin);

                    // Remove margin from section title
                    _this.$('.plt-gridTitle').css('margin-bottom', 0);

                    // Adjust grid again
                    doAdjustGrid();

                    return;
                }

                // Adjust bottom margin for each element to match column spacing
                _.each(elements, function(el)
                {
                    if (el.row === row)
                    {
                        $(el).css('margin-bottom', 0);
                    }
                    else
                    {
                        $(el).css('margin-bottom', spacing);
                    }
                });

                // Set grid vertical margins
                $grid.css('margin-top', spacing / 2);
                $grid.css('margin-bottom', spacing);
                _this.$el.trigger('gridMarginsChanged', {grid: _this});

                // Remove margin from section title
                _this.$('.plt-gridTitle').css('margin-bottom', 0);

                // Re-adjust the grid if it is resized
                // $grid.off('resize').on('resize', doAdjustGrid);
            })();

            // Adjust for variable heights
            _.defer(_this.adjustForVarHeights.bind(_this));
        },


        adjustForVarHeights: function()
        {
            var _this = this;
            var $items = _this.$('.plt-gridItem');

            // Assemble 2D array of items; coordinate = (row, column)
            var items2D = [];
            var rowTop = $($items[0]).position().top;
            var row = 0;
            _.each($items, function(el)
            {
                var $el = $(el);

                // Reset top value
                $el.css('top', 0);

                var elTop = $el.position().top;
                if (elTop > rowTop)
                {
                    ++row;
                    rowTop = elTop;
                }

                // Add row if necessary
                if (items2D.length < row + 1)
                {
                    items2D.push([]);
                }

                items2D[row].push(el);
            });

            var numRows = items2D.length;
            // var numCols = numRows > 0 ? items2D[0].length : 0;

            _.each(items2D, function(row, i)
            {
                // Skip last row
                if (i === numRows - 1)
                {
                    return;
                }

                // Check each column's spacing with its neighbor below it
                _.each(row, function(item, j)
                {
                    var $item = $(item);
                    var $neighborBelow = $(items2D[i + 1][j]);
                    if ($neighborBelow.length === 0)
                    {
                        return;
                    }
                    var vertSpacing = $neighborBelow.position().top -
                        ($item.position().top + Palette.getActualHeight($item));

                    // Move neighbor up
                    if (vertSpacing > 0)
                    {
                        $neighborBelow.css(
                        {
                            position: 'relative',
                            top: -1 * vertSpacing
                        });
                    }
                });
            });

            // Find first spacing item
            var $spacingItems = _this.$('.plt-gridItem.invisible');
            if ($spacingItems.length === 0)
            {
                return;
            }
            var $firstSpaceItem = $($spacingItems[0]);
            var firstSpaceTop = $firstSpaceItem.position().top;

            // If the first space is higher than any item, that item
            // needs a spacing item before it
            var spaceInserted = false;
            var $nonSpaceItems = $items.not('.invisible');
            _.each($nonSpaceItems, function(item)
            {
                if (spaceInserted)
                {
                    return;
                }
                var $item = $(item);
                if (firstSpaceTop < $item.position().top)
                {
                    $('<div class="invisible plt-gridItem"></div><span ' +
                        'class="plt-gridSpace">&nbsp;</span>')
                        .insertBefore($item);
                    spaceInserted = true;
                }
            });

            if (spaceInserted)
            {
                _this.adjustForVarHeights();
            }

            // Find actual height of the grid
            var height = _.chain($nonSpaceItems)
                .map(function(item)
                {
                    var $item = $(item);
                    return $item.position().top + Palette.getActualHeight($item);
                })
                .max();

            // Set height manually because spaces and adjustments add a lot of
            // padding
            _this.$('.plt-grid').css('height', height);
        }
    });

    return Grid;
});

define('Palette/Grid', ['Palette/Grid/Grid'], function (main) { return main; });

/**
 * @license Copyright 2016 Mukul Majmudar
 *
 * All rights reserved.
 *
 * Palette v1.0
 */

define(
'Palette',[
    'Palette/Entity',
    'Palette/Route',
    'Palette/Router',
    'Palette/Palette',
    'Palette/Grid'
], function(Entity, Route, Router, Palette, Grid)
{
    'use strict';

    return _.extend(Palette,
    {
        Entity: Entity,
        Route: Route,
        Router: Router,
        Grid: Grid
    });
});


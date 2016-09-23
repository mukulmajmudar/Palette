define(
[
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
        currentRoute: null,

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
                        // Trigger "attached" event
                        _.defer(function()
                        {
                            $(node).trigger('attached');
                        });
                    });

                    // For each removed node
                    _.each(mutation.removedNodes, function(node)
                    {
                        // Trigger "detached" event
                        _.defer(function()
                        {
                            $(node).trigger('detached');
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
                view.attached = $.contains(document.body, view.el);

                // Manage attachment flag
                view.$el
                    .off('attached.Palette')
                    .on('attached.Palette', function()
                    {
                        view.attached = true;
                    });
                view.$el
                    .off('detached.Palette')
                    .on('detached.Palette', function()
                    {
                        view.attached = false;
                    });
            }
            return view.attached;
        },


        isRendered: function(view)
        {
            return view.rendered;
        },


        setDefaults: function(view)
        {
            var viewDefaults =
            {
                // Whether to show a loading spinner while rendering
                showRenderSpinner: false,

                templates: {},
                styleSheets: [],
                staticData: {},
                loadErrorMessage: 'There was an error loading this content.',
                templatesLoaded: false,
                styleSheetsLoaded: false,
                staticDataLoaded: false,
                rendered: false,
                attached: this.isAttached(view),
                $loadingSpinner: null
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

            // Set default renderer-related arguments on the view
            _this.setDefaults(view);

            var promises = [];

            // Load templates
            if (!view.templatesLoaded)
            {
                promises = promises.concat(
                    _.map(view.templates, function(path, key)
                    {
                        if (!path)
                        {
                            return Promise.resolve();
                        }

                        // Prepend requirejs baseUrl, if any
                        if (view.context &&
                            view.context.requireJsConfig &&
                            view.context.requireJsConfig.baseUrl)
                        {
                            path = view.context.requireJsConfig.baseUrl + path;
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
                        return _this.loadStyleSheet(styleSheet, view.context);
                    }));
            }

            // Load static data
            if (!view.staticDataLoaded)
            {
                promises = promises.concat(
                    _.map(view.staticData, function(url, key)
                    {
                        // Prepend requirejs baseUrl, if any
                        if (view.context &&
                            view.context.requireJsConfig &&
                            view.context.requireJsConfig.baseUrl)
                        {
                            url = view.context.requireJsConfig.baseUrl +
                                '/' + url;
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
                        _this.hideLoading(view);
                        view.$el.trigger('rendered');
                    });
                });
        },


        showLoading: function(view, options)
        {
            var _this = this;

            // If already showing a spinner, don't do anything
            if (view.$loadingSpinner)
            {
                return;
            }

            // Make sure the view is attached
            if (!_this.isAttached(view))
            {
                if (window.console && window.console.warn)
                {
                    window.console.warn(
                        'View must be on the page for loading spinner.');
                }
                return;
            }

            view.$loadingSpinner = $('<div class="plt-loadingSpinner"></div>');

            if (options && options.id)
            {
                view.$loadingSpinner.attr('id', options.id);
            }

            // Position on top of the view
            var offset = view.$el.offset();
            var width = _this.getActualWidth(view.$el);
            var height = _this.getActualHeight(view.$el);
            view.$loadingSpinner.css(
            {
                top: offset.top + (height / 2 - 40),
                left: offset.left + (width / 2 - 40)
            });
            $(document.body).append(view.$loadingSpinner);

            // If promise given, hide after promise is done
            if (options && options.promise)
            {
                $.when(options.promise).then(
                    _this.hideLoading.bind(_this, view),
                    _this.hideLoading.bind(_this, view));
            }
        },


        hideLoading: function(view)
        {
            if (!view.$loadingSpinner)
            {
                return;
            }
            view.$loadingSpinner.remove();
            view.$loadingSpinner = null;
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
                    $el.each(function(i, e)
                    {
                        center($(e));
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
            var elHeight = getActualHeight($el);
            var elWidth = getActualWidth($el);
            var parentHeight = getActualHeight($parent) - 
                parseInt($parent.css('margin-top')) -
                parseInt($parent.css('margin-bottom'));
            var parentWidth = getActualWidth($parent) -
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
                null, cond, interval, timeout, ++count), interval);
        },


        /**
         * Adapted from http://stackoverflow.com/a/5537911/1196816
         */
        loadStyleSheet: function(styleSheet, options)
        {
            var head = document.getElementsByTagName('head')[0];

            var href = styleSheet.href;
            if (options && options.requireJsConfig &&
               options.requireJsConfig.baseUrl)
            {
                href = options.requireJsConfig.baseUrl + href;
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
        },


        /**
         * Use to transform a Palette.Route instance into a callable to pass it
         * to a Backbone router.
         */
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

    return new Palette();
});

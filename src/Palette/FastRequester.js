define(
[
    'Palette/Entity',
    'underscore',
    'jquery'
], function(Entity, _, $)
{
    'use strict';

    var FastRequester = Entity.extend(
    {
        request: function(args, options)
        {
            options = _.extend(
            {
                httpRequestFn: $.ajax
            }, options);

            if (args.method &&
                (args.method !== 'GET' || args.method === 'HEAD'))
            {
                throw new Error(
                    'FastRequester only supports GET and HEAD requests');
            }

            if (!options.onError)
            {
                throw new Error('onError callback is required.');
            }

            var cachedEtag;

            function makeActualRequest(cachedSuccess)
            {
                // Make actual request
                args.headers = _.extend({}, args.headers,
                        {'Cache-Control': 'no-cache'});
                var cacheKey = new Date().getTime();
                var origUrl = args.url;
                if (args.url.indexOf('?') === -1)
                {
                    args.url += '?fr=1&ck=' + cacheKey;
                }
                else
                {
                    args.url += '&fr=1&ck=' + cacheKey;
                }
                options.httpRequestFn(args).then(
                    function(response, textStatus, jqXHR)
                    {
                        // Mark this as the cached version
                        window.localStorage.setItem(
                            'FastRequester.cacheKey.' + origUrl,
                            cacheKey);
                        
                        // If different than the cached version,
                        // trigger the callback
                        if (jqXHR.getResponseHeader('Etag') !== cachedEtag)
                        {
                            options.onSuccess(
                                false, response, textStatus, jqXHR);
                        }
                    },
                    function(jqXHR, textStatus, errorThrown)
                    {
                        options.onError(
                            cachedSuccess, jqXHR, textStatus, errorThrown);
                    });
            }

            if (options && options.actualOnly)
            {
                makeActualRequest(false);
            }

            // Make cache-only request.
            // Most browser caches don't seem to honor max-stale
            // or only-if-cached even though the RFC says they should :-(
            // so we have to do this by conspiring with the API: we
            // request with a URL argument "fr" (fast request) to receive the
            // response with a long max-age.
            var cacheArgs = _.clone(args);
            var cacheKey = window.localStorage.getItem(
                    'FastRequester.cacheKey.' + args.url);
            if (!cacheKey)
            {
                cacheKey = new Date().getTime();
            }
            if (cacheArgs.url.indexOf('?') === -1)
            {
                cacheArgs.url += '?fr=1&ck=' + cacheKey;
            }
            else
            {
                cacheArgs.url += '&fr=1&ck=' + cacheKey;
            }
            options.httpRequestFn(cacheArgs).then(
                function(response, textStatus, jqXHR)
                {
                    cachedEtag = jqXHR.getResponseHeader('Etag');

                    // If response does not have "max-age" Cache-Control
                    // header, this API does not support FastRequester.
                    // So the assumed cached request is the actual
                    // request
                    var cacheControl = jqXHR.getResponseHeader(
                        'Cache-Control');
                    var fromCache = false;
                    if (cacheControl &&
                        cacheControl.indexOf('max-age') !== -1)
                    {
                        if (!options.cacheOnly)
                        {
                            makeActualRequest(true);
                        }
                        fromCache = true;
                    }

                    options.onSuccess(
                        fromCache, response, textStatus, jqXHR);
                },
                function(jqXHR, textStatus, errorThrown)
                {
                    // If not found in cache, wait for actual request
                    if (jqXHR.status === 504)
                    {
                        makeActualRequest(false);
                    }

                    // Forward the error back
                    options.onError(
                        false, jqXHR, textStatus, errorThrown);
                });
        }
    });

    return FastRequester;
});

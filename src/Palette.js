/**
 * @license Copyright 2016 Mukul Majmudar
 *
 * All rights reserved.
 *
 * Palette v1.0
 */

define(
[
    'Palette/Entity',
    'Palette/FastRequester',
    'Palette/Route',
    'Palette/Palette'
], function(Entity, FastRequester, Route, Palette)
{
    'use strict';

    return _.extend(Palette,
    {
        Entity: Entity,
        FastRequester: FastRequester,
        Route: Route
    });
});

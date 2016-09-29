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

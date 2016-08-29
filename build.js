({
    baseUrl: 'src',
    dir: 'build',
    modules:
    [   
        {   
            name: 'Palette',
            exclude:
            [
                'backbone',
                'jquery',
                'mustache',
                'underscore'
            ]
        }
    ],

    packages:
    [
        {name: 'Palette/Grid', main: 'Grid'},
        {name: 'Palette/Util', main: 'Util'}
    ],

    preserveLicenseComments: false,

    optimizeCss: 'standard'
})

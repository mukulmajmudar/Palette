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
        {name: 'Palette/Grid', main: 'Grid'}
    ],

    preserveLicenseComments: false,

    optimizeCss: 'standard'
})

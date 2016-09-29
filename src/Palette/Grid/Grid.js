define(
[
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
        title: null,
        emptyMessage: null,
        showEmptyMessage: null,
        maxSpacing: null,
        minSpacing: null,

        constructor: function(args)
        {
            args = _.extend(
            {
                title: '',
                emptyMessage: 'No items',
                showEmptyMessage: true,
                maxSpacing: 30,
                minSpacing: 5,
                singleColBottomMargin: 10
            }, args);

            Backbone.View.call(this, args);
            this.itemDimensions = args.itemDimensions;
            this.uri = args.uri;
            this.templateLambdas = args.templateLambdas;
            this.title = args.title;
            this.emptyMessage = args.emptyMessage;
            this.showEmptyMessage = args.showEmptyMessage;
            this.minSpacing = args.minSpacing;
            this.maxSpacing = args.maxSpacing;
            this.singleColBottomMargin = args.singleColBottomMargin;
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
            if (Palette.isAttached(_this))
            {
                _this.adjustItems();
            }
            else
            {
                _this.$el.one('attached', _this.adjustItems.bind(_this));
            }
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

            // Reset title padding
            _this.$('.plt-gridTitle').css('padding-bottom', '10px');

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

                        // Remove padding from section title
                        _this.$('.plt-gridTitle').css('padding-bottom', 0);

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

                    // Remove padding from section title
                    _this.$('.plt-gridTitle').css('padding-bottom', 0);

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

                // Remove padding from section title
                _this.$('.plt-gridTitle').css('padding-bottom', 0);

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

(function(){
	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;


	var defaultConfig = {
		//Boolean - Whether the scale should start at zero, or an order of magnitude down from the lowest value
		scaleBeginAtZero : true,

		//Boolean - Whether grid lines are shown across the chart
		scaleShowGridLines : true,

		//String - Colour of the grid lines
		scaleGridLineColor : "rgba(0,0,0,.05)",

		//Number - Width of the grid lines
		scaleGridLineWidth : 1,

		//Boolean - Whether to show horizontal lines (except X axis)
		scaleShowHorizontalLines: true,

		//Boolean - Whether to show vertical lines (except Y axis)
		scaleShowVerticalLines: true,

		//Boolean - If there is a stroke on each bar
		barShowStroke : true,

		//Number - Pixel width of the bar stroke
		barStrokeWidth : 2,

		//Number - Spacing between each of the X value sets
		barValueSpacing : 5,

		//Number - Spacing between data sets within X values
		barDatasetSpacing : 1,

		//String - Hover mode for events
		hoverMode : 'bars', // 'bar', 'dataset'

		//Function - Custom hover handler
		onHover : null,

		//String - A legend template
		legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].fillColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>"

	};


	Chart.Type.extend({
		name: "Bar",
		defaults : defaultConfig,
		initialize:  function(data){

			// Save data as a source for updating of values & methods
			this.data = data;

			//Expose options as a scope variable here so we can access it in the ScaleClass
			var options = this.options;

			this.ScaleClass = Chart.Scale.extend({
				offsetGridLines : true,
				calculateBarX : function(datasetCount, datasetIndex, barIndex){
					//Reusable method for calculating the xPosition of a given bar based on datasetIndex & width of the bar
					var xWidth = this.calculateBaseWidth(),
						xAbsolute = this.calculateX(barIndex) - (xWidth/2),
						barWidth = this.calculateBarWidth(datasetCount);

					return xAbsolute + (barWidth * datasetIndex) + (datasetIndex * options.barDatasetSpacing) + barWidth/2;
				},
				calculateBaseWidth : function(){
					return (this.calculateX(1) - this.calculateX(0)) - (2*options.barValueSpacing);
				},
				calculateBarWidth : function(datasetCount){
					//The padding between datasets is to the right of each bar, providing that there are more than 1 dataset
					var baseWidth = this.calculateBaseWidth() - ((datasetCount - 1) * options.barDatasetSpacing);

					return (baseWidth / datasetCount);
				}
			});

			//Set up tooltip events on the chart
			if (this.options.showTooltips){
				helpers.bindEvents(this, this.options.tooltipEvents, function(e){
					var active;
					if(e.type == 'mouseout'){
						return false;
					}
					if(this.options.hoverMode == 'bar'){
						active = this.getBarAtEvent(e);
						// TODO: tooltips for single items
					}
					else if(this.options.hoverMode == 'bars'){
						active = this.getBarsAtEvent(e);
					}
					else {
						// TODO: active = this.getDatasetAtEvent(e); 
					}
					
					if(this.options.onHover){
						this.options.onHover.call(this, active);
					}

					this.showTooltip(active);
				});
			}


			
			//Declare the extension of the default point, to cater for the options passed in to the constructor
			this.BarClass = Chart.Rectangle.extend({
				ctx : this.chart.ctx,
				_vm: {}
			});

			// Build Scale
			this.buildScale(data.labels);

			//Create a new bar for each piece of data
			helpers.each(this.data.datasets,function(dataset,datasetIndex){
				dataset.metaData = [];
				helpers.each(dataset.data,function(dataPoint,index){
					dataset.metaData.push(new this.BarClass());
				},this);
			},this);

			// Set defaults for bars
			this.eachBars(function(bar, index, datasetIndex){
				helpers.extend(bar, {
					width : this.scale.calculateBarWidth(this.data.datasets.length),
					x: this.scale.calculateBarX(this.data.datasets.length, datasetIndex, index),
					y: this.scale.endPoint,
				});
				// Copy to view model
				bar.save();
			}, this);

			this.update();
		},
		update : function(){

			this.scale.update();

			this.eachBars(function(bar, index, datasetIndex){
				helpers.extend(bar, {
					width : this.scale.calculateBarWidth(this.data.datasets.length),
					x: this.scale.calculateBarX(this.data.datasets.length, datasetIndex, index),
					y: this.scale.calculateY(this.data.datasets[datasetIndex].data[index]),
					value : this.data.datasets[datasetIndex].data[index],
					label : this.data.labels[index],
					datasetLabel: this.data.datasets[datasetIndex].label,
					strokeColor : this.data.datasets[datasetIndex].strokeColor,
					fillColor : this.data.datasets[datasetIndex].fillColor,
					highlightFill : this.data.datasets[datasetIndex].highlightFill || this.data.datasets[datasetIndex].fillColor,
					highlightStroke : this.data.datasets[datasetIndex].highlightStroke || this.data.datasets[datasetIndex].strokeColor,
					_start: undefined
				});
			}, this);


			this.render();
		},
		eachBars : function(callback){
			helpers.each(this.data.datasets,function(dataset, datasetIndex){
				helpers.each(dataset.metaData, callback, this, datasetIndex);
			},this);
		},
		eachValue : function(callback){
			helpers.each(this.data.datasets,function(dataset, datasetIndex){
				helpers.each(dataset.data, callback, this, datasetIndex);
			},this);
		},
		getBarsAtEvent : function(e){
			var barsArray = [],
				eventPosition = helpers.getRelativePosition(e),
				datasetIterator = function(dataset){
					barsArray.push(dataset.metaData[barIndex]);
				},
				barIndex;

			for (var datasetIndex = 0; datasetIndex < this.data.datasets.length; datasetIndex++) {
				for (barIndex = 0; barIndex < this.data.datasets[datasetIndex].metaData.length; barIndex++) {
					if (this.data.datasets[datasetIndex].metaData[barIndex].inRange(eventPosition.x,eventPosition.y)){
						helpers.each(this.data.datasets, datasetIterator);
						return barsArray;
					}
				}
			}

			return barsArray;
		},
		// Get the single bar that was clicked on
		// @return : An object containing the dataset index and bar index of the matching bar. Also contains the rectangle that was drawn
		getBarAtEvent : function(e) {
			var bar;
			var eventPosition = helpers.getRelativePosition(e);
			
			for (var datasetIndex = 0; datasetIndex < this.datasets.length; ++datasetIndex) {
				for (var barIndex = 0; barIndex < this.datasets[datasetIndex].metaData.length; ++barIndex) {
					if (this.datasets[datasetIndex].metaData[barIndex].inRange(eventPosition.x, eventPosition.y)) {
						bar = {
							rectangle : this.datasets[datasetIndex].metaData[barIndex],
							datasetIndex : datasetIndex,
							barIndex : barIndex,
						};
						return bar;
					}
				}
			}
			
			return bar;
		},
		buildScale : function(labels){
			var self = this;

			var dataTotal = function(){
				var values = [];
				self.eachValue(function(value){
					values.push(value);
				});
				return values;
			};

			var scaleOptions = {
				templateString : this.options.scaleLabel,
				height : this.chart.height,
				width : this.chart.width,
				ctx : this.chart.ctx,
				textColor : this.options.scaleFontColor,
				fontSize : this.options.scaleFontSize,
				fontStyle : this.options.scaleFontStyle,
				fontFamily : this.options.scaleFontFamily,
				valuesCount : labels.length,
				beginAtZero : this.options.scaleBeginAtZero,
				integersOnly : this.options.scaleIntegersOnly,
				calculateYRange: function(currentHeight){
					var updatedRanges = helpers.calculateScaleRange(
						dataTotal(),
						currentHeight,
						this.fontSize,
						this.beginAtZero,
						this.integersOnly
					);
					helpers.extend(this, updatedRanges);
				},
				xLabels : labels,
				font : helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
				lineWidth : this.options.scaleLineWidth,
				lineColor : this.options.scaleLineColor,
				showHorizontalLines : this.options.scaleShowHorizontalLines,
				showVerticalLines : this.options.scaleShowVerticalLines,
				gridLineWidth : (this.options.scaleShowGridLines) ? this.options.scaleGridLineWidth : 0,
				gridLineColor : (this.options.scaleShowGridLines) ? this.options.scaleGridLineColor : "rgba(0,0,0,0)",
				padding : (this.options.showScale) ? 0 : (this.options.barShowStroke) ? this.options.barStrokeWidth : 0,
				showLabels : this.options.scaleShowLabels,
				display : this.options.showScale
			};

			if (this.options.scaleOverride){
				helpers.extend(scaleOptions, {
					calculateYRange: helpers.noop,
					steps: this.options.scaleSteps,
					stepValue: this.options.scaleStepWidth,
					min: this.options.scaleStartValue,
					max: this.options.scaleStartValue + (this.options.scaleSteps * this.options.scaleStepWidth)
				});
			}

			this.scale = new this.ScaleClass(scaleOptions);
		},
		addData : function(valuesArray,label){
			//Map the values array for each of the datasets
			helpers.each(valuesArray,function(value,datasetIndex){
				//Add a new point for each piece of data, passing any required data to draw.
				this.data.datasets[datasetIndex].bars.push(new this.BarClass({
					value : value,
					label : label,
					datasetLabel: this.data.datasets[datasetIndex].label,
					x: this.scale.calculateBarX(this.data.datasets.length, datasetIndex, this.scale.valuesCount+1),
					y: this.scale.endPoint,
					width : this.scale.calculateBarWidth(this.data.datasets.length),
					base : this.scale.endPoint,
					strokeColor : this.data.datasets[datasetIndex].strokeColor,
					fillColor : this.data.datasets[datasetIndex].fillColor
				}));
			},this);

			this.scale.addXLabel(label);
			//Then re-render the chart.
			this.update();
		},
		removeData : function(){
			this.scale.removeXLabel();
			//Then re-render the chart.
			helpers.each(this.data.datasets,function(dataset){
				dataset.bars.shift();
			},this);
			this.update();
		},
		reflow : function(){
			helpers.extend(this.BarClass.prototype,{
				y: this.scale.endPoint,
				base : this.scale.endPoint
			});
			var newScaleProps = helpers.extend({
				height : this.chart.height,
				width : this.chart.width
			});
			this.scale.update(newScaleProps);
		},
		draw : function(ease){

			var easingDecimal = ease || 1;
			this.clear();

			this.scale.draw(easingDecimal);

			//Draw all the bars for each dataset
			this.eachBars(function(bar, index, datasetIndex){
				if (bar.hasValue()){
					// Update the bar basepoint
					bar.base = this.scale.endPoint;
					//Transition 
					bar.transition(['x','y','width'], easingDecimal).draw();
				}
			}, this);
		}
	});


}).call(this);

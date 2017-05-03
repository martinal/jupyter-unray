var widgets = require('jupyter-js-widgets');
var _ = require('underscore');
var ndarray = require('ndarray');


// Array serialization code copied from pythreejs by Jason Grout
var typesToArray = {
    int8: Int8Array,
    int16: Int16Array,
    int32: Int32Array,
    uint8: Uint8Array,
    uint16: Uint16Array,
    uint32: Uint32Array,
    float32: Float32Array,
    float64: Float64Array
}
var JSONToArray = function(obj, manager) {
    // obj is {shape: list, dtype: string, array: DataView}
    // return an ndarray object
    return ndarray(new typesToArray[obj.dtype](obj.buffer.buffer), obj.shape);
}
var arrayToJSON = function(obj, manager) {
    // serialize to {shape: list, dtype: string, array: buffer}
    return {shape: obj.shape, dtype: obj.dtype, buffer: obj.data}
}
var array_serialization = { deserialize: JSONToArray, serialize: arrayToJSON };


// TODO: Place in its own file or even separate module
class Unray
{
    constructor(gl) {
        this.gl = gl;
        console.log("Unray: " + gl);
    }

    log(msg) {
        console.log("Unray:  " + msg);
    }

    redraw() {
        this.log("redraw");
    }

    update_config(config) {
        this.log("update_config");
    }

    update_coordinates(coordinates) {
        this.log("update_coordinates");
    }

    update_cells(cells) {
        this.log("update_cells");
    }

    update_values(values) {
        this.log("update_values");
    }

};


// Custom Model. Custom widgets models must at least provide default values
// for model attributes, including
//
//  - `_view_name`
//  - `_view_module`
//  - `_view_module_version`
//
//  - `_model_name`
//  - `_model_module`
//  - `_model_module_version`
//
//  when different from the base class.

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
//class UnrayModel extends widgets.DOMWidgetModel {
var UnrayModel = widgets.DOMWidgetModel.extend({

    defaults: _.extend(_.result(this, 'widgets.DOMWidgetModel.prototype.defaults'), {
        _model_name : 'UnrayModel',
        _view_name : 'UnrayView',
        _model_module : 'jupyter-unray',
        _view_module : 'jupyter-unray',
        _model_module_version : '0.1.0',
        _view_module_version : '0.1.0',

        // Configuration dict
        config : {
            raymodel: "sum",
        },

        // Mesh and function data
        coordinates: ndarray(new Float32Array(), [0, 3]),
        cells: ndarray(new Uint32Array(), [0, 3]),
        values: ndarray(new Float32Array(), [0]),

        // TODO: More to come
    }) // end defaults

    //}, {
    ,

    serializers: _.extend({
        coordinates: array_serialization,
        cells: array_serialization,
        values: array_serialization,
    }, widgets.DOMWidgetModel.serializers)

});
//};


// Custom View. Renders the widget model.
class UnrayView extends widgets.DOMWidgetView {

    /* Hooks called from widget library or backbone */

    // Initialize view properties (called on initialization)
    initialize() {
        this.log("initialize");
        widgets.DOMWidgetView.prototype.initialize.apply(this, arguments);

        this.canvas = null;
        this.gl = null;
        this.unray = null;
    }

    // Render to DOM (called at least once when placed on page, not sure what the semantics are beyond that?)
    render() {
        this.log("render");
        this.setup_unray(this.el);
        //this.setup_unray_data();
        this.wire_events();

        // Schedule a
        this.schedule_redraw();
    }

    /* Internal view logic (may contain stupid parts, I don't know the widgets design very well) */

    log(msg) {
        console.log("unray view:  " + msg);
    }

    wire_events() {
        this.log("wire_events");
        this.model.on('change:config', this.config_changed, this);
        this.model.on('change:coordinates', this.coordinates_changed, this);
        this.model.on('change:cells', this.cells_changed, this);
        this.model.on('change:values', this.values_changed, this);
        this.on('animate:update', this.redraw, this);
    }

    setup_unray(elm) {
        this.log("setup_unray.");
        if (!this.canvas) {
            var canvas = document.createElement("canvas");
            elm.appendChild(canvas);
            this.canvas = canvas;
            this.log("created canvas");
        }
        if (!this.gl) {
            var gloptions = {
                antialias: false,
                depth: false,
                alpha: true,
                stencil: false,
                preserveDrawingBuffer: true,
                failIfMajorPerformanceCaveat: true,
            };
            this.gl = this.canvas.getContext("webgl2", this.gloptions);
            this.log("created webgl2 context");
        }
        if (!this.unray) {
            this.unray = new Unray(this.gl);
            this.log("created Unray instance");
        }
        this.log("leaving setup_unray.");
    }

    // TODO: pythreejs has some more sophisticated animation handlers
    schedule_redraw() {
        window.requestAnimationFrame(_.bind(this.redraw, this));
    }

    // Update canvas contents by executing gl draw calls in unray
    redraw() {
        this.log("redraw()");
        this.unray.redraw();
    }

    /* Data change handlers */

    config_changed() {
        var config = this.model.get('config');
        this.log("config changed:");
        this.log(config);
        this.unray.update_config(config);
        this.schedule_redraw();
    }

    coordinates_changed() {
        // FIXME
        var coordinates = this.model.get('coordinates');
        this.log("coordinates changed:");
        this.log(coordinates);
        this.unray.update_coordinates(coordinates);
        this.schedule_redraw();
    }

    cells_changed() {
        // FIXME
        var cells = this.model.get('cells');
        this.log("cells changed:");
        this.log(cells);
        this.unray.update_cells(cells);
        this.schedule_redraw();
    }

    values_changed() {
        // FIXME
        var values = this.model.get('values');
        this.log("values changed:");
        this.log(values);
        this.unray.update_values(values);
        this.schedule_redraw();
    }

};


module.exports = {
    UnrayModel : UnrayModel,
    UnrayView : UnrayView
};

"use strict";

import * as THREE from "three";
import * as widgets from "@jupyter-widgets/base";
import { BlackboxModel } from "jupyter-threejs";
import { getArrayFromUnion, data_union_serialization } from "jupyter-datawidgets";

//import _ from "underscore";

import { module_defaults } from "./version";
import { create_plot_state } from "./plotstate";


function getNotNull(model, key) {
    const value = model.get(key);
    if (!value) {
        console.error("Key:", key, "Model:", model);
        throw new Error(`Missing required ${key} on ${model}.`);
    }
    return value;
}

function getIdentifiedValue(parent, name) {
    const dataunion = getNotNull(parent, name);
    const value = getArrayFromUnion(dataunion).data;
    const id = dataunion.model_id || parent.model_id + "_" + name;
    return { id, value };
}


function createMeshEncoding(mesh) {
    const encoding = {};
    const data = {};

    if (!mesh) {
        throw new Error("Mesh is always required.");
    }

    const cells = getIdentifiedValue(mesh, "cells");
    if (cells.value) {
        const { id, value } = cells;
        data[id] = value;
        encoding.cells = { field: id };
    }

    const points = getIdentifiedValue(mesh, "points");
    if (points.value) {
        const { id, value } = points;
        data[id] = value;
        encoding.coordinates = { field: id };
    }

    return { encoding, data };
}

function checkMeshEncoding(encoding, data, mesh) {
    if (mesh) {
        const cells = getIdentifiedValue(mesh, "cells");
        if (cells.value) {
            const { id, value } = cells;
            if (encoding.cells.field !== id) {
                console.warn(`Mesh mismatch, cells id differ:`, encoding.cells.field, id);
            }
            if (data[id] !== value) {
                console.warn(`Mesh mismatch, cells value differ:`, data[id], value);
            }
        }
        const points = getIdentifiedValue(mesh, "points");
        if (points.value) {
            const { id, value } = points;
            if (encoding.coordinates.field !== id) {
                console.warn(`Mesh mismatch, points id differ:`, encoding.coordinates.field, id);
            }
            if (data[id] !== value) {
                console.warn(`Mesh mismatch, points value differ:`, data[id], value);
            }
        }
    }
}

function createParamsEncoding(params, channel, keys) {
    const encoding = {};
    const data = {};
    if (params) {
        const desc = {};
        for (let key of keys) {
            const value = params.get(key);
            if (value !== undefined) {
                desc[key] = value;
            }
        }
        encoding[channel] = desc;
    }
    return { encoding, data };
}

function createWireframeParamsEncoding(params) {
    const channel = "wireframe";
    const keys = ["enable", "size", "color", "opacity"];
    return createParamsEncoding(params, channel, keys);
}

function createIsovalueParamsEncoding(params) {
    const channel = "isovalues";
    const keys = ["mode", "value", "num_intervals", "spacing", "period"];
    return createParamsEncoding(params, channel, keys);
}

function createRestrictEncoding(restrict) {
    const encoding = {};
    const data = {};
    if (restrict) {
        const desc = {};

        // Top level traits
        const field = getNotNull(restrict, "field");
        const lut = restrict.get("lut");

        // Non-optional field values
        const values = getIdentifiedValue(field, "values");
        if (values.value) {
            const { id, value } = values;
            data[id] = value;
            desc.field = id;
            desc.value = restrict.get("value");
            desc.space = field.get("space");
        } else {
            throw new Error(`Missing values in field.`);
        }

        // Optional LUT
        // if (lut) {
        //     if (lut.isArrayScalarLUT) {
        //         const values = getIdentifiedValue(lut, "values");
        //         if (values.value) {
        //             const { id, value } = values;
        //             data[id] = value;
        //             desc.lut_field = id;
        //             // TODO: Handle linear/log scaled LUTs somehow:
        //             //desc.lut_space = getNotNull(lut, "space");
        //         } else {
        //             throw new Error(`Missing values in array LUT.`);
        //         }
        //     } else {
        //         throw new Error(`"Invalid scalar LUT ${lut}`);
        //     }
        // }

        encoding.indicators = desc;
    }
    return { encoding, data };
}

function createDensityConstantEncoding(density) {
    // TODO: Allow constant mapped through LUT?
    const encoding = {};
    const data = {};
    encoding.density = {
        constant: density.get("value"),
    };
    return { encoding, data };
}

function createDensityFieldEncoding(density) {
    const encoding = {};
    const data = {};

    const desc = {};

    // Top level traits
    const field = getNotNull(density, "field");
    const lut = density.get("lut");

    // Non-optional field values
    const values = getIdentifiedValue(field, "values");
    if (values.value) {
        const { id, value } = values;
        data[id] = value;
        desc.field = id;
        desc.space = field.get("space");
        // desc.range = field.get("range"); // FIXME
    } else {
        throw new Error(`Missing values in field.`);
    }

    // Optional LUT
    if (lut) {
        if (lut.isArrayScalarLUT) {
            const values = getIdentifiedValue(lut, "values");
            if (values.value) {
                const { id, value } = values;
                data[id] = value;
                desc.lut_field = id;
                // TODO: Handle linear/log scaled LUTs somehow:
                //desc.lut_space = getNotNull(lut, "space");
            } else {
                throw new Error(`Missing values in array LUT.`);
            }
        } else {
            throw new Error(`"Invalid scalar LUT ${lut}`);
        }
    }

    encoding.density = desc;
    return { encoding, data };
}

function createDensityEncoding(density) {
    if (density) {
        if (density.isScalarConstant) {
            return createDensityConstantEncoding(density);
        } else if (density.isScalarField) {
            return createDensityFieldEncoding(density);
        } else {
            throw new Error(`Invalid scalar ${density}.`);
        }
    }
    return { encoding: {}, data: {} };
}

function createEmissionConstantEncoding(color) {
    // TODO: Allow constant mapped through LUT?
    const encoding = {}
    const data = {};
    encoding.emission = {
        constant: color.get("intensity"),
        color: color.get("color"),
    };
    return { encoding, data };
}

function createEmissionFieldEncoding(color) {
    const encoding = {};
    const data = {};

    const desc = {};

    // Top level traits
    const field = getNotNull(color, "field");
    const lut = color.get("lut");

    // Non-optional field
    // color: ColorFieldModel
    // field: FieldModel
    // array: DataUnion
    const values = getIdentifiedValue(field, "values");
    if (values.value) {
        const { id, value } = values;
        data[id] = value;
        desc.field = id;
        desc.space = field.get("space");
        // desc.range = field.get("range"); // FIXME
    } else {
        throw new Error(`Missing required field values.`);
    }

    // Optional LUT
    if (lut) {
        if (lut.isArrayColorLUT) {
            const values = getIdentifiedValue(lut, "values");
            if (values.value) {
                const { id, value } = values;
                data[id] = value;
                desc.lut_field = id;
                // TODO: Handle linear/log scaled LUTs somehow:
                // desc.lut_space = getNotNull(lut, "space");
            } else {
                throw new Error(`Missing required values in ArrayColorLUT`);
            }
        } else if (lut.isNamedColorLUT) {
            const name = getNotNull(lut, "name");
            // FIXME Implement something like this using d3
            const value = getNamedColorLutArray(name);
            const id = name;
            data[id] = value;
            desc.lut_field = id;
            console.error("Named color LUT not implemented.");
        } else {
            console.error("Invalid color LUT", lut);
        }
    }

    encoding.emission = desc;
    return { encoding, data };
}

function createEmissionEncoding(color) {
    if (color) {
        if (color.isColorConstant) {
            return createEmissionConstantEncoding(color);
        } else if (color.isColorField) {
            return createEmissionFieldEncoding(color);
        } else {
            throw new Error(`Invalid color ${color}`);
        }
    }
    return { encoding: {}, data: {} };
}

function createExtinctionEncoding(extinction) {
    const encoding = { extinction: { value: extinction } };
    return { encoding };
}

function createExposureEncoding(exposure) {
    const encoding = { exposure: { value: exposure } };
    return { encoding };
}


// Merge a list of { encoding, data } objects into one
function mergeEncodings(...encodings) {
    const dst = { encoding: {}, data: {} };
    for (let src of encodings) {
        Object.assign(dst.encoding, src.encoding);
        Object.assign(dst.data, src.data);
    }
    return dst;
}


class PlotModel extends BlackboxModel {
    // Override this in every subclass
    getPlotMethod() {
        throw new Error("Missing implementation of getPlotMethod.");
    }

    // Override this in every subclass
    buildPlotEncoding() {
        throw new Error("Missing implementation of buildPlotEncoding.");
    }

    defaults() {
        return Object.assign(super.defaults(), module_defaults, {
            mesh: null,  // MeshModel
            restrict: null,  // ScalarIndicatorsModel
        });
    }

    constructThreeObject() {
        const root = new THREE.Group();
        this.plotState = create_plot_state(root, this.getPlotMethod());
        const { encoding, data } = this.buildPlotEncoding();
        this.plotState.init(encoding, data);
        return root;
    }

    updatePlotState(changed) {
        // TODO: Only update the affected parts?
        // Doing so is a bit complex and may not
        // be that important to performance, considering
        // the large objects are reused through reference
        // counting managers internally.
        const { encoding, data } = this.buildPlotEncoding();
        this.plotState.update(encoding, data);
    }

    syncToThreeObj() {
        super.syncToThreeObj();

        // Let backbone tell us which attributes have changed
        const changed = this.changedAttributes();

        // Let plotState update itself (mutates this.plotState)
        this.updatePlotState(changed);
    }
};
PlotModel.serializers = Object.assign({},
    BlackboxModel.serializers,
    {
        mesh: { deserialize: widgets.unpack_models },
        restrict: { deserialize: widgets.unpack_models },
    }
);


export
class SurfacePlotModel extends PlotModel {
    getPlotMethod() {
        return "surface";
    }

    plotDefaults() {
        return {
            color: null,  // ColorFieldModel || ColorConstantModel
            wireframe: null,  // WireframeParamsModel
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "SurfacePlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createEmissionEncoding(this.get("color")),
            createWireframeParamsEncoding(this.get("wireframe"))
        );
    }
};
SurfacePlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        color: { deserialize: widgets.unpack_models },
        wireframe: { deserialize: widgets.unpack_models },
    }
);


export
class IsosurfacePlotModel extends PlotModel {
    getPlotMethod() {
        return "isosurface";
    }

    plotDefaults() {
        return {
            color: null,  // ColorFieldModel | ColorConstantModel
            field: null,  // Field if different from color.field
            values: null,  // IsovalueParams
            // wireframe: null, // TODO: Add wireframe options
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "IsosurfacePlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createDensityEncoding(this.get("field")),
            createEmissionEncoding(this.get("color")),
            createIsovalueParamsEncoding(this.get("values"))
            //createWireframeParamsEncoding(this.get("wireframe"))
        );
    }
};
IsosurfacePlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        color: { deserialize: widgets.unpack_models },
        field: { deserialize: widgets.unpack_models },
        values: { deserialize: widgets.unpack_models },
        //wireframe: { deserialize: widgets.unpack_models },
    }
);


export
class XrayPlotModel extends PlotModel {
    getPlotMethod() {
        return "xray";
    }

    plotDefaults() {
        return {
            density: null,  // ScalarFieldModel | ScalarConstantModel
            extinction: 1.0,
            //color: "#ffffff",  // ColorConstant
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "XrayPlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createDensityEncoding(this.get("density")),
            //createEmissionConstantEncoding(this.get("color")),
            createExtinctionEncoding(this.get("extinction"))
        );
    }
};
XrayPlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        density: { deserialize: widgets.unpack_models },
        //color: { deserialize: widgets.unpack_models },
    }
);

export
class MinPlotModel extends PlotModel {
    getPlotMethod() {
        return "min";
    }

    plotDefaults() {
        return {
            color: null,  // ColorFieldModel | ColorConstantModel
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "MinPlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createEmissionEncoding(this.get("color"))
        );
    }
};
MinPlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        color: { deserialize: widgets.unpack_models },
    }
);


export
class MaxPlotModel extends PlotModel {
    getPlotMethod() {
        return "max";
    }

    plotDefaults() {
        return {
            color: null,  // ColorFieldModel | ColorConstantModel
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "MaxPlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createEmissionEncoding(this.get("color"))
        );
    }
};
MaxPlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        color: { deserialize: widgets.unpack_models },
    }
);


export
class SumPlotModel extends PlotModel {
    getPlotMethod() {
        return "sum";
    }

    plotDefaults() {
        return {
            color: null,  // ColorFieldModel | ColorConstantModel
            exposure: 0.0,
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "SumPlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createEmissionEncoding(this.get("color")),
            createExposureEncoding(this.get("exposure"))
        );
    }
};
SumPlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        color: { deserialize: widgets.unpack_models },
    }
);


export
class VolumePlotModel extends PlotModel {
    getPlotMethod() {
        return "volume";
    }

    plotDefaults() {
        return {
            density: null,  // ScalarFieldModel | ScalarConstantModel
            color: null,  // ColorFieldModel | ColorConstantModel
            extinction: 1.0,
            exposure: 0.0,
        };
    }

    defaults() {
        return Object.assign(super.defaults(), {
            _model_name : "VolumePlotModel",
            }, this.plotDefaults());
    }

    buildPlotEncoding() {
        return mergeEncodings(
            createMeshEncoding(this.get("mesh")),
            createRestrictEncoding(this.get("restrict")),
            createDensityEncoding(this.get("density")),
            createEmissionEncoding(this.get("color")),
            createExtinctionEncoding(this.get("extinction")),
            createExposureEncoding(this.get("exposure"))
        );
    }
};
VolumePlotModel.serializers = Object.assign({},
    PlotModel.serializers,
    {
        density: { deserialize: widgets.unpack_models },
        color: { deserialize: widgets.unpack_models },
    }
);
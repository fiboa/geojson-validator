const fs = require('fs');
const { isObject, loadDatatypes, loadSchema } = require('./util.js');
const template = require('../assets/template.json');

async function run(config) {
  const coreSchema = await loadSchema(config);
  const datatypes = await loadDatatypes(config.fiboaVersion);
  const schema = await createSchema(coreSchema, datatypes, config.id);
  if (config.out) {
    fs.writeFileSync(config.out, JSON.stringify(schema, null, 2));
  }
  else {
    console.log(schema);
  }
}

async function createSchema(coreSchema, datatypes, id = null) {
  const geojsonRootProperties = ['id', 'geometry', 'bbox', 'properties'];

  const geojson = {
    root: {
      required: [],
      properties: {}
    },
    properties: {
      required: [],
      properties: {}
    }
  };

  for (const key in coreSchema.properties) {
    const propSchema = coreSchema.properties[key];
    const result = convertSchema(propSchema, datatypes);

    const place = geojsonRootProperties.includes(key) ? 'root' : 'properties';
    if (result.required) {
      geojson[place].required.push(key);
    }
    geojson[place].properties[key] = result.schema;
  }

  let schema = JSON.parse(JSON.stringify(template));
  if (id) {
    schema.$id = id;
  }
  else {
    delete schema.$id;
  }

  const merge = (target, source) => {
    if (Array.isArray(target.required)) {
      for(const prop of source.required) {
        if (!target.required.includes(prop)) {
          target.required.push(prop);
        }
      }
    }
    else {
      target.required = source.required;
    }
    if (isObject(target.properties)) {
      Object.assign(target.properties, source.properties);
    }
    else {
      target.properties = source.properties;
    }
  };
  merge(schema, geojson.root);
  merge(schema.properties.properties, geojson.properties);

  return schema;
}

// merge the schema of the property into the schema for the data type if refers to
function convertSchema(propSchema, datatypes) {
  if (!isObject(propSchema) || typeof propSchema.type === 'undefined') {
    return propSchema;
  }
  else if (typeof datatypes[propSchema.type] === 'undefined') {
    throw new Error(`Unknown datatype ${propSchema.type}`);
  }

  let datatypeSchema = Object.assign({}, datatypes[propSchema.type]);

  // Allow null if the property is not required
  const required = propSchema.required;
  if (required) {
    // If required, make sure that for external schemas null is not allowed
    if (datatypeSchema.$ref) {
      datatypeSchema = {
        "allOf": [
          datatypeSchema,
          {
            "not": {
              "type": "null"
            }
          }
        ]
      };
    }
  }
  else {
    // If optional, add null data type to schema
    if (typeof datatypeSchema.type === "string") {
      datatypeSchema.type = [datatypeSchema.type, "null"];
    } else if (datatypeSchema.$ref) {
      datatypeSchema = {
        "allOf": [
          datatypeSchema,
          {
            "type": "null"
          }
        ]
      };
    } else if (Array.isArray(datatypeSchema.type)) {
      datatypeSchema.type.push("null");
    } else if (Array.isArray(datatypeSchema.oneOf)) {
      datatypeSchema.oneOf.push({ type: "null" });
    } else if (Array.isArray(datatypeSchema.anyOf)) {
      datatypeSchema.anyOf.push({ type: "null" });
    } else {
      console.warn(`Making schema ${JSON.stringify(datatypeSchema)} optional is not supported by this generator`);
    }
  }

  // Avoid conflicting statements
  if (typeof propSchema.exclusiveMaximum !== 'undefined') {
    delete datatypeSchema.maximum;
  }
  if (typeof propSchema.exclusiveMinimum !== 'undefined') {
    delete datatypeSchema.minimum;
  }
  if (typeof propSchema.maximum !== 'undefined') {
    delete datatypeSchema.exclusiveMaximum;
  }
  if (typeof propSchema.minimum !== 'undefined') {
    delete datatypeSchema.exclusiveMinimum;
  }

  // deep merge schemas
  for (const key in propSchema) {
    const value = propSchema[key];
    if (key === 'items' && isObject(value)) {
      // Merge item schemas
      const result = convertSchema(value, datatypes);
      datatypeSchema.items = Object.assign(
        {},
        datatypeSchema.items,
        result.schema
      );
    }
    else if (key === 'properties' && isObject(value.properties)) {
      // Merge schemas for all properties
      if (!isObject(datatypeSchema.properties)) {
        datatypeSchema.properties = {};
      }
      if (!Array.isArray(datatypeSchema.required)) {
        datatypeSchema.required = [];
      }
      for (const propName in value) {
        const result = convertSchema(value[propName], datatypes);
        datatypeSchema.properties[propName] = Object.assign(
          {},
          datatypeSchema.properties[propName],
          result.schema
        );
        if (result.required) {
          datatypeSchema.required.push(propName);
        }
      }
    }
    else if (!['type', 'required'].includes(key)) {
      datatypeSchema[key] = value;
    }
    // else: ignore
  }

  return {
    required,
    schema: datatypeSchema
  };
}

module.exports = { createSchema, run };
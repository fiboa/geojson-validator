const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { createSchema } = require('./create_schema.js');
const { getCollection, getFiles, isObject, loadDatatypes, loadFile, loadSchema } = require('./util.js');

const ALLOWED_EXTENSIONS = ['.json', '.geojson'];

let logger = console.log;
function setLogger(fn) {
  logger = fn;
}

// Create ajv instance for validation
function createAjv(config) {
  // Create ajv instance for JSON Schema draft 2020-12 (used by fiboa)
  const instance = new Ajv({
    allErrors: config.verbose,
    logger: config.verbose ? console : false,
    loadSchema: loadFile
  });

  // Add support for draft-07 (used by GeoJSON)
  const draft7MetaSchema = require("ajv/dist/refs/json-schema-draft-07.json")
  instance.addMetaSchema(draft7MetaSchema);

  // Add additional formats
  addFormats(instance);

  return instance;
}

function markInvalid(label, error, ext = null) {
  if (ext) {
    logger(`${label}: Extension ${ext} INVALID`);
  }
  else {
    logger(`${label}: INVALID`);
  }
  logger(error);
}

async function validateFromConfig(config) {
  const extMapping = {};
  if (Array.isArray(config.extSchema)) {
    for (const ext of config.extSchema) {
      const [url, file] = ext.split(',', 2);
      extMapping[url] = file;
    }
  }
  config.extSchema = extMapping;

  // Create ajv instance for validation
  const ajv = createAjv(config);

  // Expand folders to files
  const files = await getFiles(config.files, ALLOWED_EXTENSIONS);
  if (files.length === 0) {
    throw new Error('No files found.');
  }

  // Validate
  let count = 0;
  let validCount = 0;
  for (let file of files) {
    logger(`=== ${file} ===`);
    count++;
    // Load data
    let data;
    try {
      data = await loadFile(file);
    } catch (error) {
      markInvalid(file, error);
      continue;
    }

    if (!isObject(data)) {
      markInvalid(file, 'Must be a JSON object');
      continue;
    }

    // Load collection
    let version = config.fiboaVersion;
    let collection = await getCollection(data, config.collection, file)
    if (collection) {
      if (typeof collection.fiboa_version === 'string') {
        version = collection.fiboa_version;
        logger("fiboa version: " + collection.fiboa_version);
      }
      else {
        logger('No fiboa_version found in collection.');
      }
    }
    else {
      logger('No collection found.');
    }

    // Load datatypes
    const datatypes = await loadDatatypes(version);

    // Compile schema for validation
    const schema = await loadSchema(config.schema, version);
    const jsonSchema = await createSchema(schema, datatypes);
    const ajvValidate = await ajv.compileAsync(jsonSchema);

    let features;
    if (data.type === "Feature") {
      features = [data];
    }
    else if (data.type === "FeatureCollection") {
      features = data.features;
    }
    else if (data.type === "Collection") {
      if (config.collection && path.normalize(config.collection) !== path.normalize(file)) {
        logger(`${file}: SKIPPED (is likely a STAC Collection)`);
      }
      continue;
    }
    else {
      markInvalid(file, 'Must be a GeoJSON Feature or FeatureCollection');
      continue;
    }

    if (features.length === 0) {
      markInvalid(file, 'Must contain at least one Feature');
      continue;
    }

    // Load extensions
    const extensions = {};
    const extErrors = [];
    let extensionInfo = "none";
    if (collection && Array.isArray(collection.fiboa_extensions) && collection.fiboa_extensions.length > 0) {
      for (const ext of collection.fiboa_extensions) {
        try {
          let uri = ext;
          if (config.extSchema[ext]) {
            uri = config.extSchema[ext];
          }
          const extSchema = await loadFile(uri);
          const jsonSchema = await createSchema(extSchema, datatypes);
          extensions[ext] = await ajv.compileAsync(jsonSchema);
        } catch (error) {
          extensions[ext] = null;
          extErrors.push(`Failed to load extension ${ext}: ${error}`);
        }
      }
      extensionInfo = collection.fiboa_extensions.join(", ");
    }

    logger("fiboa extensions: " + extensionInfo);
    if (extErrors.length > 0) {
      extErrors.forEach(error => logger(error));
    }

    // Go through all features
    for (const index in features) {
      if (index > 0) {
        logger();
        count++;
      }
      const feature = features[index];
      let valid = ajvValidate(feature);
      if (valid && extErrors.length > 0) {
        valid = false;
      }

      let label = file;
      if (features.length > 1) {
        if (typeof feature.id === 'string') {
          label += ` (id: ${feature.id})`;
        }
        else {
          label += ` (index: ${index})`;
        }
      }
      if (!valid) {
        markInvalid(label, ajvValidate.errors);
      }
      else {
        for (const ext in extensions) {
          if (extensions[ext]) {
            const validExt = extensions[ext](feature);
            if (!validExt) {
              markInvalid(label, extensions[ext].errors, ext);
              valid = false;
            }
          }
          else {
            logger(`${label}: Extension ${ext} SKIPPED`);
          }
        }
        if (valid) {
          logger(`${label}: VALID`);
          validCount++;
        }
      }
    }
  }

  const invalid = count - validCount;

  return {
    count: count,
    valid: validCount,
    invalid: invalid
  };
}

module.exports = { setLogger, validateFromConfig };
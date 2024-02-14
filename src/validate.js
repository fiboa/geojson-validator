const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { createSchema } = require('./create_schema.js');
const { getFiles, isObject, loadDatatypes, loadFile, loadSchema } = require('./util.js');

const ALLOWED_EXTENSIONS = ['.json', '.geojson', '.parquet', '.geoparquet'];

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

async function validate(config) {
	console.log(`fiboa GeoJSON Validator`);
	console.log();

  // Create ajv instance for validation
  const ajv = createAjv(config);

  // Expand folders to files
  const files = await getFiles(config.files, ALLOWED_EXTENSIONS);
	if (files.length === 0) {
		throw new Error('No files found.');
	}

  // Load collection
  let collection = null;
  let version = config.fiboaVersion;
  let versionInfo = `unknown (assuming ${version})`;
  const extensions = {};
  let extensionInfo = "unknown";
  const extErrors = [];
  if (config.collection) {
    collection = await loadFile(config.collection);
    if (Array.isArray(collection.fiboa_extensions)) {
      for (const ext of collection.fiboa_extensions) {
        try {
          const extSchema = await loadFile(ext);
          const jsonSchema = await createSchema(extSchema, datatypes);
          extensions[ext] = await ajv.compileAsync(jsonSchema);
        } catch (error) {
          extensions[ext] = null;
          extErrors.push(`Failed to load extension ${ext}: ${error}`);
        }
      }
      extensionInfo = collection.fiboa_extensions.join(", ") || "none";
    }
    if (typeof collection.fiboa_version === 'string') {
      version = collection.fiboa_version;
      versionInfo = collection.fiboa_version;
    }
  }
  console.log("fiboa version: " + versionInfo);
  console.log("fiboa extensions: " + extensionInfo);
  if (extErrors.length > 0) {
    extErrors.forEach(error => console.log(error));
  }
  console.log();

  // Load datatypes
  const datatypes = await loadDatatypes(version);

  // Compile schema for validation
  const schema = await loadSchema(config);
  const jsonSchema = await createSchema(schema, datatypes);
  const ajvValidate = await ajv.compileAsync(jsonSchema);

  const markInvalid = (label, error, ext = null) => {
    if (ext) {
      console.log(`${label}: Extension ${ext} INVALID`);
    }
    else {
      console.log(`${label}: INVALID`);
    }
    console.log(error);
  };

  // Validate
  let count = 0;
  let validCount = 0;
  for(let file of files) {
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

    let features;
    if (data.type === "Feature") {
      features = [data];
    }
    else if (data.type === "FeatureCollection") {
      features = data.features;
    }
    else if (data.type === "Collection") {
      if (config.collection && path.normalize(config.collection) !== path.normalize(file)) {
        console.log(`${file}: SKIPPED (is likely a STAC Collection)`);
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
    
    for(const index in features) {
      count++;
      const feature = features[index];
      const valid = ajvValidate(feature);

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
        for(const ext in extensions) {
          if (extensions[ext]) {
            const validExt = extensions[ext](feature);
            if (!validExt) {
              markInvalid(label, extensions[ext].errors, ext);
              valid = false;
            }
          }
          else {
            console.log(`${label}: Extension ${ext} SKIPPED`);
          }
        }
        if (valid) {
          console.log(`${label}: VALID`);
          validCount++;
        }
      }
      console.log();
    }
  }

  const invalid = count - validCount;
  if (invalid === 0) {
    console.log('=== All features are VALID ===');
  }
  else if (invalid === 1) {
    console.log(`=== 1 feature is INVALID ===`);
  }
  else {
    console.log(`=== ${invalid} features are INVALID ===`);
  }
}

async function run(config) {
  config.files = config._.slice(1); // Remove the command "validate" from the files list
  try {
    await validate(config);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = { validate, run };